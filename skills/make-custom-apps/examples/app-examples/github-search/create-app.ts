#!/usr/bin/env node
// Management script: runs in your terminal and calls the Make API. It is NOT Make app runtime code.
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import type { Make } from '@makehq/sdk';
import { createApp, formatReport, MAKE_ZONE, MODULE_SECTIONS, SAFE_NAME } from './create-app-core.ts';
import type { AppPlan, ManagementClient } from './create-app-core.ts';
import { createMockClient } from './mock-client.ts';

export type PlanOptions = { app: Partial<AppPlan['app']>; module: Partial<AppPlan['module']> };

export type CliDeps = {
  env: Readonly<Record<string, string | undefined>>;
  loadPlan: (options: PlanOptions) => AppPlan;
  connect: (credentials: { apiKey: string; zone: string }) => Promise<ManagementClient>;
  out: (line: string) => void;
  err: (line: string) => void;
};

const SECTION_FILES = {
  base: 'base.imljson', api: 'api.imljson', parameters: 'parameters.imljson',
  expect: 'expect.imljson', interface: 'interface.imljson', samples: 'samples.imljson',
} as const;

const USAGE = `Usage: create-app [--live --app-name <name> --audience <audience> --module-type-id <integer>]

Default: an in-memory mock run. It needs no environment and makes no Make API call.
--live: creates a PRIVATE app in your Make account. It requires
  MAKE_API_KEY and MAKE_ZONE (for example eu1.make.com) in the environment, plus the three flags.
  The audience and module type id are never defaulted: take them from your own Make account or its documentation.`;

export function defaultSourceDir(): string {
  let directory = dirname(fileURLToPath(import.meta.url));
  while (!existsSync(join(directory, 'package.json'))) {
    const parent = dirname(directory);
    if (parent === directory) throw new Error('could not locate the example directory');
    directory = parent;
  }
  return directory;
}

function readSource(directory: string, file: string): string {
  const text = readFileSync(join(directory, file), 'utf8');
  try {
    JSON.parse(text);
  } catch {
    throw new Error(`${file} is not valid JSON`);
  }
  return text;
}

export function loadPlan(options: PlanOptions, directory: string = defaultSourceDir()): AppPlan {
  const read = (key: keyof typeof SECTION_FILES) => readSource(directory, SECTION_FILES[key]);
  const moduleSections = Object.fromEntries(MODULE_SECTIONS.map((section) => [section, read(section)])) as AppPlan['moduleSections'];
  return {
    app: {
      name: 'github-search-example', label: 'GitHub search example',
      description: 'Teaching app created by the make-custom-apps skill example script.', audience: 'mock-audience',
      ...options.app,
    },
    module: {
      name: 'searchRepositories', label: 'Search repositories',
      description: 'Searches public GitHub repositories.', typeId: 0,
      ...options.module,
    },
    base: read('base'),
    moduleSections,
  };
}

export function fromMake(make: Make): ManagementClient {
  return { apps: make.sdk.apps, modules: make.sdk.modules };
}

// Automatic retries are disabled so a write whose outcome is unknown is never silently repeated.
export async function connectToMake(credentials: { apiKey: string; zone: string }): Promise<ManagementClient> {
  const { Make } = await import('@makehq/sdk');
  return fromMake(new Make(credentials.apiKey, credentials.zone, {
    retry: { maxRetries: 0, onRateLimit: false, onServerError: false },
  }));
}

export async function run(argv: readonly string[], deps: CliDeps): Promise<number> {
  let values;
  try {
    ({ values } = parseArgs({
      args: [...argv], strict: true, allowPositionals: false,
      options: {
        live: { type: 'boolean' }, help: { type: 'boolean' },
        'app-name': { type: 'string' }, audience: { type: 'string' }, 'module-type-id': { type: 'string' },
      },
    }));
  } catch {
    deps.err('Unknown or malformed option.');
    deps.err(USAGE);
    return 2;
  }
  if (values.help) {
    deps.out(USAGE);
    return 0;
  }

  if (!values.live) {
    if (values['app-name'] !== undefined || values.audience !== undefined || values['module-type-id'] !== undefined) {
      deps.err('--app-name, --audience and --module-type-id only apply with --live. Re-run with --live, or drop them for the mock run.');
      return 2;
    }
    let plan: AppPlan;
    try {
      plan = deps.loadPlan({ app: {}, module: {} });
    } catch (error) {
      deps.err(error instanceof Error ? error.message : 'could not load the example sources');
      return 2;
    }
    const report = await createApp(createMockClient(), plan);
    deps.out(formatReport(report, 'mock'));
    return report.ok ? 0 : 1;
  }

  const problems: string[] = [];
  const apiKey = deps.env['MAKE_API_KEY'];
  const zone = deps.env['MAKE_ZONE'];
  const appName = values['app-name'];
  const audience = values.audience;
  const typeIdText = values['module-type-id'];

  if (!apiKey) problems.push('MAKE_API_KEY is not set in the environment.');
  if (!zone) problems.push('MAKE_ZONE is not set in the environment (for example eu1.make.com).');
  else if (!MAKE_ZONE.test(zone)) problems.push('MAKE_ZONE must be a bare Make hostname such as eu1.make.com, with no scheme, path, port or credentials.');
  if (!appName) problems.push('--app-name is required.');
  else if (!SAFE_NAME.test(appName)) problems.push('--app-name must use only letters, digits, "-" and "_", start with a letter or digit, and be at most 64 characters.');
  if (!audience) problems.push('--audience is required; it is never defaulted.');
  if (typeIdText === undefined) problems.push('--module-type-id is required; it is never defaulted.');
  else if (!/^\d{1,9}$/.test(typeIdText)) problems.push('--module-type-id must be a non-negative integer.');
  if (problems.length > 0 || !apiKey || !zone || !appName || !audience || typeIdText === undefined) {
    for (const problem of problems) deps.err(problem);
    deps.err(USAGE);
    return 2;
  }

  let plan: AppPlan;
  try {
    plan = deps.loadPlan({ app: { name: appName, audience }, module: { typeId: Number(typeIdText) } });
  } catch (error) {
    deps.err(error instanceof Error ? error.message : 'could not load the example sources');
    return 2;
  }
  if (!SAFE_NAME.test(plan.module.name)) {
    deps.err('The module name is not URL-path safe.');
    return 2;
  }

  let client: ManagementClient;
  try {
    client = await deps.connect({ apiKey, zone });
  } catch {
    deps.err('Could not create the Make client.');
    return 1;
  }
  const report = await createApp(client, plan);
  deps.out(formatReport(report, 'live'));
  return report.ok ? 0 : 1;
}

const entry = process.argv[1];
if (entry !== undefined && realpathSync(resolve(entry)) === realpathSync(fileURLToPath(import.meta.url))) {
  process.exitCode = await run(process.argv.slice(2), {
    env: process.env,
    loadPlan: (options) => loadPlan(options),
    connect: connectToMake,
    out: (line) => console.log(line),
    err: (line) => console.error(line),
  });
}
