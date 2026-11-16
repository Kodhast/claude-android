import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { logFile } from '../log.mjs';

const now = new Date('2026-11-16T10:00:00Z');

test('CLAUDE_HOOKS_LOG går före allt annat', () => {
  assert.equal(logFile({ CLAUDE_HOOKS_LOG: '/x/y.log', CLAUDE_HOOKS_LOG_DIR: tmpdir() }, now), '/x/y.log');
});

test('projektmappen ger en fil per dag och session under hooklogg/', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'hooklogg-'));
  assert.equal(
    logFile({ CLAUDE_HOOKS_LOG_DIR: dir, CLAUDE_CODE_REMOTE_SESSION_ID: 'session_01Ab/../x' }, now),
    path.join(dir, 'hooklogg', '2026-11-16-session_01Abx.log'),
  );
});

test('utan session-id heter filen okand', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'hooklogg-'));
  assert.equal(logFile({ CLAUDE_HOOKS_LOG_DIR: dir }, now), path.join(dir, 'hooklogg', '2026-11-16-okand.log'));
});

test('utan projektmapp hamnar loggen i /tmp som förut', () => {
  assert.equal(logFile({ CLAUDE_HOOKS_LOG_DIR: path.join(tmpdir(), 'finns-inte-xyz') }, now), '/tmp/claude-hooks.log');
});
