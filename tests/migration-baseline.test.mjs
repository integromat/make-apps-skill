import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifestPath = resolve(root, 'provenance/pr70-baseline.json');

function withinRoot(path) {
  assert.equal(typeof path, 'string');
  assert.ok(path.length > 0 && !path.includes('\\') && !path.startsWith('/'));
  const target = resolve(root, path);
  assert.ok(target.startsWith(root.endsWith(sep) ? root : `${root}${sep}`), `Unsafe import path: ${path}`);
  return target;
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

test('imports the entire PR70 app skill and checker sources byte-for-byte', () => {
  assert.ok(existsSync(manifestPath), 'PR70 import manifest must exist');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.source.repository, 'https://github.com/integromat/make-skills');
  assert.equal(manifest.source.commit, '3dcad8e96a6e040e7eeaf344c16efec25685b5e8');
  assert.equal(manifest.source.pullRequest, 70);
  assert.equal(manifest.counts.skillFiles, 122);
  assert.equal(manifest.counts.references, 12);
  assert.equal(manifest.counts.exampleFiles, 109);
  assert.equal(manifest.entries.length, manifest.counts.skillFiles + manifest.counts.checkerFiles);
  assert.equal(new Set(manifest.entries.map((entry) => entry.target)).size, manifest.entries.length);
  for (const entry of manifest.entries) {
    const target = withinRoot(entry.target);
    assert.ok(existsSync(target), `Missing imported file: ${entry.target}`);
    const stat = lstatSync(target);
    assert.ok(stat.isFile() && !stat.isSymbolicLink(), `Import must be a regular file: ${entry.target}`);
    const bytes = readFileSync(target);
    assert.equal(bytes.length, entry.bytes, `Size drift: ${entry.target}`);
    assert.equal(sha256(bytes), entry.sha256, `Baseline drift: ${entry.target}`);
  }
});
