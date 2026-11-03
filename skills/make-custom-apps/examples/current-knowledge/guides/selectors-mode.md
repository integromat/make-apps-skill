# Selectors, `mode` and dependent selects

Back to the [knowledge index](../README.md).

A select backed by a remote procedure call (RPC) lets users pick a record instead of typing an ID. Most mistakes come from three confusions: when to set `mode: "edit"`, how a child select receives its parent's value, and mixing up an RPC that supplies *options* with one that supplies a *schema of fields*.

## The pieces

An option RPC returns an array of `{ "label": ..., "value": ... }` (`default: true` is optional). A select refers to it as `"options": "rpc://listProjects"` or in object form `{ "store": "rpc://listProjects", "nested": [...] }`. A fields RPC returns parameter specs (`name`, `type`, `label`, ...) and is referenced from `interface` or a `parameters` array, not from `options`. Using one where the other is expected is a schema confusion: the user sees the wrong thing, or nothing.

### Grouped options

See [parameters and RPCs](../../../references/parameters-and-rpcs.md#grouped-options) — the `grouped: true` shape for long lists with natural categories, values unique across groups, and confirming RPC-loaded groups in the form.

### Option order

**Documented behaviour.** Options are unsorted by default and appear in the order they arrive. The select's `sort` attribute (`"text"` or `"number"`) sorts them in the form, which also replaces any order the RPC produced. When another order helps more (newest first), leave `sort` off and order the list before it reaches the select. Either ask the provider to sort (a sort query parameter), or sort in the RPC with the IML function `sort(array; [order]; [key])` ([array functions](https://help.make.com/array-functions)), where `order` is `asc`, `desc`, `asc ci` or `desc ci`.

~~~json
"response": {
  "iterate": "{{sort(body.items, 'desc', 'created')}}",
  "output": { "label": "{{item.name}}", "value": "{{item.id}}" }
}
~~~

**Pitfall, checked by evaluating the expressions.** The order comes before the key, and both are quoted strings. Written key-first, `sort(body.items, 'created', 'desc')`, the first argument is not an order keyword, so it is read as the key and the list comes back ascending. Written unquoted, `sort(body.items, desc, created)`, both arguments are empty variables and the list keeps the provider's order. Both forms pass upload and look plausible. Also, `iterate` runs once per response page, so an RPC-side sort orders each page, not the whole list. When the list spans pages and `response.limit` cuts it, prefer provider-side ordering so that the first options really are the newest.

## Describing options that need explanation

**Inferred UX guidance, not a documented requirement.** The public [Select page](https://developers.make.com/custom-apps-documentation/block-elements/parameters/select) documents the option forms (`value`/`label` pairs, `nested`, `store`) and the [mappable-parameters best practices](https://developers.make.com/custom-apps-documentation/best-practices/input-parameters/mappable-parameters) cover select behaviour in mappable forms. Neither page gives guidance on an option-level `description`, so do not cite either as the source of that field or of this advice. It is a UX judgment: when the choices are not self-explanatory (for example two access levels whose difference the label cannot carry), and the authoring or editor schema you are working against accepts `option.description`, give each option its own short `description` next to `label` and `value`, instead of explaining the differing meanings in the field's help text or leaving users to guess. Verify that the section is accepted on upload and that the description is present in the read-back. If it is rejected or dropped, fall back to the field's help text. The shape, where accepted:

```json
{
  "name": "visibility", "type": "select", "label": "Visibility",
  "options": [
    { "value": "private", "label": "Private", "description": "Only the owner can open the item." },
    { "value": "shared", "label": "Shared", "description": "Everyone with the link can open the item." }
  ]
}
```

A description is explanatory text only. It does not change `value`, validation or `mode`, and options that are obvious (Yes, No) need none. Use it for a hand-written `options` array after the read-back confirms support; this guide does not claim it for an options RPC's `{label, value}` output. This is advice for form quality, not a requirement a missing description fails.

## `mode: "edit"`

**Documented authoring requirement for Get, Update and Delete.** The best-practices page states that adding edit mode is required for a mappable RPC-backed identifier select in these modules. Initialise it with `mode: "edit"` so the user can map an ID from a previous module without first toggling the field. `mode` accepts `edit` or `choose`; the default is `choose`. State the UI/mapping consequence when reporting it; it does not make requests unexecutable, so it is an authoring correction, not an observed outage.

**Documented recommendation, depends on hierarchy.**

| Context | Treatment |
| --- | --- |
| Search/List, higher-level entity with few RPC inputs | Recommend `choose` (no edit mode). |
| Search/List, low-level child entity that always sits under a parent | Recommend `mode: "edit"`, from the hierarchy. |
| Create | Recommend `choose`; many RPC **inputs** can justify edit. One large RPC **result** set is a different load/page-budget issue, not a mode reason. |

Infer hierarchy from the provider's model, never from names. With many nested RPCs, keep the documented choice between mapping the deepest ID directly and traversing the hierarchy; a deliberately non-mappable selector inside the browse branch should not receive edit mode mechanically.

**Documented behaviour.** With the Map toggle on, a mapped value (for example `{{1.status}}`) is not restricted by the options. A static value typed into the field must match an option value, otherwise the field shows `Value not found in options`, with three documented exemptions: static values are not validated when the options are loaded by an RPC, when `dynamic` is `true` (set automatically for RPC-generated options), or when `validate` is `false`. So the "static value must match" rule applies to hand-written `options` arrays without those settings, not to RPC-backed selects. In mapping mode only the value, never the label, is available.

## Nested (dependent) selects

A child select appears after the parent is chosen. The documented form is:

```json
{
  "name": "projectId", "type": "select", "label": "Project",
  "options": { "store": "rpc://listProjects", "nested": [
    { "name": "taskId", "type": "select", "label": "Task", "options": "rpc://listTasks" }
  ] }
}
```

**Documented requirement.** `store` is needed or `nested` will not work. Parent parameters are inherited by child RPCs, so `listTasks` reads `{{parameters.projectId}}`. Every RPC must use the same connection as the calling module; a module whose connection differs from the RPC's (or an RPC with none, even a request-less one) fails with "Provided connection is not acceptable for this RPC".

**Inferred implementation pattern.** A child RPC that never reads its parent value loads the same list for every parent, so the nesting achieves nothing; one that reads a parameter that is not an ancestor reads something that may not be filled in. The checker's `CK-SELECTOR-NESTED` rule inspects the RPC text for those two cases. The parent still has to load: do not add `mode: "edit"` to the parent of a nested select merely to satisfy the mode rule, because that is not what the documentation's own nested example requires of every module kind.

**Documented form: nested fields from an RPC.** `nested` holds *parameters*, so besides an inline array it accepts an RPC URL. It can sit on the options object (`"options": { "store": ..., "nested": "rpc://getItemTypeFields" }`), so the fields follow whichever option is chosen. It can also sit on a single option (`{ "label": ..., "value": ..., "nested": "rpc://getOptionFields" }`), so the fields appear for that option only. That RPC is a fields RPC: it reads the chosen value from `parameters.<parent>` and returns parameter specs (`name`, `type`, `label`, ...), not `{label, value}` pairs. A fields RPC under `nested` is therefore correct and is not the options/schema confusion described in "The pieces"; an *options* RPC placed directly in `nested` is.

~~~json
{
  "name": "itemType", "type": "select", "label": "Item type", "required": true,
  "options": { "store": "rpc://listItemTypes", "nested": "rpc://getItemTypeFields" }
}
~~~

**Inferred implementation pattern.** A nested fields RPC may have nothing to add for some choices. A communication branch whose `condition` is false, or a `response.output` of `null`, returns no field, and nothing appears under the select. That is not a defect. Requiredness that depends on the choice follows "Conditionally required fields" in [parameters-and-rpcs](../../../references/parameters-and-rpcs.md#form-quality-ux-guidance-not-schema-rules). Test each choice, including one that adds nothing.

## RPC inputs, parent values and what a picker must (not) cover

* **Parameters reach RPCs automatically.** The module's parameters are passed to a linked RPC, and nested child RPCs also receive the parent's value. An RPC with an empty `parameters` declaration does not prove that module values are unavailable to it; the declaration describes the RPC's own inputs. Do not report a "missing parameter" on that basis alone.
* **A mapped parent may not be resolved while the form loads.** When the parent value is a mapping, the child RPC may run before the real value exists. Decide what the child should do (return an empty list, a generic list, or a clear message), and test both the *choose* path and the *map* path. Do not invent a universal string-inspection guard.
* **A picker is a convenience.** A dropdown does not need to list every object in a large account; a bounded sample plus manual mapping is a legitimate design ([rpc-page-budgets](rpc-page-budgets.md)). An ID missing from a sampled list is not invalid: mapped values are not restricted by the options, and static values are not validated against RPC-loaded options. Likewise, the absence of a picker proves a defect only when the provider offers a lookup and the task's scope includes one.
* **Connection lists must match.** An RPC's connection list has to match the parent module's, even when the RPC makes no request at all.
* **Metadata-driven options.** Keep the provider's stable identifier as `value` and the display text as `label`. Two options with the same label must not collapse into one choice. See [dynamic-data-and-files](dynamic-data-and-files.md) for schema-style RPCs.
* **Fixed context through the `rpc://` query string (documented).** One RPC can serve several fields that differ slightly: `"options": "rpc://listItems?status=open"` passes `status` to the RPC as `parameters.status`, and a repeated key sends an array. Whether a value such as `active=false` arrives as text or as a boolean, and which value wins when a module field has the same name, are not documented, so do not test such an argument for truthiness. The checks are in [parameters and RPCs](../../../references/parameters-and-rpcs.md#fixed-arguments-in-an-rpc-reference).
* **A picker must list from the scope the module acts in (inferred implementation pattern).** An RPC inherits Base, not the calling module's own `headers` or `qs`. When modules scope each request with a value from a module field (an organisation, workspace or tenant header or query parameter), every RPC behind a select or search button of those modules has to send the same value, read from the same `parameters.<scopeField>` (module parameters reach linked RPCs automatically). Otherwise the picker lists records from the account's default scope while the module reads or writes another, and the user picks IDs that do not exist where the request runs. Compare each module's scoping header or query parameter with the RPCs its pickers call, and test with a non-default scope. A mapped scope value follows the "mapped parent" rule above. A picker that offers IDs the module cannot use is the functional failure named under Approval impact below.
* **Search button (ID finder) on a typed field (documented).** A text field with an `rpc` search button keeps the identifier a typed field, and after a pick it shows the **value**, not the label. `mode` belongs to selects, so do not report a missing `mode: "edit"` on such a field; its `rpc://` name must still resolve and the RPC must share the module's connection. Syntax, conventions and the search RPC: [parameters and RPCs](../../../references/parameters-and-rpcs.md#search-buttons-id-finder).

## Rationale

The user-facing goal is simple: find the thing without knowing its ID, and still be able to map it. `mode` is the switch for the second half. Nested selects exist because many providers scope children by parent; the platform passes parameters to RPCs automatically so a child does not need extra plumbing.

## Pitfalls

* Putting `mode: "edit"` on every select as a habit. It is required for the mappable addressed record in Get/Update/Delete, a hierarchy-based recommendation for Search/List, and generally avoided for Create (except where there are many RPC inputs). A Search/List/Create mode choice is a recommendation, not an automatic blocker; the answer depends on the entity's place in the hierarchy.
* Nesting without `store`; the child never appears.
* An ID picker where the provider has no lookup endpoint. If there is nothing to list, a plain text or number field is right; do not invent a lookup route.
* Pointing `options` at a fields RPC, or `interface` at an options RPC.
* Forgetting that a connection-less RPC cannot be called from a module that has a connection.
* Expecting the label in mapping mode. Only the value arrives.
* A hand-written `options` value that is not the provider's exact value: label and value swapped (`{ "label": "item_group", "value": "Item group" }`), or casing that differs from the provider's enum. The value is what the request sends, so compare every hand-written value with the provider's documented list. A repeated identical entry shows twice in the dropdown.
* A select whose options each reveal a different nested field ("by state", "by date range"), translated by a helper that sends the first non-empty nested field in a fixed order. That ignores the user's choice. Branch on the select's own value instead (`{{switch(parameters.filterKind, 'state', parameters.state, 'range', parameters.range)}}`), and check that every option value is one the request or helper actually compares. A misspelt value that nothing compares goes unnoticed until a user picks it.

## Exceptions and applicability

* The mode rule applies to the selector that addresses the record in Get/Update/Delete. A static, non-mappable select (`mappable: false`) is outside it.
* Selects with hand-written `options` arrays have no RPC and no mode requirement.
* Search/List and Create follow the hierarchy guidance above as recommendations; there is no blanket exemption of Search/List filters and no blanket rule.
* **Approval impact** ([Approval gating](../../../references/review-and-qa.md#2a-approval-gating)). Selector edit mode, option description and a missing RPC are advisory by themselves. A picker option whose value the consuming request cannot use is a functional failure and is fixed; keep it separate from label clarity and from endpoint execution failure.

## Evidence and limits

* `store` for nested, connection matching, automatic parameter inheritance: **documented requirement / behaviour**. `mode: "edit"` for mappable Get/Update/Delete identifiers: documented authoring requirement; hierarchy-dependent recommendation elsewhere.
* Search/List hierarchy and Create advice: **documented recommendation**.
* Per-option `description` for options with differing meanings: **inferred UX guidance**. The public Select and mappable-parameters pages were checked and give no option-description guidance; the Select page supports only the adjacent option syntax (`value`, `label`, `nested`, `store`). Advisory only, depends on the schema in use accepting the field, and needs upload/read-back evidence.
* Parent-value reading checks and the options/schema separation: **inferred implementation pattern** over declared fixtures. The checker does not run RPCs or know a provider's real hierarchy; it cannot tell a high-level from a low-level entity.
* `nested` as an RPC URL (on the options object or on one option), the grouped options syntax, the select `sort` attribute, `rpc://` query parameters and the search button (`rpc` with `label`, `url` and `parameters`; the field shows the value after a pick; no `default: true` there): **documented behaviour / syntax**. A search button for large, searchable record sets: **documented recommendation**.
* A nested fields RPC returning no field, an options RPC returning groups, and the IML `sort` argument order: **inferred implementation pattern**. The `sort` order and the empty result were checked by evaluating the expressions and the RPC output handling; none of these is stated on the public pages. Re-test them in the module.
* Group design, the choice of option order, the picker-scope rule and the hand-written option checks: **inferred implementation pattern / inferred UX guidance**. These are advisory, except where a picker offers IDs or values that the consuming request cannot use (see Approval impact).

## Fixtures

Static, synthetic teaching fixtures; the checker reads the declared RPC, parameter and interface text and runs nothing.

* Correct: [correct.json](../recipes/selector-mode-dependent/correct.json): an options RPC emits `label`/`value`, a fields RPC supplies the interface, the nested child stores its parent and reads `parameters.<parent>`, and the Get module's identifier selector has `mode: "edit"`.
* Incorrect, `CK-SELECTOR-RPC`: [undefined-rpc.json](../recipes/selector-mode-dependent/incorrect/undefined-rpc.json). A select points at an `rpc://` name no RPC defines, so the dropdown cannot load.
* Incorrect, `CK-SELECTOR-MODE`: [missing-edit-mode.json](../recipes/selector-mode-dependent/incorrect/missing-edit-mode.json). The identifier selector of a Get/Update/Delete module lacks `mode: "edit"`. This is the documented requirement for those module kinds; the same selector in a Search/List module follows the hierarchy recommendation above, which the checker does not evaluate.
* Incorrect, `CK-SELECTOR-NESTED`: [nested-without-store.json](../recipes/selector-mode-dependent/incorrect/nested-without-store.json). A `nested` list sits on a parent whose options are not stored (`options.store`), and the documentation says `store` is required for nesting to work.
* Incorrect, `CK-SELECTOR-NESTED`: [child-ignores-parent.json](../recipes/selector-mode-dependent/incorrect/child-ignores-parent.json). The child RPC never reads its parent's `parameters.<name>`, so it loads the same list for every parent (or reads a name that is not an ancestor).
* Incorrect, `CK-SELECTOR-SCHEMA-CONFUSION`: [options-from-fields-rpc.json](../recipes/selector-mode-dependent/incorrect/options-from-fields-rpc.json). Select `options` point at a fields RPC, which returns parameter specs rather than `label`/`value` pairs.
* Incorrect, `CK-SELECTOR-SCHEMA-CONFUSION`: [interface-from-options-rpc.json](../recipes/selector-mode-dependent/incorrect/interface-from-options-rpc.json). An output `interface` refers to an options RPC, which cannot describe an output schema.

## Sources

* https://developers.make.com/custom-apps-documentation/block-elements/parameters/select (option forms, `mode`, nested/`store`; no option `description` guidance)
* https://developers.make.com/custom-apps-documentation/app-components/rpcs
* https://developers.make.com/custom-apps-documentation/app-components/rpcs/dynamic-options-rpc
* https://developers.make.com/custom-apps-documentation/app-components/rpcs/dynamic-fields-rpc (fields RPCs supply schemas, not options)
* https://developers.make.com/custom-apps-documentation/component-blocks/interface (the interface an RPC-backed schema fills)
* https://developers.make.com/custom-apps-documentation/best-practices/remote-procedure-calls
* https://developers.make.com/custom-apps-documentation/best-practices/input-parameters/mappable-parameters (mappable select behaviour; no option description guidance)
* https://developers.make.com/custom-apps-documentation/block-elements/parameters/select#grouped and #sort (grouped options syntax; `sort` attribute, unsorted by default)
* https://developers.make.com/custom-apps-documentation/app-components/rpcs/dynamic-options-rpc#search-button (search button: value shown after a pick, no `default: true`, `ifempty(..., undefined)` filters) and #send-query-to-rpc (`rpc://` query parameters, repeated keys as an array)
* https://developers.make.com/custom-apps-documentation/app-components/rpcs/dynamic-fields-rpc#select-parameter-with-nested-dynamic-parameters-under-a-specific-option (`nested` as a fields RPC on one option)
* https://help.make.com/array-functions (`sort(array; [order]; [key])`)
