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

## Rationale

IML keeps communication declarative and reviewable; helpers are an escape hatch with a smaller, different runtime. Keeping each in its own lane makes expressions readable and makes helper failures easy to localise.

## Pitfalls

* Translating an IML index of 1 into a JavaScript index of 1, or the reverse.
* Replacing `ifempty` with `||` (or the reverse) without checking the value types involved.
* Importing a package or calling `fetch` in a helper.
* Treating a helper as active because it exists, or as built-in because its name looks familiar.
* Changing a shared helper without checking every module and RPC that calls it.
* Concluding a value is a timestamp or an identifier from its digits.

## Exceptions and applicability

* Applies to apps that use expressions or custom functions; apps with plain mappings need little of it.
* Limits and available built-ins evolve; the IML and function pages are the authority.
* Helpers that read dynamic metadata also follow the schema guidance in [dynamic-data-and-files](dynamic-data-and-files.md).

## Evidence and limits

* IML indexing, `ifempty`, available runtime features: **documented behaviour** (JavaScript in Make, custom IML functions, debugging functions).
* The four-link trace: **inferred implementation pattern**; the checker's textual version in [dates-helpers](dates-helpers.md) never executes a helper.
* Runtime behaviour needs runtime evidence, and a helper test in the debugging tools is one good source. It is not the only one: a module or RPC run that exercises the helper, an IML test file, or a scenario execution also shows what the function returns. Choose evidence that covers the real call path and the missing, empty, zero, false and malformed inputs.

## Sources

* https://developers.make.com/custom-apps-documentation/block-elements/iml
* https://developers.make.com/custom-apps-documentation/app-components/iml-functions
* https://developers.make.com/custom-apps-documentation/app-components/iml-functions/dynamic-mappable-parameters
* https://developers.make.com/custom-apps-documentation/debug-your-app/debugging-of-custom-iml-functions
* https://developers.make.com/custom-apps-documentation/get-started/make-apps-editor/apps-sdk/iml-tests
