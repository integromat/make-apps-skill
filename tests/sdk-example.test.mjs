import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const example = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills/make-custom-apps/examples/app-examples/github-search');
const json = (name) => JSON.parse(readFileSync(join(example, name), 'utf8'));

test('the SDK example pins every direct dependency to an exact version', () => {
  const manifest = json('package.json');
  assert.equal(manifest.dependencies['@makehq/sdk'], '1.8.1');
  assert.equal(manifest.devDependencies.typescript, '7.0.2');
  for (const [name, version] of Object.entries({ ...manifest.dependencies, ...manifest.devDependencies })) {
    assert.match(version, /^\d+\.\d+\.\d+$/, `${name} must be pinned exactly`);
  }
  assert.equal(manifest.private, true);
});

test('the lockfile resolves the pinned packages from the public npm registry', () => {
  const lock = json('package-lock.json');
  assert.equal(lock.lockfileVersion, 3);
  assert.equal(lock.packages['node_modules/@makehq/sdk'].version, '1.8.1');
  assert.equal(lock.packages['node_modules/typescript'].version, '7.0.2');
  for (const [path, entry] of Object.entries(lock.packages)) {
    if (path === '') continue;
    assert.match(entry.resolved ?? '', /^https:\/\/registry\.npmjs\.org\//, `${path} must resolve from the public registry`);
    assert.ok(entry.integrity, `${path} needs an integrity hash`);
  }
  const root = lock.packages[''];
  assert.deepEqual(root.dependencies, json('package.json').dependencies);
  assert.deepEqual(root.devDependencies, json('package.json').devDependencies);
});

test('the lockfile root declares the same Node engine as the manifest (compiled path supports Node 20)', () => {
  const manifest = json('package.json');
  assert.equal(manifest.engines.node, '>=20');
  assert.deepEqual(json('package-lock.json').packages[''].engines, manifest.engines);
});

test('README documents the compiled fallback and an explicit flag, and no bare "node create-app.ts" for every Node 22', () => {
  const readme = readFileSync(join(example, 'README.md'), 'utf8');
  const manifest = json('package.json');
  assert.equal(manifest.scripts['dry-run'], 'npm run build && node .build/create-app.js');
  assert.match(readme, /^npm run-script dry-run\b/m);
  assert.doesNotMatch(readme, /npm run (?!test:sdk)/, 'the root portability test would read these as repository-root commands');
  assert.match(readme, /node --experimental-strip-types create-app\.ts/);
  assert.match(readme, /22\.6/);
  assert.match(readme, /22\.18/);
  assert.doesNotMatch(readme, /^node create-app\.ts/m);
  assert.doesNotMatch(readme, /Node 22 or later strips/);
});

test('the SDK test script gates direct TypeScript runs through the version-boundary helper', () => {
  const script = readFileSync(join(example, '..', '..', '..', '..', '..', 'scripts/test-sdk-example.mjs'), 'utf8');
  assert.match(script, /directTypeScriptRun\(/);
  assert.doesNotMatch(script, /major\s*>=\s*22/);
});

test('test:sdk is a separate root command wired into CI, and npm test stays free of installs', () => {
  const root = join(example, '..', '..', '..', '..', '..');
  const scripts = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).scripts;
  assert.equal(scripts['test:sdk'], 'node scripts/test-sdk-example.mjs');
  assert.ok(!scripts.test.includes('test:sdk'), 'npm test must stay free of installs');
  const workflow = readFileSync(join(root, '.github/workflows/check.yml'), 'utf8');
  assert.match(workflow, /run: npm run test:sdk/);
});
