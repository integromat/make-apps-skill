import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const withoutGit = !existsSync(join(root, '.git'));

test('Git preserves canonical source bytes and marks ZIP archives binary', { skip: withoutGit }, () => {
  for (const path of ['skills/make-custom-apps/SKILL.md',
    'skills/make-custom-apps/examples/github-search/api.imljson', 'provenance/pr70-baseline.json']) {
    const result = execFileSync('git', ['check-attr', 'text', '--', path], { cwd: root, encoding: 'utf8' });
    assert.equal(result.trim(), `${path}: text: unset`);
  }
  const zip = execFileSync('git', ['check-attr', 'text', 'diff', 'merge', '--', 'dist/make-custom-apps.zip'],
    { cwd: root, encoding: 'utf8' });
  for (const attribute of ['text', 'diff', 'merge']) assert.ok(zip.includes(`: ${attribute}: unset`));
});

test('Git excludes generated output, credentials, caches and private evidence', { skip: withoutGit }, () => {
  const paths = ['dist/make-custom-apps.zip', '.env', '.env.local', '.cache/state.json',
    'node_modules/example/index.js', 'tests/__pycache__/test.pyc', 'private-evidence/review.json'];
  const ignored = execFileSync('git', ['check-ignore', '--no-index', ...paths], { cwd: root, encoding: 'utf8' });
  assert.deepEqual(ignored.trim().split('\n'), paths);
});
