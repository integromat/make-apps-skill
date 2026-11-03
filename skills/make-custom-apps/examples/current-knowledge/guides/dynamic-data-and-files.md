# Dynamic options, fields and metadata-driven schemas

Back to the [knowledge index](../README.md).

Forms that adapt to the provider at configuration time: option lists, field schemas and sample data. This guide covers dynamic RPCs and metadata-driven schemas. File bytes, multipart, request sequences and repeats are in [requests-files-multistep](requests-files-multistep.md); empty values and updates are in [outputs-empty-values-updates](outputs-empty-values-updates.md). Selector behaviour is in [selectors-mode](selectors-mode.md) and budgets in [rpc-page-budgets](rpc-page-budgets.md). This guide has no recipe fixtures.

## Pick the RPC kind that matches the job

* **Options RPC.** Returns `[{ "label", "value" }]` (optionally a default) for a select. Value is the provider's stable identifier; label is for people.
* **Fields RPC.** Returns parameter specifications for mappable input or an interface: `name` is required and the type for plain text is `text`, not `string`. An interface or `parameters` array may mix fixed fields with a single `"rpc://name"` entry, and the RPC string alone is allowed.
* **Sample RPC.** Supplies sample output for the module's interface.

Using an options RPC where a schema is expected, or the reverse, shows the user the wrong thing or nothing.

### Request-less RPCs with conditional branches

**Documented behaviour.** An RPC needs no request when it only returns definitions: omit `url` and return them from `response.output` (request-less communication). Communication may also be an array of requests, each with its own `condition`. A request whose condition is false is skipped, and the output of the last request is used. Together they give a fields RPC that returns a different set of fields for each value of another parameter. This is the "condition-aware RPC" that the conditionally required guidance refers to: `required: true` inside a branch applies only while that branch is active.

```json
[
  { "condition": "{{parameters.rangeType == 'between'}}",
    "response": { "output": [
      { "name": "from", "type": "date", "label": "From", "required": true },
      { "name": "to", "type": "date", "label": "To", "required": true } ] } },
  { "condition": "{{parameters.rangeType == 'last'}}",
    "response": { "output": { "name": "days", "type": "uinteger", "label": "Number of days" } } },
  { "condition": "{{!parameters.rangeType}}",
    "response": { "output": null } }
]
```

**Inferred implementation pattern.**

* Reference the RPC where the documentation places dynamic fields that depend on a choice: in the controlling select's `nested` (on an option, or as `options.nested` together with `store`). If each option's fields are fixed and need no connection data, plain `nested` arrays on the options do the same without an RPC. The RPC pays off when several modules share the variants, or when a branch needs a lookup or connection data.
* Make the conditions mutually exclusive and cover every value of the controlling parameter, so exactly one branch decides the fields, or deliberately none (an explicit `null` branch records that choice). If two conditions are true, only the later branch's output is used and the earlier branch's fields silently disappear.
* A branch may still call the provider (give it a `url`) when only that case needs a lookup, for example loading custom fields only once the parent is set.
* A first, request-less step can set `temp` with definitions that several branches reuse (see "Define a repeated structure once").
* Review check: list the controlling parameter's values, confirm each has its branch, and confirm no field appears for the wrong value. If the controlling field can be mapped, its value may be unresolved while the form loads and no branch matches; make it non-mappable or handle the map path (end of "Inputs, dependencies and connection").

### Notices and connection-specific help from an RPC

**Documented building blocks, inferred use.** The `banner` parameter is the documented way to show a message in a module form ([parameters and RPCs](../../../references/parameters-and-rpcs.md#banners) has its shape and when to prefer it over an `html` notice). A request-less RPC entry in a `parameters` or `expect` array can return one, so the notice can depend on other inputs or on the connection, which RPCs can read:

* A rule that `required` cannot express, such as "set at least one of these fields", shown next to those fields.
* A step the user must take, or a warning that applies only to some connections or settings: give the branch a `condition` and return `null` when it does not apply.
* Help that must name connection data, such as the regional base URL in a universal module's path field. The RPC returns that single field with the same `name`, `type`, `label` and `required` it would have as a static field, and builds only the help from `connection`. The help keeps the universal-module wording: the base without a trailing slash, and an example that starts with `/` and the version. It does not replace the fixed prefix in the module's own `url` ([universal-modules-and-scopes](universal-modules-and-scopes.md)).

```json
{ "response": { "output": {
  "name": "url", "type": "text", "label": "URL", "required": true,
  "help": "Enter a path relative to `https://{{connection.region}}.api.example.com`. For example: `/v1/files`."
} } }
```

A notice informs; it does not validate. Keep the real check with the provider or in an explicit validation.

### Option labels that are never blank

**Inferred implementation pattern.** A label may combine several properties of the item. When the display property is optional, fall back to something the user can still recognise, usually the identifier, so a record without a name never shows up as an empty dropdown entry. `ifempty` falls back when its first argument is not defined, null or an empty string.

```json
"output": { "label": "{{ifempty(item.name, item.id)}}", "value": "{{item.id}}" }
```

When the display text arrives as a map (for example keyed by locale), pick it with one deterministic rule that every RPC and helper of the app uses: a preferred key, then the first available key, then the identifier. Two RPCs that read the same object differently show different labels for the same record. The `value` stays the stable identifier either way.

## Inputs, dependencies and connection

**Documented behaviour.** Module parameters reach RPCs automatically, and nested child RPCs also inherit the parent's value. In an instant trigger's interface RPC, `webhook.<name>` is available. An RPC with an empty parameter declaration may still read those inherited values. The RPC's connection list must match the module's, even for a request-less RPC.

**Behaviour to design for.** A mapped parent value may not be resolved while the form loads. Choose and test the child's behaviour for choose and map paths, an empty list, a missing permission and each supported connection. Trace parent selectors, connection choices and schema variants.

## Schemas from provider metadata

When a provider exposes user-defined fields:

1. Keep the **stable machine identifier** apart from the **display label**, so duplicate labels cannot overwrite different fields.
2. Preserve type, requiredness and option metadata until every decision that needs them has run (input generation, request serialisation, output, interface).
3. Give unsupported provider types an explicit fallback or document the limitation.
4. Strip UI-only routing controls (parameters that only choose which schema to load) from the provider payload.
5. Keep dynamic input and output specifications aligned with what the request sends and emits at runtime. If the interface is dynamic, scenarios need a refresh after the provider's schema changes.

A custom function is a good place to convert provider metadata into a schema; keep it small and pure ([iml-and-helpers](iml-and-helpers.md)).

### Use the provider's capability flags, not literal lists

**Inferred implementation pattern.** Metadata endpoints often mark each field or item with what it supports: read-only or computed, key, editable on create or update, sortable, viewable, filterable. Build each generated list from the flag that matches its purpose:

* Create and update inputs leave out read-only and computed fields; a form that addresses a record keeps its key fields.
* A sort list offers only sortable fields, a "fields to return" list only viewable ones, a filter list only filterable ones.
* Prefer the flag to comparing identifiers with a literal list in a helper (`const unsupported = ['id-a', 'id-b']`). The list goes stale as soon as the provider adds an item, and copies of it in several helpers start to disagree. If a literal list is unavoidable, keep it in one helper, comment why each entry is there, and send an unknown identifier to the explicit fallback ("Concrete fallbacks for unsupported types" below) rather than silently into a form that may not fit. A literal list that is still accurate is a maintenance remark, not a defect.

Users then cannot pick a field the provider rejects, and the form follows the provider without a new app version.

### Concrete fallbacks for unsupported types

**Inferred implementation pattern** (rule 3 above, made concrete). Two shapes recur in released apps:

* **Per field.** End the type map with an explicit default instead of silently dropping the field: map an unknown provider type to `any` (listed in the editor schema; it accepts whatever the user maps) or to `text` with help that states the expected format. Add help for kinds the metadata cannot describe fully (for example a date-only field: "Date in the format `YYYY-MM-DD`."). A type left out on purpose is documented as a limitation (rule 3).
* **Per item.** When a whole selected item (a model, a record type) has no built-in form, return a `warning` banner that says so, followed by a generic array of name, type and value rows. The request folds the rows into the payload with `toCollection(parameters.extraParameters, 'key', 'value')`. Let the helper that classifies items end with an explicit "unknown" result, and give every `switch` a default that routes to this fallback.

```json
[
  { "type": "banner", "theme": "warning", "title": "No built-in form for this item",
    "text": "Add the parameters this item needs as name, type and value rows. They are sent as entered." },
  { "name": "extraParameters", "type": "array", "label": "Parameters",
    "spec": { "type": "collection", "label": "Parameter", "spec": [
      { "name": "key", "type": "text", "label": "Name", "required": true },
      { "name": "type", "type": "select", "label": "Type", "options": [
        { "label": "Text", "value": "text", "nested": [ { "name": "value", "type": "text", "label": "Value" } ] },
        { "label": "Number", "value": "number", "nested": [ { "name": "value", "type": "number", "label": "Value" } ] },
        { "label": "Boolean", "value": "boolean", "nested": [ { "name": "value", "type": "boolean", "label": "Value" } ] }
      ] } ] } }
]
```

New or unrecognised items then stay usable without a new app version, and a reviewer can see what the app does with a type it does not know.

### A field picker for objects with many fields

**Inferred implementation pattern.** When an object has more fields than a form can reasonably show (hundreds of standard and custom fields), let the user pick the fields first and generate inputs only for those:

1. A multi-select (`multiple: true`) whose options come from the metadata: the value is the stable field key, the label the display name, sorted by label, with read-only fields left out. Where the options are given as an array, custom fields can sit in their own group (`grouped: true` with the grouped-options syntax).
2. `options.nested` points to a fields RPC. For a `multiple` select the nested parameters are generated for the selected options; the RPC reads the picked keys from `parameters.<picker>` and returns typed parameters for just those keys, built by the same conversion helper as any other metadata-driven field.
3. Keep the picker a plain choice (`mappable: false`): a mapped list of keys is not known while the form loads, so the nested fields could not be built.

```json
{
  "name": "selectedFields", "type": "select", "label": "Fields to set",
  "multiple": true, "mappable": false,
  "options": { "store": "rpc://listWritableFields", "nested": "rpc://buildSelectedFields" }
}
```

The mapper stays short and the form still follows the provider's metadata. The picker is a schema-selection control, so strip it from the provider payload (rule 4).

### Define a repeated structure once

**Inferred implementation pattern.** Inside a fields or interface RPC, a `spec` (or a whole field list) can be filled from IML, so a structure used in several places is written once: in the `temp` of a request-less first step, or in a custom function that returns the spec array. Reference it wherever it recurs: other branches, input and output, several modules that use the same RPC. Pasted copies drift: one copy gains an option or a field type the other lacks, and two modules then accept different input for the same provider object. Give such a function a defined result for missing input (for example an empty array), because the RPC also runs while the form is still incomplete.

```json
[
  { "temp": { "address": [
      { "name": "street", "type": "text", "label": "Street" },
      { "name": "city", "type": "text", "label": "City" } ] } },
  { "response": { "output": [
      { "name": "billingAddress", "type": "collection", "label": "Billing address", "spec": "{{temp.address}}" },
      { "name": "shippingAddress", "type": "collection", "label": "Shipping address", "spec": "{{temp.address}}" } ] } }
]
```

When one RPC serves several variants chosen by a non-mappable select, the variants can sit in one `temp` object keyed by the option values and be returned with `get(temp.variants, parameters.kind)`. The option values must equal the keys exactly; a mismatch returns nothing, silently.

Copies that still agree are not a defect; report the copies that already differ.

## Filtering and size

**Documented recommendation.** Filter on the provider whenever it can; filter inside the RPC (`iterate` with a `condition`) only when it cannot, and keep dynamic RPCs inside their budget. A configuration-time list does not need to enumerate a whole large account; offer a search or mappable alternative.

## Rationale

Dynamic forms turn a manual step (look up an ID, learn a custom schema) into an automatic one, at the price of failure modes the user cannot see: a slow RPC, a stale schema, a parent not yet known. Naming the RPC kind, the identifier and the dependency makes each of those inspectable.

## Pitfalls

* Returning `type: string` in a fields RPC.
* Using labels as keys, so two options with the same text collide.
* Filtering inside `iterate.condition` while the provider supports a search parameter.
* Treating an empty RPC `parameters` list as proof that module values cannot reach it.
* Leaking schema-selection controls into the provider payload.
* Forgetting that a changed provider schema needs a scenario refresh.
* Reading provider metadata with the wrong key case (`item.isKey` where the metadata says `IsKey`). Property names are case-sensitive, in IML dot notation and in a custom function alike, and a property that is not defined is simply empty, with no error. A derived `required` flag or type is then silently wrong for every generated field (`IsMandatory && !isKey` is true for key fields too). Compare every referenced key, including those inside negations and fallbacks, with a real metadata response.

## Exceptions and applicability

* Apps with fixed forms need no dynamic RPC.
* Small, static provider lists can use hand-written `options`.
* An instant trigger's dynamic interface has the `webhook` context in addition to the usual ones.

## Evidence and limits

RPC kinds, inheritance and the connection rule: **documented behaviour / requirement**. Filtering and budgets: **documented recommendation**. The metadata handling steps are an **inferred implementation pattern**. This guide has no static fixtures, and the checker does not examine dynamic schemas.

Request-less RPCs, the request `condition`, `temp`, banners, grouped options and nested parameters for a multiple select: **documented behaviour**. Branch coverage, notices from RPCs, field pickers, capability-flag filtering, fallback shapes, single-source structures and label fallbacks: **inferred implementation patterns** seen in released apps. The checker does not examine any of them.

## Sources

* https://developers.make.com/custom-apps-documentation/app-components/rpcs/dynamic-options-rpc
* https://developers.make.com/custom-apps-documentation/component-blocks/interface
* https://developers.make.com/custom-apps-documentation/app-components/rpcs
* https://developers.make.com/custom-apps-documentation/app-components/rpcs/dynamic-fields-rpc
* https://developers.make.com/custom-apps-documentation/app-components/rpcs/dynamic-sample-rpc
* https://developers.make.com/custom-apps-documentation/app-components/iml-functions/dynamic-mappable-parameters
* https://developers.make.com/custom-apps-documentation/best-practices/remote-procedure-calls
* https://developers.make.com/custom-apps-documentation/component-blocks/api/request-less-communication (request-less RPCs, conditional outputs)
* https://developers.make.com/custom-apps-documentation/component-blocks/api/making-requests (the request `condition` and `temp` directives)
* https://developers.make.com/custom-apps-documentation/component-blocks/api/multiple-requests
* https://developers.make.com/custom-apps-documentation/component-blocks/api/handling-responses/temp
* https://developers.make.com/custom-apps-documentation/block-elements/parameters (documented parameter types)
* https://developers.make.com/custom-apps-documentation/block-elements/parameters/select (`multiple`, `grouped`, nested parameters for the selected options)
* https://developers.make.com/custom-apps-documentation/best-practices/input-parameters/mappable-parameters (messages and banners)
* https://developers.make.com/custom-apps-documentation/block-elements/iml (`ifempty`, `get`, `toCollection`, dot notation)
