#!/usr/bin/env node
/**
 * Narrow, offline, STATIC validator for the synthetic teaching fixtures in
 * skills/make-custom-apps/examples/current-knowledge/.
 *
 * What it is: a check that the knowledge tree is navigable (index, guides, links), that every
 * recipe declares its source, strength, applicability, exceptions and compatibility, that local
 * dependencies resolve, and that each *declared* recipe invariant holds for its authored correct
 * fixture and is violated, for the declared reason, by each authored incorrect fixture.
 *
 * What it is NOT: a general IML interpreter, an SDK or schema validator, or proof of Make or
 * provider behaviour. It never runs fixture code, never executes IML, never reads the network and
 * never calls Make. Expressions are inspected only as text. A pass means "the teaching fixtures are
 * internally consistent with the rules the catalog declares", nothing more. Real apps still need
 * Make validation, upload/readback and provider-side tests.
 *
 * Rule codes (CK-*) are stable identifiers; messages are for humans and may change.
 */
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const CATALOG_FORMAT = 'make-custom-apps-current-knowledge-v1';
export const REQUIRED_TOPICS = [
  'dates-helpers', 'selectors-mode', 'rpc-page-budgets', 'headers-merge', 'interfaces-required',
  'labels-visibility', 'auth-context', 'webhooks', 'optional-endpoints', 'compatibility-evidence',
];

// ------------------------------------------------------------------ small utilities
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isStr = (v) => typeof v === 'string';
const nonBlank = (v) => isStr(v) && v.trim() !== '';
const nonBlankList = (v) => Array.isArray(v) && v.length > 0 && v.every(nonBlank);
const posix = (p) => p.split(sep).join('/');
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const compareErrors = (a, b) => a.code.localeCompare(b.code) || String(a.file).localeCompare(String(b.file))
  || String(a.message).localeCompare(String(b.message));

function validDate(text) {
  if (!isStr(text) || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
}
function parseSemver(text) {
  const match = isStr(text) ? text.match(/^(\d+)\.(\d+)\.(\d+)$/) : null;
  return match ? match.slice(1).map(Number) : null;
}
function compareSemver(a, b) {
  for (let i = 0; i < 3; i += 1) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  return 0;
}
function listFiles(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}
function leaves(value, path = '', out = []) {
  if (isStr(value)) out.push({ path, value });
  else if (Array.isArray(value)) value.forEach((item, index) => leaves(item, `${path}.${index}`, out));
  else if (isObj(value)) for (const [key, item] of Object.entries(value)) leaves(item, `${path}.${key}`, out);
  return out;
}

// Expressions are treated as text only. `{{ ... }}` segments are cut out and inspected lexically.
const exprs = (text) => (isStr(text) ? [...text.matchAll(/\{\{([\s\S]*?)\}\}/g)].map((m) => m[1]) : []);
const stripLiterals = (expr) => expr.replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/g, "''");
const RESERVED = new Set(['true', 'false', 'null', 'undefined', 'NaN']);
function refsOf(text) {
  const refs = [];
  for (const raw of exprs(text)) {
    const cleaned = stripLiterals(raw);
    const pattern = /(?<![\w$.])([A-Za-z_$][\w$]*)((?:\.[A-Za-z_$][\w$]*)*)(?![\w$])(?!\s*\()/g;
    for (const match of cleaned.matchAll(pattern)) {
      if (RESERVED.has(match[1])) continue;
      refs.push({ root: match[1], path: match[2].split('.').filter(Boolean) });
    }
  }
  return refs;
}
function callsOf(text) {
  const names = [];
  for (const raw of exprs(text)) {
    for (const match of stripLiterals(raw).matchAll(/(?<![\w$.])([A-Za-z_$][\w$]*)\s*\(/g)) names.push(match[1]);
  }
  return names;
}
/**
 * Raw argument texts of each call to `name` inside one expression, found with a small quote-aware scan
 * (string literals are skipped, parentheses are balanced, only top-level commas split). Lexical only:
 * it never evaluates anything and is not an IML parser.
 */
function callArguments(raw, name) {
  const calls = [];
  const skipLiteral = (from) => {
    const quote = raw[from];
    let i = from + 1;
    while (i < raw.length && raw[i] !== quote) i += raw[i] === '\\' ? 2 : 1;
    return i + 1;
  };
  let i = 0;
  while (i < raw.length) {
    const ch = raw[i];
    if (ch === "'" || ch === '"') { i = skipLiteral(i); continue; }
    if (/[A-Za-z_$]/.test(ch) && !/[\w$.]/.test(raw[i - 1] ?? '')) {
      const ident = raw.slice(i).match(/^[A-Za-z_$][\w$]*/)[0];
      i += ident.length;
      const open = raw.slice(i).match(/^\s*\(/);
      if (ident !== name || !open) continue;
      i += open[0].length;
      const args = [];
      let depth = 1;
      let start = i;
      let j = i;
      while (j < raw.length && depth > 0) {
        const c = raw[j];
        if (c === "'" || c === '"') { j = skipLiteral(j); continue; }
        if (c === '(') depth += 1;
        else if (c === ')') depth -= 1;
        else if (c === ',' && depth === 1) { args.push(raw.slice(start, j)); start = j + 1; }
        j += 1;
      }
      args.push(raw.slice(start, depth === 0 ? j - 1 : j));
      calls.push(args);
      continue; // keep scanning inside the arguments so nested calls are found too
    }
    i += 1;
  }
  return calls;
}
const refsInTree = (value) => leaves(value).flatMap((leaf) => refsOf(leaf.value));
const parameterNames = (value) => new Set(refsInTree(value).filter((r) => r.root === 'parameters' && r.path.length).map((r) => r.path[0]));

// A deliberately small list of documented built-ins that the teaching fixtures use or may use.
// A call outside this list must be traced to a declared helper dependency; it is not a claim
// that every other name is invalid in Make.
const IML_BUILTINS = new Set([
  'if', 'ifempty', 'length', 'join', 'get', 'map', 'lower', 'upper', 'trim', 'substring', 'replace', 'split',
  'contains', 'indexOf', 'toString', 'toNumber', 'toBoolean', 'toDate', 'parseDate', 'formatDate', 'addDays',
  'addHours', 'addMinutes', 'addSeconds', 'addMonths', 'addYears', 'distinct', 'merge', 'base64', 'sha256',
  'md5', 'uuid', 'ceil', 'floor', 'round', 'min', 'max', 'sum', 'first', 'last', 'keys', 'switch',
]);

// ------------------------------------------------------------------ helper-file tracing
function stripComments(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}
/** Function declarations only, matched textually. Nothing in the file is executed. */
function helperDefinitions(code) {
  const defs = new Map();
  const clean = stripComments(code);
  for (const match of clean.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*\{/g)) {
    let depth = 1;
    let index = match.index + match[0].length;
    while (index < clean.length && depth > 0) {
      if (clean[index] === '{') depth += 1;
      else if (clean[index] === '}') depth -= 1;
      index += 1;
    }
    defs.set(match[1], {
      params: match[2].split(',').map((s) => s.trim()).filter(Boolean),
      body: clean.slice(match.index + match[0].length, index - 1),
    });
  }
  return defs;
}
/** A helper only counts as a transformation if it returns, uses an argument, and is not identity. */
function isTransformation({ params, body }) {
  const compact = body.replace(/\s+/g, ' ').trim();
  if (!/\breturn\b/.test(compact)) return false;
  const usesParameter = params.some((p) => new RegExp(`(?<![\\w$])${escapeRe(p)}(?![\\w$])`).test(compact));
  if (!usesParameter) return false;
  const identity = compact.match(/^return\s+([A-Za-z_$][\w$]*)\s*;?$/);
  return !(identity && params.includes(identity[1]));
}

// ------------------------------------------------------------------ recipe semantic checks
// Each check inspects one bundle (a parsed JSON fixture) and returns [{ code, message }].
const push = (out, code, message) => out.push({ code, message });

const AUTO_PARSED_DATE_FORMATS = new Set(['iso-8601-offset', 'iso-8601-utc']);

function checkDates(b, env) {
  const out = [];
  const api = isObj(b.api) ? b.api : {};
  const trigger = isObj(api.response?.trigger) ? api.response.trigger : {};
  const qs = isObj(api.qs) ? api.qs : {};
  const order = String(trigger.order ?? '').toLowerCase();
  const direction = String(qs.direction ?? '').toLowerCase();
  if (!(order === 'unordered' || (['asc', 'desc'].includes(order) && direction === order))) {
    push(out, 'CK-DATE-ORDER', `trigger.order "${trigger.order}" must describe the order the provider is asked for (qs.direction "${qs.direction}")`);
  }
  if (trigger.type === 'date') {
    const fields = refsOf(trigger.date).filter((r) => r.root === 'item' && r.path.length).map((r) => r.path[0]);
    const parsers = ['parseDate', ...env.helpers.keys()];
    let ok = nonBlank(trigger.date) && fields.length > 0;
    for (const field of fields) {
      const format = b.providerFields?.[field]?.format;
      if (!isStr(format)) { ok = false; continue; }
      if (AUTO_PARSED_DATE_FORMATS.has(format)) continue;
      const wrapped = new RegExp(`(?<![\\w$.])(?:${parsers.map(escapeRe).join('|')})\\s*\\(\\s*item\\.${escapeRe(field)}(?![\\w$])`);
      if (!wrapped.test(trigger.date)) ok = false;
    }
    if (!ok) push(out, 'CK-DATE-PARSE', 'trigger.date must pass fields whose declared provider format is not auto-parsed through a parse call or traced helper');
  } else if (trigger.type !== 'id') {
    push(out, 'CK-DATE-PARSE', 'trigger.type must be "date" or "id"');
  }
  const scanned = { ...b };
  delete scanned.providerFields;
  for (const { value } of leaves(scanned)) {
    for (const name of new Set(callsOf(value))) {
      if (IML_BUILTINS.has(name)) continue;
      const def = env.helpers.get(name);
      if (!def) {
        push(out, 'CK-HELPER-TRACE', `${name}() is not a listed built-in and no declared file dependency defines it`);
        continue;
      }
      if (!isTransformation(def)) push(out, 'CK-HELPER-TRACE', `${name}() is defined but does not transform its argument`);
      // Provider-field provenance: a real `item.FIELD` reference outside quoted literals in some argument.
      // A quoted string that merely spells a field is a constant, not a field.
      for (const raw of exprs(value)) {
        for (const args of callArguments(raw, name)) {
          if (!args.some((arg) => /(?<![\w$.])item\.[A-Za-z_$]/.test(stripLiterals(arg)))) {
            push(out, 'CK-HELPER-TRACE', `${name}() is not called with a provider field`);
          }
        }
      }
    }
  }
  return out;
}

const MODE_REQUIRED_KINDS = new Set(['get', 'update', 'delete']);
function checkSelectors(b) {
  const out = [];
  const rpcs = isObj(b.rpcs) ? b.rpcs : {};
  const rpcName = (value) => (isStr(value) && value.startsWith('rpc://') ? value.slice('rpc://'.length) : null);
  for (const [name, def] of Object.entries(rpcs)) {
    const output = def?.api?.response?.output;
    if (def?.kind === 'options') {
      if (!isObj(output) || !('label' in output) || !('value' in output)) push(out, 'CK-SELECTOR-RPC', `options RPC ${name} must output label and value`);
    } else if (def?.kind === 'fields') {
      if (!isObj(output) || !('name' in output) || !('type' in output)) push(out, 'CK-SELECTOR-SCHEMA-CONFUSION', `fields RPC ${name} must output parameter specs (name, type)`);
    } else {
      push(out, 'CK-SELECTOR-RPC', `RPC ${name} needs kind "options" or "fields"`);
    }
  }
  const useAsOptions = (ref) => {
    const name = rpcName(ref);
    if (!name || !rpcs[name]) push(out, 'CK-SELECTOR-RPC', `${ref} is not a defined RPC`);
    else if (rpcs[name].kind === 'fields') push(out, 'CK-SELECTOR-SCHEMA-CONFUSION', `${ref} builds a schema (fields) and cannot supply select options`);
  };
  const walk = (params, ancestors) => {
    for (const p of Array.isArray(params) ? params : []) {
      if (!isObj(p)) continue;
      if (p.mode !== undefined && !['edit', 'choose'].includes(p.mode)) push(out, 'CK-SELECTOR-MODE', `unsupported mode "${p.mode}"`);
      if (p.type !== 'select') continue;
      const options = p.options;
      const hasNested = isObj(options) && Array.isArray(options.nested) && options.nested.length > 0;
      const ref = isObj(options) ? options.store : options;
      if (hasNested && !(isStr(ref) && ref.startsWith('rpc://'))) {
        push(out, 'CK-SELECTOR-NESTED', `${p.name}: nested selects only work when the parent options are stored (options.store)`);
      }
      if (isStr(ref) && ref.startsWith('rpc://')) useAsOptions(ref);
      const parent = ancestors[ancestors.length - 1];
      if (parent) {
        const def = rpcs[rpcName(ref)];
        if (def) {
          const used = parameterNames(def.api);
          if (!used.has(parent)) push(out, 'CK-SELECTOR-NESTED', `child RPC for ${p.name} never reads its parent value parameters.${parent}`);
          for (const name of used) {
            if (!ancestors.includes(name)) push(out, 'CK-SELECTOR-NESTED', `child RPC for ${p.name} reads undeclared parent parameters.${name}`);
          }
        }
      } else if (MODE_REQUIRED_KINDS.has(b.moduleKind) && isStr(ref) && ref.startsWith('rpc://')
        && !hasNested && p.mappable !== false && p.mode === undefined) {
        push(out, 'CK-SELECTOR-MODE', `${p.name}: Get/Update/Delete ID selectors backed by an RPC need mode "edit"`);
      }
      if (hasNested) walk(options.nested, [...ancestors, p.name]);
    }
  };
  walk(b.parameters, []);
  for (const ref of Array.isArray(b.interface) ? b.interface : []) {
    const name = rpcName(ref);
    if (!name) continue;
    if (!rpcs[name]) push(out, 'CK-SELECTOR-RPC', `${ref} is not a defined RPC`);
    else if (rpcs[name].kind !== 'fields') push(out, 'CK-SELECTOR-SCHEMA-CONFUSION', `${ref} supplies select options, not an output schema`);
  }
  return out;
}

function checkBudget(b) {
  const out = [];
  const budget = isObj(b.budget) ? b.budget : {};
  const api = isObj(b.rpc?.api) ? b.rpc.api : {};
  const { pageSize, maxPages, maxRecords } = budget;
  const numbers = [pageSize, maxPages, maxRecords].every((n) => Number.isInteger(n) && n > 0);
  if (!numbers) push(out, 'CK-BUDGET-PAGE', 'budget.pageSize, maxPages and maxRecords must be positive integers');
  else {
    if (maxRecords > pageSize * maxPages) push(out, 'CK-BUDGET-PAGE', 'maxRecords exceeds pageSize x maxPages, so the budget can never be reached');
    if (maxPages > 50 || maxRecords > 3200) push(out, 'CK-BUDGET-PAGE', 'budget exceeds the documented hard limits (50 pagination requests, 3200 records)');
    if (api.qs?.limit !== pageSize) push(out, 'CK-BUDGET-PAGE', 'qs.limit must equal budget.pageSize');
  }
  const first = api.qs?.page;
  const next = api.pagination?.qs?.page;
  if (first === 1 && String(next).replace(/\s+/g, '') !== '{{pagination.page}}') {
    push(out, 'CK-BUDGET-PAGE', 'pagination.page is already the next page (2 after the first request); a one-based provider takes it unchanged');
  } else if (first === 0 && String(next).replace(/\s+/g, '') !== '{{pagination.page-1}}') {
    push(out, 'CK-BUDGET-PAGE', 'a zero-based provider needs pagination.page - 1');
  }
  const limit = api.response?.limit;
  if (!Number.isInteger(limit) || limit < 1) push(out, 'CK-BUDGET-BOUND', 'RPC response.limit must be a fixed positive integer, not a mapped or missing value');
  else if (numbers && limit > maxRecords) push(out, 'CK-BUDGET-BOUND', 'RPC response.limit exceeds the declared record budget');
  return out;
}

const SPREAD_KEY = '{{...}}';
function checkHeaders(b) {
  const out = [];
  const lowered = (headers, label) => {
    const map = new Map();
    let duplicate = false;
    if (isObj(headers)) {
      for (const [key, value] of Object.entries(headers)) {
        if (key === SPREAD_KEY) continue;
        const lower = key.toLowerCase();
        if (map.has(lower)) { duplicate = true; push(out, 'CK-HEADERS-DUPLICATE', `${label} repeats header "${lower}" with different case`); }
        map.set(lower, value);
      }
    }
    return { map, duplicate };
  };
  const base = lowered(b.base?.headers, 'base.headers');
  const request = lowered(b.request?.headers, 'request.headers');
  if (base.duplicate || request.duplicate) return out;
  let effective = new Map(base.map);
  const requestHeaders = b.request?.headers;
  if (isStr(requestHeaders)) {
    effective = new Map(); // a whole-expression headers value overwrites the Base collection
  } else if (isObj(requestHeaders)) {
    for (const [key, value] of Object.entries(requestHeaders)) {
      if (key === SPREAD_KEY) {
        for (const [name, produced] of Object.entries(isObj(b.request?.spreadProduces) ? b.request.spreadProduces : {})) effective.set(name.toLowerCase(), produced);
      } else effective.set(key.toLowerCase(), value);
    }
  }
  const expected = new Map(Object.entries(isObj(b.expectedEffectiveHeaders) ? b.expectedEffectiveHeaders : {}).map(([k, v]) => [k.toLowerCase(), v]));
  const same = effective.size === expected.size && [...effective].every(([k, v]) => expected.has(k) && expected.get(k) === v);
  if (!same) push(out, 'CK-HEADERS-MERGE', 'expectedEffectiveHeaders does not match the Base + request merge (request wins per name, spread keeps Base, whole-expression replaces)');
  return out;
}

function checkInterfaces(b) {
  const out = [];
  const expect = Array.isArray(b.expect) ? b.expect.filter(isObj) : [];
  const byName = new Map(expect.map((p) => [p.name, p]));
  const api = isObj(b.api) ? b.api : {};
  // A declared input is consumed by ANY declared component-graph consumer: the main request, RPCs,
  // a dynamic interface or helper arguments. A technical parent that only an RPC reads is legitimate.
  // This only lists `parameters.NAME` reads in those declared sections; it is not an IML interpreter.
  const consumers = { api, rpcs: b.rpcs, dynamicInterface: b.dynamicInterface, helperArguments: b.helperArguments };
  const used = parameterNames(consumers);
  const urlPath = isStr(api.url) ? api.url.split('?')[0] : '';
  for (const ref of refsOf(urlPath)) {
    if (ref.root === 'parameters' && ref.path.length && byName.get(ref.path[0])?.required !== true) {
      push(out, 'CK-REQUIRED-FLAG', `${ref.path[0]} is a path parameter and must be required`);
    }
  }
  for (const p of expect) if (p.required === true && !used.has(p.name)) push(out, 'CK-REQUIRED-FLAG', `${p.name} is required but no declared consumer (request, RPC, dynamic interface or helper) uses it`);
  for (const name of used) if (!byName.has(name)) push(out, 'CK-REQUIRED-FLAG', `a declared consumer reads undeclared parameters.${name}`);
  // Bounded lexical rule, outside quoted literals: `parameters.NAME || LITERAL` where NAME is declared
  // boolean (LITERAL true) or numeric (LITERAL nonzero) replaces a valid false/0. A fallback equal to the
  // falsy value (`|| false`, `|| 0`), a non-literal fallback, a text fallback or a larger expression is
  // left unproven rather than called lossy. Declared types bound the analysis; nothing is evaluated.
  const NUMERIC = ['number', 'integer', 'uinteger'];
  const fallback = /(?<![\w$.!])parameters\.([A-Za-z_$][\w$]*)(?![\w$.(])\s*\|\|\s*(-?\d+(?:\.\d+)?|true|false)\s*(?=$|[),])/g;
  for (const { value } of leaves(consumers)) {
    for (const raw of exprs(value)) {
      const cleaned = stripLiterals(raw);
      for (const match of cleaned.matchAll(fallback)) {
        if (/[+\-*/%&|<>=!]\s*$/.test(cleaned.slice(0, match.index))) continue; // not the direct left operand
        const type = byName.get(match[1])?.type;
        const literal = match[2];
        const lossy = (type === 'boolean' && literal === 'true')
          || (NUMERIC.includes(type) && /^-?\d/.test(literal) && Number(literal) !== 0);
        if (lossy) push(out, 'CK-FALSY-LOSS', `"|| ${literal}" on ${type} parameter ${match[1]} replaces a valid ${type === 'boolean' ? 'false' : '0'}`);
      }
    }
  }
  const iface = Array.isArray(b.interface) ? b.interface.filter(isObj) : [];
  const names = iface.map((f) => f.name);
  const output = api.response?.output;
  const projected = isObj(output) ? Object.keys(output) : null;
  if (!projected || projected.length !== names.length || !names.every((n) => projected.includes(n))) {
    push(out, 'CK-INTERFACE-DRIFT', 'interface names and the response.output projection must list the same fields');
  }
  const typeOk = { text: 'string', date: 'string', boolean: 'boolean', number: 'number', integer: 'number', uinteger: 'number' };
  for (const [key, value] of Object.entries(isObj(b.samples) ? b.samples : {})) {
    const field = iface.find((f) => f.name === key);
    if (!field) push(out, 'CK-INTERFACE-DRIFT', `sample field ${key} is not in the interface`);
    else if (typeOk[field.type] && typeof value !== typeOk[field.type]) push(out, 'CK-INTERFACE-DRIFT', `sample ${key} is not a ${field.type}`);
  }
  return out;
}

const SECRET_NAME = /(secret|passw|token|api[_-]?key|private[_-]?key|passphrase)/i;
function checkLabels(b) {
  const out = [];
  // Only a label that is character-for-character the machine name, or that visibly carries
  // snake_case / camelCase, counts as a leak. Case or spacing wording differences are cosmetic.
  const forms = [['parameters', b.parameters], ['connectionParameters', b.connectionParameters], ['interface', b.interface]];
  for (const [formName, list] of forms) {
    const seen = new Set();
    for (const field of Array.isArray(list) ? list.filter(isObj) : []) {
      const label = field.label;
      if (!nonBlank(label)) { push(out, 'CK-LABEL', `${formName}: ${field.name ?? '?'} needs a non-blank label`); continue; }
      if (label === String(field.name ?? '') || /_|[a-z][A-Z]/.test(label)) {
        push(out, 'CK-LABEL', `${formName}: label "${label}" exposes an API-style machine name`);
      }
      const key = label.trim().toLowerCase();
      if (seen.has(key)) push(out, 'CK-LABEL-UNIQUE', `${formName}: label "${label}" is used twice in one form`);
      seen.add(key);
    }
  }
  for (const [formName, list] of forms.slice(0, 2)) {
    for (const field of Array.isArray(list) ? list.filter(isObj) : []) {
      if (field.advanced === true && field.required === true && field.default === undefined) push(out, 'CK-VISIBILITY', `${formName}: required field ${field.name} is hidden under advanced settings without a default`);
      // `password` exists only for connection parameters; elsewhere it behaves like `text`, so no mask is demanded.
      if (formName === 'connectionParameters' && SECRET_NAME.test(String(field.name ?? '')) && field.type !== 'password') push(out, 'CK-VISIBILITY', `${formName}: secret-named field ${field.name} must use type password`);
    }
  }
  return out;
}

const SENSITIVE_HEADER = /^(authorization|proxy-authorization|x-api-key|api-key|x-auth-token)$/i;
const SECRET_BODY_KEY = /(secret|passw|token|^code$|verifier|assertion|api[_-]?key)/i;
const RESPONSE_ONLY_ROOTS = new Set(['body', 'item', 'iterate', 'output', 'pagination', 'headers']);
function sanitizeSet(block) {
  const list = block?.log?.sanitize;
  return new Set(Array.isArray(list) ? list.filter(isStr).map((s) => s.toLowerCase()) : []);
}
/** Paths a block must mask: secret-named request body keys, sensitive request headers, secret response fields. */
function requiredMasks(block) {
  const paths = [];
  for (const key of Object.keys(isObj(block.body) ? block.body : {})) if (SECRET_BODY_KEY.test(key)) paths.push(`request.body.${key}`);
  for (const key of Object.keys(isObj(block.headers) ? block.headers : {})) if (SENSITIVE_HEADER.test(key)) paths.push(`request.headers.${key.toLowerCase()}`);
  for (const [target, value] of Object.entries(isObj(block.response?.data) ? block.response.data : {})) {
    for (const ref of refsOf(value)) {
      if (ref.root === 'body' && ref.path.length && (SECRET_NAME.test(target) || SECRET_NAME.test(ref.path[0]))) paths.push(`response.body.${ref.path[0]}`);
    }
  }
  return paths;
}
function checkAuth(b) {
  const out = [];
  const headerCheck = (headers, label, allowed) => {
    for (const [name, value] of Object.entries(isObj(headers) ? headers : {})) {
      if (!SENSITIVE_HEADER.test(name)) continue;
      const refs = refsOf(value);
      if (refs.length === 0) push(out, 'CK-AUTH-CONTEXT', `${label}.${name} is a literal; credentials must come from the connection`);
      for (const ref of refs) {
        if (!allowed.has(ref.root)) push(out, 'CK-AUTH-CONTEXT', `${label}.${name} reads "${ref.root}", which is not the connection in this context`);
      }
    }
  };
  // In Base and module requests `connection` is the connection's data; `data`/`parameters` are the module's own.
  headerCheck(b.base?.headers, 'base.headers', new Set(['connection', 'common']));
  headerCheck(b.module?.api?.headers, 'module.api.headers', new Set(['connection', 'common']));
  if (isObj(b.base?.headers) && Object.keys(b.base.headers).some((k) => SENSITIVE_HEADER.test(k))) {
    const masked = sanitizeSet(b.base);
    for (const key of Object.keys(b.base.headers).filter((k) => SENSITIVE_HEADER.test(k))) {
      if (!masked.has(`request.headers.${key.toLowerCase()}`)) push(out, 'CK-SECRET-LOG', `base.log.sanitize must mask request.headers.${key.toLowerCase()}`);
    }
  }
  // In connection communication data/connection/parameters (same stored data) and common (a separate
  // common-data store) are all legitimate request sources; only variables that exist solely in
  // responses are wrong inside a request. The checker does not decide which store a value belongs to.
  for (const name of ['token', 'refresh', 'invalidate', 'info']) {
    const block = b.connection?.[name];
    if (!isObj(block)) continue;
    for (const section of ['url', 'qs', 'headers', 'body']) {
      for (const ref of refsInTree(block[section])) {
        if (RESPONSE_ONLY_ROOTS.has(ref.root)) push(out, 'CK-AUTH-CONTEXT', `connection.${name}.${section} reads response-only variable "${ref.root}"`);
      }
    }
    headerCheck(block.headers, `connection.${name}.headers`, new Set(['connection', 'data', 'common', 'parameters', 'temp']));
    const masked = sanitizeSet(block);
    for (const path of requiredMasks(block)) {
      if (!masked.has(path.toLowerCase())) push(out, 'CK-SECRET-LOG', `connection.${name}.log.sanitize must mask ${path}`);
    }
  }
  return out;
}

const is2xx = (status) => /^2\d\d$/.test(String(status));
function checkWebhook(b) {
  const out = [];
  const attachData = Object.keys(isObj(b.attach?.response?.data) ? b.attach.response.data : {});
  const detachRefs = refsInTree(b.detach).filter((r) => r.root === 'webhook' && r.path.length).map((r) => r.path[0]);
  if (detachRefs.length === 0 || detachRefs.some((name) => !attachData.includes(name))) {
    push(out, 'CK-WEBHOOK-IDENTITY', 'detach must use identity values that attach saved in response.data (webhook.<name>)');
  }
  if (isObj(b.attach)) {
    const masked = sanitizeSet(b.attach);
    for (const path of requiredMasks(b.attach)) {
      if (!masked.has(path.toLowerCase())) push(out, 'CK-SECRET-LOG', `attach.log.sanitize must mask ${path}`);
    }
  }
  const receiver = isObj(b.receiver) ? b.receiver : {};
  const verification = receiver.verification;
  const condition = isStr(verification?.condition) ? verification.condition.replace(/\{\{|\}\}/g, '').trim() : '';
  const inputRoots = new Set(['body', 'query', 'headers', 'method']);
  if (b.verificationScope !== 'challenge-only') push(out, 'CK-WEBHOOK-VERIFY', 'verificationScope must stay "challenge-only"; challenge replies are not signature verification');
  if (b.signatureVerification !== 'not-demonstrated') push(out, 'CK-WEBHOOK-VERIFY', 'a static fixture cannot demonstrate signature verification');
  if (!isObj(verification) || /^(true|false|null|1|0)?$/i.test(condition) || !refsOf(`{{${condition}}}`).some((r) => inputRoots.has(r.root))) {
    push(out, 'CK-WEBHOOK-VERIFY', 'verification.condition must depend on the incoming request, not be constant');
  }
  if (!is2xx(verification?.respond?.status)) push(out, 'CK-WEBHOOK-VERIFY', 'a verification challenge must be acknowledged with a 2xx response');
  if (!is2xx(receiver.respond?.status)) push(out, 'CK-WEBHOOK-DELIVERY', 'event delivery must be acknowledged with a 2xx response');
  const names = (Array.isArray(b.interface) ? b.interface : []).filter(isObj).map((f) => f.name).sort();
  const produced = isObj(receiver.output) ? Object.keys(receiver.output).sort() : null;
  if (!produced || produced.join('|') !== names.join('|')) push(out, 'CK-WEBHOOK-DELIVERY', 'receiver.output and the trigger interface must list the same fields');
  return out;
}

function checkEndpoint(b) {
  const out = [];
  if (b.optional !== true) push(out, 'CK-ENDPOINT-OPTIONAL', 'Endpoints are optional additions and must never be marked required for ordinary module apps');
  // `inputParameters` is the definition SECTION that declares the inputs. In the Endpoint request IML the
  // declared inputs are read as `parameters.NAME`. This wrapper fixture is synthetic, not a deployable definition.
  const declared = new Set((Array.isArray(b.endpoint?.inputParameters) ? b.endpoint.inputParameters : []).filter(isObj).map((p) => p.name));
  for (const ref of refsInTree(b.endpoint?.api)) {
    if (ref.root === 'inputParameters') {
      push(out, 'CK-ENDPOINT-INPUT', 'Endpoint request IML reads parameters.NAME; inputParameters is the declaring section, not an IML root');
    } else if (ref.root === 'parameters' && ref.path.length && !declared.has(ref.path[0])) {
      push(out, 'CK-ENDPOINT-INPUT', `Endpoint request reads undeclared parameters.${ref.path[0]}`);
    }
  }
  return out;
}

const GATE_NAMES = ['static', 'uploadReadback', 'providerExecution', 'publication'];
function checkEvidence(b, env) {
  const out = [];
  for (const [index, claim] of (Array.isArray(b.claims) ? b.claims : []).entries()) {
    const label = `claims.${index}`;
    const ids = Array.isArray(claim?.sourceIds) ? claim.sourceIds : null;
    if (!isObj(claim) || !['documented', 'observed', 'unverified'].includes(claim.status) || !ids) {
      push(out, 'CK-CLAIM-EVIDENCE', `${label} needs a status (documented|observed|unverified) and a sourceIds list`);
      continue;
    }
    for (const id of ids) if (!env.sources.has(id)) push(out, 'CK-CLAIM-EVIDENCE', `${label} cites unknown source "${id}"`);
    if (claim.status === 'documented' && !ids.some((id) => env.sources.get(id)?.kind === 'public-doc')) {
      push(out, 'CK-CLAIM-EVIDENCE', `${label} is "documented" without a public documentation source`);
    }
    if (claim.status === 'observed' && ids.length === 0) push(out, 'CK-CLAIM-EVIDENCE', `${label} is "observed" without any source`);
  }
  const gates = isObj(b.gates) ? b.gates : {};
  for (const name of GATE_NAMES) {
    if (!['performed', 'skipped', 'unavailable'].includes(gates[name])) push(out, 'CK-GATES', `gates.${name} must be performed, skipped or unavailable`);
  }
  for (const name of GATE_NAMES.slice(1)) {
    if (gates[name] === 'performed') push(out, 'CK-GATES', `a static-only fixture cannot report ${name} as performed`);
  }
  if (gates.static === 'performed' && !nonBlank(b.gateEvidence?.static)) push(out, 'CK-GATES', 'a performed static gate must record what was run');
  return out;
}

export const RECIPE_CHECKS = {
  'dates-helper-trace': { run: checkDates, rules: ['CK-DATE-ORDER', 'CK-DATE-PARSE', 'CK-HELPER-TRACE'] },
  'selector-mode-dependent': { run: checkSelectors, rules: ['CK-SELECTOR-RPC', 'CK-SELECTOR-MODE', 'CK-SELECTOR-NESTED', 'CK-SELECTOR-SCHEMA-CONFUSION'] },
  'rpc-page-budget': { run: checkBudget, rules: ['CK-BUDGET-BOUND', 'CK-BUDGET-PAGE'] },
  'headers-merge': { run: checkHeaders, rules: ['CK-HEADERS-MERGE', 'CK-HEADERS-DUPLICATE'] },
  'interface-required-flags': { run: checkInterfaces, rules: ['CK-REQUIRED-FLAG', 'CK-FALSY-LOSS', 'CK-INTERFACE-DRIFT'] },
  'labels-visibility': { run: checkLabels, rules: ['CK-LABEL', 'CK-LABEL-UNIQUE', 'CK-VISIBILITY'] },
  'auth-context': { run: checkAuth, rules: ['CK-AUTH-CONTEXT', 'CK-SECRET-LOG'] },
  'webhook-lifecycle-delivery': { run: checkWebhook, rules: ['CK-WEBHOOK-IDENTITY', 'CK-WEBHOOK-VERIFY', 'CK-WEBHOOK-DELIVERY', 'CK-SECRET-LOG'] },
  'optional-endpoint': { run: checkEndpoint, rules: ['CK-ENDPOINT-OPTIONAL', 'CK-ENDPOINT-INPUT'] },
  'evidence-gates': { run: checkEvidence, rules: ['CK-CLAIM-EVIDENCE', 'CK-GATES'] },
};

function evaluate(recipeId, bundle, env) {
  if (!isObj(bundle)) return [{ code: 'CK-SHAPE', message: 'fixture must be a JSON object' }];
  try {
    return RECIPE_CHECKS[recipeId].run(bundle, env);
  } catch (error) {
    return [{ code: 'CK-SHAPE', message: `fixture shape could not be interpreted: ${error.message}` }];
  }
}

// ------------------------------------------------------------------ privacy and synthetic-host tripwires
const PRIVATE_PATTERNS = [
  ['a home-directory path', /(?:^|[^A-Za-z0-9_.])\/(?:Users|home)\/[A-Za-z0-9._-]+\//],
  ['a Windows user path', /[A-Za-z]:\\{1,2}(?:Users|Documents and Settings)\\{1,2}/],
  ['an email address', /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}\b/],
  ['a token-shaped secret', /\bgh[pousr]_[A-Za-z0-9]{30,}\b|-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----|\bAKIA[0-9A-Z]{16}\b/],
  ['an internal host', /https?:\/\/[A-Za-z0-9.-]+\.(?:internal|corp|intranet|lan|local)(?![A-Za-z0-9-])/i],
  ['a private working-notes path', /\.sonnet\//],
];
const PRIVATE_HOST = /\.(?:internal|corp|intranet|lan|local)$/i;
const SYNTHETIC_HOST = /(?:^|\.)(?:example\.com|example\.org|example\.net)$|\.(?:invalid|test|example)$/i;

// ------------------------------------------------------------------ the validator
export function validateCurrentKnowledge(examplesRoot) {
  const root = resolve(String(examplesRoot));
  const ck = join(root, 'current-knowledge');
  const errors = [];
  const seen = new Set();
  const add = (code, file, message) => {
    const key = `${code}\u0000${file ?? ''}\u0000${message}`;
    if (seen.has(key)) return;
    seen.add(key);
    errors.push({ code, file: file ?? '', message });
  };
  const rel = (abs) => posix(relative(ck, abs));
  const stats = { topics: 0, recipes: 0, sources: 0, guides: 0, fixtures: 0 };
  const finish = () => ({ errors: errors.sort(compareErrors), stats });

  // Real-path containment (same bound as skill-reference sources): a symlink under current-knowledge must
  // not lead outside it, so no local check ever reads bytes from beyond the tree.
  const contained = (abs) => {
    try {
      const back = relative(realpathSync(ck), realpathSync(abs));
      return back !== '' && !back.startsWith('..') && !isAbsolute(back);
    } catch { return false; }
  };
  const loadJson = (relPath) => {
    const abs = join(ck, relPath);
    if (!existsSync(abs) || !statSync(abs).isFile()) return { missing: true };
    if (!contained(abs)) {
      add('CK-FORMAT', relPath, 'file resolves outside current-knowledge through a symlink and is not read');
      return { invalid: true };
    }
    try {
      return { value: JSON.parse(readFileSync(abs, 'utf8')) };
    } catch (error) {
      add('CK-JSON', relPath, `invalid JSON: ${error.message}`);
      return { invalid: true };
    }
  };
  const inside = (relPath) => {
    if (!nonBlank(relPath) || isAbsolute(relPath) || /^[a-z][a-z0-9+.-]*:/i.test(relPath) || relPath.includes('\\')) return null;
    const abs = resolve(ck, relPath);
    const back = relative(ck, abs);
    return back === '' || back.startsWith('..') || isAbsolute(back) ? null : abs;
  };
  const localLinks = (file) => {
    const text = readFileSync(file, 'utf8').replace(/```[\s\S]*?```/g, '');
    return [...text.matchAll(/\[[^\]]*\]\(([^)\s]*)(?:\s+"[^"]*")?\)/g)].map((m) => m[1].split('#')[0])
      .filter((link) => link && !/^[a-z][a-z0-9+.-]*:/i.test(link))
      .map((link) => { try { return resolve(dirname(file), decodeURIComponent(link)); } catch { return resolve(dirname(file), link); } });
  };

  const loaded = loadJson('catalog.json');
  if (!loaded.value) {
    if (loaded.missing) add('CK-FORMAT', 'catalog.json', 'catalog.json is missing');
    return finish();
  }
  const catalog = loaded.value;
  if (!isObj(catalog) || catalog.format !== CATALOG_FORMAT) add('CK-FORMAT', 'catalog.json', `format must be "${CATALOG_FORMAT}"`);
  if (!isObj(catalog) || !Array.isArray(catalog.sources) || !Array.isArray(catalog.topics) || !Array.isArray(catalog.recipes)) {
    add('CK-FORMAT', 'catalog.json', 'catalog needs sources, topics and recipes arrays');
    return finish();
  }
  const reviewedOn = catalog.reviewedOn;
  if (!validDate(reviewedOn)) add('CK-COMPAT', 'catalog.json', 'catalog.reviewedOn must be a real YYYY-MM-DD date');
  if (!isObj(catalog.evidenceBoundary) || catalog.evidenceBoundary.static !== true || catalog.evidenceBoundary.runtime !== 'none') {
    add('CK-RUNTIME-CLAIM', 'catalog.json', 'evidenceBoundary must be { static: true, runtime: "none" }: this tree makes no runtime or interpreter claim');
  }

  // ---- sources
  const sources = new Map();
  for (const source of catalog.sources) {
    if (!isObj(source) || !nonBlank(source.id) || !nonBlank(source.title)) { add('CK-SOURCE', 'catalog.json', 'every source needs an id and a title'); continue; }
    if (sources.has(source.id)) add('CK-FORMAT', 'catalog.json', `duplicate source id ${source.id}`);
    sources.set(source.id, source);
    if (source.kind === 'public-doc') {
      let url = null;
      try { url = new URL(source.url); } catch { /* reported below */ }
      if (!url || url.protocol !== 'https:' || !['developers.make.com', 'help.make.com'].includes(url.hostname)) {
        add('CK-SOURCE', 'catalog.json', `source ${source.id} must be an https developers.make.com or help.make.com URL`);
      }
      if (!validDate(source.retrieved) || (validDate(reviewedOn) && source.retrieved > reviewedOn)) {
        add('CK-SOURCE', 'catalog.json', `source ${source.id} needs a valid retrieved date not after catalog.reviewedOn`);
      }
    } else if (source.kind === 'research-summary') {
      if (source.url !== undefined || source.scope !== 'generic' || source.containsPrivateData !== false) {
        add('CK-SOURCE', 'catalog.json', `research source ${source.id} must be generic, have no URL and set containsPrivateData to false`);
      }
    } else if (source.kind === 'skill-reference') {
      // A reference file shipped inside this skill (for example references/sdk-endpoints.md): no URL, must exist.
      const skillRoot = resolve(root, '..');
      const target = nonBlank(source.path) && !isAbsolute(source.path) && !source.path.includes('\\') ? resolve(skillRoot, source.path) : null;
      const back = target ? relative(skillRoot, target) : '..';
      let contained = false;
      if (target && existsSync(target) && statSync(target).isFile()) {
        // A symlink under references/ must not point outside the references directory.
        const refsReal = realpathSync(join(skillRoot, 'references'));
        const back2 = relative(refsReal, realpathSync(target));
        contained = back2 !== '' && !back2.startsWith('..') && !isAbsolute(back2);
      }
      if (source.url !== undefined || !target || back.startsWith('..') || !source.path.startsWith('references/')
        || !contained) {
        add('CK-SOURCE', 'catalog.json', `skill-reference source ${source.id} must have no URL and a path to an existing file under references/`);
      }
    } else {
      add('CK-SOURCE', 'catalog.json', `source ${source.id} has unknown kind`);
    }
  }
  stats.sources = sources.size;
  const publicSource = (id) => sources.get(id)?.kind === 'public-doc';

  // ---- topics
  const topics = new Map();
  const recipeIds = new Set(catalog.recipes.filter(isObj).map((r) => r.id));
  for (const topic of catalog.topics) {
    if (!isObj(topic) || !nonBlank(topic.id)) { add('CK-FORMAT', 'catalog.json', 'every topic needs an id'); continue; }
    if (topics.has(topic.id)) add('CK-FORMAT', 'catalog.json', `duplicate topic id ${topic.id}`);
    topics.set(topic.id, topic);
    if (!nonBlank(topic.title) || !nonBlank(topic.summary)) add('CK-FORMAT', 'catalog.json', `topic ${topic.id} needs a title and a summary`);
    for (const id of Array.isArray(topic.sources) ? topic.sources : []) {
      if (!sources.has(id)) add('CK-SOURCE', 'catalog.json', `topic ${topic.id} cites unknown source ${id}`);
    }
    if (!Array.isArray(topic.sources) || topic.sources.length === 0) add('CK-SOURCE', 'catalog.json', `topic ${topic.id} must cite sources`);
    if (!Array.isArray(topic.recipes)) add('CK-FORMAT', 'catalog.json', `topic ${topic.id} needs a recipes array (empty for a guide-only topic)`);
    for (const id of Array.isArray(topic.recipes) ? topic.recipes : []) {
      if (!recipeIds.has(id)) add('CK-FORMAT', 'catalog.json', `topic ${topic.id} lists unknown recipe ${id}`);
    }
  }
  stats.topics = topics.size;
  for (const id of REQUIRED_TOPICS) if (!topics.has(id)) add('CK-TOPIC-SET', 'catalog.json', `required topic ${id} is missing`);

  // ---- guides and index
  const readme = join(ck, 'README.md');
  const indexLinks = existsSync(readme) ? localLinks(readme) : null;
  if (!indexLinks) add('CK-INDEX-LINK', 'README.md', 'the navigation index README.md is missing');
  else if (!indexLinks.includes(join(ck, 'catalog.json'))) add('CK-INDEX-LINK', 'README.md', 'the index must link catalog.json');
  const recipesByTopic = new Map();
  for (const recipe of catalog.recipes.filter(isObj)) {
    if (!recipesByTopic.has(recipe.topic)) recipesByTopic.set(recipe.topic, []);
    recipesByTopic.get(recipe.topic).push(recipe);
  }
  const fixturePaths = (recipe) => [recipe.fixtures?.correct, ...(Array.isArray(recipe.fixtures?.incorrect) ? recipe.fixtures.incorrect.map((n) => n?.file) : [])].filter(isStr);
  // Recipe-backed guides teach fixtures; a guide-only topic (no recipes) is retrieval-only and needs just its limits and sources.
  const recipeGuideSections = ['## Rationale', '## Pitfalls', '## Exceptions and applicability', '## Evidence and limits', '## Fixtures', '## Sources'];
  const guideOnlySections = ['## Evidence and limits', '## Sources'];
  const guideFiles = new Set();
  const guideOwners = new Map();
  for (const topic of topics.values()) {
    if (!isStr(topic.guide) || !/^guides\/[a-z0-9-]+\.md$/.test(topic.guide)) { add('CK-TOPIC-GUIDE', 'catalog.json', `topic ${topic.id} needs guide "guides/<name>.md"`); continue; }
    if (guideOwners.has(topic.guide)) add('CK-GUIDE-DUPLICATE', topic.guide, `topics ${guideOwners.get(topic.guide)} and ${topic.id} share one guide`);
    else guideOwners.set(topic.guide, topic.id);
    const guideSections = (recipesByTopic.get(topic.id)?.length ?? 0) > 0 || (Array.isArray(topic.recipes) && topic.recipes.length > 0)
      ? recipeGuideSections : guideOnlySections;
    const guideAbs = join(ck, topic.guide);
    if (!existsSync(guideAbs)) { add('CK-TOPIC-GUIDE', topic.guide, `guide for topic ${topic.id} does not exist`); continue; }
    guideFiles.add(guideAbs);
    if (indexLinks && !indexLinks.includes(guideAbs)) add('CK-INDEX-LINK', 'README.md', `the index must link ${topic.guide}`);
    const text = readFileSync(guideAbs, 'utf8');
    const links = localLinks(guideAbs);
    if (!links.includes(readme)) add('CK-GUIDE-SHAPE', topic.guide, 'a guide must link back to ../README.md');
    const missing = guideSections.filter((heading) => !text.includes(`\n${heading}`));
    if (!text.startsWith('# ') || missing.length > 0 || text.length < 2500) {
      add('CK-GUIDE-SHAPE', topic.guide, `a guide needs a title, substantive prose and the sections ${guideSections.join(', ')}${missing.length ? ` (missing: ${missing.join(', ')})` : ''}`);
    }
    for (const id of Array.isArray(topic.sources) ? topic.sources : []) {
      const source = sources.get(id);
      if (source?.kind === 'public-doc' && isStr(source.url) && !text.includes(source.url)) {
        add('CK-GUIDE-SOURCES', topic.guide, `guide must cite source ${id} (${source.url})`);
      }
      if (source?.kind === 'skill-reference' && isStr(source.path) && !links.includes(resolve(root, '..', source.path))) {
        add('CK-GUIDE-SOURCES', topic.guide, `guide must link skill reference source ${id} (${source.path})`);
      }
    }
    for (const recipe of recipesByTopic.get(topic.id) ?? []) {
      for (const path of fixturePaths(recipe)) {
        const abs = inside(path);
        if (abs && !links.includes(abs)) add('CK-GUIDE-RECIPE-LINK', topic.guide, `guide must link fixture ${path}`);
      }
    }
  }
  const guidesDir = join(ck, 'guides');
  if (existsSync(guidesDir) && statSync(guidesDir).isDirectory()) {
    for (const entry of readdirSync(guidesDir, { withFileTypes: true })) {
      if (!entry.name.endsWith('.md') || entry.isDirectory()) continue;
      if (!guideOwners.has(`guides/${entry.name}`)) add('CK-GUIDE-ORPHAN', `guides/${entry.name}`, 'guide file is not the guide of any catalog topic');
    }
  }
  stats.guides = guideFiles.size;
  for (const file of [readme, ...guideFiles]) {
    if (!existsSync(file)) continue;
    for (const target of localLinks(file)) {
      if (!existsSync(target)) add('CK-LINK', rel(file), `broken local link to ${posix(relative(dirname(file), target))}`);
    }
  }

  // ---- recipes: metadata
  const skillText = existsSync(join(root, '..', 'SKILL.md')) ? readFileSync(join(root, '..', 'SKILL.md'), 'utf8') : '';
  const skillVersion = parseSemver(skillText.match(/^\s*version:\s*"([^"]+)"/m)?.[1]);
  if (!skillVersion) add('CK-COMPAT', 'catalog.json', 'SKILL.md needs a metadata.version in MAJOR.MINOR.PATCH form');
  const seenRecipes = new Set();
  const recipes = [];
  const FREQUENCY_KEY = /frequen|prevalen|popular|occurr|percent|share|count|usage/i;
  const FREQUENCY_BASIS = /(most|common|frequen|prevalen|majority|popular|widespread|typical|usual|\d)/i;
  for (const recipe of catalog.recipes) {
    if (!isObj(recipe) || !nonBlank(recipe.id)) { add('CK-FORMAT', 'catalog.json', 'every recipe needs an id'); continue; }
    if (seenRecipes.has(recipe.id)) { add('CK-FORMAT', 'catalog.json', `duplicate recipe id ${recipe.id}`); continue; }
    seenRecipes.add(recipe.id);
    recipes.push(recipe);
    const where = `recipe ${recipe.id}`;
    if (!nonBlank(recipe.title)) add('CK-FORMAT', 'catalog.json', `${where} needs a title`);
    if (!topics.has(recipe.topic)) add('CK-TOPIC-SET', 'catalog.json', `${where} belongs to unknown topic ${recipe.topic}`);
    if (!RECIPE_CHECKS[recipe.id]) add('CK-FORMAT', 'catalog.json', `${where} has no checker implementation`);
    const ap = recipe.applicability;
    if (!isObj(ap) || !nonBlankList(ap.appliesWhen) || !nonBlankList(ap.notWhen) || !Array.isArray(ap.exceptions)
      || ap.exceptions.some((e) => !isObj(e) || !nonBlank(e.condition) || !nonBlank(e.effect))) {
      add('CK-APPLICABILITY', 'catalog.json', `${where} needs appliesWhen, notWhen and exceptions[{condition, effect}]`);
    }
    const evidence = isObj(recipe.evidence) ? recipe.evidence : {};
    const frequencyKeys = [...Object.keys(recipe), ...Object.keys(evidence)].filter((k) => FREQUENCY_KEY.test(k));
    const frequencyBasis = isStr(recipe.basis) && FREQUENCY_BASIS.test(recipe.basis);
    if (frequencyKeys.length > 0 || frequencyBasis) {
      add('CK-POLICY-FREQUENCY', 'catalog.json', `${where}: policy strength comes from documentation, never from how often something was seen`);
    }
    const ids = Array.isArray(evidence.sourceIds) ? evidence.sourceIds : [];
    for (const id of ids) if (!sources.has(id)) add('CK-SOURCE', 'catalog.json', `${where} cites unknown source ${id}`);
    const enumsOk = ['must', 'should', 'consider'].includes(recipe.strength)
      && (frequencyBasis || ['documented', 'documented-and-observed', 'observed'].includes(recipe.basis))
      && ['documented', 'observed', 'inferred', 'unverified'].includes(evidence.confidence)
      && Array.isArray(evidence.sourceIds) && ids.length > 0;
    const mustOk = recipe.strength !== 'must' || (recipe.basis === 'documented' && evidence.confidence === 'documented' && ids.some(publicSource));
    if (!enumsOk || !mustOk) {
      add('CK-EVIDENCE-STRENGTH', 'catalog.json', `${where}: strength/basis/confidence/sources are inconsistent; "must" needs documented basis and a public documentation source`);
    }
    if (recipe.validation !== 'static') add('CK-RUNTIME-CLAIM', 'catalog.json', `${where}: validation must be "static"`);
    const compat = recipe.compatibility;
    const floor = parseSemver(compat?.minSkillVersion);
    const compatOk = isObj(compat) && floor && validDate(compat.reviewedOn)
      && (!validDate(reviewedOn) || compat.reviewedOn <= reviewedOn) && (!skillVersion || compareSemver(floor, skillVersion) <= 0);
    if (!compatOk) add('CK-COMPAT', 'catalog.json', `${where}: minSkillVersion must be a semver not above SKILL.md's version and reviewedOn a real date not after the catalog's`);
    const allowed = RECIPE_CHECKS[recipe.id]?.rules ?? [];
    if (!Array.isArray(recipe.rules) || recipe.rules.length === 0 || recipe.rules.some((r) => !allowed.includes(r))) {
      add('CK-FORMAT', 'catalog.json', `${where}: rules must be a non-empty list of rule codes this recipe's checker implements`);
    }
    if (!isStr(recipe.fixtures?.correct) || !Array.isArray(recipe.fixtures?.incorrect)) add('CK-FORMAT', 'catalog.json', `${where} needs fixtures.correct and fixtures.incorrect[]`);
  }
  stats.recipes = recipes.length;

  // ---- dependencies
  const recipeById = new Map(recipes.map((r) => [r.id, r]));
  for (const recipe of recipes) {
    if (!Array.isArray(recipe.dependencies)) { add('CK-DEPENDENCY', 'catalog.json', `recipe ${recipe.id} needs a dependencies array`); continue; }
    for (const dep of recipe.dependencies) {
      if (dep?.type === 'recipe') {
        if (!recipeById.has(dep.id)) add('CK-DEPENDENCY', 'catalog.json', `recipe ${recipe.id} depends on unknown recipe ${dep.id}`);
        else if (dep.id === 'optional-endpoint' && recipe.id !== 'optional-endpoint') {
          add('CK-ENDPOINT-OPTIONAL', 'catalog.json', `recipe ${recipe.id} must not depend on the optional Endpoint recipe`);
        }
      } else if (dep?.type === 'file') {
        const abs = inside(dep.path);
        if (!abs || !existsSync(abs) || !statSync(abs).isFile() || !contained(abs)) add('CK-DEPENDENCY', 'catalog.json', `recipe ${recipe.id} depends on missing or out-of-tree file ${dep.path}`);
      } else {
        add('CK-DEPENDENCY', 'catalog.json', `recipe ${recipe.id} has a dependency of unknown type`);
      }
    }
  }
  const state = new Map();
  const visit = (id, trail) => {
    if (state.get(id) === 'done') return;
    if (state.get(id) === 'active') { add('CK-DEPENDENCY', 'catalog.json', `dependency cycle: ${[...trail, id].join(' -> ')}`); return; }
    state.set(id, 'active');
    const deps = recipeById.get(id)?.dependencies;
    for (const dep of Array.isArray(deps) ? deps : []) if (dep?.type === 'recipe' && recipeById.has(dep.id)) visit(dep.id, [...trail, id]);
    state.set(id, 'done');
  };
  for (const id of recipeById.keys()) visit(id, []);

  // ---- fixtures: existence, coverage, semantics, negatives
  const cataloged = new Set();
  for (const recipe of recipes) {
    const checks = RECIPE_CHECKS[recipe.id];
    if (!checks || !isObj(recipe.fixtures)) continue;
    const helpers = new Map();
    for (const dep of Array.isArray(recipe.dependencies) ? recipe.dependencies : []) {
      const abs = dep?.type === 'file' ? inside(dep.path) : null;
      if (abs && existsSync(abs) && statSync(abs).isFile() && contained(abs) && abs.endsWith('.js')) {
        for (const [name, def] of helperDefinitions(readFileSync(abs, 'utf8'))) helpers.set(name, def);
      }
    }
    const env = { helpers, sources, catalog };
    const fixtureFile = (path) => {
      const abs = inside(path);
      if (!abs || !path.startsWith('recipes/') || !path.endsWith('.json')) { add('CK-FORMAT', 'catalog.json', `fixture path ${path} must be a recipes/**/*.json file inside current-knowledge`); return null; }
      cataloged.add(posix(relative(ck, abs)));
      stats.fixtures += 1;
      const result = loadJson(path);
      if (result.missing) add('CK-COVERAGE', path, 'cataloged fixture file is missing');
      return result.value === undefined ? null : { value: result.value };
    };
    if (isStr(recipe.fixtures.correct)) {
      const correct = fixtureFile(recipe.fixtures.correct);
      if (correct) for (const e of evaluate(recipe.id, correct.value, env)) add(e.code, recipe.fixtures.correct, e.message);
    }
    const covered = new Set();
    for (const negative of Array.isArray(recipe.fixtures.incorrect) ? recipe.fixtures.incorrect : []) {
      if (!isObj(negative) || !isStr(negative.file)) { add('CK-FORMAT', 'catalog.json', `recipe ${recipe.id} has a malformed incorrect fixture entry`); continue; }
      const declared = Array.isArray(negative.violates) ? negative.violates : [];
      for (const code of declared) covered.add(code);
      const loadedNegative = fixtureFile(negative.file);
      if (!loadedNegative) continue;
      const produced = new Set(evaluate(recipe.id, loadedNegative.value, env).map((e) => e.code));
      if (produced.size === 0) add('CK-NEGATIVE-NOT-FAILING', negative.file, 'an incorrect fixture must violate at least one declared rule');
      else if (declared.length === 0 || declared.some((code) => !produced.has(code) || !(recipe.rules ?? []).includes(code))) {
        add('CK-NEGATIVE-WRONG-RULE', negative.file, `incorrect fixture must violate each declared rule (declared: ${declared.join(', ') || 'none'}; found: ${[...produced].join(', ')})`);
      }
    }
    for (const rule of Array.isArray(recipe.rules) ? recipe.rules : []) {
      if (!covered.has(rule)) add('CK-NEGATIVE-COVERAGE', 'catalog.json', `recipe ${recipe.id} has no incorrect fixture for ${rule}`);
    }
  }
  for (const file of listFiles(join(ck, 'recipes')).filter((f) => f.endsWith('.json'))) {
    if (!cataloged.has(rel(file))) add('CK-COVERAGE', rel(file), 'fixture file is not listed in catalog.json');
  }

  // ---- text tripwires: privacy in every shipped text, synthetic hosts in every fixture
  const textFiles = [readme, join(ck, 'catalog.json'), ...listFiles(join(ck, 'guides')), ...listFiles(join(ck, 'recipes'))].filter((f) => existsSync(f));
  for (const file of textFiles) {
    const text = readFileSync(file, 'utf8');
    for (const [label, pattern] of PRIVATE_PATTERNS) {
      if (pattern.test(text)) add('CK-PRIVATE', rel(file), `contains ${label}; public teaching material must not carry private data`);
    }
  }
  for (const file of listFiles(join(ck, 'recipes'))) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(/https?:\/\/([^\s"'<>{}\\/?#:]+)/g)) {
      const host = match[1];
      if (PRIVATE_HOST.test(host)) continue;
      if (!SYNTHETIC_HOST.test(host)) add('CK-SYNTHETIC', rel(file), `fixture URL host ${host} is not synthetic (use *.invalid, *.test, *.example or example.com)`);
    }
  }
  return finish();
}

// ------------------------------------------------------------------ CLI
function main(argv) {
  const index = argv.indexOf('--examples-root');
  const fallback = fileURLToPath(new URL('../skills/make-custom-apps/examples', import.meta.url));
  const examples = index >= 0 && argv[index + 1] ? resolve(argv[index + 1]) : fallback;
  const { errors, stats } = validateCurrentKnowledge(examples);
  if (errors.length > 0) {
    for (const error of errors) process.stderr.write(`[${error.code}] ${error.file || '(tree)'}: ${error.message}\n`);
    process.stderr.write(`Current-knowledge static check failed: ${errors.length} problem(s).\n`);
    return 1;
  }
  process.stdout.write(`Current-knowledge static check passed: ${stats.topics} topics, ${stats.recipes} recipes, ${stats.fixtures} fixtures. `
    + 'Static fixture consistency only; not Make, SDK or provider validation.\n');
  return 0;
}
const invokedDirectly = (() => {
  try { return Boolean(process.argv[1]) && realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
})();
if (invokedDirectly) process.exitCode = main(process.argv.slice(2));
