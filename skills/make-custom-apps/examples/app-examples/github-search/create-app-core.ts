// Management script logic: runs in your terminal and calls the Make API. It is NOT Make app runtime code.
import type {
  CreateSDKAppBody,
  GetSDKAppsOptions,
  PickColumns,
  SDKApp,
  SDKApps,
  SDKModules,
  SDKModuleSectionType,
} from '@makehq/sdk';

export const MODULE_SECTIONS = ['api', 'parameters', 'expect', 'interface', 'samples'] as const satisfies readonly SDKModuleSectionType[];
export type ModuleSection = (typeof MODULE_SECTIONS)[number];

type AppReadColumns = 'name' | 'version' | 'public';

// Derived from the published declarations, so a signature change in @makehq/sdk fails the typecheck.
export type AppsApi = Pick<SDKApps, 'create' | 'setSection' | 'getSection'> & {
  get(name: string, version: number, options: GetSDKAppsOptions<AppReadColumns>): Promise<PickColumns<SDKApp, AppReadColumns>>;
};
export type ModulesApi = Pick<SDKModules, 'create' | 'get' | 'setSection' | 'getSection'>;
export type ManagementClient = { apps: AppsApi; modules: ModulesApi };

export type AppPlan = {
  app: Pick<CreateSDKAppBody, 'name' | 'label' | 'audience'> & { description: string };
  module: { name: string; label: string; description: string; typeId: number };
  base: string;
  moduleSections: Record<ModuleSection, string>;
};

export type StepStatus = 'ok' | 'failed' | 'not-attempted';
export type Step = { name: string; status: StepStatus; detail?: string };
export type Report = {
  ok: boolean;
  app?: { name: string; version: number; private: boolean | null };
  steps: Step[];
};

// Names are placed into URL paths by the SDK without encoding; the service remains the authority on valid names.
export const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
// A deliberately narrow guard: the API key is sent to this host, so only bare Make hostnames are accepted.
export const MAKE_ZONE = /^[a-z0-9-]+\.make\.(?:com|celonis\.com)$/;

class CheckFailure extends Error {}

function httpStatus(error: unknown): number | undefined {
  return typeof error === 'object' && error !== null && 'statusCode' in error && typeof error.statusCode === 'number'
    ? error.statusCode
    : undefined;
}

// Never include the error message, response body or API diagnostics: they can echo credentials or section source.
export function describeRemoteError(error: unknown): string {
  const status = httpStatus(error);
  if (status === undefined) {
    const name = error instanceof Error && /^[A-Za-z]{1,40}$/.test(error.name) ? error.name : 'error';
    return `the request failed without a usable response (${name}). Outcome uncertain: inspect the target in Make before re-running; this script never retries.`;
  }
  const meaning = status === 400 || status === 422 ? 'request rejected as invalid'
    : status === 401 ? 'authentication rejected'
    : status === 403 ? 'permission or scope denied'
    : status === 404 ? 'target not found'
    : status === 409 ? 'conflict, possibly an existing app or module'
    : status === 429 ? 'rate limited; not retried'
    : status >= 500 ? 'service error. Outcome uncertain: inspect the target in Make before re-running; this script never retries'
    : 'unexpected response';
  return `HTTP ${status}: ${meaning}.`;
}

function firstDifference(expected: string, actual: string): number {
  let index = 0;
  while (index < expected.length && index < actual.length && expected[index] === actual[index]) index += 1;
  return index;
}

const PLANNED_STEPS = [
  'app.create', 'app.verifyPrivate', 'base.write', 'base.readback', 'module.create',
  ...MODULE_SECTIONS.flatMap((section) => [`module.${section}.write`, `module.${section}.readback`]),
  'module.verify',
];

export async function createApp(client: ManagementClient, plan: AppPlan): Promise<Report> {
  const outcomes = new Map<string, Step>();
  let appVersion: number | undefined;
  let privateConfirmed: boolean | null = null;

  async function step(name: string, action: () => Promise<void>): Promise<boolean> {
    try {
      await action();
      outcomes.set(name, { name, status: 'ok' });
      return true;
    } catch (error) {
      const detail = error instanceof CheckFailure ? error.message : describeRemoteError(error);
      outcomes.set(name, { name, status: 'failed', detail });
      return false;
    }
  }

  async function writeThenReadBack(
    prefix: string, write: () => Promise<void>, read: () => Promise<unknown>, expected: string,
  ): Promise<boolean> {
    if (!(await step(`${prefix}.write`, write))) return false;
    return step(`${prefix}.readback`, async () => {
      const actual = await read();
      if (typeof actual !== 'string') throw new CheckFailure(`readback was ${actual === null ? 'null' : typeof actual}, not text`);
      if (actual !== expected) {
        throw new CheckFailure(`readback differs from the uploaded source (first difference at offset ${firstDifference(expected, actual)}; lengths ${expected.length} uploaded / ${actual.length} read)`);
      }
    });
  }

  async function execute(): Promise<void> {
    const { app, module } = plan;

    if (!(await step('app.create', async () => {
      const created = await client.apps.create({
        name: app.name, label: app.label, description: app.description, private: true, audience: app.audience,
      });
      if (created.name !== app.name) throw new CheckFailure('the acknowledged app name differs from the request');
      appVersion = created.version;
      if (created.public === true) {
        throw new CheckFailure('the service reported the new app as public; no section was written. Review the app in Make manually');
      }
    }))) return;
    const version = appVersion;
    if (version === undefined) return;

    if (!(await step('app.verifyPrivate', async () => {
      const full = await client.apps.get(app.name, version, { cols: ['name', 'version', 'public'] });
      if (full.name !== app.name || full.version !== version) throw new CheckFailure('the full GET describes a different app or version');
      if (full.public !== false) throw new CheckFailure('the full GET did not confirm the app is private; no section was written');
      privateConfirmed = true;
    }))) return;

    if (!(await writeThenReadBack('base',
      () => client.apps.setSection(app.name, version, 'base', plan.base),
      () => client.apps.getSection(app.name, version, 'base'),
      plan.base))) return;

    if (!(await step('module.create', async () => {
      const created = await client.modules.create(app.name, version, {
        name: module.name, typeId: module.typeId, label: module.label, description: module.description, moduleInitMode: 'blank',
      });
      if (created.name !== module.name) throw new CheckFailure('the acknowledged module name differs from the request');
      if (created.typeId !== undefined && created.typeId !== module.typeId) throw new CheckFailure('the acknowledged module type differs from the request');
    }))) return;

    for (const section of MODULE_SECTIONS) {
      const source = plan.moduleSections[section];
      if (!(await writeThenReadBack(`module.${section}`,
        () => client.modules.setSection(app.name, version, module.name, section, source),
        () => client.modules.getSection(app.name, version, module.name, section),
        source))) return;
    }

    await step('module.verify', async () => {
      const full = await client.modules.get(app.name, version, module.name);
      if (full.name !== module.name || full.typeId !== module.typeId) throw new CheckFailure('the full GET describes a different module or type');
    });
  }

  await execute();

  const steps = PLANNED_STEPS.map((name): Step => outcomes.get(name) ?? { name, status: 'not-attempted' });
  const report: Report = { ok: steps.every((entry) => entry.status === 'ok'), steps };
  if (appVersion !== undefined) report.app = { name: plan.app.name, version: appVersion, private: privateConfirmed };
  return report;
}

export function formatReport(report: Report, mode: 'mock' | 'live'): string {
  const lines = [mode === 'mock'
    ? 'Mode: mock. An in-memory stand-in was used; no Make API call was made.'
    : 'Mode: live. Requests were sent to the Make API with caller-provided credentials.'];
  if (report.app) {
    lines.push(`App: ${report.app.name} (version ${report.app.version}); private ${report.app.private ? 'confirmed by a full GET' : 'NOT confirmed'}.`);
  }
  lines.push('Steps:');
  for (const step of report.steps) {
    lines.push(`  ${step.name.padEnd(28)} ${step.status}${step.detail ? `: ${step.detail}` : ''}`);
  }
  lines.push(report.ok ? 'Result: all steps passed.' : 'Result: FAILED. Steps marked not-attempted did not run; completed writes are NOT rolled back.');
  lines.push(mode === 'mock'
    ? 'Evidence: this checks only the script sequence and local sources. It is not evidence that Make accepted these sections or that the app works.'
    : 'Evidence: readback equality only. Provider execution, scenario use and publication were not performed.');
  return lines.join('\n');
}
