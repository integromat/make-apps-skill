import assert from 'node:assert/strict';
import test from 'node:test';
import { directTypeScriptRun } from '../scripts/node-type-stripping.mjs';

const cases = [
  ['20.19.0', 'unsupported'],
  ['21.7.3', 'unsupported'],
  ['22.0.0', 'unsupported'],
  ['22.5.1', 'unsupported'],
  ['22.6.0', 'flag'],
  ['22.17.1', 'flag'],
  ['22.18.0', 'default'],
  ['22.20.5', 'default'],
  ['23.0.0', 'flag'],
  ['23.5.0', 'flag'],
  ['23.6.0', 'default'],
  ['24.0.0', 'default'],
];

for (const [version, mode] of cases) {
  test(`Node ${version} direct TypeScript run is "${mode}"`, () => {
    assert.equal(directTypeScriptRun(version), mode);
  });
}

test('the version boundaries agree with the flags the running Node accepts', () => {
  const mode = directTypeScriptRun(process.versions.node);
  assert.equal(
    process.allowedNodeEnvironmentFlags.has('--experimental-strip-types'),
    mode !== 'unsupported',
    `Node ${process.versions.node} classified as "${mode}"`,
  );
});

test('a malformed version is not treated as supported', () => {
  assert.equal(directTypeScriptRun('not-a-version'), 'unsupported');
  assert.equal(directTypeScriptRun(''), 'unsupported');
});
