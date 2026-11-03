# IML expressions, JavaScript helpers and dependency tracing

Back to the [knowledge index](../README.md).

An app has two expression worlds. **IML** is the expression language inside `{{ }}` in communication, parameters and interfaces. **Custom IML functions** are JavaScript files that you call from IML. Bugs appear when one world's habits are applied in the other, or when a helper is assumed to exist, to run, or to do something because of its name. This guide separates the two and shows how to trace a helper from its call to its effect.

## IML is not JavaScript

* **Array indexes.** IML arrays start at 1; JavaScript arrays inside a helper start at 0. `{{items[1]}}` in IML picks the first element; `items[0]` is the first in a helper.
* **Operators and fallbacks.** Familiar-looking operators and coercion can differ. The IML `ifempty(value, fallback)` falls back for `undefined`, `null` and an empty string and **keeps `0` and `false`**. JavaScript `||` falls back for every falsy value, losing `0`, `false` and `''`. A claim that a value is lost must be argued from the real expression's semantics, not the helper's name.
* **Unfamiliar is not wrong.** An IML operator that looks like a typo to a JavaScript reader may be valid, and valid IML is not necessarily valid standalone JavaScript. Identify the language context before diagnosing or translating an expression.
* **Prefer built-ins.** Use built-in IML functions (`formatDate`, `parseDate`, `omit`, `ifempty` and others from the IML reference) when they express the operation clearly, and keep custom code for what they cannot do.
* **Where to evaluate.** Built-in and custom functions are reachable from IML through the documented namespace; confirm an identifier in the reference before relying on it.

## What a custom function is

**Documented behaviour.** A custom IML function is a JavaScript function in the app that IML can call. The runtime provides standard JavaScript built-ins and `Buffer`. It is **not** a general Node environment: do not assume arbitrary package loading, network or filesystem access, or a particular Node API. Functions are subject to documented limits; confirm availability and current limits before building on them. Functions can call other functions, so trace the whole call graph.

Use helpers for work that would otherwise obscure communication: converting provider metadata into a dynamic field schema, normalising nested values, converting a date, or applying a provider-specific encoding. Keep them deterministic, small and explicit about inputs and outputs, and test missing, empty, zero, false and malformed values.

### Recursive cleaners and array elements

See [outputs, empty values and updates](outputs-empty-values-updates.md#recursive-cleanup-helpers-check-every-branch) — what a recursive empty-value cleaner, including the documented one, does to array elements, dates and buffers, and a corrected version with its tests.

### Helpers that build query text or JSON text

A `filter` parameter returns an array of condition groups. The groups are joined by OR and the `{ a, o, b }` conditions in a group by AND; an operator that needs no value has no `b`. The [filter documentation](https://developers.make.com/custom-apps-documentation/block-elements/parameters/filter) converts that value to the provider's query syntax in a custom function. Such converters decide whether user values arrive intact, and so do helpers that assemble a key predicate or a JSON string:

* **Serialise JSON with `JSON.stringify`.** A template such as `` `{"${key}": "${value}"}` `` produces invalid JSON as soon as a value contains a quote, a backslash or a line break, and it lets a value add keys. Build an object and stringify it.
* **Escape literals the way the provider's syntax documents.** `` `${field} eq '${value}'` `` breaks on an apostrophe and lets a value change the query. Many query syntaxes escape a single quote by doubling it, but check the provider's own rule ([user values inside provider query languages](../../../references/requests-and-responses.md#user-values-inside-provider-query-languages)). Quote by the field's declared type (text quoted, numbers and booleans bare), not by whether the value looks numeric. Where the provider accepts values separately (GraphQL variables, a JSON body), pass them there instead of splicing them into the query text.
* **Convert every group and every offered operator.** The documented example reads only the first group, which fits its `logic: "and"` setting; a filter that allows OR must convert every group. Give each offered operator, negations included, its own branch: a negated operator (`not contains`) that shares the positive branch silently returns the opposite records. A `switch` without `default` returns `undefined`, which `join` turns into an empty condition and a template literal turns into the text `undefined`. Map operators through an explicit table and throw on an unknown one.

Test a value containing a quote, a backslash and a line break, every offered operator, an unknown operator and, where OR is allowed, two groups.

```js
// values are assumed to arrive with their declared parameter type
const literal = (v) => (typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : String(v));

const OPERATORS = {
  'text:equal': (field, value) => `${field} eq ${value}`,
  'text:startwith': (field, value) => `startswith(${field}, ${value})`,
  // one entry per offered operator, negations included; an operator without b ignores value
};

function toCondition({ a, o, b }) {
  if (!Object.prototype.hasOwnProperty.call(OPERATORS, o)) throw new Error(`Unsupported filter operator: ${o}`);
  return OPERATORS[o](a, literal(b));
}

// JSON text: build an object, never a template
const toFilterJson = (key, value) => JSON.stringify({ [key]: value });
```

### Whole-response normalisers that convert by value shape

See [dates-helpers](dates-helpers.md#helpers-that-decide-by-value-shape) — what a helper that converts every date-looking value gets wrong (zone-less values, prefix matches, partial spellings, numbers) and the list-of-date-fields form that avoids it.

### Parsing JSON the user typed

When a helper parses text that a user typed or mapped, such as an advanced JSON field or a "properties as JSON" option, wrap `JSON.parse` and throw an error that names the field and says what is expected. An unguarded parse fails the run with a generic parser message (an unexpected token at some position), which does not tell the user which field to fix. Parse only text: a value that is already an object passes through. Test invalid JSON, an empty string and an already parsed object.

```js
function parseJsonField(text, label) {
  if (text === undefined || text === null || text === '') return undefined;
  if (typeof text === 'object') return text;
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`${label} must be valid JSON: ${e.message}`);
  }
}
```

## Tracing a helper

A helper is useful only if the data travels through it and it changes the value. Follow four links:

1. **Declared.** The function exists in the app (or the declared dependency set) under the name used. A familiar-looking identifier is not proof of a built-in or an available helper.
2. **Called.** An execution path reaches it, with a provider field or user input as argument, not a literal or unrelated variable. A helper's presence does not show that anything calls it.
3. **Effective.** It returns something computed from its argument; an identity function converts nothing, and a name like `normalizeDate` proves nothing.
4. **Consumed.** The result is used where the effect matters (request, output, interface) and, for a shared helper, every other consumer is still correct after a change.

Hidden components belong in the inventory too. Hidden visibility does not make an app empty, does not prevent testing by its author, and does not remove the need to trace it.

Do not use a number's magnitude, an identifier's type name or a parameter name as dependency proof. The dependency is shown by a reference in the definition graph, not by a guess about what a value "must be".

### Effects through mutation

A helper can act by changing an object it was given instead of returning a new one: it assigns or deletes keys on its argument, or on the items of an array argument. Within one function's code the caller then sees the change even if it ignores the return value. Whether a change made by another custom function, called through `iml.`, reaches the caller is not documented. This has two consequences:

* **Tracing.** Before calling a helper call ineffective because its result is unused (link 4), check whether the helper mutates an argument that the caller keeps using. If it does, the effect is invisible at the call site; settle it with an editor test or an execution, not from the call site alone.
* **Authoring.** Return a new value and use it at the call site, or copy before editing. A helper that edits its input in place gives a different result when the same object is processed twice. That happens with a repeated call, a recursive walk that reaches a shared object again, or a test that reuses one fixture for two assertions: the second pass sees already converted values or keys already deleted. When the contract is non-mutating, add a test that the input is unchanged after the call.

```js
// effect hidden in the argument: the call site looks like it does nothing
iml.dropEmptyArgs(parameters);
return { name: parameters.name, items: parameters.items };

// effect visible at the call site
const args = iml.dropEmptyArgs(parameters); // returns a new object
return { name: args.name, items: args.items };
```

## A small pure helper, in prose

A date normaliser takes the provider's string, checks that it matches the documented format, converts it to an ISO timestamp, and returns nothing (or fails clearly) for input it cannot parse. It has no network, no timezone guessing and no shared state. The call site passes the provider's field, and a test covers a valid value, an empty value and a malformed value.

Two habits break that purity without looking wrong:

* **Declare every variable** with `const` or `let`. An assignment to an undeclared name (`date = …`, `config = { … }`) does not create a local. In non-strict JavaScript it writes a global that can outlive the call and be seen by later calls and by other helpers sharing the runtime. In strict-mode code (ES modules and many local test runners) it throws a `ReferenceError` instead (standard JavaScript strict-mode behaviour; MDN Web Docs, strict mode). Either way the helper has shared state, and the same file can behave differently in a local test and in Make.
* **Check a lookup before dereferencing it.** `match` and `exec` return `null` when nothing matches, and `find` returns `undefined`. So `value.match(re)[1]` or `text.match(re).map(…)` throws on the first value with an unexpected shape, and the whole module run fails with the function's error. In a helper that walks every field of a response, leave a non-matching value unchanged.

```js
const match = typeof value === 'string' ? value.match(pattern) : null;
if (!match) return value; // leave an unexpected shape unchanged
const timestamp = match[1];
```

Regular expressions can carry hidden state too. A pattern with the `g` (or `y`) flag makes `test()` and `exec()` start at its `lastIndex` and move it after every match. Reusing one such object across several values, in a loop over entries or a `map` over an array, makes the next `test()` start in the middle of the next string, so a matching value can be reported as not matching. A following `replace()` resets `lastIndex`, which can hide the problem until someone removes that call (standard JavaScript behaviour; MDN Web Docs, `RegExp.prototype.test`). For a yes/no check, use a pattern without `g`, and keep `g` for `replace` or `matchAll` over one string. A literal written inside the function body is created anew on each call, so the risk is one object reused within a call, or a pattern stored outside the function body, which can be shared between calls.

```js
const iso = /^\d{4}-\d{2}-\d{2}$/g;
['2024-01-01', '2024-01-02'].map((v) => iso.test(v)); // [true, false]

const isIsoDate = /^\d{4}-\d{2}-\d{2}$/; // yes/no check: no g flag
```

## Testing a helper

This is engineering guidance for helper QA. The [IML tests page](https://developers.make.com/custom-apps-documentation/get-started/make-apps-editor/apps-sdk/iml-tests) documents the editor's `it(name, fn)` tests and strict and deep assertions; it does not mandate any of the coverage below.

1. **Trace the reachable call sites first.** List where the helper is really called and what each site can pass (a provider field, a parameter, another helper's result). Test those inputs. Do not invent inputs a call site can never supply, such as an object where only text can arrive.
2. **Assert exact results.** Use `assert.strictEqual` for primitives and `assert.deepStrictEqual` for objects and arrays, so the type and the full structure are compared. Where an error is the contract, assert the exact error type and message with `assert.throws`. A test must be able to fail: a body that never calls the helper, a swallowed `try`/`catch`, or an assertion on a constant is a vacuous pass and proves nothing.
3. **Cover the boundaries the call sites allow.** `undefined`, `null`, `false`, `0`, `''`, an empty array, and a nested object or array whose inner values are missing or `null`. Falsy is not one case: `0` and `false` are valid values and must not be treated as missing. For dates, add non-midnight timestamps, positive and negative offsets, a named IANA timezone, a DST boundary where the helper converts zones, and an explicitly set extension timezone ([dates-helpers](dates-helpers.md)).
4. **Do not demand the impossible.** A pure static helper (a constant, or a fixed mapping with no input) may need no behavioural test, if the review says why. Do not require a test for an input type the call sites cannot produce.

These standards apply when you author or evaluate a new or changed helper test. A working legacy app that lacks comprehensive helper unit tests has an evidence limitation: report it and recommend tests, but it is not by itself a defect or an approval blocker. It becomes one only when the task's explicit review criteria require such tests, or when the helper's actual behavior lacks the evidence needed to judge it. A helper that demonstrably returns a wrong value is still a finding, whatever tests exist.

`assert.ok(value, expected)` does not compare `value` with `expected`. Its second argument is only the failure message, so the call passes whenever `value` is truthy, whatever `expected` is. It cannot check for `null`, `0`, `false` or `''` at all, because those are falsy and fail. Use `strictEqual` or `deepStrictEqual` to state an expected result; do not copy an `assert.ok(result, expected)` pattern or a placeholder test that asserts `true` about a function it never calls ([Node.js assert](https://nodejs.org/api/assert.html)).

Editor-targeted tests are written here as bare `it()` calls with the editor's `assert`, the supported format used in this guidance; do not add `import` lines or `describe` to these snippets. Local Node test infrastructure is separate. The helper below is illustrative.

```js
it('returns exact initials for a full name', () => {
  assert.strictEqual(initials('ada king lovelace'), 'AKL');
});

it('returns an empty string for missing or blank names', () => {
  assert.strictEqual(initials(undefined), '');
  assert.strictEqual(initials(null), '');
  assert.strictEqual(initials(''), '');
});

it('keeps nested values exact', () => {
  assert.deepStrictEqual(initialsOf({ people: [{ name: 'ada king' }, { name: null }] }), ['AK', '']);
});
```

A local Node test may use Node's own infrastructure, including `node:test` and `node:assert/strict`, and may assert an exact error:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { toLimit } from './toLimit.js';

test('0 is out of range, not "missing"', () => {
  assert.throws(() => toLimit(0), { name: 'RangeError', message: 'limit must be an integer from 1 to 100' });
});
```

A local test with a mock runs your function in Node. It is not proof of how Make runs it, of the available built-ins, or of the editor's behaviour; report it as a local unit test and use an editor test or an execution when the Make runtime is the question.

`assert.throws` has the same trap shape as `assert.ok`. In Node.js `assert` (listed under Sources) its second argument is an optional error validator and its third argument is only the failure message. The editor page lists the signature as `assert.throws(fn, [error])`. None of these forms checks the error the test is named after:

* `assert.throws(fn)` with no validator passes for any error. That includes a `TypeError` from a crash before the helper reaches its own check.
* A class alone, as in `assert.throws(fn, TypeError, 'input is missing')`, passes for every error of that class. The string is never compared with the thrown message. With `Error` as the class, any thrown error object passes.
* A string as the second argument is not a validator either. Node treats it as the failure message.
* A misplaced closing parenthesis, as in `assert.throws(() => { fn(bad, TypeError, 'msg'); })`, turns the class and the message into extra arguments of the helper. Nothing is validated.

Pin the error with a regular expression or with an object holding `name` and `message`, so that a different error fails the test. Node tests a regular expression against the error's `Name: message` text, so anchor it with `^` and `$` when the exact message is the contract. The editor page documents no validator form beyond `[error]`: before relying on one there, change the expected message once and confirm that the test fails. The helper below is illustrative.

```js
it('rejects a response without items', () => {
  assert.throws(() => normalizeResponse({}), /^TypeError: "response\.items" is missing\.$/);
  assert.throws(() => normalizeResponse({}), { name: 'TypeError', message: '"response.items" is missing.' });
});
```

## Rationale

IML keeps communication declarative and reviewable; helpers are an escape hatch with a smaller, different runtime. Keeping each in its own lane makes expressions readable and makes helper failures easy to localise.

## Pitfalls

* Translating an IML index of 1 into a JavaScript index of 1, or the reverse.
* Replacing `ifempty` with `||` (or the reverse) without checking the value types involved.
* Importing a package or calling `fetch` in a helper.
* Treating a helper as active because it exists, or as built-in because its name looks familiar.
* Changing a shared helper without checking every module and RPC that calls it.
* Concluding a value is a timestamp or an identifier from its digits.
* Passing `assert.ok(result, expected)` and believing `expected` was compared, or testing only inputs the call sites never send.
* Reporting a local mock test as proof of Make runtime behaviour.
* Reading `assert.throws(fn, TypeError, 'message')` as a check of the message, or writing `assert.throws(fn)` with no validator.
* Reusing a recursive empty-value cleaner (including the documented one) without checking that primitive array items and `Buffer` values survive and that emptied elements are removed rather than sent as `{}` or `null`.
* Building JSON or provider query text with template strings around user values, converting only the first group of a filter that allows OR, or letting a negated operator share the positive branch.
* Converting every date-looking string in a response, including free text that only starts with a timestamp.
* Calling a helper call unused without checking whether the helper mutates its argument, or relying on such a mutation instead of a returned value.
* Assigning to an undeclared variable, or indexing the result of `match`, `exec` or `find` without checking it.
* Parsing user-typed JSON without an error that names the field.
* Calling `test()` repeatedly on one regular expression that has the `g` flag.

## Exceptions and applicability

* Applies to apps that use expressions or custom functions; apps with plain mappings need little of it.
* Limits and available built-ins evolve; the IML and function pages are the authority.
* Helpers that read dynamic metadata also follow the schema guidance in [dynamic-data-and-files](dynamic-data-and-files.md).

## Evidence and limits

* IML indexing, `ifempty`, available runtime features: **documented behaviour** (JavaScript in Make, custom IML functions, debugging functions).
* The helper-testing steps (exact assertions, boundaries, timezones): **engineering guidance**, not a documented Make requirement; only `it(name, fn)` tests and the assertion style come from the editor documentation, and Node's assert semantics come from the Node.js documentation.
* The four-link trace: **inferred implementation pattern**; the checker's textual version in [dates-helpers](dates-helpers.md) never executes a helper.
* Runtime behaviour needs runtime evidence, and a helper test in the debugging tools is one good source. It is not the only one: a module or RPC run that exercises the helper, an IML test file, or a scenario execution also shows what the function returns. Choose evidence that covers the real call path and the missing, empty, zero, false and malformed inputs.
* `assert.throws` argument semantics: **Node.js documentation**; the editor page only lists `assert.throws(fn, [error])`. `lastIndex` state and undeclared assignments in strict and non-strict code: **standard JavaScript behaviour** (MDN), not Make sources. The array and `Buffer` behaviour of the documented empty-removal helper is read from its published code. The filter value's groups, conditions and OR/AND joining are **documented behaviour** (filter parameter page).
* Escaping and operator coverage in query builders, value-shape normalisers, mutation and guarded JSON parsing: **engineering guidance** drawn from recurring helper patterns, not documented Make requirements. Whether a mutation crosses an `iml.` call between custom functions is **not documented**. A demonstrably wrong value is still a finding; a style difference alone is not.

## Sources

* https://developers.make.com/custom-apps-documentation/block-elements/iml
* https://developers.make.com/custom-apps-documentation/app-components/iml-functions
* https://developers.make.com/custom-apps-documentation/app-components/iml-functions/dynamic-mappable-parameters
* https://developers.make.com/custom-apps-documentation/debug-your-app/debugging-of-custom-iml-functions
* https://developers.make.com/custom-apps-documentation/get-started/make-apps-editor/apps-sdk/iml-tests
* https://nodejs.org/api/assert.html (strictEqual, deepStrictEqual, throws and ok semantics for local Node tests; not a Make source)
* https://developers.make.com/custom-apps-documentation/app-components/iml-functions/removal-of-empty-collections-and-nulls (the documented recursive removal helper and its array handling)
* https://developers.make.com/custom-apps-documentation/block-elements/parameters/filter (filter value structure and converting operators in a custom function)
* MDN Web Docs, `RegExp.prototype.test` (`lastIndex` with the `g` flag; not a Make source)
* MDN Web Docs, strict mode (undeclared assignments; not a Make source)
