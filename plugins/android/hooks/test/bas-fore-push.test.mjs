import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findPushes, parsePushArgs } from '../bas-fore-push.mjs';

const HOOK = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bas-fore-push.mjs');
const ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.com', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.com',
  GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1',
};

function git(dir, ...args) {
  const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8', env: ENV });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
}

function commit(dir, file, text) {
  writeFileSync(path.join(dir, file), text);
  git(dir, 'add', file);
  git(dir, 'commit', '-q', '-m', `${file}: ${text.trim()}`);
}

// Ett bart "GitHub"-repo med `main`, en klon med arbetsgrenen `gren` och en andra klon som spelar
// en annan tråd som mergar till main. Inget nät.
function setup({ base = 'main' } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'bas-'));
  const origin = path.join(root, 'origin.git');
  git(root, 'init', '-q', '--bare', `--initial-branch=${base}`, origin);
  const other = path.join(root, 'other');
  git(root, 'clone', '-q', origin, other);
  git(other, 'checkout', '-q', '-b', base);
  commit(other, 'a.txt', 'ett\n');
  git(other, 'push', '-q', 'origin', base);
  const work = path.join(root, 'work');
  git(root, 'clone', '-q', origin, work);
  git(work, 'checkout', '-q', '-b', 'gren');
  commit(work, 'b.txt', 'min ändring\n');
  return { root, origin, other, work, base };
}

/** En annan tråd mergar till basen. */
function advanceBase({ other, base }, file = 'c.txt', text = 'annan tråd\n') {
  commit(other, file, text);
  git(other, 'push', '-q', 'origin', base);
}

function run(command, cwd, extraEnv = {}) {
  const logDir = mkdtempSync(path.join(tmpdir(), 'bas-log-'));
  const r = spawnSync('node', [HOOK], {
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command }, cwd }),
    encoding: 'utf8',
    env: { ...ENV, CLAUDE_HOOKS_LOG: path.join(logDir, 'log'), ...extraEnv },
  });
  assert.equal(r.status, 0, r.stderr);
  const log = existsSync(path.join(logDir, 'log')) ? readFileSync(path.join(logDir, 'log'), 'utf8') : '';
  return { out: r.stdout ? JSON.parse(r.stdout).hookSpecificOutput : null, log };
}

const denied = (res) => res.out?.permissionDecision === 'deny';

test('grenen innehåller senaste main: pushen går', () => {
  const s = setup();
  const res = run('git push -u origin gren', s.work);
  assert.equal(res.out, null);
  assert.equal(res.log, '');
});

test('main har rört sig utan konflikt: pushen spärras med vad som ska göras', () => {
  const s = setup();
  advanceBase(s);
  const res = run('git push -u origin gren', s.work);
  assert.ok(denied(res));
  assert.match(res.out.permissionDecisionReason, /saknar senaste origin\/main/);
  assert.match(res.out.permissionDecisionReason, /git merge --no-edit origin\/main/);
  assert.doesNotMatch(res.out.permissionDecisionReason, /konflikt i/);
  assert.match(res.log, /bas-fore-push\tefter\twork/);
});

test('efter merge av main går pushen', () => {
  const s = setup();
  advanceBase(s);
  git(s.work, 'fetch', '-q', 'origin', 'main');
  git(s.work, 'merge', '-q', '--no-edit', 'origin/main');
  assert.equal(run('git push origin gren', s.work).out, null);
});

test('konflikt: spärren listar filerna som krockar', () => {
  const s = setup();
  commit(s.work, 'a.txt', 'min version\n');
  advanceBase(s, 'a.txt', 'deras version\n');
  const res = run('git push origin gren', s.work);
  assert.ok(denied(res));
  assert.match(res.out.permissionDecisionReason, /konflikt i: a\.txt/);
  assert.match(res.log, /\tkonflikt\t/);
  // Arbetskatalogen rörs inte.
  assert.equal(git(s.work, 'status', '--porcelain'), '');
});

test('master som bas', () => {
  const s = setup({ base: 'master' });
  advanceBase(s);
  const res = run('git push origin gren', s.work);
  assert.match(res.out.permissionDecisionReason, /origin\/master/);
});

test('cd före pushen och git -C hittar rätt repo', () => {
  const s = setup();
  advanceBase(s);
  assert.ok(denied(run('cd work && git push origin gren', s.root)));
  assert.ok(denied(run('git -C work push origin gren', s.root)));
  assert.ok(denied(run('git status && git push', s.work)));
});

test('push till basen, taggar och radering rörs inte', () => {
  const s = setup();
  advanceBase(s);
  git(s.work, 'tag', 'v1.0.0');
  assert.equal(run('git push origin main', s.work).out, null);
  assert.equal(run('git push origin gren:main', s.work).out?.permissionDecision, undefined);
  assert.equal(run('git push origin v1.0.0', s.work).out, null);
  assert.equal(run('git push origin refs/tags/v1.0.0', s.work).out, null);
  assert.equal(run('git push --tags', s.work).out, null);
  assert.equal(run('git push origin --delete gamla', s.work).out, null);
  assert.equal(run('git push origin :gamla', s.work).out, null);
});

test('HEAD som refspec pushar aktuell gren', () => {
  const s = setup();
  advanceBase(s);
  assert.ok(denied(run('git push -u origin HEAD', s.work)));
});

test('hämtningen misslyckas: varning, ingen spärr', () => {
  const s = setup();
  advanceBase(s);
  git(s.work, 'remote', 'set-url', 'origin', path.join(s.root, 'finns-inte.git'));
  const res = run('git push origin gren', s.work);
  assert.equal(res.out.permissionDecision, undefined);
  assert.match(res.out.additionalContext, /Kunde inte hämta origin\/main/);
  assert.match(res.log, /\thamtning\t/);
});

test('kommandon utan push och kataloger utan git passerar', () => {
  const s = setup();
  advanceBase(s);
  assert.equal(run('git status', s.work).out, null);
  assert.equal(run('echo push', s.work).out, null);
  assert.equal(run('git push origin gren', s.root).out, null);
});

test('omdirigering, bakgrund, miljövariabler, omslag och underskal hittas', () => {
  const s = setup();
  advanceBase(s);
  for (const cmd of [
    'git push 2>&1 | tail -3',
    'git push >/tmp/ut 2>&1',
    'git push &',
    'GIT_TERMINAL_PROMPT=0 git push origin gren',
    'env A=1 git push origin gren',
    'command git push origin gren',
    '(cd work && git push origin gren)',
    'env -u FOO git push origin gren',
    'time -p git push origin gren',
    'git push \\\n  origin gren',
  ]) assert.ok(denied(run(cmd, cmd.includes('cd work') ? s.root : s.work)), cmd);
});

test('citattecken: semikolon i ett citerat ord delar inte kommandot', () => {
  const s = setup();
  advanceBase(s);
  assert.equal(run('git commit -q -m "fix; git push x" --allow-empty', s.work).out, null);
  assert.deepEqual(findPushes('cd "/a;b" && git push', '/').map((p) => p.dir), ['/a;b']);
});

test('--dry-run pushar inget och rörs inte', () => {
  const s = setup();
  advanceBase(s);
  assert.equal(run('git push --dry-run origin gren', s.work).out, null);
});

test('merge och push i samma kommando: spärren säger att pushen ska vara eget kommando', () => {
  const s = setup();
  advanceBase(s);
  const res = run('git fetch origin main && git merge --no-edit origin/main && git push', s.work);
  assert.ok(denied(res));
  assert.match(res.out.permissionDecisionReason, /i samma kommando som pushen räknas inte/);
});

test('pågående merge: spärren säger att den ska avslutas, inte startas om', () => {
  const s = setup();
  commit(s.work, 'a.txt', 'min version\n');
  advanceBase(s, 'a.txt', 'deras version\n');
  git(s.work, 'fetch', '-q', 'origin', 'main');
  spawnSync('git', ['merge', '--no-edit', 'origin/main'], { cwd: s.work, env: ENV });
  const res = run('git push origin gren', s.work);
  assert.ok(denied(res));
  assert.match(res.out.permissionDecisionReason, /En merge pågår/);
  assert.doesNotMatch(res.out.permissionDecisionReason, /git merge --no-edit/);
});

test('utan origin/HEAD avgör GitHubs förvalda gren basen', () => {
  const s = setup({ base: 'master' });
  // Repot har också en gren main, men förvald gren är master.
  git(s.other, 'push', '-q', 'origin', 'master:main');
  git(s.work, 'remote', 'set-head', 'origin', '--delete');
  git(s.work, 'fetch', '-q', 'origin');
  advanceBase(s);
  const res = run('git push origin gren', s.work);
  assert.match(res.out.permissionDecisionReason, /saknar senaste origin\/master/);
});

test('grund klon utan gemensam historik: varning, ingen spärr', () => {
  const s = setup();
  advanceBase(s);
  git(s.work, 'push', '-q', 'origin', 'gren');
  advanceBase(s, 'd.txt', 'ännu en\n');
  const shallow = path.join(s.root, 'shallow');
  git(s.root, 'clone', '-q', '--depth=1', '--branch', 'main', `file://${s.origin}`, shallow);
  git(shallow, 'fetch', '-q', '--depth=1', 'origin', 'gren:gren');
  git(shallow, 'checkout', '-q', 'gren');
  const res = run('git push origin gren', shallow);
  assert.equal(res.out.permissionDecision, undefined);
  assert.match(res.out.additionalContext, /ingen gemensam historik/);
});

test('findPushes och parsePushArgs', () => {
  assert.deepEqual(findPushes('cd /a && git -c x=y push -u origin g; cd b; git merge x; git push', '/'), [
    { dir: '/a', args: ['-u', 'origin', 'g'], mergeBefore: false },
    { dir: '/a/b', args: [], mergeBefore: true },
  ]);
  assert.deepEqual(parsePushArgs(['-u', 'origin', 'g']), { remote: 'origin', refspecs: ['g'] });
  assert.deepEqual(parsePushArgs(['--force-with-lease', '-o', 'ci.skip', 'up']), { remote: 'up', refspecs: [] });
  assert.equal(parsePushArgs(['--tags']).skip, '--tags');
});
