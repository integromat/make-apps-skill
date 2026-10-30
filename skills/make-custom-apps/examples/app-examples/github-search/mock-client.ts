// In-memory stand-in for the SDK surface used by create-app-core.ts. No network, no credentials.
import { MakeError } from '@makehq/sdk';
import type { ManagementClient } from './create-app-core.ts';

export type MockFaults = {
  appVersion?: number;
  publicOnCreate?: boolean;
  publicOnGet?: boolean;
  moduleNameOverride?: string;
  moduleTypeIdOverride?: number;
  failAt?: Record<string, unknown>;
  normalizeOnWrite?: Record<string, (text: string) => string>;
};

export type MockRecord = { label: string; args: readonly unknown[] };
export type MockClient = ManagementClient & { readonly records: MockRecord[] };

export function createMockClient(faults: MockFaults = {}): MockClient {
  const records: MockRecord[] = [];
  const stored = new Map<string, string>();
  const version = faults.appVersion ?? 1;
  const moduleTypes = new Map<string, number>();

  function enter(label: string, args: readonly unknown[]): void {
    records.push({ label, args });
    const failure = faults.failAt?.[label];
    if (failure !== undefined) throw failure;
  }

  function store(label: string, key: string, text: string): void {
    stored.set(key, faults.normalizeOnWrite?.[label]?.(text) ?? text);
  }

  function load(key: string): string {
    const text = stored.get(key);
    if (text === undefined) throw new MakeError('not found', 404);
    return text;
  }

  return {
    records,
    apps: {
      async create(body) {
        enter('apps.create', [body]);
        return {
          name: body.name, label: body.label, description: body.description ?? '', version,
          theme: '#000000', public: faults.publicOnCreate ?? body.private !== true, approved: false,
        };
      },
      async get(name, appVersion, options) {
        enter('apps.get', [name, appVersion, options]);
        return { name, version: appVersion, public: faults.publicOnGet ?? false };
      },
      async setSection(name, appVersion, section, body) {
        const label = `apps.setSection:${section}`;
        enter(label, [name, appVersion, section, body]);
        store(label, `app:${name}:${appVersion}:${section}`, body);
      },
      async getSection(name, appVersion, section) {
        enter(`apps.getSection:${section}`, [name, appVersion, section]);
        return load(`app:${name}:${appVersion}:${section}`);
      },
    },
    modules: {
      async create(appName, appVersion, body) {
        enter('modules.create', [appName, appVersion, body]);
        const typeId = faults.moduleTypeIdOverride ?? body.typeId;
        moduleTypes.set(body.name, typeId);
        return {
          name: faults.moduleNameOverride ?? body.name, label: body.label, description: body.description, typeId,
          public: false, approved: false, crud: null, connection: null, altConnection: null, webhook: null,
        };
      },
      async get(appName, appVersion, moduleName) {
        enter('modules.get', [appName, appVersion, moduleName]);
        return {
          name: moduleName, label: '', description: '', typeId: moduleTypes.get(moduleName) ?? 0,
          public: false, approved: false, crud: null, connection: null, altConnection: null, webhook: null,
        };
      },
      async setSection(appName, appVersion, moduleName, section, body) {
        const label = `modules.setSection:${section}`;
        enter(label, [appName, appVersion, moduleName, section, body]);
        store(label, `module:${appName}:${appVersion}:${moduleName}:${section}`, body);
      },
      async getSection(appName, appVersion, moduleName, section) {
        enter(`modules.getSection:${section}`, [appName, appVersion, moduleName, section]);
        return load(`module:${appName}:${appVersion}:${moduleName}:${section}`);
      },
    },
  };
}
