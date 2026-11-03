# Parameters and RPCs

Load this reference when defining module inputs, output interfaces, dropdowns,
search buttons, or dynamic fields. Use [modules-and-pagination.md](modules-and-pagination.md)
for emitted bundles and [iml-functions.md](iml-functions.md) for transformations.

## Route fields to the correct component

| Surface | Purpose |
| --- | --- |
| Connection parameters | Credentials and account configuration collected when creating a connection. |
| Static parameters | Trigger configuration; there is no preceding bundle to map. |
| Mappable parameters | Action/search inputs entered literally or mapped from earlier modules. |
| Interface | The schema of each emitted output bundle, not an input form. |
| Samples | A representative output object, not another field-definition array. |

Follow the dedicated Static parameters guide: use the static tab for triggers and
leave it empty for non-trigger inputs. Do not interpret a local `parameters` file
as a JavaScript preprocessing stage. File names and export keys depend on the editor.
Refresh the scenario after changing mappable fields or interfaces before diagnosing
an apparent stale schema as a failed deployment.

Sources: [Static parameters](https://developers.make.com/custom-apps-documentation/component-blocks/parameters.md),
[Mappable parameters](https://developers.make.com/custom-apps-documentation/component-blocks/mappable-parameters.md),
[Interface](https://developers.make.com/custom-apps-documentation/component-blocks/interface.md),
[Samples](https://developers.make.com/custom-apps-documentation/component-blocks/samples.md).

## Define types and validation deliberately

- Keep stable machine-readable `name` values separate from human-readable labels.
- Use Make types such as `text`, `number`, `integer`, `uinteger`, `boolean`, `date`,
  `collection`, `array`, and `buffer`; do not translate JSON Schema types mechanically.
- Keep opaque identifiers as text unless the provider requires a numeric value.
  A numeric-looking identifier can have leading zeros or exceed safe integer precision.
- Use `required`, defaults, and optional fields according to the provider operation.
  Creation and partial update rarely need identical required-field rules.
- Text supports **`validate.pattern`, `validate.min`, and `validate.max`**.
  Numeric, integer, and unsigned-integer fields support **`validate.min` and `validate.max`**.
- Put regex and range constraints inside `validate`, not JSON Schema-style top-level
  `pattern`, `minimum`, or `maximum`. Anchor a regex when validating the whole string.

Documented text-validation fragment:

```json
{
  "name": "validated",
  "type": "text",
  "label": "Validated string",
  "validate": {"pattern": "^[A-Z ]+$", "min": 10, "max": 32}
}
```

Numeric-validation fragment:

```json
{
  "name": "thinking",
  "type": "integer",
  "label": "Input a number from 1 to 10",
  "validate": {"min": 1, "max": 10}
}
```

These demonstrate SDK syntax, not constraints to impose on every provider field.

Sources: [Text](https://developers.make.com/custom-apps-documentation/block-elements/parameters/text.md),
[Number](https://developers.make.com/custom-apps-documentation/block-elements/parameters/number.md),
[Integer and Uinteger](https://developers.make.com/custom-apps-documentation/block-elements/parameters/integer-uinteger.md).

### Limits the help text already states

When the provider documents a count or a range and the help text repeats it ("at least 5
items", "1 to 25", "up to 100 entries"), also put it in `validate`: `minItems`/`maxItems` on
an array or a `multiple` select, `min`/`max` on a number, `max` on a text length. The editor
then rejects a typed value while the scenario is built, instead of the provider rejecting the
run later with a vaguer error. Keep the help text, because a mapped value is only known at run
time, and keep any `default` inside the declared bounds. Only limits the provider documents
belong here; this is not a reason to invent constraints. A missing `validate` next to accurate
help text is advisory. On a module that is already released, a new bound tightens validation:
add it only where the provider already rejects values outside it, so that no saved scenario
that works today starts failing (see
[compatibility evidence](../examples/current-knowledge/guides/compatibility-evidence.md)).

Sources: [Array](https://developers.make.com/custom-apps-documentation/block-elements/parameters/array.md),
[Number](https://developers.make.com/custom-apps-documentation/block-elements/parameters/number.md),
[Text](https://developers.make.com/custom-apps-documentation/block-elements/parameters/text.md),
[Select: multiple choice with validation](https://developers.make.com/custom-apps-documentation/block-elements/parameters/select.md).

## Collections, arrays, and intentional empty values

Define a collection's `spec` as an array of named fields. For an array of primitive
values, use an object `spec`, such as `{"type":"text"}`. For collections, Make documents
both an array of named field definitions and `spec: {type: "collection", spec: [...]}`
(with an optional collection label). Preserve a valid existing form; match the payload nesting.
Array length constraints use `validate.minItems` and `validate.maxItems`.

Preserve `false` and `0`. Prefer direct parameter mapping over truthiness-based
omission. Distinguish absent values from explicit `null`, an empty string, or an
empty array: those may intentionally clear a field. Do not run a generic
"remove empty" transform over every update request.

For selects, keep `label` separate from the API's `value`; retain the identifier's
actual type. Use `spec` only for an intentional value conversion. A mapping toggle
and static option validation are different concerns; check `mode`, `dynamic`, and
`validate` behavior rather than assuming all typed or mapped values are equivalent.

Sources: [Collection](https://developers.make.com/custom-apps-documentation/block-elements/parameters/collection.md),
[Array](https://developers.make.com/custom-apps-documentation/block-elements/parameters/array.md),
[Select](https://developers.make.com/custom-apps-documentation/block-elements/parameters/select.md),
[Handling empty inputs](https://developers.make.com/custom-apps-documentation/best-practices/input-parameters/processing-of-input-parameters.md#handling-arrays-nulls-and-empty-strings).

### Filter parameters and built queries

For a search whose provider accepts a query expression, Make's documented pattern offers a
built filter and a free query side by side: a required `mappable: false` select (`Search by`)
whose options nest either a `filter` parameter or a `Custom query` text field, and a request
that picks one, for example
`"filter": "{{if(parameters.searchBy === 'filter', buildQuery(parameters.filter), parameters.query)}}"`.

- **`type: "filter"`.** `options.store` (an array or an `rpc://` reference) lists the fields
  (left operands). `options.operators` uses the grouped-select shape: group operators by data
  type instead of offering one list for every type. `options.logic` limits the form to `and`,
  `or` or `both`.
- **Its value** is an array of OR groups; each group is an array of AND conditions
  `{"a": field, "o": operator, "b": value}`, and `b` is absent for operators that take no
  value. Convert it to the provider's syntax in a custom IML function, and test an empty
  filter, an empty group and a value-less operator.
- **Custom query help** states the query format, gives a working example and links the
  provider's query documentation.
- **Quote and escape every user value the app writes into an expression.** This covers filter
  values, a search button's search text and a selected name placed into a provider filter,
  query or search string; follow the provider's grammar as described in
  [User values inside provider query languages](requests-and-responses.md#user-values-inside-provider-query-languages).
  A custom query is the user's own expression and is sent as written; do not escape it. Say in
  the help whether the search matches exactly or by substring, because an exact (`eq`) match
  returns nothing for a partial value. A request that valid input breaks is a functional defect
  to fix; the help wording is advice.

Sources: [Filter](https://developers.make.com/custom-apps-documentation/block-elements/parameters/filter.md),
[Custom query and filter options](https://developers.make.com/custom-apps-documentation/best-practices/input-parameters/mappable-parameters.md#support-for-custom-query-and-filter-options).

### Alternative inputs behind one select

When an operation accepts one of several input forms (file data or a reference to a stored
file, a key/value list or raw JSON, a list choice or a typed ID), use one select whose options
each carry their own `nested` fields. Only the chosen option's fields are shown, so the user
can neither fill both forms nor send neither.

~~~json
{
  "name": "source", "type": "select", "label": "Source", "required": true, "mappable": false,
  "options": [
    {"label": "File data", "value": "data", "nested": [
      {"name": "fileName", "type": "filename", "label": "File name", "semantic": "file:name", "required": true},
      {"name": "data", "type": "buffer", "label": "Data", "semantic": "file:data", "required": true}]},
    {"label": "Stored file", "value": "stored", "nested": [
      {"name": "fileKey", "type": "text", "label": "File key", "required": true}]}
  ]
}
~~~

- Make the switch `mappable: false`. It decides which fields appear, and with the Map toggle
  on the nested fields disappear. `required: true` inside a branch applies only while that
  branch is chosen.
- Let the request read the switch to choose the branch, for example
  `"fileKey": "{{if(parameters.source === 'stored', parameters.fileKey, undefined)}}"`, and
  keep the switch itself out of the provider payload.
- Branches may reuse one field `name` with different types (a key/value array in one, JSON
  text in the other). Convert that value according to the switch, never by guessing from the
  value's shape, and test each branch.
- A switch inside an array item's `spec` has a value per item, so the request or helper must
  convert and remove it per item. Declare a switch once, at the level the choice belongs to;
  a second copy at another level is an input nothing reads.
- When a field offers several ways to find one record, the documented label for the switch
  is `[Item] search method`, with options such as Select from list, Search by keyword or
  Enter manually.
- The form shape is advisory. A request that sends both branches, or converts a branch value
  wrongly, is a functional defect. In a released module, check what saved scenarios map
  before turning mapping off on an existing switch or moving fields into branches (see Form
  quality).

Sources: [Select: nested fields for specific options](https://developers.make.com/custom-apps-documentation/block-elements/parameters/select.md),
[Mappable: false and search methods](https://developers.make.com/custom-apps-documentation/best-practices/input-parameters/mappable-parameters.md).

## Form quality (UX guidance, not schema rules)

These points make a form readable. They are recommendations from the public
[mappable parameters](https://developers.make.com/custom-apps-documentation/best-practices/input-parameters/mappable-parameters)
and [parameter hints](https://developers.make.com/custom-apps-documentation/best-practices/naming-conventions/input-parameters/parameter-hints)
pages plus authoring judgment (option descriptions below are judgment only). A layout or
wording deviation is advice to raise, not a validation failure. A wrong type that loses a
value or contradicts documented provider behavior is a different matter: see "Accurate
types". An existing app's parameter names and types should not change in place without
checking what saved scenarios already map.

- **Order.** Required parameters first, then conditionally required, then optional. A
  logical group overrides that order: a start and an end, or the parts of one address,
  stay together even when their required status differs. Put `advanced` parameters at the
  bottom. In a search or list module, `Limit` is the last parameter.
- **Conditionally required fields.** Do not mark a field `required: true` at the top level
  when the provider requires it only in some states ("only when Type is Custom"): the flag
  would demand it in every state. Where the form supports it, place the field in the
  structure that is only active for that case (a selected branch or nested fields, or fields
  supplied by a condition-aware RPC) and keep `required: true` there, where it is true. Where
  there is no such structure, leave the flag off and say it in the help text ("Required when
  Type is Custom."), so the user does not learn it from a failed run. Do not invent
  conditional syntax.
- **Array wording.** Three labels name three things: the array `label` is the whole list
  (`Attendees`), an item `spec.label` is one entry (`Attendee`), and `labels.add`
  replaces the add button text (`Add attendee`). Keep them coherent. An item label needs
  the collection form `spec: {"type": "collection", "label": "Attendee", "spec": [...]}`;
  the documented array-of-fields form has no item label.
- **Option descriptions (inferred UX guidance).** The public Select and mappable-parameters
  pages give no option-description guidance, so do not cite them for it. When choices differ
  in meaning that a bare label cannot carry and the authoring or editor schema in use
  accepts `option.description`, give each option its own `description` and verify the
  section is accepted and read back. Otherwise explain the choices in the field's help text.
  Do not assume the field for an RPC's `{label, value}` output.
- **Accurate types.** Declare the type the value really is: `date` for a date-time,
  `number` or `integer` for numbers, `boolean` for flags, `text` for opaque identifiers.
  The exception is a value that is only a date (`2026-10-29`) or only a time of day
  (`14:30`): it is not a date-time, so declare it `text` and state the exact format in
  the help text. A `date` parameter would offer and produce a full date-time. Choosing a
  more accurate type for a value that already works is advice. A type the schema rejects,
  one that loses or alters the value, or one that contradicts documented provider behavior
  is a defect when evidence shows it.

Guides: [labels and visibility](../examples/current-knowledge/guides/labels-visibility.md),
[selectors and mode](../examples/current-knowledge/guides/selectors-mode.md),
[interfaces and required flags](../examples/current-knowledge/guides/interfaces-required.md).

### Banners

A `banner` parameter shows a message in the form: `text`, an optional `title`, and a
`theme` of `info`, `warning` or `danger`. The recommended length is 50 to 300 characters. A
banner has no `name` and sends no value.

~~~json
{"type": "banner", "theme": "info", "text": "Use at most one filter: Status, Owner or Tag. The provider rejects a request that combines them."}
~~~

- Use it for what one field's help cannot carry: a rule across fields (use at most one of
  these filters, give either A or B), a cost, quota or rate note, the consequence of a mode,
  or the setup steps for a webhook that is not attached. Keep each field's own help as well.
- A fields RPC can return a banner in a conditional step, so the message appears only when
  it applies, for example for one selected option (see
  [notices from an RPC](../examples/current-knowledge/guides/dynamic-data-and-files.md#notices-and-connection-specific-help-from-an-rpc)).
- Prefer a banner to a field of type `html` whose label carries inline markup and fixed
  colors. `html` is in neither the documented parameter types nor the editor schema's `type`
  enum, so schema validation warns on it. Published apps do use such fields for notes that
  render, so replacing one is advisory, not a defect to fix.
- A missing banner, or one worded differently, is advisory.

Sources: [Messages (banners)](https://developers.make.com/custom-apps-documentation/best-practices/input-parameters/mappable-parameters.md#messages-banners),
[Instructions for a webhook that is not attached](https://developers.make.com/custom-apps-documentation/app-components/webhooks/dedicated/not-attached.md).

## Dynamic options RPCs

RPCs execute during scenario configuration, not as substitutes for action execution.
Bind each RPC to the same connection or connection list as its calling module.
This requirement also applies to request-less RPCs; a static response does not
remove the component's connection-compatibility requirement.

Use a select's `"options": "rpc://getUsers"` for a bounded list. Return an array
of `{label, value}` objects through iteration and output. A standard response fragment is:

```json
{
  "response": {
    "limit": 500,
    "iterate": "{{body.users}}",
    "output": {"label": "{{item.name}}", "value": "{{item.id}}"}
  }
}
```

Choose the real array path and a useful bounded limit; do not fetch an entire
account merely to open a dropdown. Prefer a search button when provider-side
search exists and the available records cannot fit a practical options list.
Use `mode: "edit"` for mappable identifier selectors in Get, Update, and Delete
modules; the RPC guide requires it. Search/List and Create follow hierarchy-based
recommendations (see the selectors guide), and the user can still choose a value.

Sources: [RPC connection contract](https://developers.make.com/custom-apps-documentation/app-components/rpcs.md),
[Dynamic options](https://developers.make.com/custom-apps-documentation/app-components/rpcs/dynamic-options-rpc.md),
[RPC usability and limits](https://developers.make.com/custom-apps-documentation/best-practices/remote-procedure-calls.md).

### Search buttons (ID finder)

A field can carry an `rpc` object: a button opens a small form, the RPC searches the
provider with that form's values, and the chosen result's `value` fills the field. Use it
when the provider can search but the records do not fit a practical options list.

~~~json
{
  "name": "recordId", "type": "text", "label": "Record ID", "required": true,
  "rpc": {
    "label": "ID finder",
    "url": "rpc://searchRecords",
    "parameters": [
      {"type": "banner", "theme": "info", "text": "Only a limited number of results can be shown. If you don't see the item you're looking for, try more specific search criteria."},
      {"name": "keywords", "type": "text", "label": "Record keywords", "required": true}
    ]
  }
}
~~~

The RPC reads the form as `parameters.<name>` and returns `{label, value}` like an options RPC:

~~~json
{
  "url": "/records/search",
  "qs": {"q": "{{parameters.keywords}}"},
  "response": {"limit": 100, "iterate": "{{body.items}}", "output": {"label": "{{item.name}}", "value": "{{item.id}}"}}
}
~~~

- The field stays an ordinary mappable field with its own type, `required` and help; mapping
  works without the finder.
- Label the button `ID finder` (`Finder` when the field is not an ID, such as a path). Label a
  keyword input `[Item] keywords` and keep the info banner. For an exact-match input, use the
  item's own name as the label, add the hint "Must be the exact [item].", and leave the banner
  out.
- Do not mark a result `default: true`; that is for selects. After selection the field shows
  the value, not the label, so a result label must identify the record on its own (a name plus
  a distinguishing detail, such as `{{item.name}} ({{item.id}})`). List results alphabetically
  when the provider can sort them.
- Leave an empty optional filter of the search form out of the request
  (`ifempty(parameters.status, undefined)`), as the documented advanced search example does;
  it is a search input, not an update that may need to clear a value. Keep the RPC inside its
  budget ([RPC page budgets](../examples/current-knowledge/guides/rpc-page-budgets.md)); a more
  specific term finds what the budget cuts off.
- `mode` belongs to selects. A text field with a search button already takes a typed or
  mapped value, so a missing `mode: "edit"` on it is not a finding. Its `rpc://` name must
  still resolve, and the RPC must share the module's connection.
- When the same finder form is copied into several modules, review the copies together;
  flags such as `mappable` drift between copies.

Sources: [Search button](https://developers.make.com/custom-apps-documentation/app-components/rpcs/dynamic-options-rpc.md#search-button),
[ID finder](https://developers.make.com/custom-apps-documentation/best-practices/input-parameters/mappable-parameters.md#id-finder).

### Grouped options

For a long list with natural sections (supported and preview choices, item families), set
`"grouped": true` on the select and let the RPC return groups instead of a flat list:
`[{"label": "Group", "options": [{"label": "Item", "value": "item-1"}]}]`. The flag is what makes
the editor read the group objects; a select that receives flat `{label, value}` pairs does not set
it. The Select page shows the grouped shape with hand-written options only, so confirm in the form
that groups an RPC returns render. Keep every `value` the full identifier, unique across groups, and
put extra detail only in the label. Leave out empty groups, and give an item that matches no
grouping rule a fallback group rather than dropping it or letting the helper throw.

Source: [Select: grouped](https://developers.make.com/custom-apps-documentation/block-elements/parameters/select.md#grouped).

### Option and finder RPCs only read

An RPC runs while a person configures the module, each time its field loads or is
refreshed. Classify its request by effect, as for module requests: an options, fields or
finder RPC must not call an endpoint that receives, leases, claims, marks as read or
otherwise changes provider state, because opening a dropdown would then hide or alter live
data. Its values must also be identifiers a user can save; a short-lived token issued per
delivery (a receipt handle, a lease ID) has expired by the time the scenario runs. Offer a
mappable text field instead, with help naming the earlier module output to map. Fix a
state-changing RPC; it is not a style point.

Source: [RPCs run while the user builds the scenario](https://developers.make.com/custom-apps-documentation/app-components/rpcs.md).

## Dependent options, fields, and interfaces

- Use `options.store` together with `options.nested` for dependent selects.
  The selected parent field is available through `parameters.<name>` in the child RPC.
- Let module parameters flow to linked RPCs; use documented RPC query parameters
  for additional fixed context rather than interpolating arbitrary unsupported syntax.
- Filter on the provider when possible. The documented `iterate.container` plus
  `iterate.condition` form can filter returned options when server filtering is unavailable.
- For dynamic fields, return Make parameter definitions with `name`, `type`, and
  appropriate labels, not `{label, value}` options or raw provider schema objects.
- Reference a fields RPC in the mappable-parameter array, alone or alongside fixed
  fields. Translate provider `string` into Make `text` rather than forwarding it.
- For a dynamic **output** interface, intentionally reference the schema RPC from
  Interface. Do not add input dropdown options to ordinary output fields by accident.
- For an instant trigger's dynamic interface, use the documented `webhook.*`
  context for webhook data, rather than assuming incoming `payload` is present at edit time.
- Dynamic sample RPCs return one sample object; set `response.limit: 1` when iterating.

Sources: [Dynamic fields](https://developers.make.com/custom-apps-documentation/app-components/rpcs/dynamic-fields-rpc.md),
[Dynamic interface](https://developers.make.com/custom-apps-documentation/component-blocks/interface.md#dynamic-interface-using-rpc),
[Dynamic samples](https://developers.make.com/custom-apps-documentation/app-components/rpcs/dynamic-sample-rpc.md).

### Fixed arguments in an `rpc://` reference

The documented RPC query parameters look like a query string:
`"options": "rpc://listItems?type=contact&active=true"`. Each argument reaches the RPC as
`parameters.<key>`, next to the inherited module parameters. Repeat a key (`?kind=a&kind=b`)
to pass an array, which the RPC declares as an `array` parameter. One RPC can then serve
several fields with different fixed context instead of near-identical copies that drift
apart.

- The RPC must read every argument it is given. An unread `?type=chat` filters nothing while
  readers assume it does; use it or remove it.
- Every value a caller passes needs a matching branch or filter in the RPC; an unknown value
  must not fall through to an empty or wrong list.
- Do not test an argument for truthiness. The documentation does not say whether
  `active=false` arrives as the text `'false'`, which is truthy, or as a boolean. Forward it
  as the documented example does, or prefer arguments whose values are compared rather than
  tested, such as `type=contact`.
- Give arguments names that differ from the module's own parameter names: both arrive as
  `parameters.<name>`, and which value wins is not documented.
- An RPC that reads a parameter no module declares may be fed by such an argument. Check the
  callers' `rpc://` references before reporting it as an undeclared input.

Source: [Send query to RPC and send array to RPC](https://developers.make.com/custom-apps-documentation/app-components/rpcs/dynamic-options-rpc.md#send-query-to-rpc).

### Condition-aware RPCs: steps with `condition`

The condition-aware RPC named under Form quality is an RPC whose communication is an array
of steps, each with its own `condition`; a step whose condition is false is skipped. Use it
for a fields RPC that returns a different field group per value of a sibling select, for an
RPC that first reads facts about the selected item and then decides which field to offer,
and for a lookup that must not run with empty input. Values pass between steps through
`response.temp`.

~~~json
[
  {
    "condition": "{{parameters.itemId}}",
    "url": "/items/{{parameters.itemId}}",
    "response": {"temp": {"needsProfile": "{{body.mode === 'profile'}}"}, "output": null}
  },
  {
    "condition": "{{temp.needsProfile}}",
    "response": {"output": [{"name": "profileId", "type": "select", "label": "Profile", "required": true, "options": "rpc://listProfiles"}]}
  },
  {
    "condition": "{{!temp.needsProfile}}",
    "response": {"output": []}
  }
]
~~~

- Make the conditions of the steps that produce the result mutually exclusive and together
  cover every case, as the documented request-less example does with a condition and its
  negation. Where no step applies, the user sees nothing and gets no error.
- A step without `output` returns the response body by default, so a step that only fills
  `response.temp` still produces a result, and a later step that is skipped or returns
  `null` does not replace it. Give a gathering step `"output": null` and the no-match case an
  explicit result: a last step with the negated condition (an empty array means no fields or
  no options), or the documented `condition` object, whose `default` is the result when the
  condition is false.
- Guard a request that depends on an earlier step's result, for example
  `"condition": "{{length(temp.ids) > 0}}"` before a batch lookup of those IDs, so an empty
  first result gives an empty list instead of a provider error. Keep the batch within the
  provider's ID count and URL length limits. Every step that sends a request counts toward
  the RPC's recommended budget of about three requests (see
  [RPC page budgets](../examples/current-knowledge/guides/rpc-page-budgets.md)).
- Branch on an explicit signal from the provider (a capability flag or a type field), not on
  a substring of a name or label: a new or renamed value silently gets the wrong branch.
- A field `name` built by an expression or helper must be defined in every state, including
  an empty parent selection.
- Some apps detect a mapped parent with `contains(parameters.parentId, '{{')`, assuming the
  RPC then receives the unresolved mapping text, and return a generic input. This is an
  observed technique, not a documented signal: do not report it as wrong where both the
  choose path and the map path work, and do not add it as a universal guard (see the
  selectors guide).

Sources: [condition](https://developers.make.com/custom-apps-documentation/component-blocks/api/making-requests.md#condition),
[Request-less communication](https://developers.make.com/custom-apps-documentation/component-blocks/api/request-less-communication.md),
[Multiple requests](https://developers.make.com/custom-apps-documentation/component-blocks/api/multiple-requests.md),
[Dynamic fields](https://developers.make.com/custom-apps-documentation/app-components/rpcs/dynamic-fields-rpc.md).

## Current-knowledge guides

Open the guide for the question at hand; each carries sources, applicability, exceptions and
authored synthetic correct/incorrect fixtures (static teaching material, not runtime proof).

- Selector mode, dependent options, options vs schema RPCs:
  [selectors and mode](../examples/current-knowledge/guides/selectors-mode.md).
- RPC limit, page size and one-based pages (a recommendation, not a provider cap):
  [RPC page budgets](../examples/current-knowledge/guides/rpc-page-budgets.md).
- Required flags, interface drift, falsy values:
  [interfaces and required flags](../examples/current-knowledge/guides/interfaces-required.md).
- Labels and field visibility (cosmetic wording vs behavior), array label vs item label vs
  `labels.add`, field order:
  [labels and visibility](../examples/current-knowledge/guides/labels-visibility.md).
- Options, fields and sample RPCs; metadata-driven schemas:
  [dynamic data and files](../examples/current-knowledge/guides/dynamic-data-and-files.md).
- Omit, clear and set, and what an interface does and does not convert:
  [outputs, empty values and updates](../examples/current-knowledge/guides/outputs-empty-values-updates.md).

## Verification gate

- Resolve every `rpc://` reference and custom helper against a defined component.
- Verify empty, single, and large option sets, parent changes, expired credentials,
  duplicate labels, identifier types, and manual/mapped entry.
- Assert dynamic fields and interfaces use supported types and unique stable names.
- Check output schemas against real bundle shape, including dates, nested arrays,
  optional fields, and file semantics. A sample is not proof of all possible fields.
- Keep fixture data synthetic or sanitized. Report UI/RPC execution separately
  from static JSON checks; an upload alone does not prove the selector opens.
- Check that every option label is readable and never blank. Free text (a description, a
  message body) can be empty, very long or multiline, so fall back to another field or the ID
  (`{{ifempty(item.title, item.id)}}`) and keep the stable ID as `value`. Do not build a label
  from a fixed array position, such as the second member of a list, unless the provider
  guarantees that order.
- Check every branch of a helper that builds options, including its not-found and empty
  branches: each returns `{label, value}` objects, never bare strings, and its test asserts
  that shape.
