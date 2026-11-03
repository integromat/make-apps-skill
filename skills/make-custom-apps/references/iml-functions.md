# IML expressions and app functions

Load this reference when expressions need transformation, parsing, validation, or
signing logic, or when a custom function requires executable tests.
Use [requests-and-responses.md](requests-and-responses.md) for HTTP orchestration.

## Keep the runtimes separate

- App IML functions are custom-app components invoked from that app's IML expressions.
  They are not organization-level Custom Functions or a general Node.js service.
- The SDK guide states that custom IML functions are not enabled by default.
  Confirm access before designing an app that depends on them; follow the documented
  support route if enablement is required.
- Prefer built-in IML functions and declarative communication when they suffice.
- A helper copied from another app must exist in the target app; its name alone
  does not make it a built-in function or a dependency available at runtime.
- Keep local directory names, generators, and test runners separate from platform
  requirements. Reuse valid short implementations, not private deployment assumptions.

Source: [Custom IML functions and availability](https://developers.make.com/custom-apps-documentation/app-components/iml-functions.md).

## Expression semantics

IML is JavaScript-like, not arbitrary JavaScript pasted into JSON. Use `{{...}}`
expressions and supported functions. Arithmetic, comparison, and logical operators
are documented; equality comparisons are strict even when written `=` or `==`.

IML arrays are **one-based**: `{{body.data[1]}}` selects the first item.
JavaScript inside a custom function uses ordinary **zero-based** array indexing.
Do not copy an exported `[0]` expression without checking which runtime evaluates it.

Use dot notation for ordinary properties, backticks for special property names,
and `get()` for a computed property. For example, the documented header form is
``{{headers.`X-HOOK-TYPE`}}``. Do not translate JavaScript method chains such as
`.startsWith()` into IML without checking the expression language.

The current IML guide defines `ifempty(a, b)` as falling back for undefined, null,
or an empty string; it does **not** define `false` or `0` as empty. Nevertheless,
`ifempty(..., undefined)` can erase an intentional null or empty string.
Truthiness defaults such as `value || fallback` can also discard valid values.
Prefer direct mapping when the provider accepts the supplied value and preserve
`false`, `0`, explicit clears, and empty arrays according to the operation contract.

Sources: [JavaScript-like IML, operators, indexing, and ifempty](https://developers.make.com/custom-apps-documentation/block-elements/iml.md),
[Empty-value handling](https://developers.make.com/custom-apps-documentation/best-practices/input-parameters/processing-of-input-parameters.md#handling-arrays-nulls-and-empty-strings).

### toCollection on user-entered rows

`toCollection(rows, 'name', 'value')` turns user-entered name/value rows into a collection,
and it does so quietly: a repeated name keeps only the last row's value, and a row with an
empty name is dropped. An empty or missing array gives an empty collection, so a spread
`"{{...}}": "{{toCollection(parameters.rows, 'name', 'value')}}"` adds nothing. Each value is
passed through unchanged, so it keeps the type its sub-field produced (text stays text).

When you build or change such an array, especially one whose rows become body fields, query
parameters or custom fields:

- mark the name sub-field `required`, so a row is not lost without a message;
- say in the array's `help` that a repeated name keeps the last value;
- give the value sub-field the type the provider expects.

In an existing array these are advice, not a defect, unless a lost or overwritten row is
shown to break a request.

### split() is not JavaScript split

IML `split(text, separator)` trims each item and drops empty items:
`split('a, b,,c', ',')` returns `["a", "b", "c"]`, and a leading or doubled separator
creates no empty position. A comma-separated text input therefore needs no extra trimming
in IML, and a review should not report missing trimming there. Do not read positions with
`get(split(...), n)` when segments can be empty, because they shift. Inside a custom
function, `value.split(',')` keeps spaces and empty strings: use
`value.split(',').map((s) => s.trim()).filter(Boolean)` or call `iml.split()`.

### URL-safe base64

`base64()` and `sha256(text, 'base64')` return standard base64 (`+`, `/` and `=` padding).
URL-safe base64 (`-` and `_`, usually without padding), as used by a PKCE
`code_challenge`, JWT segments and some message APIs, is not a built-in IML function. The
OAuth 2 PKCE example calls `base64url(...)`; that call works only when the app defines a
custom function with that name, and otherwise fails with a "function not found" error.
Without custom functions, convert in IML:

```text
{{replace(replace(replace(sha256(temp.code_verifier, 'base64'), '+', '-'), '/', '_'), '=', '')}}
```

IML `replace()` with a plain search string replaces every occurrence. Inside a function,
JavaScript `'a+b+c'.replace('+', '-')` replaces only the first one, so use
`.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')`. Decoding needs no
conversion: `toBinary(value, 'base64')` accepts both alphabets, with or without padding.
Keep the encoding in one place and test it with input whose standard encoding contains `+`
and `/`. A challenge that still contains `+`, `/` or `=` does not match the verifier, so the
token exchange fails.

## Custom function contract

Pass all required values as explicit arguments. Do not assume a custom JavaScript
function automatically receives `body`, `connection`, or another component context.
Return the intended collection, array, string, number, boolean, or buffer rather
than stringifying data that the surrounding directive expects as an object.

The documented runtime provides JavaScript built-in objects, ES6 features, `Buffer`,
and built-in/custom IML functions through the `iml` namespace, such as
`iml.parseDate()`. Use `JSON.parse()` and `JSON.stringify()` inside functions rather
than the expression-layer `parseJSON()` and `createJSON()` helpers.

Do not import `require`, Node `crypto`, filesystem modules, or network clients into
app code. Do not move HTTP validation into `fetch()`. Use Communication for requests;
keep functions bounded data transformations and verify signing against supported
IML primitives when needed.

The current guide lists a 10-second execution timeout and a 5,000-character function
limit. Recheck the live guide before targeting a limit; do not assume local Node
performance or package availability reproduces the app runtime.

Sources: [Function runtime and limits](https://developers.make.com/custom-apps-documentation/app-components/iml-functions.md),
[IML built-ins and JSON conversion](https://developers.make.com/custom-apps-documentation/block-elements/iml.md).

### Serialize values instead of splicing them into text

Treat names and values that come from the user, the connection or the provider as data for
a serializer, never as text to splice. JSON text built as `'{"' + name + '":' + ...` in a
function, or as `parseJSON('{"k":"' + parameters.k + '"}')` in IML, fails or gains extra
members when a table name, column, file name, free-text value or even an API key contains a
quote, a backslash or a line break.

- In a function, build an object (`const out = {}; out[name] = rows; return out;`) and return
  it, or pass it to `JSON.stringify()` when the caller needs a string.
- In IML, put the structure in the directive (`"body": {"k": "{{parameters.k}}"}`).
- When the body has to stay text, for example because a signature covers the exact sent
  bytes, wrap every spliced value in `createJSON()` and guard optional values: when an absent
  value arrives as `undefined`, `createJSON()` returns nothing and
  `'{"k":' + createJSON(parameters.k) + '}'` becomes `{"k":}`. Use
  `ifempty(createJSON(parameters.k), 'null')` or leave the member out. Outside this text-body
  case, keep objects as objects ([requests-and-responses.md](requests-and-responses.md)).
- `escapeHTML()` (`iml.escapeHTML()` in a function) replaces only `&`, `<` and `>`. Inside a
  quoted HTML attribute value, after `escapeHTML()`, also replace `"` with `&quot;` (and `'`
  with `&#39;` in a single-quoted one). Replacing line breaks with `<br>` is formatting, not
  escaping.
- In a MIME message, multipart part or other header block assembled as text, remove CR and LF
  from every user value (header names and values, file names, display names), so a value
  cannot start a new header line.

Test each assembled text with a value containing `"`, `\`, a line break and non-ASCII text,
and with each optional value left empty, not only the happy path.

## Reuse a small testable function

The following function and the first two tests reuse the SDK's IML test example.
The third test checks null input. Names are synthetic fixture values, not account data.
Store the source and tests in the selected editor's function and test components;
`code.js` and `test.js` below are only local file conventions.

```javascript
function formatUsername(user) {
    if (!user || !user.firstName || !user.lastName) {
        return null;
    }
    return `${user.firstName} ${user.lastName}`;
}
```

```javascript
it("should format full name correctly", () => {
    const user = { firstName: "Jane", lastName: "Doe" };
    const result = formatUsername(user);
    assert.strictEqual(result, "Jane Doe");
});

it("should return null if last name missing", () => {
    const user = { firstName: "Jane" };
    const result = formatUsername(user);
    assert.strictEqual(result, null);
});

it("should return null for null input", () => {
    assert.strictEqual(formatUsername(null), null);
});
```

Run the editor's **Run IML test** action and inspect its output channel.
Set the extension's timezone when testing date/time functions.

Source: [Write and run IML tests](https://developers.make.com/custom-apps-documentation/get-started/make-apps-editor/apps-sdk/iml-tests.md).

## Make offline tests genuinely executable

A syntax check does not execute assertions. A plain Node run also does not magically
provide the function under test, `it`, `assert`, or Make's `iml` namespace.
For helpers using only standard JavaScript, a local harness can load both files:

```javascript
const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const files = process.argv.slice(2);
if (files.length !== 2) throw new Error("Pass source and test paths");
let passed = 0;
const sandbox = { assert, Buffer, it(name, test) { test(); passed += 1; } };
vm.createContext(sandbox);
for (const file of files) {
    vm.runInContext(fs.readFileSync(file, "utf8"), sandbox, {
        filename: file, timeout: 1000
    });
}
if (passed === 0) throw new Error("No tests executed");
console.log(`${passed} tests passed`);
```

Run it as `node run-tests.cjs code.js test.js` after saving those local files.
**The Node imports belong only to this offline harness, never to app function code.**
For helpers using `iml.*`, run SDK tests or clearly document limited test substitutes;
do not report a stubbed function as proof of real Make semantics.

## Make helper tests exact and able to fail

This is engineering guidance for helper QA; the IML tests page only documents `it(name, fn)`
and the strict and deep assertions, not the coverage below. The runnable examples are in
[IML and helpers](../examples/current-knowledge/guides/iml-and-helpers.md) and the date side
in [dates and helpers](../examples/current-knowledge/guides/dates-helpers.md).

1. **Trace reachable call sites first.** Test what each real call site can pass (a provider
   field, a parameter, another helper's result). Do not demand a test for an input type no
   call site can produce, and do not demand a behavioral test for a pure static helper (a
   constant or a fixed mapping with no input) when the review says why none is needed.
2. **Assert exact results.** `assert.strictEqual` for primitives, `assert.deepStrictEqual`
   for objects and arrays; where an error is the contract, assert the exact error type and
   message (`assert.throws` in a local Node test). A test must be able to fail: no vacuous
   success, such as a body that never calls the helper, a swallowed `try`/`catch`, or an
   assertion on a constant. The `it()` harness above passes a test that makes no assertion.
3. **Cover the boundaries the call sites allow:** `undefined`, `null`, `false`, `0`, `''`,
   an empty array, and nested objects or arrays whose inner values are missing or `null`.
   `0` and `false` are valid values, not "missing".
4. **For date and time helpers**, add non-midnight timestamps, positive and negative
   offsets, a named IANA timezone, a DST boundary where the helper converts zones, and an
   explicit extension timezone when running the editor test.
5. **`assert.ok(value, expected)` does not compare equality.** Its second argument is only
   the failure message, so the call passes whenever `value` is truthy. It cannot assert
   `null`, `0`, `false` or `''`. Do not write `assert.ok(fn({}), null)` or a placeholder test
   that asserts `true` about a function it never calls; use `strictEqual` or
   `deepStrictEqual` ([Node.js assert](https://nodejs.org/api/assert.html)).
6. **Editor tests: bare `it()` snippets are the supported format used here.** Write them
   without `import` lines or `describe`. Only a local Node test file uses `node:test` and
   `node:assert/strict`; that local Node infrastructure is separate from editor tests.
7. **A local test or mock is not Make runtime proof.** Report it as a local unit test; use
   an editor test or an execution when the Make runtime, built-ins or `iml.*` behavior is
   the question.

Points 1-6 are standards for authoring or evaluating a new or changed function test. Missing
comprehensive helper tests in a working legacy app (maintenance that does not change the helper)
are an evidence limitation and advice, not an automatic defect or approval blocker, unless the
task's explicit review criteria or request-scope requirements (which can block when unmet) require them or the helper's actual behavior lacks essential
evidence. Demonstrably incorrect behavior stays a finding.

### Run the shipped tests, not only read them

Execute every shipped test against the current function source: with the editor's
**Run IML test**, or with the local harness above when the helper makes no `iml.*` call. A
test that cannot run locally only because the harness lacks `iml` is an evidence limit, not a
finding. Tests that fail or cannot run were seen in approved apps; look for these forms:

- an assertion on a property the function never sets, such as
  `assert.strictEqual(attr.time, false)` when the code never adds `time`;
- `strictEqual` against a fresh array or object (`assert.strictEqual(fn(x), [])`), which
  always fails because `[] !== []`; use `deepStrictEqual`;
- a call the IML tests page does not document, such as a Jest-style
  `expect(...).toEqual(...)` or a `require()` of a fixture or module. Rewrite it with `it`
  and the documented `assert` functions.

Report a red test, or one the editor's **Run IML test** cannot execute, as a finding. Decide
from the real call sites whether the test or the function is wrong, and fix that side: a wrong
function is a demonstrated defect; a wrong test alone is advisory under [Approval
gating](review-and-qa.md#2a-approval-gating) and is fixed because the fix is clear.

## Transformation and verification gate

- Test absent, null, empty-string, zero, false, and normal inputs where meaningful.
- Test primitive arrays, nested collections, dates, and buffers before reusing a
  generic empty-removal function. Removing every null can destroy an update's erase intent.
- Preserve original fields during read/merge/write updates; changing one field must
  not silently drop unrelated `false`, `0`, or empty values.
- For XML, prefer the documented response parser; regex tag matching is not a generic
  XML parser. For signatures, use independent documented test vectors and exact bytes.
- Keep transformation helpers free of credentials, endpoint secrets, and side effects.
- Verify each custom call has a matching implementation and, where tests exist or are being
  added, that every test actually ran.
- Report offline assertions, SDK function tests, and full module execution separately.
  No local harness proves connection authentication, pagination, or deployment readiness.

Sources: [Conditional empty removal](https://developers.make.com/custom-apps-documentation/app-components/iml-functions/removal-of-empty-collections-and-nulls.md),
[Full-update behavior](https://developers.make.com/custom-apps-documentation/app-components/iml-functions/handling-of-full-update-approach-in-update-modules.md).

### Normalize before hashing identifiers

When a provider requires personal identifiers (email, phone, names, address parts) to
arrive hashed, its per-field normalization is part of the contract: a wrongly normalized
hash is accepted by the API and silently never matches.

- Apply each field's documented rule (trim, lowercase, allowed characters, phone format)
  before hashing, for example `sha256(lower(trim(parameters.email)))`. Rules differ per field
  and per provider; do not copy them from another integration.
- Hash only present, non-blank values and leave the field out otherwise. `sha256()` of a
  missing value fails the module, and `sha256('')` returns the digest of the empty string
  (`e3b0c442…`), which a provider can accept as a real value.
- Pass fields the provider wants raw (for example an IP address or user agent) through
  unhashed, and keep it visible which fields are hashed and which are raw.
- Use the digest encoding the provider expects; `sha256()` returns hex by default.
- Test mixed-case, padded, formatted and blank inputs against the provider's documented
  examples.
