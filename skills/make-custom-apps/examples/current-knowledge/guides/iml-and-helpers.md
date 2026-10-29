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

## Tracing a helper

A helper is useful only if the data travels through it and it changes the value. Follow four links:

1. **Declared.** The function exists in the app (or the declared dependency set) under the name used. A familiar-looking identifier is not proof of a built-in or an available helper.
2. **Called.** An execution path reaches it, with a provider field or user input as argument, not a literal or unrelated variable. A helper's presence does not show that anything calls it.
3. **Effective.** It returns something computed from its argument; an identity function converts nothing, and a name like `normalizeDate` proves nothing.
4. **Consumed.** The result is used where the effect matters (request, output, interface) and, for a shared helper, every other consumer is still correct after a change.

Hidden components belong in the inventory too. Hidden visibility does not make an app empty, does not prevent testing by its author, and does not remove the need to trace it.

Do not use a number's magnitude, an identifier's type name or a parameter name as dependency proof. The dependency is shown by a reference in the definition graph, not by a guess about what a value "must be".

## A small pure helper, in prose

A date normaliser takes the provider's string, checks that it matches the documented format, converts it to an ISO timestamp, and returns nothing (or fails clearly) for input it cannot parse. It has no network, no timezone guessing and no shared state. The call site passes the provider's field, and a test covers a valid value, an empty value and a malformed value.

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

## Exceptions and applicability

* Applies to apps that use expressions or custom functions; apps with plain mappings need little of it.
* Limits and available built-ins evolve; the IML and function pages are the authority.
* Helpers that read dynamic metadata also follow the schema guidance in [dynamic-data-and-files](dynamic-data-and-files.md).

## Evidence and limits

* IML indexing, `ifempty`, available runtime features: **documented behaviour** (JavaScript in Make, custom IML functions, debugging functions).
* The helper-testing steps (exact assertions, boundaries, timezones): **engineering guidance**, not a documented Make requirement; only `it(name, fn)` tests and the assertion style come from the editor documentation, and Node's assert semantics come from the Node.js documentation.
* The four-link trace: **inferred implementation pattern**; the checker's textual version in [dates-helpers](dates-helpers.md) never executes a helper.
* Runtime behaviour needs runtime evidence, and a helper test in the debugging tools is one good source. It is not the only one: a module or RPC run that exercises the helper, an IML test file, or a scenario execution also shows what the function returns. Choose evidence that covers the real call path and the missing, empty, zero, false and malformed inputs.

## Sources

* https://developers.make.com/custom-apps-documentation/block-elements/iml
* https://developers.make.com/custom-apps-documentation/app-components/iml-functions
* https://developers.make.com/custom-apps-documentation/app-components/iml-functions/dynamic-mappable-parameters
* https://developers.make.com/custom-apps-documentation/debug-your-app/debugging-of-custom-iml-functions
* https://developers.make.com/custom-apps-documentation/get-started/make-apps-editor/apps-sdk/iml-tests
* https://nodejs.org/api/assert.html (strictEqual, deepStrictEqual, throws and ok semantics for local Node tests; not a Make source)
