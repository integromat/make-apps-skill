// PHASE 1 (RED) tests for examples/current-knowledge/ and scripts/check-current-knowledge.mjs.
//
// Contract under test: a small offline *static* checker that validates a navigation index, a
// source/applicability catalog, local dependencies, and the declared semantics of synthetic
// recipe fixtures. It is NOT a general IML runtime or interpreter and these tests never expect one.
//
// Assertions use stable rule codes (CK-*), never prose. Every semantic test (a) proves the pristine
// tree is clean, (b) applies one mutation to a temporary copy, and (c) asserts the EXACT set of
// rule codes, so a checker that always fails, or only greps strings, cannot pass. Benign
// semantics-preserving edits must stay green for the same reason.
//
// Fixture layout required (see .sonnet/task-1-phase1-report.md for per-recipe bundle shapes):
//   skills/make-custom-apps/examples/current-knowledge/{README.md,catalog.json,guides/*.md,
//   recipes/<recipe-id>/{correct.json,incorrect/*.json,functions/*.js}}
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const repo = fileURLToPath(new URL('../', import.meta.url));
const skillSource = resolve(repo, 'skills/make-custom-apps');
const checkerPath = resolve(repo, 'scripts/check-current-knowledge.mjs');

const REQUIRED_TOPICS = [
  'dates-helpers', 'selectors-mode', 'rpc-page-budgets', 'headers-merge', 'interfaces-required',
  'labels-visibility', 'auth-context', 'webhooks', 'optional-endpoints', 'compatibility-evidence',
];
const RECIPE_TOPIC = {
  'dates-helper-trace': 'dates-helpers',
  'selector-mode-dependent': 'selectors-mode',
  'rpc-page-budget': 'rpc-page-budgets',
  'headers-merge': 'headers-merge',
  'interface-required-flags': 'interfaces-required',
  'labels-visibility': 'labels-visibility',
  'auth-context': 'auth-context',
  'webhook-lifecycle-delivery': 'webhooks',
  'optional-endpoint': 'optional-endpoints',
  'evidence-gates': 'compatibility-evidence',
};
const RECIPES = Object.keys(RECIPE_TOPIC);
// Rule codes each supplied recipe must declare (and therefore must carry negative fixtures for).
const RECIPE_RULES = {
  'dates-helper-trace': ['CK-DATE-ORDER', 'CK-DATE-PARSE', 'CK-HELPER-TRACE'],
  'selector-mode-dependent': ['CK-SELECTOR-RPC', 'CK-SELECTOR-MODE', 'CK-SELECTOR-NESTED', 'CK-SELECTOR-SCHEMA-CONFUSION'],
  'rpc-page-budget': ['CK-BUDGET-BOUND', 'CK-BUDGET-PAGE'],
  'headers-merge': ['CK-HEADERS-MERGE', 'CK-HEADERS-DUPLICATE'],
  'interface-required-flags': ['CK-REQUIRED-FLAG', 'CK-FALSY-LOSS', 'CK-INTERFACE-DRIFT'],
  'labels-visibility': ['CK-LABEL', 'CK-LABEL-UNIQUE', 'CK-VISIBILITY'],
  'auth-context': ['CK-AUTH-CONTEXT', 'CK-SECRET-LOG'],
  'webhook-lifecycle-delivery': ['CK-WEBHOOK-IDENTITY', 'CK-WEBHOOK-VERIFY', 'CK-WEBHOOK-DELIVERY', 'CK-SECRET-LOG'],
  'optional-endpoint': ['CK-ENDPOINT-OPTIONAL', 'CK-ENDPOINT-INPUT'],
  'evidence-gates': ['CK-CLAIM-EVIDENCE', 'CK-GATES'],
};
// Topic -> references that must route (by real local link) to the topic guide.
const REFERENCE_ROUTES = {
  'dates-helpers': ['iml-functions.md', 'webhooks-and-polling.md'],
  'selectors-mode': ['parameters-and-rpcs.md'],
  'rpc-page-budgets': ['parameters-and-rpcs.md', 'modules-and-pagination.md'],
  'headers-merge': ['base-and-connections.md', 'requests-and-responses.md'],
  'interfaces-required': ['parameters-and-rpcs.md'],
  'labels-visibility': ['parameters-and-rpcs.md'],
  'auth-context': ['base-and-connections.md'],
  webhooks: ['webhooks-and-polling.md'],
  'optional-endpoints': ['sdk-endpoints.md'],
  'compatibility-evidence': ['maintenance.md', 'review-and-qa.md', 'source-hierarchy.md'],
};

// ---------------------------------------------------------------- harness
let checkerModule;
async function validate(examples) {
  checkerModule ??= await import(pathToFileURL(checkerPath).href);
  assert.equal(typeof checkerModule.validateCurrentKnowledge, 'function', 'checker must export validateCurrentKnowledge(examplesRoot)');
  const result = checkerModule.validateCurrentKnowledge(examples);
  assert.ok(Array.isArray(result?.errors), 'result.errors must be an array of {code, file, message}');
  for (const error of result.errors) assert.match(error.code, /^CK-[A-Z0-9-]+$/, 'every error needs a stable CK-* code');
  return result;
}
const codesOf = (result) => [...new Set(result.errors.map((error) => error.code))].sort();
const show = (result) => result.errors.map((e) => `${e.code} ${e.file ?? ''}`).join('\n');

async function withCopy(fn) {
  const temp = mkdtempSync(join(tmpdir(), 'make-current-knowledge-'));
  const skill = join(temp, 'skills', 'make-custom-apps');
  try {
    cpSync(skillSource, skill, { recursive: true });
    const ctx = { temp, skill, examples: join(skill, 'examples'), ck: join(skill, 'examples', 'current-knowledge') };
    ctx.read = (rel) => readFileSync(join(ctx.ck, rel), 'utf8');
    ctx.write = (rel, text) => { mkdirSync(dirname(join(ctx.ck, rel)), { recursive: true }); writeFileSync(join(ctx.ck, rel), text); };
    // Mutators edit in place; their return values (e.g. Array#push length) are deliberately ignored.
    ctx.json = (rel, mutate) => { const value = JSON.parse(ctx.read(rel)); mutate(value); ctx.write(rel, `${JSON.stringify(value, null, 2)}\n`); };
    ctx.catalog = (mutate) => ctx.json('catalog.json', mutate);
    ctx.recipe = (id) => JSON.parse(ctx.read('catalog.json')).recipes.find((r) => r.id === id);
    ctx.bundle = (id, mutate, which = 'correct') => {
      const recipe = ctx.recipe(id);
      assert.ok(recipe, `catalog must define recipe ${id}`);
      const rel = which === 'correct' ? recipe.fixtures.correct : which;
      ctx.json(rel, (value) => { mutate(value, ctx); });
    };
    return await fn(ctx);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

/** Mutate a pristine copy; prove the baseline was clean; return the post-mutation result. */
async function mutated(prepare) {
  return withCopy(async (ctx) => {
    const before = await validate(ctx.examples);
    assert.deepEqual(codesOf(before), [], `pristine tree must be clean first:\n${show(before)}`);
    await prepare(ctx);
    return validate(ctx.examples);
  });
}
async function assertRejected(prepare, codes, { exact = true } = {}) {
  const result = await mutated(prepare);
  const got = codesOf(result);
  if (exact) assert.deepEqual(got, [...codes].sort(), show(result));
  else for (const code of codes) assert.ok(got.includes(code), `expected ${code}; got:\n${show(result)}`);
}
async function assertStillClean(prepare) {
  const result = await mutated(prepare);
  assert.deepEqual(codesOf(result), [], `semantics-preserving edit must stay valid:\n${show(result)}`);
}

function walk(object, path) {
  const parts = path.split('.');
  const last = parts.pop();
  let current = object;
  for (const part of parts) {
    assert.ok(current !== null && typeof current === 'object' && part in current, `fixture shape: ${path} is missing at "${part}"`);
    current = current[part];
  }
  assert.ok(current !== null && typeof current === 'object', `fixture shape: parent of ${path} is not a container`);
  return [current, last];
}
function set(object, path, value) {
  const [parent, key] = walk(object, path);
  assert.ok(key in parent, `fixture shape: ${path} must already exist in the correct fixture`);
  parent[key] = value;
}
function put(object, path, value) { const [parent, key] = walk(object, path); parent[key] = value; }
function del(object, path) {
  const [parent, key] = walk(object, path);
  assert.ok(key in parent, `fixture shape: ${path} must already exist in the correct fixture`);
  if (Array.isArray(parent)) parent.splice(Number(key), 1); else delete parent[key];
}
function get(object, path) { const [parent, key] = walk(object, path); return parent[key]; }

// ---------------------------------------------------------------- 1. pristine contract
test('the shipped current-knowledge tree validates cleanly and is deterministic', async () => {
  const examples = join(skillSource, 'examples');
  const first = await validate(examples);
  assert.deepEqual(codesOf(first), [], show(first));
  assert.deepEqual(await validate(examples), first, 'validation must be a pure function of the tree');
  assert.deepEqual(first.errors, [...first.errors].sort((a, b) => a.code.localeCompare(b.code) || String(a.file).localeCompare(String(b.file))));
  assert.ok(first.stats.recipes >= RECIPES.length && first.stats.topics >= REQUIRED_TOPICS.length);
});

test('the catalog declares every required topic and recipe with its semantic rules and negatives', () => {
  const catalog = JSON.parse(readFileSync(join(skillSource, 'examples/current-knowledge/catalog.json'), 'utf8'));
  const topics = new Map(catalog.topics.map((t) => [t.id, t]));
  for (const id of REQUIRED_TOPICS) {
    assert.ok(topics.has(id), `missing topic ${id}`);
    assert.match(topics.get(id).guide, /^guides\/[a-z0-9-]+\.md$/);
    assert.ok(existsSync(join(skillSource, 'examples/current-knowledge', topics.get(id).guide)));
  }
  const byId = new Map(catalog.recipes.map((r) => [r.id, r]));
  for (const [id, topic] of Object.entries(RECIPE_TOPIC)) {
    const recipe = byId.get(id);
    assert.ok(recipe, `missing recipe ${id}`);
    assert.equal(recipe.topic, topic);
    for (const rule of RECIPE_RULES[id]) {
      assert.ok(recipe.rules.includes(rule), `${id} must declare ${rule}`);
      assert.ok(recipe.fixtures.incorrect.some((n) => n.violates.includes(rule)), `${id}: no negative fixture for ${rule}`);
    }
    assert.ok(existsSync(join(skillSource, 'examples/current-knowledge', recipe.fixtures.correct)));
    assert.equal(recipe.validation, 'static');
  }
  assert.equal(catalog.evidenceBoundary.runtime, 'none');
  const research = catalog.sources.filter((s) => s.kind === 'research-summary');
  assert.ok(research.length >= 1, 'the generic complete-app research summary must be a declared source');
  for (const source of research) {
    assert.equal(source.url, undefined, 'a research summary has no URL');
    assert.equal(source.containsPrivateData, false);
    assert.equal(source.scope, 'generic');
  }
  const publicDocs = new Set(catalog.sources.filter((s) => s.kind === 'public-doc').map((s) => s.id));
  assert.ok(publicDocs.size >= 5);
  for (const recipe of catalog.recipes.filter((r) => r.evidence.sourceIds.some((id) => research.some((s) => s.id === id)))) {
    if (recipe.strength === 'must') {
      assert.ok(recipe.evidence.sourceIds.some((id) => publicDocs.has(id)), `${recipe.id}: research alone cannot justify a must rule`);
    }
  }
  assert.ok(catalog.recipes.some((r) => r.evidence.sourceIds.some((id) => research.some((s) => s.id === id))),
    'at least one recipe must record research-derived guidance with its confidence');
  assert.ok(catalog.recipes.some((r) => r.strength !== 'must'), 'advisory (should/consider) guidance must exist, not only must rules');
});

// ---------------------------------------------------------------- 2. catalog/navigation/source invariants
test('rejects a wrong catalog format and a duplicate recipe id', async () => {
  await assertRejected((ctx) => ctx.catalog((c) => { c.format = 'something-else'; }), ['CK-FORMAT']);
  await assertRejected((ctx) => ctx.catalog((c) => { c.recipes[1].id = c.recipes[0].id; }), ['CK-FORMAT'], { exact: false });
});

test('rejects a missing required topic', () => assertRejected(
  (ctx) => ctx.catalog((c) => { c.topics = c.topics.filter((t) => t.id !== 'headers-merge'); }), ['CK-TOPIC-SET'], { exact: false }));

test('rejects a topic whose guide file is gone', () => assertRejected(
  (ctx) => { const topic = JSON.parse(ctx.read('catalog.json')).topics[0]; rmSync(join(ctx.ck, topic.guide)); }, ['CK-TOPIC-GUIDE'], { exact: false }));

test('rejects a guide the navigation index does not link', () => assertRejected((ctx) => {
  const guide = JSON.parse(ctx.read('catalog.json')).topics[0].guide;
  ctx.write('README.md', ctx.read('README.md').replaceAll(guide, '#'));
}, ['CK-INDEX-LINK']));

test('rejects broken local links in the index and in a guide', async () => {
  await assertRejected((ctx) => ctx.write('README.md', `${ctx.read('README.md')}\n[gone](guides/not-there.md)\n`), ['CK-LINK']);
  await assertRejected((ctx) => {
    const guide = JSON.parse(ctx.read('catalog.json')).topics[0].guide;
    ctx.write(guide, `${ctx.read(guide)}\n[gone](../recipes/not-there/correct.json)\n`);
  }, ['CK-LINK']);
});

test('rejects a guide that stops citing a declared source of its topic', () => assertRejected((ctx) => {
  const catalog = JSON.parse(ctx.read('catalog.json'));
  const topic = catalog.topics.find((t) => t.id === 'dates-helpers');
  const urls = catalog.sources.filter((s) => topic.sources.includes(s.id) && s.url).map((s) => s.url);
  assert.ok(urls.length > 0, 'topic must cite at least one public URL');
  let text = ctx.read(topic.guide);
  for (const url of urls) text = text.replaceAll(url, '#');
  ctx.write(topic.guide, text);
}, ['CK-GUIDE-SOURCES']));

test('rejects a guide that no longer links the recipe fixtures it teaches', () => assertRejected((ctx) => {
  const topic = JSON.parse(ctx.read('catalog.json')).topics.find((t) => t.id === 'headers-merge');
  ctx.write(topic.guide, ctx.read(topic.guide).replace(/\]\([^)]*recipes\/headers-merge\/[^)]*\)/g, '](#)'));
}, ['CK-GUIDE-RECIPE-LINK']));

for (const [label, mutate] of [
  ['an insecure URL', (s) => { s.url = s.url.replace(/^https:/, 'http:'); }],
  ['a non-Make host', (s) => { s.url = 'https://wiki.corp.invalid/page'; }],
]) {
  test(`rejects a public source with ${label}`, () => assertRejected(
    (ctx) => ctx.catalog((c) => mutate(c.sources.find((s) => s.kind === 'public-doc'))), ['CK-SOURCE'], { exact: false }));
}
test('rejects an unknown source id and a research source claiming private data', async () => {
  await assertRejected((ctx) => ctx.catalog((c) => { c.recipes[0].evidence.sourceIds.push('ghost-source'); }), ['CK-SOURCE']);
  await assertRejected((ctx) => ctx.catalog((c) => { c.sources.find((s) => s.kind === 'research-summary').containsPrivateData = true; }), ['CK-SOURCE']);
  await assertRejected((ctx) => ctx.catalog((c) => { c.sources.find((s) => s.kind === 'research-summary').url = 'https://developers.make.com/x'; }), ['CK-SOURCE']);
});

for (const id of RECIPES) {
  for (const [label, mutate] of [
    ['missing appliesWhen', (r) => { delete r.applicability.appliesWhen; }],
    ['blank appliesWhen entry', (r) => { r.applicability.appliesWhen = ['  ']; }],
    ['missing exceptions list', (r) => { delete r.applicability.exceptions; }],
    ['exception without a condition', (r) => { r.applicability.exceptions = [{ effect: 'relaxed' }]; }],
  ]) {
    test(`${id}: applicability metadata rejects ${label}`, () => assertRejected(
      (ctx) => ctx.catalog((c) => mutate(c.recipes.find((r) => r.id === id))), ['CK-APPLICABILITY']));
  }
}

test('strength must be justified by documentation, never by observation or research alone', async () => {
  const research = (c) => c.sources.find((s) => s.kind === 'research-summary').id;
  await assertRejected((ctx) => ctx.catalog((c) => {
    Object.assign(c.recipes[0], { strength: 'must', basis: 'observed' });
    Object.assign(c.recipes[0].evidence, { confidence: 'observed', sourceIds: [research(c)] });
  }), ['CK-EVIDENCE-STRENGTH']);
  await assertRejected((ctx) => ctx.catalog((c) => {
    Object.assign(c.recipes[0], { strength: 'must', basis: 'documented' });
    Object.assign(c.recipes[0].evidence, { confidence: 'documented', sourceIds: [research(c)] });
  }), ['CK-EVIDENCE-STRENGTH']);
  await assertStillClean((ctx) => ctx.catalog((c) => {
    Object.assign(c.recipes[0], { strength: 'should', basis: 'observed' });
    Object.assign(c.recipes[0].evidence, { confidence: 'observed', sourceIds: [research(c)] });
  }));
});

test('policy is never inferred from frequency', async () => {
  await assertRejected((ctx) => ctx.catalog((c) => { c.recipes[0].frequency = 14; }), ['CK-POLICY-FREQUENCY']);
  await assertRejected((ctx) => ctx.catalog((c) => { c.recipes[0].evidence.prevalence = '80%'; }), ['CK-POLICY-FREQUENCY']);
  await assertRejected((ctx) => ctx.catalog((c) => { c.recipes[0].basis = 'most-common-practice'; }), ['CK-POLICY-FREQUENCY']);
});

test('never claims runtime verification or a general IML runtime', async () => {
  await assertRejected((ctx) => ctx.catalog((c) => { c.recipes[0].validation = 'runtime-verified'; }), ['CK-RUNTIME-CLAIM']);
  await assertRejected((ctx) => ctx.catalog((c) => { c.evidenceBoundary.runtime = 'general-iml-interpreter'; }), ['CK-RUNTIME-CLAIM']);
});

test('the checker itself contains no evaluator, sandbox, subprocess or network capability', () => {
  const source = readFileSync(checkerPath, 'utf8');
  for (const forbidden of [/\beval\s*\(/, /new\s+Function\s*\(/, /node:vm/, /node:child_process/, /node:https?/, /\bfetch\s*\(/, /node:net/]) {
    assert.doesNotMatch(source, forbidden);
  }
});

// ---------------------------------------------------------------- 3. dependencies and fixture coverage
test('local dependencies must resolve inside current-knowledge and be acyclic', async () => {
  await assertRejected((ctx) => ctx.catalog((c) => { c.recipes[0].dependencies.push({ type: 'recipe', id: 'no-such-recipe' }); }), ['CK-DEPENDENCY']);
  await assertRejected((ctx) => ctx.catalog((c) => { c.recipes[0].dependencies.push({ type: 'file', path: 'recipes/none/missing.js' }); }), ['CK-DEPENDENCY']);
  await assertRejected((ctx) => ctx.catalog((c) => { c.recipes[0].dependencies.push({ type: 'file', path: '../../SKILL.md' }); }), ['CK-DEPENDENCY']);
  await assertRejected((ctx) => ctx.catalog((c) => { c.recipes[0].dependencies.push({ type: 'file', path: '/etc/hosts' }); }), ['CK-DEPENDENCY']);
  await assertRejected((ctx) => ctx.catalog((c) => { c.recipes[0].dependencies.push({ type: 'file', path: 'https://example.invalid/x.js' }); }), ['CK-DEPENDENCY']);
  await assertRejected((ctx) => ctx.catalog((c) => {
    const [a, b] = [c.recipes.find((r) => r.id === 'headers-merge'), c.recipes.find((r) => r.id === 'labels-visibility')];
    a.dependencies.push({ type: 'recipe', id: b.id });
    b.dependencies.push({ type: 'recipe', id: a.id });
  }), ['CK-DEPENDENCY']);
  await assertStillClean((ctx) => ctx.catalog((c) => {
    c.recipes.find((r) => r.id === 'headers-merge').dependencies.push({ type: 'recipe', id: 'labels-visibility' });
  }));
});

test('every fixture file is cataloged and every cataloged fixture exists', async () => {
  await assertRejected((ctx) => ctx.write('recipes/headers-merge/incorrect/orphan.json', '{}\n'), ['CK-COVERAGE']);
  await assertRejected((ctx) => rmSync(join(ctx.ck, ctx.recipe('headers-merge').fixtures.correct)), ['CK-COVERAGE'], { exact: false });
  await assertRejected((ctx) => ctx.write(ctx.recipe('headers-merge').fixtures.correct, '{ not json'), ['CK-JSON'], { exact: false });
});

test('negative fixtures must actually fail, for the declared reason', async () => {
  for (const id of RECIPES) {
    await assertRejected((ctx) => {
      const recipe = ctx.recipe(id);
      ctx.write(recipe.fixtures.incorrect[0].file, ctx.read(recipe.fixtures.correct));
    }, ['CK-NEGATIVE-NOT-FAILING']);
  }
  await assertRejected((ctx) => ctx.catalog((c) => {
    const recipe = c.recipes.find((r) => r.id === 'dates-helper-trace');
    recipe.fixtures.incorrect[0].violates = ['CK-HEADERS-MERGE'];
  }), ['CK-NEGATIVE-WRONG-RULE'], { exact: false });
  await assertRejected((ctx) => ctx.catalog((c) => {
    const recipe = c.recipes.find((r) => r.id === 'dates-helper-trace');
    recipe.fixtures.incorrect = recipe.fixtures.incorrect.filter((n) => !n.violates.includes('CK-DATE-PARSE'));
  }), ['CK-COVERAGE', 'CK-NEGATIVE-COVERAGE']); // the dropped fixture file also becomes an uncataloged orphan
});

// ---------------------------------------------------------------- 4. no private / real-provider material
const privateSamples = {
  'a home-directory path': () => ['', 'Users', 'someone', 'work', 'repo'].join('/'),
  'a Windows user path': () => ['C:', 'Users', 'someone', 'repo'].join('\\'),
  'an email address': () => ['dev', 'corp.example'].join('@'),
  'a token-shaped secret': () => ['ghp', 'a'.repeat(36)].join('_'),
  'an internal host': () => `https://${['svc', 'corp', 'internal'].join('.')}/v1`,
  'a private working-notes path': () => ['.', 'sonnet/task-1.md'].join(''),
};
for (const [label, sample] of Object.entries(privateSamples)) {
  test(`rejects ${label} in a guide, a fixture and the catalog`, async () => {
    await assertRejected((ctx) => {
      const guide = JSON.parse(ctx.read('catalog.json')).topics[0].guide;
      ctx.write(guide, `${ctx.read(guide)}\nNote: ${sample()}\n`);
    }, ['CK-PRIVATE']);
    await assertRejected((ctx) => ctx.bundle('headers-merge', (b) => { put(b, 'note', sample()); }), ['CK-PRIVATE']);
    await assertRejected((ctx) => ctx.catalog((c) => { c.recipes[0].title += ` ${sample()}`; }), ['CK-PRIVATE']);
  });
}
test('fixtures use synthetic hosts only', () => assertRejected(
  (ctx) => ctx.bundle('dates-helper-trace', (b) => set(b, 'api.url', 'https://api.github.com/issues')), ['CK-SYNTHETIC']));

// ---------------------------------------------------------------- 5. compatibility
test('compatibility: skill-version floor uses numeric comparison and dates are real and not future', async () => {
  const setSkillVersion = (ctx, version) => {
    const path = join(ctx.skill, 'SKILL.md');
    const text = readFileSync(path, 'utf8');
    const next = text.replace(/version:\s*"[^"]+"/, `version: "${version}"`);
    assert.notEqual(next, text);
    writeFileSync(path, next);
  };
  await assertRejected((ctx) => ctx.catalog((c) => { c.recipes[0].compatibility.minSkillVersion = '9.9.9'; }), ['CK-COMPAT']);
  await assertRejected((ctx) => setSkillVersion(ctx, '0.2.0'), ['CK-COMPAT'], { exact: false });
  await assertRejected((ctx) => {
    ctx.catalog((c) => { for (const r of c.recipes) r.compatibility.minSkillVersion = '0.10.0'; });
    setSkillVersion(ctx, '0.9.0');
  }, ['CK-COMPAT']);
  await assertStillClean((ctx) => {
    ctx.catalog((c) => { for (const r of c.recipes) r.compatibility.minSkillVersion = '0.9.0'; });
    setSkillVersion(ctx, '0.10.0');
  });
  await assertRejected((ctx) => ctx.catalog((c) => { c.recipes[0].compatibility.reviewedOn = '2999-01-01'; }), ['CK-COMPAT']);
  await assertRejected((ctx) => ctx.catalog((c) => { c.recipes[0].compatibility.reviewedOn = 'yesterday'; }), ['CK-COMPAT']);
});

// ---------------------------------------------------------------- 6. recipe semantics (mutation matrix)
// [label, recipe, mutate(bundle, ctx), expected exact rule codes ([] = must stay valid)]
const SEMANTIC_CASES = [
  // dates + helper tracing
  ['trigger order contradicts provider sort', 'dates-helper-trace', (b) => set(b, 'api.response.trigger.order', 'asc'), ['CK-DATE-ORDER']],
  ['provider sort direction contradicts trigger order', 'dates-helper-trace', (b) => set(b, 'api.qs.direction', 'asc'), ['CK-DATE-ORDER']],
  ['trigger date is not parsed', 'dates-helper-trace', (b) => set(b, 'api.response.trigger.date', '{{item.created_at}}'), ['CK-DATE-PARSE']],
  ['misspelled helper call is untraceable', 'dates-helper-trace', (b) => set(b, 'api.response.output.updatedAt', '{{normalizeDat(item.updated_at)}}'), ['CK-HELPER-TRACE']],
  ['helper dependency removed from the catalog', 'dates-helper-trace', (b, ctx) => ctx.catalog((c) => {
    c.recipes.find((r) => r.id === 'dates-helper-trace').dependencies = [];
  }), ['CK-HELPER-TRACE']],
  ['dependency file no longer defines the helper', 'dates-helper-trace', (b, ctx) => {
    const dep = ctx.recipe('dates-helper-trace').dependencies.find((d) => d.type === 'file');
    ctx.write(dep.path, 'function somethingElse(value) { return value; }\n');
  }, ['CK-HELPER-TRACE']],
  ['consistent ascending order and sort stays valid', 'dates-helper-trace', (b) => { set(b, 'api.response.trigger.order', 'asc'); set(b, 'api.qs.direction', 'asc'); }, []],
  ['consistent helper rename stays valid', 'dates-helper-trace', (b, ctx) => {
    set(b, 'api.response.output.updatedAt', '{{toIsoDate(item.updated_at)}}');
    const dep = ctx.recipe('dates-helper-trace').dependencies.find((d) => d.type === 'file');
    ctx.write(dep.path, ctx.read(dep.path).replaceAll('normalizeDate', 'toIsoDate'));
  }, []],
  // A quoted string spelling a field is a constant, not provider-field provenance.
  ['helper given a single-quoted string that spells a field is not provider provenance', 'dates-helper-trace', (b) => set(b, 'api.response.output.updatedAt', "{{normalizeDate('item.updated_at')}}"), ['CK-HELPER-TRACE']],
  ['helper given a double-quoted string that spells a field is not provider provenance', 'dates-helper-trace', (b) => set(b, 'api.response.output.updatedAt', '{{normalizeDate("item.updated_at")}}'), ['CK-HELPER-TRACE']],
  ['helper given a non-provider variable is not provider provenance', 'dates-helper-trace', (b) => set(b, 'api.response.output.updatedAt', '{{normalizeDate(parameters.when)}}'), ['CK-HELPER-TRACE']],
  ['helper given a real field plus a quoted format literal stays valid', 'dates-helper-trace', (b) => set(b, 'api.response.output.updatedAt', "{{normalizeDate(item.updated_at, 'YYYY-MM-DD')}}"), []],
  ['helper given a quoted literal that spells a field AND a real field stays valid', 'dates-helper-trace', (b) => set(b, 'api.response.output.updatedAt', "{{normalizeDate('item.created_at', item.updated_at)}}"), []],
  ['helper given a real field and a literal containing parentheses stays valid', 'dates-helper-trace', (b) => set(b, 'api.response.output.updatedAt', "{{normalizeDate(item.updated_at, ')')}}"), []],
  ['helper given a real field nested inside a built-in call stays valid', 'dates-helper-trace', (b) => set(b, 'api.response.output.updatedAt', '{{normalizeDate(trim(item.updated_at))}}'), []],

  // selectors / mode
  ['select options reference an undefined RPC', 'selector-mode-dependent', (b) => set(b, 'parameters.0.options', 'rpc://missingList'), ['CK-SELECTOR-RPC']],
  ['dependent store references an undefined RPC', 'selector-mode-dependent', (b) => set(b, 'parameters.1.options.store', 'rpc://missingBoards'), ['CK-SELECTOR-RPC']],
  ['options RPC does not emit label/value', 'selector-mode-dependent', (b) => set(b, 'rpcs.listProjects.api.response.output', { name: '{{item.name}}' }), ['CK-SELECTOR-RPC']],
  ['unsupported mode value', 'selector-mode-dependent', (b) => set(b, 'parameters.0.mode', 'bogus'), ['CK-SELECTOR-MODE']],
  ['identifier selector in a Get module loses edit mode', 'selector-mode-dependent', (b) => del(b, 'parameters.0.mode'), ['CK-SELECTOR-MODE']],
  ['same selector in a Search module needs no edit mode (applicability exception)', 'selector-mode-dependent', (b) => { set(b, 'moduleKind', 'search'); del(b, 'parameters.0.mode'); }, []],
  ['child RPC reads an undeclared parent parameter', 'selector-mode-dependent', (b) => set(b, 'rpcs.listBoards.api.qs.workspace', '{{parameters.workspaceIdd}}'), ['CK-SELECTOR-NESTED']],
  ['nested child RPC stops reading its parent value', 'selector-mode-dependent', (b) => del(b, 'rpcs.listBoards.api.qs.workspace'), ['CK-SELECTOR-NESTED']],
  ['nested parent without a stored options source', 'selector-mode-dependent', (b) => del(b, 'parameters.1.options.store'), ['CK-SELECTOR-NESTED']],
  ['output interface points at an options RPC', 'selector-mode-dependent', (b) => set(b, 'interface', ['rpc://listProjects']), ['CK-SELECTOR-SCHEMA-CONFUSION']],
  ['select options point at a fields (schema) RPC', 'selector-mode-dependent', (b) => set(b, 'parameters.0.options', 'rpc://describeFields'), ['CK-SELECTOR-SCHEMA-CONFUSION']],
  ['relabeling a selector stays valid', 'selector-mode-dependent', (b) => set(b, 'parameters.0.label', 'Parent project'), []],

  // RPC / page budgets
  ['RPC without a record limit', 'rpc-page-budget', (b) => del(b, 'rpc.api.response.limit'), ['CK-BUDGET-BOUND']],
  ['RPC limit is a mapped expression', 'rpc-page-budget', (b) => set(b, 'rpc.api.response.limit', '{{parameters.limit}}'), ['CK-BUDGET-BOUND']],
  ['RPC limit exceeds the declared budget', 'rpc-page-budget', (b) => set(b, 'rpc.api.response.limit', 10000), ['CK-BUDGET-BOUND']],
  ['budget larger than pageSize x maxPages', 'rpc-page-budget', (b) => set(b, 'budget.maxRecords', 900), ['CK-BUDGET-PAGE']],
  ['request page size disagrees with the budget', 'rpc-page-budget', (b) => set(b, 'rpc.api.qs.limit', 50), ['CK-BUDGET-PAGE']],
  ['one-based page advanced with + 1', 'rpc-page-budget', (b) => set(b, 'rpc.api.pagination.qs.page', '{{pagination.page + 1}}'), ['CK-BUDGET-PAGE']],
  ['a smaller limit stays valid', 'rpc-page-budget', (b) => set(b, 'rpc.api.response.limit', 1), []],
  ['a consistently larger budget stays valid', 'rpc-page-budget', (b) => { set(b, 'budget.maxPages', 10); set(b, 'budget.maxRecords', 1000); }, []],

  // Headers merge
  ['base value wins over the request override', 'headers-merge', (b) => set(b, 'expectedEffectiveHeaders.accept', 'application/json'), ['CK-HEADERS-MERGE']],
  ['merge result drops an inherited base header', 'headers-merge', (b) => del(b, 'expectedEffectiveHeaders.user-agent'), ['CK-HEADERS-MERGE']],
  ['request adds a header the expectation omits', 'headers-merge', (b) => put(b, 'request.headers.X-Extra', 'v'), ['CK-HEADERS-MERGE']],
  ['case-insensitive duplicate inside one header block', 'headers-merge', (b) => put(b, 'base.headers.accept', 'duplicate'), ['CK-HEADERS-DUPLICATE']],
  ['header name case change stays valid', 'headers-merge', (b) => {
    const key = Object.keys(b.request.headers).find((k) => k.toLowerCase() === 'accept');
    assert.ok(key, 'fixture shape: request.headers needs an Accept override');
    const value = b.request.headers[key];
    delete b.request.headers[key];
    b.request.headers.ACCEPT = value;
  }, []],
  ['changing an inherited value and its expectation stays valid', 'headers-merge', (b) => {
    const key = Object.keys(b.base.headers).find((k) => k.toLowerCase() === 'user-agent');
    assert.ok(key, 'fixture shape: base.headers needs User-Agent');
    b.base.headers[key] = 'synthetic-app/2';
    set(b, 'expectedEffectiveHeaders.user-agent', 'synthetic-app/2');
  }, []],

  // Interfaces / required flags
  ['path parameter not marked required', 'interface-required-flags', (b) => set(b, 'expect.0.required', false), ['CK-REQUIRED-FLAG']],
  ['required input that no request uses', 'interface-required-flags', (b) => b.expect.push({ name: 'unusedRequired', type: 'text', label: 'Unused', required: true }), ['CK-REQUIRED-FLAG']],
  // Falsy loss is a bounded lexical rule: a direct `parameters.X || LITERAL` on a declared boolean/number
  // whose literal differs from the falsy value. A fallback equal to the falsy value preserves it.
  ['|| true replaces a valid false on an optional boolean', 'interface-required-flags', (b) => set(b, 'api.body.archived', '{{parameters.archived || true}}'), ['CK-FALSY-LOSS']],
  ['|| false preserves a valid false on an optional boolean (corrected expectation)', 'interface-required-flags', (b) => set(b, 'api.body.archived', '{{parameters.archived || false}}'), []],
  ['|| false without spaces preserves false', 'interface-required-flags', (b) => set(b, 'api.body.archived', '{{parameters.archived||false}}'), []],
  ['|| nonzero replaces a valid 0 on an optional number', 'interface-required-flags', (b) => { b.expect.push({ name: 'limit', type: 'number', label: 'Limit' }); put(b, 'api.body.limit', '{{parameters.limit || 10}}'); }, ['CK-FALSY-LOSS']],
  ['|| nonzero on an integer is also lossy', 'interface-required-flags', (b) => { b.expect.push({ name: 'limit', type: 'integer', label: 'Limit' }); put(b, 'api.body.limit', '{{parameters.limit||5}}'); }, ['CK-FALSY-LOSS']],
  ['|| 0 preserves a valid 0 on an optional number', 'interface-required-flags', (b) => { b.expect.push({ name: 'limit', type: 'number', label: 'Limit' }); put(b, 'api.body.limit', '{{parameters.limit || 0}}'); }, []],
  ['a quoted || inside a literal is not a fallback', 'interface-required-flags', (b) => set(b, 'api.body.archived', "{{if(parameters.archived, 'left || right', 'other')}}"), []],
  ['a fixed text fallback on a text parameter is harmless', 'interface-required-flags', (b) => set(b, 'api.body.title', "{{parameters.title || 'untitled'}}"), []],
  ['a boolean condition combining two parameters is not a literal fallback', 'interface-required-flags', (b) => set(b, 'api.body.title', "{{if(parameters.archived || parameters.title, 'a', 'b')}}"), []],
  ['a fallback of one parameter unrelated to a boolean field is harmless', 'interface-required-flags', (b) => set(b, 'api.body.title', '{{parameters.title || true}}'), []],
  ['interface field renamed away from the projection', 'interface-required-flags', (b) => set(b, 'interface.1.name', 'titleX'), ['CK-INTERFACE-DRIFT']],
  ['output projection loses an interface field', 'interface-required-flags', (b) => del(b, 'api.response.output.title'), ['CK-INTERFACE-DRIFT']],
  ['sample has the wrong type', 'interface-required-flags', (b) => set(b, 'samples.archived', 'false'), ['CK-INTERFACE-DRIFT']],
  ['an unused optional input stays valid', 'interface-required-flags', (b) => b.expect.push({ name: 'spare', type: 'text', label: 'Spare' }), []],
  ['required technical parent whose only RPC consumer stops reading it is flagged', 'interface-required-flags', (b) => del(b, 'rpcs.listLabels.api.qs.workspace'), ['CK-REQUIRED-FLAG']],
  ['required input consumed only by a dynamic interface stays valid', 'interface-required-flags', (b) => {
    del(b, 'rpcs.listLabels');
    put(b, 'dynamicInterface', { api: { qs: { workspace: '{{parameters.workspaceId}}' } } });
  }, []],
  ['RPC reads an undeclared input', 'interface-required-flags', (b) => put(b, 'rpcs.listLabels.api.qs.team', '{{parameters.teamId}}'), ['CK-REQUIRED-FLAG']],

  // Labels / visibility
  ['blank label', 'labels-visibility', (b) => set(b, 'parameters.0.label', ''), ['CK-LABEL']],
  ['label leaks the machine name', 'labels-visibility', (b) => set(b, 'parameters.1.label', 'timeoutSeconds'), ['CK-LABEL']],
  ['interface field without a label', 'labels-visibility', (b) => del(b, 'interface.0.label'), ['CK-LABEL']],
  ['duplicate labels in one form', 'labels-visibility', (b) => set(b, 'parameters.1.label', get(b, 'parameters.0.label')), ['CK-LABEL-UNIQUE']],
  ['required field hidden under advanced', 'labels-visibility', (b) => set(b, 'parameters.1.required', true), ['CK-VISIBILITY']],
  ['secret-named connection field shown as plain text', 'labels-visibility', (b) => set(b, 'connectionParameters.0.type', 'text'), ['CK-VISIBILITY']],
  ['required advanced field with a default stays valid (documented exception)', 'labels-visibility', (b) => { set(b, 'parameters.1.required', true); put(b, 'parameters.1.default', 30); }, []],
  ['secret-named module parameter is not required to be password (connection-only type)', 'labels-visibility', (b) => b.parameters.push({ name: 'sessionToken', type: 'text', label: 'Session value', required: false }), []],
  ['promoting a field out of advanced and requiring it stays valid', 'labels-visibility', (b) => { set(b, 'parameters.1.advanced', false); set(b, 'parameters.1.required', true); }, []],
  ['rewording a label stays valid', 'labels-visibility', (b) => set(b, 'parameters.0.label', 'Name shown in lists'), []],
  ['label differing from the name only by case is cosmetic', 'labels-visibility', (b) => set(b, 'interface.0.label', 'Id'), []],

  // Auth context evidence
  ['module request reads connection data from the wrong context', 'auth-context', (b) => set(b, 'module.api.headers.Authorization', 'Bearer {{data.accessToken}}'), ['CK-AUTH-CONTEXT']],
  ['Base reads a module parameter for authorization', 'auth-context', (b) => set(b, 'base.headers.Authorization', 'Bearer {{parameters.accessToken}}'), ['CK-AUTH-CONTEXT']],
  ['literal authorization value', 'auth-context', (b) => set(b, 'module.api.headers.Authorization', 'Bearer REPLACE_WITH_TOKEN'), ['CK-AUTH-CONTEXT']],
  ['refresh request reads a response-only variable', 'auth-context', (b) => set(b, 'connection.refresh.body.refresh_token', '{{body.refresh_token}}'), ['CK-AUTH-CONTEXT']],
  ['refresh may read stored data through the data alias (context alias, not an error)', 'auth-context', (b) => set(b, 'connection.refresh.body.refresh_token', '{{data.refreshToken}}'), []],
  ['token request may read submitted values through the connection alias', 'auth-context', (b) => set(b, 'connection.token.body.client_id', '{{connection.clientId}}'), []],
  ['token exchange without log masks', 'auth-context', (b) => set(b, 'connection.token.log.sanitize', []), ['CK-SECRET-LOG']],
  ['reordering log masks stays valid', 'auth-context', (b) => { b.connection.token.log.sanitize.reverse(); }, []],

  // Webhook verification / delivery / lifecycle
  ['verification condition is constant', 'webhook-lifecycle-delivery', (b) => set(b, 'receiver.verification.condition', '{{true}}'), ['CK-WEBHOOK-VERIFY']],
  ['challenge verification fails to acknowledge', 'webhook-lifecycle-delivery', (b) => set(b, 'receiver.verification.respond.status', 500), ['CK-WEBHOOK-VERIFY']],
  ['fixture claims signature verification it does not demonstrate', 'webhook-lifecycle-delivery', (b) => set(b, 'signatureVerification', 'verified'), ['CK-WEBHOOK-VERIFY']],
  ['delivery acknowledged with a server error', 'webhook-lifecycle-delivery', (b) => set(b, 'receiver.respond.status', 500), ['CK-WEBHOOK-DELIVERY']],
  ['delivered output drifts from the trigger interface', 'webhook-lifecycle-delivery', (b) => del(b, 'receiver.output.event'), ['CK-WEBHOOK-DELIVERY']],
  ['detach reads an identity attach never saved', 'webhook-lifecycle-delivery', (b) => set(b, 'detach.url', 'https://api.example.invalid/hooks/{{webhook.hookId}}'), ['CK-WEBHOOK-IDENTITY']],
  ['attach stops saving the provider hook id', 'webhook-lifecycle-delivery', (b) => del(b, 'attach.response.data.externalHookId'), ['CK-WEBHOOK-IDENTITY']],
  ['attach logs its signing secret', 'webhook-lifecycle-delivery', (b) => set(b, 'attach.log.sanitize', []), ['CK-SECRET-LOG']],
  ['another successful status stays valid', 'webhook-lifecycle-delivery', (b) => set(b, 'receiver.respond.status', 202), []],

  // Optional Endpoints
  ['Endpoint fixture stops being optional', 'optional-endpoint', (b) => set(b, 'optional', false), ['CK-ENDPOINT-OPTIONAL']],
  ['Endpoint request reads an undeclared input', 'optional-endpoint', (b) => set(b, 'endpoint.api.url', 'https://api.example.invalid/items/{{parameters.missingId}}'), ['CK-ENDPOINT-INPUT']],
  ['Endpoint request reads the legacy inputParameters root', 'optional-endpoint', (b) => set(b, 'endpoint.api.url', 'https://api.example.invalid/items/{{inputParameters.recordId}}'), ['CK-ENDPOINT-INPUT']],
  ['Endpoint request binds a second declared input', 'optional-endpoint', (b) => { b.endpoint.inputParameters.push({ name: 'page', type: 'text', label: 'Page' }); put(b, 'endpoint.api.qs.page', '{{parameters.page}}'); }, []],
  ['an extra optional Endpoint output stays valid', 'optional-endpoint', (b) => b.endpoint.outputParameters.push({ name: 'extra', type: 'text', label: 'Extra' }), []],

  // Compatibility / evidence confidence
  ['claim cites an unknown source', 'evidence-gates', (b) => set(b, 'claims.0.sourceIds', ['no-such-source']), ['CK-CLAIM-EVIDENCE']],
  ['documented claim without any source', 'evidence-gates', (b) => set(b, 'claims.0.sourceIds', []), ['CK-CLAIM-EVIDENCE']],
  ['unverified claim upgraded to documented without a source', 'evidence-gates', (b) => set(b, 'claims.1.status', 'documented'), ['CK-CLAIM-EVIDENCE']],
  ['provider execution reported performed by a static-only fixture', 'evidence-gates', (b) => set(b, 'gates.providerExecution', 'performed'), ['CK-GATES']],
  ['static gate performed without recorded evidence', 'evidence-gates', (b) => del(b, 'gateEvidence.static'), ['CK-GATES']],
  ['marking publication unavailable stays valid', 'evidence-gates', (b) => set(b, 'gates.publication', 'unavailable'), []],
];
for (const [label, recipe, mutate, expected] of SEMANTIC_CASES) {
  test(`${recipe}: ${label}`, () => (expected.length
    ? assertRejected((ctx) => ctx.bundle(recipe, mutate), expected)
    : assertStillClean((ctx) => ctx.bundle(recipe, mutate))));
}

// Dependency robustness and real-path containment for helper files and fixtures.
test('a non-array dependencies value yields CK-DEPENDENCY, not a TypeError', () => assertRejected((ctx) => ctx.catalog((c) => {
  c.recipes.find((r) => r.id === 'headers-merge').dependencies = {};
}), ['CK-DEPENDENCY']));

test('a helper dependency that is a symlink escaping current-knowledge is rejected and never read', () => assertRejected((ctx) => {
  const dep = ctx.recipe('dates-helper-trace').dependencies.find((d) => d.type === 'file');
  const outside = join(ctx.temp, 'outside-helper.js');
  writeFileSync(outside, readFileSync(join(ctx.ck, dep.path), 'utf8'));
  rmSync(join(ctx.ck, dep.path));
  symlinkSync(outside, join(ctx.ck, dep.path));
}, ['CK-DEPENDENCY', 'CK-HELPER-TRACE']));

test('a fixture that is a symlink escaping current-knowledge is rejected and never read', () => assertRejected((ctx) => {
  const rel = ctx.recipe('headers-merge').fixtures.correct;
  const outside = join(ctx.temp, 'outside-fixture.json');
  writeFileSync(outside, readFileSync(join(ctx.ck, rel), 'utf8'));
  rmSync(join(ctx.ck, rel));
  symlinkSync(outside, join(ctx.ck, rel));
}, ['CK-FORMAT']));

test('a helper dependency that is a symlink to a file inside current-knowledge stays valid', () => assertStillClean((ctx) => {
  const dep = ctx.recipe('dates-helper-trace').dependencies.find((d) => d.type === 'file');
  const real = join(ctx.ck, 'recipes', 'dates-helper-trace', 'functions-real.txt');
  writeFileSync(real, readFileSync(join(ctx.ck, dep.path), 'utf8'));
  rmSync(join(ctx.ck, dep.path));
  symlinkSync(real, join(ctx.ck, dep.path));
}));

// Focused skill-reference source kind: one positive, and the three ways a reference can be invalid.
const skillRefSource = (c) => c.sources.find((s) => s.kind === 'skill-reference');
test('skill-reference source: an existing in-tree reference with a reworded title stays valid', () => assertStillClean((ctx) => {
  ctx.catalog((c) => { skillRefSource(c).title = 'SDK Endpoints reference (reworded)'; });
}));
test('skill-reference source: a missing file is rejected', () => assertRejected((ctx) => {
  ctx.catalog((c) => { skillRefSource(c).path = 'references/no-such-reference.md'; });
}, ['CK-SOURCE', 'CK-GUIDE-SOURCES']));
test('skill-reference source: a path escaping references/ is rejected', () => assertRejected((ctx) => {
  ctx.catalog((c) => { skillRefSource(c).path = 'references/../SKILL.md'; });
}, ['CK-SOURCE', 'CK-GUIDE-SOURCES']));
test('skill-reference source: a symlink leaving references/ is rejected', () => assertRejected((ctx) => {
  const outside = join(ctx.skill, 'SKILL.md');
  symlinkSync(outside, join(ctx.skill, 'references', 'escaping-link.md'));
  ctx.catalog((c) => { skillRefSource(c).path = 'references/escaping-link.md'; });
}, ['CK-SOURCE', 'CK-GUIDE-SOURCES']));

// ---------------------------------------------------------------- 7. progressive routing, version, packaging
function frontmatterVersion(text) { return text.match(/^\s*version:\s*"([^"]+)"/m)?.[1]; }
function localLinks(file) {
  const text = readFileSync(file, 'utf8').replace(/```[\s\S]*?```/g, '');
  return [...text.matchAll(/\[[^\]]*\]\(([^)\s#]*)(?:#[^)\s]*)?\)/g)].map((m) => m[1]).filter((l) => l && !/^[a-z][a-z0-9+.-]*:/i.test(l))
    .map((l) => resolve(dirname(file), decodeURIComponent(l)));
}

test('skill is version 0.3.0', () => {
  assert.equal(frontmatterVersion(readFileSync(join(skillSource, 'SKILL.md'), 'utf8')), '0.3.0');
});

test('routing is progressive: entry and examples index reach the knowledge index, references reach topic guides', () => {
  const index = join(skillSource, 'examples/current-knowledge/README.md');
  assert.ok(existsSync(index));
  assert.ok(localLinks(join(skillSource, 'SKILL.md')).includes(index), 'SKILL.md must link the current-knowledge index');
  assert.ok(localLinks(join(skillSource, 'examples/README.md')).includes(index), 'examples index must link current-knowledge');
  const catalog = JSON.parse(readFileSync(join(skillSource, 'examples/current-knowledge/catalog.json'), 'utf8'));
  for (const topic of catalog.topics) {
    const guide = join(skillSource, 'examples/current-knowledge', topic.guide);
    assert.ok(REFERENCE_ROUTES[topic.id], `no routing expectation for topic ${topic.id}`);
    const routed = REFERENCE_ROUTES[topic.id].filter((name) => localLinks(join(skillSource, 'references', name)).includes(guide));
    assert.ok(routed.length > 0, `no reference among ${REFERENCE_ROUTES[topic.id].join(', ')} links ${topic.guide}`);
    assert.ok(localLinks(index).includes(guide), `index must link ${topic.guide}`);
  }
  const entryLines = readFileSync(join(skillSource, 'SKILL.md'), 'utf8').split('\n').length;
  assert.ok(entryLines < 500, 'entry must stay concise');
});

test('npm scripts expose the checker and include it in the aggregate check', () => {
  const pkg = JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8'));
  assert.ok(pkg.scripts['check:current-knowledge'], 'missing check:current-knowledge');
  assert.match(pkg.scripts['check:current-knowledge'], /check-current-knowledge\.mjs/);
  assert.match(pkg.scripts.check, /check:current-knowledge/);
  assert.ok(pkg.scripts['check:examples'], 'inherited example check must remain');
  assert.match(pkg.scripts['test:node'], /tests\/\*\.test\.mjs/);
});

test('the CLI exits 0 on the shipped tree and 1 with the rule code on a broken copy', async () => {
  const run = (examples) => spawnSync(process.execPath, [checkerPath, '--examples-root', examples], { cwd: tmpdir(), encoding: 'utf8', timeout: 30000 });
  const ok = run(join(skillSource, 'examples'));
  assert.equal(ok.status, 0, ok.stderr + ok.stdout);
  await withCopy((ctx) => {
    ctx.bundle('dates-helper-trace', (b) => set(b, 'api.response.trigger.order', 'asc'));
    const bad = run(ctx.examples);
    assert.equal(bad.status, 1, bad.stdout);
    assert.match(bad.stderr, /CK-DATE-ORDER/);
  });
});

test('packaging includes the knowledge tree deterministically without unsafe names', () => {
  const temp = realpathSync(mkdtempSync(join(tmpdir(), 'make-ck-build-')));
  try {
    const build = (name) => {
      const output = join(temp, name);
      const result = spawnSync('python3', ['-B', join(repo, 'scripts/build-skill.py'), '--output', output], { cwd: repo, encoding: 'utf8', timeout: 60000 });
      assert.equal(result.status, 0, result.stderr + result.stdout);
      return readFileSync(output);
    };
    const first = build('a.zip');
    assert.ok(first.equals(build('b.zip')), 'archive must be byte-identical across builds');
    const catalog = JSON.parse(readFileSync(join(skillSource, 'examples/current-knowledge/catalog.json'), 'utf8'));
    const names = [
      'examples/current-knowledge/README.md', 'examples/current-knowledge/catalog.json',
      ...catalog.topics.map((t) => `examples/current-knowledge/${t.guide}`),
      ...catalog.recipes.flatMap((r) => [r.fixtures.correct, ...r.fixtures.incorrect.map((n) => n.file)].map((f) => `examples/current-knowledge/${f}`)),
    ];
    for (const name of names) assert.ok(first.includes(Buffer.from(`make-custom-apps/${name}`)), `archive lacks ${name}`);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
