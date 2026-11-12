# Outputs, empty values and updates

Back to the [knowledge index](../README.md).

Three questions decide whether a module is pleasant to use in a scenario: what *shape* does it return, what does it do when a user leaves a field empty, and does an update change only what the user meant to change. Each has documented platform behaviour that custom code often fights. This guide explains the behaviour first and then when custom handling is justified.

## Output: start from the useful response

**Documented recommendation.** Return the provider's response as it is (`output: "{{body}}"` for actions, `output: "{{item}}"` for search results), and remove only what you must. That keeps custom fields and later provider additions mappable.

**Documented flexibility.** The same guidance allows removing transport metadata, unwrapping a data envelope, flattening unnecessary nesting, converting awkward key/value structures into mappable fields, parsing dates and using custom functions. Reshaping is not wrong; *unexplained* reshaping that drops fields users need is.

Keep concepts distinct: the iterated item of a search, the wrapper object, and an action's single result (which may contain an array). Output must never carry error messages; those belong to the error directive ([errors-and-rate-limits](errors-and-rate-limits.md)). Search modules expose individual records; batch and bulk modules need a deliberate item-level model.

**Interface honesty.** The interface describes the emitted value; it never converts it. It must agree in names, nesting and types with what is output. A field missing from the interface is not necessarily unmappable. Refresh scenarios after changing an interface ([interfaces-required](interfaces-required.md)).

**Precision.** A provider identifier too large for a JSON number can be rounded during parsing; switching the interface to text afterwards cannot recover digits. Use the documented response-parsing option, or have the provider send strings. Label derived units and rounding explicitly instead of replacing original values silently.

**Spread first, overrides after.** An output or a request body may combine the collection spread with computed keys (a `parseDate` on a timestamp, a parsed `result`, a formatted date). Write the spread first and the computed keys after it, or remove those keys from the spread with `omit`, as the documented input-processing example does. A key declared before the spread can be overwritten by a same-named key from the spread, and the user then maps the raw provider value instead of the converted one. The same holds in a helper: `return { ...response, result }` keeps the computed `result`, while `return { result, ...response }` lets a provider field named `result` replace it. The safe form, for a provider that documents `createdAt` as a Unix timestamp in seconds:

```json
"output": {
  "{{...}}": "{{body}}",
  "createdAt": "{{parseDate(body.createdAt, 'X')}}"
}
```

Equally safe is `"createdAt"` first with `"{{...}}": "{{omit(body, 'createdAt')}}"` after it, because the spread then cannot carry a competing key.

**One entry per name and level.** Each interface entry describes one key of the emitted bundle, so names must be unique at each level. Two entries with the same `name` at the same level describe one key twice. When their types differ (text in one, collection in the other), at most one of them can match a given run, and users cannot tell which item to map. This usually happens when the fields of several response variants (one per model, record type or operation) are merged into one static list. Declare each key once. Where the variants share a type, use it. Where the key is a collection in every variant but its fields differ, a collection with `spec: []` fits all of them. Where the type itself differs between variants, describe the key through a dynamic interface keyed on the option that selects the variant.

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

### Recursive cleanup helpers: check every branch

Recursive removal of empty values is a custom IML function that the app must define. `removeEmpty` is not a built-in IML function. Many apps include one, often adapted from the documented sample, and its branches are where data is silently lost. Before relying on such a helper, check and test each branch:

* **Primitive array items.** An array branch that passes every element back through the helper loses scalars when the helper returns `undefined` for anything that is not an object. The documented sample does this as published, so `["a", "b"]` is sent as `[null, null]`, because `JSON.stringify` writes an `undefined` array element as `null` (standard JavaScript behaviour). Recurse only into objects, and pass strings, numbers and booleans through unchanged.
* **Dates and buffers.** Inside a function, values of `date` parameters and the results of `parseDate` are `Date` objects. A `Date` has no own keys, so an "empty object" test removes it. The documented sample keeps a date that is a property value with an `instanceof Date` check, but a date inside an array still goes through the object branch and comes out as `{}`. A `Buffer` has numeric keys, so a helper that recurses into it turns file data into a plain object of byte values. Treat both as leaves wherever they occur.
* **Truthiness filters.** `.filter(Boolean)` or `filter(([, v]) => v)` inside a helper drops `0`, `false` and `""` just as an inline `||` fallback would, but someone reading the module's communication cannot see it. Test for `null` and `undefined` explicitly.
* **Emptiness tested before cleaning.** If a collection is checked for keys before its children are cleaned, a collection whose only values were `null` still goes out as `{}`. The documented sample does this, so `{ "address": { "street": null } }` still sends `"address": {}`, which is the provider error the sample page sets out to avoid. Check emptiness on the cleaned result.
* **Clearing on updates.** Erase sends `null` for text and numbers and `[]` for arrays. A helper that strips `null` or empty arrays makes Erase do nothing in an update module. Keep those values in the helper used for updates, or apply the helper only to the fields whose provider rejects empty values.
* **Conditional spreads inside arrays.** Building parts as `[{ ...(text && { type: 'text', text }) }]` leaves `{}` in the array when the condition is false. Push only the parts that exist.
* **Nothing left.** When everything is removed, the documented sample returns `{}` and the version below returns `undefined`. Check that the call site (a whole `body`, or a `{{...}}` spread) and the provider accept that result, and test that case.

A version that avoids the first four traps:

```js
function removeEmpty(value) {
  if (value === null || value === undefined) return undefined;
  if (value instanceof Date || Buffer.isBuffer(value)) return value; // leaves
  if (Array.isArray(value)) {
    return value.map((item) => removeEmpty(item)).filter((item) => item !== undefined);
  }
  if (typeof value === 'object') {
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      const cleaned = removeEmpty(item);
      if (cleaned !== undefined) out[key] = cleaned;
    }
    return Object.keys(out).length > 0 ? out : undefined; // tested after cleaning
  }
  return value; // keeps 0, false and ""
}
```

It keeps empty arrays, so an array Erase still reaches the provider. It removes `null`, including `null` items and empty objects inside arrays, so it suits create requests, not updates that must clear text or numbers. For an update that must clear, keep `null`: return it unchanged instead of `undefined` in the first line, so an erased field still reaches the provider. Test it with an array of strings, an array of objects, a `Date` (also inside an array), a `Buffer`, `0`, `false`, `""`, a collection that holds only `null` values, and an input where everything is empty. An expected value that contains `undefined` or `null` elements records the defect instead of catching it.

### Whole-parameter spreads: complete the omit list

`"{{...}}": "{{omit(parameters, ...)}}"` sends every parameter that has a value and that the list does not name. The input-processing page gives the reasons to omit a parameter: it is used somewhere else, it should not be sent at all (technical parameters such as selects), or it needs special handling. In each spread, name:

* identifiers already used in the URL path;
* the module's own result limit (read by `response.limit`) and any page-size or pagination input;
* mode and source selectors, parent selectors that exist only to feed an RPC, and other form-only controls;
* parameters that are already mapped under another key, or that are transformed explicitly (for example a date passed through `formatDate`).

When a module has several conditional requests, each request has its own spread and needs its own complete list. Compare each list with the parameters that are visible in that branch. An unknown query or body key can make the provider reject the request, or can quietly change a filter.

### Optional collections: send them only when filled

On Apps platform version 2, a collection whose fields the user leaves empty still reaches the request as `{}`, while Erase on one of its fields sends the collection with that field set to `null`. Where the provider rejects or misreads an empty object, guard that one collection instead of cleaning the whole body:

```json
"settings": "{{if(length(keys(parameters.settings)) > 0, parameters.settings, undefined)}}"
```

The guard omits only an untouched collection. A collection with an erased field still has a key, so it is sent and clearing keeps working. Where a parent holds several optional groups, guard each sub-collection. In a read-and-merge update, do not use the same test to choose between the user's collection and the fetched one: a partly filled collection would then replace every stored field the user left empty, which is the shallow-merge problem described under updates, and a note in the help does not make that replacement safe. Do not reuse the guard for arrays. The input-processing page lists `if(length(parameters.tags) > 0, parameters.tags, undefined)` as bad practice, because it makes it impossible to send an empty array, which is the Erase value for arrays.

## Updates: partial or full replacement

Decide from the provider's contract, not the HTTP verb: some APIs support partial behaviour through PUT, and some PATCH calls still replace nested collections.

* If the update **replaces** the resource and needs every current field, a read-and-merge sequence (get the resource, overlay the user's edits and clears, send everything) preserves unspecified values. Keep the merge aligned with the provider's writable schema and mind nested collections, where a shallow merge can be wrong.
* If the provider documents **partial** updates, an extra read is unnecessary cost and adds concurrency and permission risk.
* A warning in the description does not make a destructive replacement safe.
* A read followed by one write is the valid shape of that merge. It is different from several independent writes in one module, which the [batch-actions best practices](https://developers.make.com/custom-apps-documentation/best-practices/modules/batch-actions) say cannot report partial success and recommend splitting into separate modules. Classify requests by side effects, not HTTP verb, and see [requests-files-multistep](requests-files-multistep.md) for the exceptions and for what a request array does and does not guarantee.
* **Defaults on update inputs.** A `default` pre-fills the field in every newly added module. An update module therefore sends that value whenever the user does not clear it, and the stored value is reset even though the user only meant to change another field (for example a status select preset to "open", or an archive boolean preset to true). Leaving a value unchanged relies on the field being empty, so optional inputs of an update module normally have no `default`. Keep defaults on create modules, where they mirror the provider's own default. A control that only steers the module, such as a "Replace the list" switch that defaults to No, may keep a default that means "leave unchanged". Check booleans too: an untouched boolean without a default sends nothing, but `default: true` or `default: false` sends that value.
* **Array fields that replace the stored list.** When the provider replaces an array on update (tags, lines, media, recipients), say so in the field's help. Where the provider keeps a field that the request omits, leaving the field empty keeps the current list. Any mapped value replaces the whole list. Erase sends an empty array, which removes all items where the provider accepts one. To add one item, the user first gets the record and then maps the existing items together with the new one. Mirror the provider's item limit in `validate.maxItems`; the `50` below stands for that documented limit. Write the help in the documented hint order: expected input, result, additional information, then what happens if left empty. Without this help, users who map one new item silently delete the rest.

  ```json
  {
    "name": "tags",
    "type": "array",
    "label": "Tags",
    "spec": { "type": "text", "label": "Tag" },
    "help": "Tags to set on the record. Mapped tags replace all existing tags. To add a tag, map the current tags from a Get module together with the new one. If left empty, the current tags are kept.",
    "validate": { "maxItems": 50 }
  }
  ```

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
* **Approval impact** ([Approval gating](../../../references/review-and-qa.md#2a-approval-gating)). Requiredness advice (key presence versus a nonempty value, create requiredness copied into an update form, conditional or at-least-one groups) is advisory unless the operation contract documents omission semantics that make the input impossible to supply. Falsy or null values that are dropped, or a clearing operation that becomes a no-op, remain established functional failures when shown.

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
