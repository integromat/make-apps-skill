import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { schemaFor, stripComments } from '../skills/make-custom-apps/references/editor-schemas/validate.mjs';

const validatorUrl = new URL('../skills/make-custom-apps/references/editor-schemas/validate.mjs', import.meta.url);

test('invoking the CLI through a symlink still reports missing arguments', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'editor-schema-cli-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const linkedScript = join(directory, 'validate.mjs');
  symlinkSync(fileURLToPath(validatorUrl), linkedScript);

  const result = spawnSync(process.execPath, [linkedScript], { encoding: 'utf8' });
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /Usage: node validate\.mjs/);
});

test('importing the validator from stdin does not invoke the CLI or resolve stdin as a file', () => {
  const result = spawnSync(process.execPath, ['--input-type=module', '-'], {
    input: `await import(${JSON.stringify(validatorUrl.href)});`,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, '');
});

for (const extension of ['imljson', 'json']) {
  test(`explicit api-oauth.${extension} selects the OAuth schema without inferring from content`, () => {
    assert.equal(schemaFor(join('connections', 'oauth', `api-oauth.${extension}`), {}), 'api-oauth.json');
  });
}

test('connection api still selects its schema from OAuth communication content', () => {
  const path = join('connections', 'oauth', 'api.imljson');
  assert.equal(schemaFor(path, { authorize: { url: '/authorize' } }), 'api-oauth.json');
  assert.equal(schemaFor(path, { url: '/me' }), 'api.json');
});

for (const source of ['{} /* unfinished', '{} /*', '{} /*/']) {
  test(`rejects an unterminated block comment in ${JSON.stringify(source)}`, () => {
    assert.throws(() => stripComments(source), SyntaxError);
  });
}

for (const source of ['{"n":1/*comment*/2}', '{"n":1/**/e2}', '{"ok":tr/*comment*/ue}']) {
  test(`comments cannot join tokens into valid JSON in ${source}`, () => {
    assert.throws(() => JSON.parse(stripComments(source)), SyntaxError);
  });
}

test('valid comments are accepted without altering strings or escaped quotes and backslashes', () => {
  const source = String.raw`{
    // A line comment before a property.
    "url": "https://example.com/*literal*/",
    "message": "a \" // literal /* comment */",
    "path": "C:\\path\\", /* A block comment after an escaped backslash. */
    "enabled": /* A comment between tokens. */ true
  } // A trailing line comment`;
  assert.deepEqual(JSON.parse(stripComments(source)), {
    url: 'https://example.com/*literal*/',
    message: 'a " // literal /* comment */',
    path: 'C:\\path\\',
    enabled: true,
  });
});

for (const lineEnding of ['\n', '\r\n', '\r']) {
  test(`a ${JSON.stringify(lineEnding)} line ending terminates a line comment`, () => {
    assert.deepEqual(JSON.parse(stripComments(`{"a":1,// comment${lineEnding}"b":2}`)), { a: 1, b: 2 });
  });
}
