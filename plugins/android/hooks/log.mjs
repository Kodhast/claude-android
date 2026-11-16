// Beskedloggen: varje besked från en hook ger en rad i en loggfil, så att veckomätningen kan
// räkna hur ofta hookarna säger till. PostToolUse-hookarnas besked syns inte i sessionens
// händelseström, så utan loggen går de inte att räkna.
//
// Var: `CLAUDE_HOOKS_LOG` om den är satt. Annars, när projektets delade mapp finns
// (`/mnt/project-files`, eller `CLAUDE_HOOKS_LOG_DIR`), en fil per session och dag under
// `hooklogg/` där – den mappen överlever tråden, `/tmp` gör det inte (claude-android #87).
// Annars `/tmp/claude-hooks.log`.
//
// En rad: tid, hook, regel och repo, tabbseparerade. Filinnehåll och kod skrivs aldrig.
// Går loggen inte att skriva tappas raden; hooken stoppas aldrig av loggen.

import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const clean = (s) => String(s ?? '').replace(/[\t\r\n]+/g, ' ');
const safe = (s) => String(s ?? '').replace(/[^A-Za-z0-9_-]+/g, '').slice(-40) || 'okand';

/** Loggfilens sökväg. `env` och `now` går att byta i tester. */
export function logFile(env = process.env, now = new Date()) {
  if (env.CLAUDE_HOOKS_LOG) return env.CLAUDE_HOOKS_LOG;
  const shared = env.CLAUDE_HOOKS_LOG_DIR || '/mnt/project-files';
  if (existsSync(shared)) {
    const session = safe(env.CLAUDE_CODE_REMOTE_SESSION_ID || env.CLAUDE_CODE_SESSION_ID);
    return path.join(shared, 'hooklogg', `${now.toISOString().slice(0, 10)}-${session}.log`);
  }
  return '/tmp/claude-hooks.log';
}

/** Skriver en beskedrad. `repo` är repots katalog; bara namnet loggas. */
export function logBesked(hook, regel, repo) {
  try {
    const file = logFile();
    mkdirSync(path.dirname(file), { recursive: true });
    const line = [new Date().toISOString(), hook, regel, repo ? path.basename(repo) : ''].map(clean).join('\t');
    appendFileSync(file, `${line}\n`);
  } catch {
    // Loggen är bara för mätningen.
  }
}
