#!/usr/bin/env node
// Verifies the github-search SDK management example from a clean copy. Fetches only the published, pinned
// npm dependencies; never sends a request to Make or a provider, and strips MAKE_* variables from the child environment.
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { directTypeScriptRun } from './node-type-stripping.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'skills/make-custom-apps/examples/app-examples/github-search');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.toUpperCase().startsWith('MAKE_')));
const workdir = mkdtempSync(join(tmpdir(), 'make-sdk-example-'));
const copy = join(workdir, 'github-search');

function fail(message) {
  console.error(`test:sdk FAILED: ${message}`);
  cleanup();
  process.exit(1);
}

function cleanup() {
  rmSync(workdir, { recursive: true, force: true });
}

function step(title, command, args, { expectStatus = 0, capture = false } = {}) {
  console.log(`\n== ${title}`);
  const result = spawnSync(command, args, {
    cwd: copy, env, encoding: 'utf8', stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.error) fail(`${title}: ${result.error.code ?? 'could not start'}`);
  if (result.status !== expectStatus) fail(`${title}: exit status ${result.status}, expected ${expectStatus}`);
  return result.stdout ?? '';
}

cpSync(source, copy, { recursive: true, filter: (path) => !/(^|[\\/])(node_modules|\.build)([\\/]|$)/.test(path.slice(source.length)) });

step('Install exact locked dependencies (npm ci)', npm, ['ci', '--ignore-scripts', '--no-audit', '--no-fund']);
step('Typecheck against the real SDK declarations', npm, ['run', 'typecheck']);
step('Unit tests (mocks and a fake fetch; no network)', npm, ['test']);

const summary = step('Offline dry-run (default mode)', npm, ['run', '--silent', 'dry-run'], { capture: true });
process.stdout.write(summary);
for (const expected of ['Mode: mock', 'no Make API call was made', 'Result: all steps passed.']) {
  if (!summary.includes(expected)) fail(`dry-run output lacks "${expected}"`);
}

step('--live without inputs is refused before any connection', process.execPath, ['.build/create-app.js', '--live'], { expectStatus: 2 });

const directMode = directTypeScriptRun(process.versions.node);
if (directMode === 'unsupported') {
  console.log(`\n== Direct TypeScript run skipped: Node ${process.versions.node} cannot strip types (needs 22.6 or later). The compiled dry-run above covers this Node; CI runs the direct path.`);
} else {
  const runs = [['with --experimental-strip-types', ['--experimental-strip-types', 'create-app.ts']]];
  if (directMode === 'default') runs.push(['without a flag (default type stripping)', ['create-app.ts']]);
  for (const [label, args] of runs) {
    const direct = step(`Run create-app.ts directly ${label}`, process.execPath, args, { capture: true });
    if (!direct.includes('Mode: mock') || !direct.includes('Result: all steps passed.')) fail(`direct TypeScript run ${label} did not print the mock summary`);
  }
}

cleanup();
console.log('\ntest:sdk passed. This is offline evidence only; nothing was sent to Make or a provider.');
