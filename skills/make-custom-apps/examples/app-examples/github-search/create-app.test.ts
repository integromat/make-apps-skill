import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mock, test } from 'node:test';
import { MakeError } from '@makehq/sdk';
import { createApp, formatReport } from './create-app-core.ts';
import type { AppPlan, ManagementClient } from './create-app-core.ts';
import { connectToMake, defaultSourceDir, loadPlan, run } from './create-app.ts';
import type { CliDeps } from './create-app.ts';
import { createMockClient } from './mock-client.ts';

// Values built at runtime so no credential-shaped literal exists in the source.
const API_KEY_CANARY = ['canary', 'api', 'value', 'x'.repeat(24)].join('-');
const API_ERROR_CANARY = ['canary', 'provider', 'detail', 'y'.repeat(24)].join('-');

const plan: AppPlan = {
  app: { name: 'github-search-example', label: 'GitHub search example', description: 'Teaching app.', audience: 'verified-audience' },
  module: { name: 'searchRepositories', label: 'Search repositories', description: 'Searches public repositories.', typeId: 4242 },
  base: '{\n  "baseUrl": "https://api.github.com"\n}\n',
  moduleSections: {
    api: '{\n  "url": "https://api.github.com/search/repositories"\n}\n',
    parameters: '[]\n',
    expect: '[{ "name": "q", "type": "text" }]\n',
    interface: '[{ "name": "id", "type": "number" }]\n',
    samples: '{ "id": 1 }\n',
  },
};

const fullSequence = [
  'apps.create', 'apps.get', 'apps.setSection:base', 'apps.getSection:base', 'modules.create',
  'modules.setSection:api', 'modules.getSection:api',
  'modules.setSection:parameters', 'modules.getSection:parameters',
  'modules.setSection:expect', 'modules.getSection:expect',
  'modules.setSection:interface', 'modules.getSection:interface',
  'modules.setSection:samples', 'modules.getSection:samples',
  'modules.get',
];

function stepStatuses(report: Awaited<ReturnType<typeof createApp>>) {
  return Object.fromEntries(report.steps.map((step) => [step.name, step.status]));
}

test('creates a private app, Base and search module in dependency order with exact section readback', async () => {
  const client = createMockClient({ appVersion: 7 });
  const report = await createApp(client, plan);

  assert.equal(report.ok, true);
  assert.deepEqual(client.records.map((record) => record.label), fullSequence);
  assert.deepEqual(client.records[0]?.args, [{
    name: 'github-search-example', label: 'GitHub search example', description: 'Teaching app.',
    private: true, audience: 'verified-audience',
  }]);
  assert.deepEqual(client.records[1]?.args, ['github-search-example', 7, { cols: ['name', 'version', 'public'] }]);
  assert.deepEqual(client.records[2]?.args, ['github-search-example', 7, 'base', plan.base]);
  assert.deepEqual(client.records[4]?.args, ['github-search-example', 7, {
    name: 'searchRepositories', typeId: 4242, label: 'Search repositories',
    description: 'Searches public repositories.', moduleInitMode: 'blank',
  }]);
  for (const section of ['api', 'parameters', 'expect', 'interface', 'samples'] as const) {
    const write = client.records.find((record) => record.label === `modules.setSection:${section}`);
    assert.deepEqual(write?.args, ['github-search-example', 7, 'searchRepositories', section, plan.moduleSections[section]]);
  }
  assert.deepEqual(report.app, { name: 'github-search-example', version: 7, private: true });
  assert.ok(report.steps.every((step) => step.status === 'ok'));
});

test('stops before any section write when the create acknowledgement reports a public app', async () => {
  const client = createMockClient({ publicOnCreate: true });
  const report = await createApp(client, plan);

  assert.equal(report.ok, false);
  assert.deepEqual(client.records.map((record) => record.label), ['apps.create']);
  assert.equal(stepStatuses(report)['app.create'], 'failed');
  assert.equal(stepStatuses(report)['base.write'], 'not-attempted');
  assert.equal(stepStatuses(report)['module.create'], 'not-attempted');
});

test('stops before any section write when the full GET does not confirm a private app', async () => {
  const client = createMockClient({ publicOnGet: true });
  const report = await createApp(client, plan);

  assert.equal(report.ok, false);
  assert.deepEqual(client.records.map((record) => record.label), ['apps.create', 'apps.get']);
  assert.equal(stepStatuses(report)['app.verifyPrivate'], 'failed');
  assert.equal(stepStatuses(report)['base.write'], 'not-attempted');
});

test('reports readback drift, never repeats a write, and does not echo section content', async () => {
  const secretLookingContent = ['canary', 'section', 'content', 'z'.repeat(24)].join('-');
  const drifting: AppPlan = { ...plan, moduleSections: { ...plan.moduleSections, api: `{ "url": "${secretLookingContent}" }\n` } };
  const client = createMockClient({ normalizeOnWrite: { 'modules.setSection:api': (text) => text.replace(/\s+/g, '') } });
  const report = await createApp(client, drifting);

  assert.equal(report.ok, false);
  assert.deepEqual(client.records.map((record) => record.label), [
    'apps.create', 'apps.get', 'apps.setSection:base', 'apps.getSection:base', 'modules.create',
    'modules.setSection:api', 'modules.getSection:api',
  ]);
  const statuses = stepStatuses(report);
  assert.equal(statuses['module.api.write'], 'ok');
  assert.equal(statuses['module.api.readback'], 'failed');
  assert.equal(statuses['module.parameters.write'], 'not-attempted');
  assert.equal(statuses['module.verify'], 'not-attempted');
  assert.ok(!formatReport(report, 'mock').includes(secretLookingContent));
  assert.match(formatReport(report, 'mock'), /module\.api\.readback/);
});

test('a write rejected by the service is classified without leaking API key or provider detail', async () => {
  const rejection = new MakeError(`denied for ${API_KEY_CANARY}`, 403);
  rejection.apiError = { detail: API_ERROR_CANARY };
  rejection.subErrors = [API_ERROR_CANARY];
  const client = createMockClient({ failAt: { 'modules.setSection:expect': rejection } });
  const report = await createApp(client, plan);
  const text = formatReport(report, 'mock');

  assert.equal(report.ok, false);
  assert.equal(stepStatuses(report)['module.parameters.readback'], 'ok');
  assert.equal(stepStatuses(report)['module.expect.write'], 'failed');
  assert.equal(stepStatuses(report)['module.interface.write'], 'not-attempted');
  assert.match(text, /HTTP 403/);
  assert.ok(!text.includes(API_KEY_CANARY) && !text.includes(API_ERROR_CANARY));
});

test('an uncertain app creation is neither retried nor followed by writes and says to inspect before re-running', async () => {
  const client = createMockClient({ failAt: { 'apps.create': new MakeError(API_ERROR_CANARY, 503) } });
  const report = await createApp(client, plan);
  const text = formatReport(report, 'mock');

  assert.deepEqual(client.records.map((record) => record.label), ['apps.create']);
  assert.match(text, /uncertain/i);
  assert.ok(!text.includes(API_ERROR_CANARY));
});

test('rejects a module acknowledgement whose name or type differs from the request', async () => {
  for (const faults of [{ moduleNameOverride: 'otherModule' }, { moduleTypeIdOverride: 1 }] as const) {
    const client = createMockClient(faults);
    const report = await createApp(client, plan);
    assert.equal(report.ok, false, JSON.stringify(faults));
    assert.equal(client.records.some((record) => record.label === 'modules.setSection:api'), false);
  }
});

function cliDeps(overrides: Partial<CliDeps> & { client?: ManagementClient } = {}) {
  const lines: string[] = [];
  const connections: Array<{ apiKey: string; zone: string }> = [];
  const deps: CliDeps = {
    env: {},
    loadPlan: (options) => ({ ...plan, app: { ...plan.app, ...options.app }, module: { ...plan.module, ...options.module } }),
    connect: async (credentials) => {
      connections.push(credentials);
      if (!overrides.client) throw new Error('connect must not be called');
      return overrides.client;
    },
    out: (line) => lines.push(line),
    err: (line) => lines.push(line),
    ...overrides,
  };
  return { deps, lines, connections };
}

const liveArgs = ['--live', '--app-name', 'my-private-app', '--audience', 'verified-audience', '--module-type-id', '4242'];

test('defaults to a credential-free in-memory mock and never connects, even when credentials are present', async () => {
  const { deps, lines, connections } = cliDeps({ env: { MAKE_API_KEY: API_KEY_CANARY, MAKE_ZONE: 'eu1.make.com' } });
  const code = await run([], deps);
  const output = lines.join('\n');

  assert.equal(code, 0);
  assert.equal(connections.length, 0);
  assert.match(output, /mock/i);
  assert.match(output, /no Make API call/i);
  assert.ok(!output.includes(API_KEY_CANARY));
});

test('--live without credentials or explicit target inputs fails before connecting and names only what is missing', async () => {
  const { deps, lines, connections } = cliDeps();
  const code = await run(['--live'], deps);
  const output = lines.join('\n');

  assert.equal(code, 2);
  assert.equal(connections.length, 0);
  for (const name of ['MAKE_API_KEY', 'MAKE_ZONE', '--app-name', '--audience', '--module-type-id']) {
    assert.ok(output.includes(name), `${name} not reported`);
  }
});

test('--live rejects zones that could send the API key to another host', async () => {
  for (const zone of ['https://eu1.make.com', 'eu1.make.com/api/v2', 'evil.example', 'eu1.make.com.evil.example',
    'user@eu1.make.com', 'eu1.make.com:8443', '']) {
    const { deps, lines, connections } = cliDeps({ env: { MAKE_API_KEY: API_KEY_CANARY, MAKE_ZONE: zone } });
    const code = await run(liveArgs, deps);
    assert.equal(code, 2, `zone ${JSON.stringify(zone)} accepted`);
    assert.equal(connections.length, 0);
    assert.ok(!lines.join('\n').includes(API_KEY_CANARY));
  }
});

test('--live rejects app and module names that are not URL-path safe before any remote call', async () => {
  for (const name of ['../apps', 'a/b', 'a b', 'name?x=1', '']) {
    const { deps, connections } = cliDeps({ env: { MAKE_API_KEY: API_KEY_CANARY, MAKE_ZONE: 'eu1.make.com' } });
    const code = await run(['--live', '--app-name', name, '--audience', 'verified-audience', '--module-type-id', '4242'], deps);
    assert.equal(code, 2, `name ${JSON.stringify(name)} accepted`);
    assert.equal(connections.length, 0);
  }
});

test('--live connects once with the caller-provided credentials, writes through the client and never prints them', async () => {
  const client = createMockClient();
  const { deps, lines, connections } = cliDeps({ client, env: { MAKE_API_KEY: API_KEY_CANARY, MAKE_ZONE: 'eu1.make.com' } });
  const code = await run(liveArgs, deps);
  const output = lines.join('\n');

  assert.equal(code, 0);
  assert.deepEqual(connections, [{ apiKey: API_KEY_CANARY, zone: 'eu1.make.com' }]);
  assert.deepEqual(client.records.map((record) => record.label), fullSequence);
  assert.deepEqual(client.records[0]?.args, [{
    name: 'my-private-app', label: 'GitHub search example', description: 'Teaching app.',
    private: true, audience: 'verified-audience',
  }]);
  assert.match(output, /live/i);
  assert.ok(!output.includes(API_KEY_CANARY));
});

test('a failed live run exits 1 with a partial-state report and no credential or provider detail', async () => {
  const failure = new MakeError(`${API_KEY_CANARY} ${API_ERROR_CANARY}`, 500);
  const client = createMockClient({ failAt: { 'modules.create': failure } });
  const { deps, lines } = cliDeps({ client, env: { MAKE_API_KEY: API_KEY_CANARY, MAKE_ZONE: 'eu1.make.com' } });
  const code = await run(liveArgs, deps);
  const output = lines.join('\n');

  assert.equal(code, 1);
  assert.match(output, /base\.readback.*ok/s);
  assert.match(output, /module\.create.*failed/s);
  assert.ok(!output.includes(API_KEY_CANARY) && !output.includes(API_ERROR_CANARY));
});

test('a live failure before connecting leaves no write: an unparseable local source stops the run', async () => {
  const { deps, connections, lines } = cliDeps({
    env: { MAKE_API_KEY: API_KEY_CANARY, MAKE_ZONE: 'eu1.make.com' },
    loadPlan: () => { throw new Error('api.imljson is not valid JSON'); },
  });
  const code = await run(liveArgs, deps);

  assert.equal(code, 2);
  assert.equal(connections.length, 0);
  assert.match(lines.join('\n'), /api\.imljson is not valid JSON/);
});

test('rejects --live combined with unknown options', async () => {
  const { deps, connections } = cliDeps({ env: { MAKE_API_KEY: API_KEY_CANARY, MAKE_ZONE: 'eu1.make.com' } });
  assert.equal(await run([...liveArgs, '--unknown'], deps), 2);
  assert.equal(connections.length, 0);
});

test('the shipped example sources are uploaded byte-for-byte and each parses as JSON', async () => {
  const directory = defaultSourceDir();
  const loaded = loadPlan({ app: {}, module: {} }, directory);
  const files = { base: 'base.imljson', api: 'api.imljson', parameters: 'parameters.imljson',
    expect: 'expect.imljson', interface: 'interface.imljson', samples: 'samples.imljson' };
  assert.equal(loaded.base, readFileSync(join(directory, files.base), 'utf8'));
  for (const section of ['api', 'parameters', 'expect', 'interface', 'samples'] as const) {
    assert.equal(loaded.moduleSections[section], readFileSync(join(directory, files[section]), 'utf8'));
    JSON.parse(loaded.moduleSections[section]);
  }
  JSON.parse(loaded.base);

  const client = createMockClient();
  assert.equal((await createApp(client, loaded)).ok, true);
});

// The real SDK class, with only the network transport replaced, proves actual call shapes and no retry.
function installFakeService(options: {
  sectionContentType?: string; failCreateWith?: number; failFirstPutAt?: { path: string; status: number };
} = {}) {
  const sections = new Map<string, string>();
  let failedPutOnce = false;
  const failure = (status: number) => new Response(JSON.stringify({ message: API_ERROR_CANARY }), {
    status, headers: { 'content-type': 'application/json', 'retry-after': '0' },
  });
  const requests: Array<{ method: string; path: string; body: unknown; hasAuthorization: boolean }> = [];
  const json = (value: unknown) => new Response(JSON.stringify(value), { status: 200, headers: { 'content-type': 'application/json' } });
  const handler = mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    const method = init?.method ?? 'GET';
    const body = typeof init?.body === 'string' ? init.body : undefined;
    requests.push({
      method, path: url.pathname,
      body: body !== undefined && method === 'POST' ? JSON.parse(body) : body,
      hasAuthorization: new Headers(init?.headers).has('authorization'),
    });
    if (url.hostname !== 'eu1.make.com') throw new Error(`unexpected host ${url.hostname}`);
    const path = url.pathname.replace('/api/v2', '');
    if (method === 'POST' && path === '/sdk/apps') {
      if (options.failCreateWith) return failure(options.failCreateWith);
      return json({ app: { name: 'my-private-app', label: 'L', description: 'D', version: 1, theme: '#000000', public: false, approved: false } });
    }
    if (method === 'GET' && path === '/sdk/apps/my-private-app/1') {
      return json({ app: { name: 'my-private-app', version: 1, public: false } });
    }
    if (method === 'POST' && path === '/sdk/apps/my-private-app/1/modules') {
      return json({ appModule: { name: 'searchRepositories', label: 'L', description: 'D', typeId: 4242, public: false, approved: false, crud: null, connection: null, altConnection: null, webhook: null } });
    }
    if (method === 'GET' && path === '/sdk/apps/my-private-app/1/modules/searchRepositories') {
      return json({ appModule: { name: 'searchRepositories', label: 'L', description: 'D', typeId: 4242, public: false, approved: false, crud: null, connection: null, altConnection: null, webhook: null } });
    }
    if (method === 'PUT' && options.failFirstPutAt?.path === path && !failedPutOnce) {
      failedPutOnce = true;
      return failure(options.failFirstPutAt.status);
    }
    if (method === 'PUT') { sections.set(path, body ?? ''); return new Response('', { status: 200 }); }
    if (method === 'GET' && sections.has(path)) {
      return new Response(sections.get(path), { status: 200, headers: { 'content-type': options.sectionContentType ?? 'text/plain' } });
    }
    return new Response('{}', { status: 404, headers: { 'content-type': 'application/json' } });
  });
  return { requests, sections, restore: () => handler.mock.restore() };
}

const livePlan: AppPlan = { ...plan, app: { ...plan.app, name: 'my-private-app' } };

test('the real SDK client issues the expected requests for the whole sequence', async () => {
  const service = installFakeService();
  try {
    const report = await createApp(await connectToMake({ apiKey: API_KEY_CANARY, zone: 'eu1.make.com' }), livePlan);
    assert.equal(report.ok, true, formatReport(report, 'live'));
    assert.deepEqual(service.requests.map((request) => `${request.method} ${request.path.replace('/api/v2', '')}`), [
      'POST /sdk/apps', 'GET /sdk/apps/my-private-app/1', 'PUT /sdk/apps/my-private-app/1/base', 'GET /sdk/apps/my-private-app/1/base',
      'POST /sdk/apps/my-private-app/1/modules',
      ...['api', 'parameters', 'expect', 'interface', 'samples'].flatMap((section) => [
        `PUT /sdk/apps/my-private-app/1/modules/searchRepositories/${section}`,
        `GET /sdk/apps/my-private-app/1/modules/searchRepositories/${section}`]),
      'GET /sdk/apps/my-private-app/1/modules/searchRepositories',
    ]);
    assert.equal(service.requests[0]?.hasAuthorization, true);
    assert.deepEqual(service.requests[0]?.body, {
      name: 'my-private-app', label: 'GitHub search example', description: 'Teaching app.', private: true, audience: 'verified-audience',
    });
    assert.equal(service.sections.get('/sdk/apps/my-private-app/1/base'), plan.base);
  } finally {
    service.restore();
  }
});

test('the real SDK client does not retry a server error on app creation', async () => {
  const service = installFakeService({ failCreateWith: 503 });
  try {
    const report = await createApp(await connectToMake({ apiKey: API_KEY_CANARY, zone: 'eu1.make.com' }), livePlan);
    assert.equal(report.ok, false);
    assert.equal(service.requests.length, 1);
    assert.ok(!formatReport(report, 'live').includes(API_ERROR_CANARY));
  } finally {
    service.restore();
  }
});

const FAILED_PUT_PATH = '/sdk/apps/my-private-app/1/modules/searchRepositories/api';

for (const status of [503, 429]) {
  test(`the real SDK client does not retry a module section write answered with ${status} and Retry-After 0`, async () => {
    const sectionCanary = ['canary', 'section', 'content', 'z'.repeat(24)].join('-');
    const canaryPlan: AppPlan = { ...livePlan, moduleSections: { ...livePlan.moduleSections, api: `{ "url": "${sectionCanary}" }\n` } };
    const service = installFakeService({ failFirstPutAt: { path: FAILED_PUT_PATH, status } });
    try {
      const report = await createApp(await connectToMake({ apiKey: API_KEY_CANARY, zone: 'eu1.make.com' }), canaryPlan);
      const seen = service.requests.map((request) => `${request.method} ${request.path.replace('/api/v2', '')}`);

      assert.equal(report.ok, false);
      assert.equal(seen.filter((entry) => entry === `PUT ${FAILED_PUT_PATH}`).length, 1);
      assert.deepEqual(seen, [
        'POST /sdk/apps', 'GET /sdk/apps/my-private-app/1', 'PUT /sdk/apps/my-private-app/1/base', 'GET /sdk/apps/my-private-app/1/base',
        'POST /sdk/apps/my-private-app/1/modules', `PUT ${FAILED_PUT_PATH}`,
      ]);
      assert.equal(service.sections.has(FAILED_PUT_PATH), false);

      const statuses = stepStatuses(report);
      assert.equal(statuses['base.readback'], 'ok');
      assert.equal(statuses['module.create'], 'ok');
      assert.equal(statuses['module.api.write'], 'failed');
      for (const later of ['module.api.readback', 'module.parameters.write', 'module.parameters.readback',
        'module.expect.write', 'module.expect.readback', 'module.interface.write', 'module.interface.readback',
        'module.samples.write', 'module.samples.readback', 'module.verify']) {
        assert.equal(statuses[later], 'not-attempted', later);
      }

      const text = formatReport(report, 'live');
      assert.match(text, new RegExp(`HTTP ${status}`));
      for (const canary of [API_KEY_CANARY, API_ERROR_CANARY, sectionCanary]) assert.ok(!text.includes(canary));
    } finally {
      service.restore();
    }
  });
}

test('a section the service returns as parsed JSON instead of text is reported as a readback failure', async () => {
  const service = installFakeService({ sectionContentType: 'application/json' });
  try {
    const report = await createApp(await connectToMake({ apiKey: API_KEY_CANARY, zone: 'eu1.make.com' }), livePlan);
    assert.equal(report.ok, false);
    assert.equal(stepStatuses(report)['base.readback'], 'failed');
    assert.equal(stepStatuses(report)['module.create'], 'not-attempted');
  } finally {
    service.restore();
  }
});
