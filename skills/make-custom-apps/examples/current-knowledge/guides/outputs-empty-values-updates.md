# Outputs, empty values and updates

Back to the [knowledge index](../README.md).

Three questions decide whether a module is pleasant to use in a scenario: what *shape* does it return, what does it do when a user leaves a field empty, and does an update change only what the user meant to change. Each has documented platform behaviour that custom code often fights. This guide explains the behaviour first and then when custom handling is justified.

## Output: start from the useful response

**Documented recommendation.** Return the provider's response as it is (`output: "{{body}}"` for actions, `output: "{{item}}"` for search results), and remove only what you must. That keeps custom fields and later provider additions mappable.

**Documented flexibility.** The same guidance allows removing transport metadata, unwrapping a data envelope, flattening unnecessary nesting, converting awkward key/value structures into mappable fields, parsing dates and using custom functions. Reshaping is not wrong; *unexplained* reshaping that drops fields users need is.

Keep concepts distinct: the iterated item of a search, the wrapper object, and an action's single result (which may contain an array). Output must never carry error messages; those belong to the error directive ([errors-and-rate-limits](errors-and-rate-limits.md)). Search modules expose individual records; batch and bulk modules need a deliberate item-level model.

**Interface honesty.** The interface describes the emitted value; it never converts it. It must agree in names, nesting and types with what is output. A field missing from the interface is not necessarily unmappable. Refresh scenarios after changing an interface ([interfaces-required](interfaces-required.md)).

**Precision.** A provider identifier too large for a JSON number can be rounded during parsing; switching the interface to text afterwards cannot recover digits. Use the documented response-parsing option, or have the provider send strings. Label derived units and rounding explicitly instead of replacing original values silently.

## Empty values: omission, clearing and setting

Model three intents separately: *leave unchanged*, *clear*, *set*. Legitimate `0`, `false`, empty strings and empty arrays can carry meaning, so cleanup based on truthiness changes data.

**Documented behaviour.**

* On Apps platform version 2, empty values are ignored by default; update and universal modules show an erase option so users can send an explicit empty value. The erase behaviour is type-dependent, not "send null".
* Passing the whole parameter collection (`"body": "{{parameters}}"`, or `"{{...}}": "{{omit(parameters, 'id')}}"`) is recommended over building each key by hand, and dropping empties with `ifempty(..., undefined)` or `if` is discouraged because it prevents clearing.
* Version 1 differs; check the app's platform version.
* Nested collections can remain empty after processing, and a provider may treat an empty object differently from an omitted one.
* Recursive removal of nulls and empty collections is a documented helper, useful only when its semantics fit the operation (typically not for updates that must clear).
* `ifempty` keeps `0` and `false` ([iml-and-helpers](iml-and-helpers.md)).

### Processed values by intent (Apps platform version 2)

| Intent | Processed value |
| --- | --- |
| Text left blank | omitted (ignored) |
| Text, Erase | `null` |
| Text, forced empty string through IML | `""` |
| Array / multiple select, Erase | `[]` |
| Number, Erase | `null` |
| Boolean `false` (supplied value) | `false`; a legitimate value |
| `0` | a legitimate value, kept by `ifempty` |

"Platform version 2" is the Apps platform version, which is distinct from the app's own major version; do not infer one from the other.

### Accepting null, empty or omission

Derive what is acceptable from each provider field's contract and the requested intent, not from a blanket rule. Erase, whole-parameter collections, `ifempty` and optional parameters are all fine where the contract fits. Whole-collection mapping is recommended, but it forwards the *processed* values; it does not turn a text `null` into `""`.

**Static ready gate.** If a requested text clear must reach the provider as a non-null empty string, then instructing users to use text Erase while forwarding the processed `null` contradicts that contract. That is an authoring and guidance defect visible in the source, before any live execution. A forced IML empty string is the documented alternative for text; confirm the exact mapping against the official page rather than assuming a helper. Array Erase (`[]`) is a separate case and fits a field that needs an empty array.

Keep these layers separate and verify each independently: the permitted input (actual module CRUD, update or universal classification governs whether Erase is shown; a label or a PATCH verb does not prove it), the actual processed value, the serialization, and provider acceptance. `required: true` or `min: 0` alone does not prove the UI accepts an empty value. JSON-schema-style required properties are not the same as UI flags that reject legitimate empties, and not every optional provider field should be made required.

Reference expectations for a synthetic contract (booleans, integer, text, array, nullable and optional controls) are in [reference-vectors.txt](../recipes/empty-values-contract/reference-vectors.txt). They are JSON data, not IML and not checker fixtures, and they are expectations rather than executed Make output.

## Updates: partial or full replacement

Decide from the provider's contract, not the HTTP verb: some APIs support partial behaviour through PUT, and some PATCH calls still replace nested collections.

* If the update **replaces** the resource and needs every current field, a read-and-merge sequence (get the resource, overlay the user's edits and clears, send everything) preserves unspecified values. Keep the merge aligned with the provider's writable schema and mind nested collections, where a shallow merge can be wrong.
* If the provider documents **partial** updates, an extra read is unnecessary cost and adds concurrency and permission risk.
* A warning in the description does not make a destructive replacement safe.
* A read followed by one write is the valid shape of that merge. It is different from several independent writes in one module, which the [batch-actions best practices](https://developers.make.com/custom-apps-documentation/best-practices/modules/batch-actions) say cannot report partial success and recommend splitting into separate modules. Classify requests by side effects, not HTTP verb, and see [requests-files-multistep](requests-files-multistep.md) for the exceptions and for what a request array does and does not guarantee.

## Dynamic fields and metadata

When fields come from provider metadata, keep stable machine identifiers separate from display labels so duplicate labels cannot overwrite distinct values; preserve type, requiredness and options until every decision that needs them has run; strip UI-only routing controls before the payload is sent; and give unsupported provider types an explicit fallback or documented limitation. See [dynamic-data-and-files](dynamic-data-and-files.md).

## Rationale

Make already ignores empty values and offers erase; it already lets you return responses untouched. Custom code is justified where the provider's contract demands it (a replacement update, a clean schema, a safe identifier). Each custom step should answer a named provider fact, which keeps modules compatible with the scenarios that already use them.

## Pitfalls

* Falsy cleanup that removes `0`, `false` or empty strings the user set on purpose.
* Using `||` fallbacks for numbers and booleans.
* Sending `null` for clearing everywhere regardless of type.
* Telling users to Erase a text field whose provider rejects `null` and needs `""`.
* Treating `required: true` / `min: 0` as proof that an empty value can be entered.
* Assuming every PUT is a full replacement, or that a warning makes replacement safe.
* A shallow merge over a nested collection.
* Changing an output type or key in a shipped module without a compatibility plan ([compatibility-evidence](compatibility-evidence.md)).
* Dropping provider custom fields while "cleaning" the output.

## Exceptions and applicability

* Version 1 apps have different empty-value behaviour.
* Providers that treat omitted and empty values identically need less machinery.
* Read-and-merge needs read permission and tolerates last-writer-wins races; weigh it.
* **Approval impact** ([Approval gating](../../../references/review-and-qa.md#approval-gating)). Requiredness advice (key presence versus a nonempty value, create requiredness copied into an update form, conditional or at-least-one groups) is advisory unless the operation contract documents omission semantics that make the input impossible to supply. Falsy or null values that are dropped, or a clearing operation that becomes a no-op, remain established functional failures when shown.

## Evidence and limits

* Output options, empty-value processing, erase and `ifempty` semantics: **documented behaviour / recommendation** (output, empty values and IML pages).
* Provider update semantics and identifier formats: **provider contract**.
* The vectors file is synthetic **expectation data** derived from the documented table; no request was executed, and real module classification and serialization must still be verified.
* The static checker only compares declared names and sample types in fixtures; it cannot judge a real transformation.

## Sources

* https://developers.make.com/custom-apps-documentation/component-blocks/api/handling-responses/output
* https://developers.make.com/custom-apps-documentation/best-practices/output-parameters/processing-of-output-parameters
* https://developers.make.com/custom-apps-documentation/best-practices/output-parameters/interface
* https://developers.make.com/custom-apps-documentation/component-blocks/api/handling-responses/type
* https://developers.make.com/custom-apps-documentation/component-blocks/interface
* https://developers.make.com/custom-apps-documentation/other/processing-of-empty-values
* https://developers.make.com/custom-apps-documentation/best-practices/input-parameters/processing-of-input-parameters
* https://developers.make.com/custom-apps-documentation/app-components/iml-functions/removal-of-empty-collections-and-nulls
* https://developers.make.com/custom-apps-documentation/app-components/iml-functions/handling-of-full-update-approach-in-update-modules
* https://developers.make.com/custom-apps-documentation/best-practices/modules/batch-actions
* https://developers.make.com/custom-apps-documentation/best-practices/modules/bulk-actions
* https://developers.make.com/custom-apps-documentation/best-practices/modules/search-modules
