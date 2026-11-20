#!/usr/bin/env node
// Basen före push (#97): en `git push` av en arbetsgren spärras när grenen inte innehåller
// senaste basgrenen (`main`/`master`) från GitHub. Då syns en merge-konflikt lokalt, innan PR:en
// finns, och kontrollerna körs på samma kod som hamnar på basen. Arbetsflödet säger att basen
// mergas in före kontrollerna (skill arbetsflode, steg 3); hooken är det som gör att det blir av.
//
// PreToolUse på Bash. Hooken mergar aldrig själv: efter en merge ska kontrollerna köras om, och det
// ska tråden se och göra. Spärren säger vad som ska göras och, vid textkonflikt, vilka filer som
// krockar (`git merge-tree`, ingenting skrivs i arbetskatalogen).
//
// Släpps igenom utan kontroll: push till basen själv, taggar, `--delete`, `--tags`/`--all`/`--mirror`,
// kataloger som inte är git-repon och repon utan känd bas. Går hämtningen inte (nät, tidsgräns)
// blir det en varning i stället för en spärr; skill arbetsflode steg 6 (`mergeable_state`) fångar
// resten. Varje besked ger en rad i beskedloggen (log.mjs).

import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logBesked } from './log.mjs';

const FETCH_TIMEOUT_MS = Number(process.env.BAS_HOOK_FETCH_TIMEOUT_MS) || 20000;

/**
 * Kommandot delat i delkommandon, vart och ett som en lista ord, så att `cd x && git push` läses
 * som två. Citattecken respekteras (`cd "a;b"` är ett ord), och omdirigeringar (`2>&1`, `>fil`)
 * och `&` tas bort.
 */
export function subcommands(command) {
  const subs = [];
  let cur = [];
  let word = null;
  let quote = null;
  const endWord = () => {
    if (word !== null) cur.push(word);
    word = null;
  };
  const endSub = () => {
    endWord();
    if (cur.length) subs.push(cur);
    cur = [];
  };
  for (let i = 0; i < command.length; i++) {
    const c = command[i];
    if (quote) {
      if (c === quote) quote = null;
      else word = (word ?? '') + c;
    } else if (c === '"' || c === "'") {
      quote = c;
      word = word ?? '';
    } else if (c === '\\' && command[i + 1] === '\n') {
      i += 1; // radfortsättning
    } else if (c === '\\' && i + 1 < command.length) {
      word = (word ?? '') + command[++i];
    } else if (/\s/.test(c) && c !== '\n') {
      endWord();
    } else if (c === '\n' || c === ';' || c === '|' || c === '&' || c === '(' || c === ')') {
      // `2>&1`: `&` direkt efter `>` hör till omdirigeringen.
      if (c === '&' && word !== null && /^\d*>$/.test(word)) word += c;
      else endSub();
    } else {
      word = (word ?? '') + c;
    }
  }
  endSub();
  return subs.map((w) => {
    const kept = [];
    for (let i = 0; i < w.length; i++) {
      if (/^\d*(?:>>?|<)&?$/.test(w[i])) i += 1; // `>` fil, `2>` fil
      else if (/^\d*(?:>>?|<)/.test(w[i])) continue; // `>fil`, `2>&1`
      else kept.push(w[i]);
    }
    return kept;
  }).filter((w) => w.length);
}

const WRAPPERS = new Set(['env', 'command', 'time', 'nohup', 'exec']);

/** Delkommandots ord utan `NAMN=värde`-prefix och omslag som `env`, `command`, `time`. */
function stripPrefix(w) {
  let i = 0;
  while (i < w.length) {
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(w[i])) {
      i += 1;
    } else if (WRAPPERS.has(w[i])) {
      const wrapper = w[i];
      i += 1;
      // Omslagets egna flaggor (`env -u NAMN`, `time -p`).
      while (i < w.length && w[i].startsWith('-')) i += wrapper === 'env' && ['-u', '--unset', '-C', '--chdir'].includes(w[i]) ? 2 : 1;
    } else {
      break;
    }
  }
  return w.slice(i);
}

/**
 * Varje `git push` i kommandot: katalogen den körs i och dess argument, och om kommandot före
 * pushen mergar eller committar (då prövas läget innan det har hänt). `cd` före pushen och
 * `git -C <dir>` följs; relativa sökvägar räknas från `cwd`.
 */
export function findPushes(command, cwd) {
  const pushes = [];
  let dir = cwd;
  let mergeBefore = false;
  for (const raw of subcommands(command)) {
    const w = stripPrefix(raw);
    if (w[0] === 'cd') {
      dir = path.resolve(dir, (w[1] ?? '~').replace(/^~(?=\/|$)/, process.env.HOME ?? '~'));
      continue;
    }
    if (w[0] !== 'git') continue;
    let i = 1;
    let gitDir = dir;
    while (i < w.length && w[i].startsWith('-')) {
      if (w[i] === '-C' && w[i + 1]) {
        gitDir = path.resolve(dir, w[i + 1]);
        i += 2;
      } else if (w[i] === '-c' && w[i + 1]) {
        i += 2;
      } else {
        i += 1;
      }
    }
    if (w[i] === 'push') pushes.push({ dir: gitDir, args: w.slice(i + 1), mergeBefore });
    else if (['merge', 'commit', 'pull', 'rebase', 'cherry-pick'].includes(w[i])) mergeBefore = true;
  }
  return pushes;
}

const SKIP_FLAGS = new Set(['--tags', '--all', '--mirror', '--delete', '-d', '--prune', '--dry-run', '-n']);
const VALUE_FLAGS = new Set(['-o', '--push-option', '--repo', '--receive-pack', '--exec']);

/**
 * Tolkar argumenten till `git push`: `{ skip }` när pushen inte är en arbetsgren, annars
 * `{ remote, refspecs }` (tom lista = aktuell gren).
 */
export function parsePushArgs(args) {
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (SKIP_FLAGS.has(a)) return { skip: a };
    if (VALUE_FLAGS.has(a)) {
      i += 1;
      continue;
    }
    if (a.startsWith('-')) continue;
    positional.push(a);
  }
  const [remote = 'origin', ...refspecs] = positional;
  return { remote, refspecs };
}

function git(dir, args, timeout) {
  return spawnSync('git', args, { cwd: dir, encoding: 'utf8', timeout });
}

const ok = (dir, args) => git(dir, args).status === 0;
const out = (dir, args) => {
  const r = git(dir, args);
  return r.status === 0 ? r.stdout.trim() : '';
};

/**
 * Basgrenens namn: `origin/HEAD` om den är satt, annars GitHubs förvalda gren (`ls-remote
 * --symref`, molnklonerna har ingen `origin/HEAD`), annars `main` eller `master` som finns.
 */
export function baseBranch(dir, remote) {
  const sym = out(dir, ['symbolic-ref', '--quiet', '--short', `refs/remotes/${remote}/HEAD`]);
  if (sym.startsWith(`${remote}/`)) return sym.slice(remote.length + 1);
  const ls = git(dir, ['ls-remote', '--symref', remote, 'HEAD'], FETCH_TIMEOUT_MS);
  const m = ls.status === 0 && /^ref: refs\/heads\/(\S+)\tHEAD$/m.exec(ls.stdout);
  if (m) return m[1];
  for (const b of ['main', 'master']) {
    if (ok(dir, ['rev-parse', '--verify', '--quiet', `refs/remotes/${remote}/${b}`])) return b;
  }
  return null;
}

/** Lokal källa och målgren för en refspec; `null` när den inte är en gren (tagg, radering). */
function resolveRefspec(dir, spec) {
  const clean = spec.replace(/^\+/, '');
  if (clean.startsWith(':')) return null;
  const [src, dst = src] = clean.split(':');
  if (src.startsWith('refs/tags/') || dst.startsWith('refs/tags/')) return null;
  if (ok(dir, ['show-ref', '--verify', '--quiet', `refs/tags/${src}`])
    && !ok(dir, ['show-ref', '--verify', '--quiet', `refs/heads/${src}`])) return null;
  const target = dst === 'HEAD' ? out(dir, ['symbolic-ref', '--quiet', '--short', 'HEAD']) : dst.replace(/^refs\/heads\//, '');
  return { src, target };
}

/**
 * Prövar en push. Ger `{ beslut: 'ok' }`, `{ beslut: 'varna', text }` eller
 * `{ beslut: 'spärra', text, regel }`.
 */
export function checkPush({ dir, args, mergeBefore = false }) {
  if (!ok(dir, ['rev-parse', '--git-dir'])) return { beslut: 'ok' };
  const parsed = parsePushArgs(args);
  if (parsed.skip) return { beslut: 'ok' };
  const { remote } = parsed;

  let specs = parsed.refspecs.map((s) => resolveRefspec(dir, s)).filter(Boolean);
  if (parsed.refspecs.length === 0) {
    const current = out(dir, ['symbolic-ref', '--quiet', '--short', 'HEAD']);
    if (!current) return { beslut: 'ok' };
    specs = [{ src: current, target: current }];
  }
  if (specs.length === 0) return { beslut: 'ok' };

  const base = baseBranch(dir, remote);
  if (!base) return { beslut: 'ok' };
  specs = specs.filter((s) => s.target !== base);
  if (specs.length === 0) return { beslut: 'ok' };

  const fetch = git(dir, ['fetch', '--quiet', remote, `+refs/heads/${base}:refs/remotes/${remote}/${base}`], FETCH_TIMEOUT_MS);
  if (fetch.status !== 0) {
    const why = fetch.error?.code === 'ETIMEDOUT' ? `ingen svar inom ${FETCH_TIMEOUT_MS / 1000} s` : (fetch.stderr || '').trim().split('\n')[0];
    return {
      beslut: 'varna',
      regel: 'hamtning',
      text: `Kunde inte hämta ${remote}/${base} (${why}), så det är okontrollerat om grenen innehåller senaste ${base}. Läs mergeable_state efter pushen (arbetsflode steg 6).`,
    };
  }

  const upstream = `${remote}/${base}`;
  for (const { src } of specs) {
    if (!ok(dir, ['rev-parse', '--verify', '--quiet', `${src}^{commit}`])) continue;
    if (ok(dir, ['merge-base', '--is-ancestor', upstream, src])) continue;
    if (!ok(dir, ['merge-base', upstream, src])) {
      // Grund klon utan gemensam historik: går inte att avgöra här, och en merge skulle vägras.
      return {
        beslut: 'varna',
        regel: 'grund',
        text: `${src} och ${upstream} har ingen gemensam historik i den här klonen (grund klon?), så det är okontrollerat om grenen innehåller senaste ${base}. Kör git fetch --unshallow ${remote} som eget kommando och pröva igen, eller läs mergeable_state efter pushen.`,
      };
    }
    const tree = git(dir, ['merge-tree', '--write-tree', '--name-only', '--no-messages', src, upstream]);
    const conflicts = tree.status === 1 ? tree.stdout.trim().split('\n').slice(1).filter(Boolean) : [];
    const repo = path.basename(out(dir, ['rev-parse', '--show-toplevel']) || dir);
    const merging = ok(dir, ['rev-parse', '--verify', '--quiet', 'MERGE_HEAD']);
    const lines = [`${repo}: ${src} saknar senaste ${upstream}. Pushen är spärrad (arbetsflode steg 3).`];
    if (merging) {
      lines.push('En merge pågår: lös konflikterna och avsluta den med git commit --no-edit.');
    } else {
      lines.push('Gör så här, ett kommando i taget:', `  git fetch ${remote} ${base}`, `  git merge --no-edit ${upstream}`);
    }
    lines.push('Kör sedan repots kontroller på resultatet och pusha i ett eget kommando. Ingen rebase och ingen force-push.');
    if (mergeBefore) {
      lines.push('Hooken prövar läget innan kommandot körs, så en merge eller commit i samma kommando som pushen räknas inte.');
    }
    if (conflicts.length) {
      lines.push(`Mergen ger konflikt i: ${conflicts.slice(0, 15).join(', ')}${conflicts.length > 15 ? ' …' : ''}.`);
      lines.push('Lös enligt arbetsflode steg 6 (version och ändringslogg från basen; kod bara när båda avsikterna är tydliga, annars fråga Mats).');
    }
    return { beslut: 'spärra', regel: conflicts.length ? 'konflikt' : 'efter', text: lines.join('\n') };
  }
  return { beslut: 'ok' };
}

function main() {
  let input;
  try {
    input = JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    return;
  }
  const command = input.tool_input?.command ?? '';
  if (!/\bgit\b[\s\S]*\bpush\b/.test(command)) return;
  const cwd = input.cwd || process.cwd();

  const warnings = [];
  for (const push of findPushes(command, cwd)) {
    const res = checkPush(push);
    if (res.beslut === 'spärra') {
      logBesked('bas-fore-push', res.regel, push.dir);
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: res.text },
      }));
      return;
    }
    if (res.beslut === 'varna') {
      logBesked('bas-fore-push', res.regel, push.dir);
      warnings.push(res.text);
    }
  }
  if (warnings.length) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: warnings.join('\n') },
    }));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
