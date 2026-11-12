#!/usr/bin/env node
// Validate the component files of a Make custom app against the editor schemas in this directory.
//
// Usage:   node validate.mjs <app-dir> [--json]
// Needs:   Node.js 18+ and Ajv 8 resolvable from the working directory or from this file
//          (for example `npm install --no-save ajv@8` in a scratch directory, then run from there).
// Makes no network request and changes no file. Exit code: 0 = no warnings, 1 = warnings or
// unparseable files, 2 = could not run (Ajv missing, no component file found).
//
// A warning is something to read, not proof of a defect: see ../editor-schema-validation.md.

import { createRequire } from 'node:module';
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCHEMA_DIR = dirname(fileURLToPath(import.meta.url));
const COMPONENT_EXTENSIONS = ['.imljson', '.json'];

// Section name -> schema file. Sections that are absent here have no editor schema.
const BY_SECTION = {
	parameters: 'parameters.json',
	expect: 'parameters.json',
	interface: 'parameters.json',
	common: 'common.json',
	samples: 'samples.json',
	scopes: 'scopes.json',
	scope: 'scope.json',
	epoch: 'epoch.json',
	base: 'base.json',
	'api-oauth': 'api-oauth.json',
	groups: 'groups.json',
	attach: 'api.json',
	detach: 'api.json',
	publish: 'api.json',
};
// Known sections without a schema: reported as "not validated", never as a pass.
const NO_SCHEMA = new Set(['install', 'installSpec', 'update', 'metadata']);

/** Remove // and block comments outside strings, so commented IMLJSON still parses. */
export function stripComments(text) {
	let out = '';
	let inString = false;
	for (let i = 0; i < text.length; i += 1) {
		const ch = text[i];
		if (inString) {
			out += ch;
			if (ch === '\\') { out += text[i + 1] ?? ''; i += 1; } else if (ch === '"') inString = false;
		} else if (ch === '"') {
			inString = true; out += ch;
		} else if (ch === '/' && text[i + 1] === '/') {
			while (i < text.length && text[i] !== '\n' && text[i] !== '\r') i += 1;
			out += text[i] ?? '';
		} else if (ch === '/' && text[i + 1] === '*') {
			const end = text.indexOf('*/', i + 2);
			if (end === -1) throw new SyntaxError('Unterminated block comment');
			out += ' ';
			i = end + 1;
		} else out += ch;
	}
	return out;
}

/** Pick the schema for one file, or null when the editor has none for it. */
export function schemaFor(relPath, data) {
	const parts = relPath.split(sep);
	const section = basename(relPath).replace(/\.(imljson|json)$/, '');
	if (section === 'api') {
		if (parts.includes('endpoints')) return 'endpoint-api.json';
		// The receiver `api` of a webhook is not a request definition and has no editor schema.
		if (parts.includes('webhooks')) return null;
		if (parts.includes('connections')) {
			const oauth = data && typeof data === 'object' && !Array.isArray(data)
				&& ['authorize', 'token', 'preauthorize', 'requestToken', 'accessToken'].some((k) => k in data);
			return oauth ? 'api-oauth.json' : 'api.json';
		}
		return 'api.json';
	}
	return BY_SECTION[section] ?? null;
}

function listFiles(dir, found = []) {
	for (const name of readdirSync(dir)) {
		if (name === 'node_modules' || name.startsWith('.')) continue;
		const path = join(dir, name);
		if (statSync(path).isDirectory()) listFiles(path, found);
		else if (COMPONENT_EXTENSIONS.some((ext) => name.endsWith(ext))) found.push(path);
	}
	return found;
}

function loadAjv() {
	for (const from of [pathToFileURL(join(process.cwd(), 'noop.js')).href, import.meta.url]) {
		try { return createRequire(from)('ajv'); } catch { /* try the next location */ }
	}
	return null;
}

function main() {
	const args = process.argv.slice(2);
	const asJson = args.includes('--json');
	const appDir = args.find((a) => !a.startsWith('--'));
	if (!appDir) { console.error('Usage: node validate.mjs <app-dir> [--json]'); process.exit(2); }

	const AjvModule = loadAjv();
	if (!AjvModule) {
		console.error('Ajv 8 was not found. In a scratch directory run `npm install --no-save ajv@8`, then run this script from there.');
		process.exit(2);
	}
	const Ajv = AjvModule.default ?? AjvModule;
	// strict:false       the schemas use editor-only keywords and draft-07 forms Ajv's strict mode rejects.
	// unicodeRegExp:false some `pattern` values are not valid with the `u` flag, which Ajv 8 adds by default.
	const ajv = new Ajv({ allErrors: true, strict: false, unicodeRegExp: false });
	// The schemas refer to each other by relative file name, so register each one under its file name.
	for (const name of readdirSync(SCHEMA_DIR).filter((n) => n.endsWith('.json'))) {
		ajv.addSchema(JSON.parse(readFileSync(join(SCHEMA_DIR, name), 'utf8')), name);
	}

	const report = { validated: 0, withWarnings: 0, unparseable: [], notValidated: [], warnings: [] };
	for (const path of listFiles(appDir).sort()) {
		const rel = relative(appDir, path);
		const section = basename(rel).replace(/\.(imljson|json)$/, '');
		let data;
		try { data = JSON.parse(stripComments(readFileSync(path, 'utf8'))); } catch (error) {
			report.unparseable.push({ file: rel, error: error.message });
			continue;
		}
		const schema = schemaFor(rel, data);
		if (!schema) {
			// Unrelated JSON (package.json, fixtures) is skipped silently; known app sections are listed.
			if (path.endsWith('.imljson') || NO_SCHEMA.has(section) || section === 'api') report.notValidated.push(rel);
			continue;
		}
		report.validated += 1;
		const validate = ajv.getSchema(schema);
		if (!validate(data)) {
			report.withWarnings += 1;
			report.warnings.push({
				file: rel,
				schema,
				errors: validate.errors.map((e) => ({ path: e.instancePath || '/', message: e.message, params: e.params })),
			});
		}
	}

	if (asJson) console.log(JSON.stringify(report, null, 2));
	else {
		for (const w of report.warnings) {
			console.log(`WARNING ${w.file} (${w.schema})`);
			for (const e of w.errors) console.log(`  ${e.path}: ${e.message} ${JSON.stringify(e.params)}`);
		}
		for (const u of report.unparseable) console.log(`UNPARSEABLE ${u.file}: ${u.error}`);
		for (const n of report.notValidated) console.log(`NOT VALIDATED (no editor schema) ${n}`);
		console.log(`${report.validated} files validated, ${report.withWarnings} with warnings, ${report.notValidated.length} without a schema, ${report.unparseable.length} unparseable.`);
	}
	if (report.validated === 0) { console.error('No component file was validated: check the app directory.'); process.exit(2); }
	process.exit(report.withWarnings || report.unparseable.length ? 1 : 0);
}

if (process.argv[1] && existsSync(process.argv[1]) && fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) main();
