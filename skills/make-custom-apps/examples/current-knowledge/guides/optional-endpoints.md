# Optional Endpoints

Back to the [knowledge index](../README.md).

An Endpoint is a callable operation definition an app can offer beside its ordinary modules. Callers use it through the SDK, CLI or tool surfaces rather than through a scenario module. This guide explains how to design one when the task asks for it and why an app that has none is not deficient.

## What is established and what is not

**Source authority, stated plainly.** Endpoints are a real SDK feature. The published SDK types and this skill's own [SDK Endpoints reference](../../../references/sdk-endpoints.md) describe the definition sections, inputs, outputs, annotations and the create/update/readback sequence, so do not call the feature nonexistent or unverified. The public custom-app documentation pages do not give Endpoints the same full coverage that they give modules, connections and RPCs, so the *page-level* detail in this tree is limited to patterns that follow from documented neighbours: declared inputs, Base reuse and the relative-path rule of the universal module. For SDK specifics, follow the Endpoints reference, not this guide.

Whether to author Endpoints is a **request-scope** decision. An Endpoint is optional because the request that asks for one says so, not because evidence happens to be absent. A task about modules, connections or RPCs does not become incomplete for lacking Endpoints, and a missing Endpoint is never a failure or a review finding on its own.

The nearest *public* concept for a free-form call is the **universal module**. **Documented requirement:** it must use a relative path so that a user cannot redirect tokens to another host. See [universal-modules-and-scopes](universal-modules-and-scopes.md).

## Design pattern when you want one

1. Declare every input the Endpoint reads in the `inputParameters` **section**, and read each one in the request IML as `parameters.FIELD` (for example `{{parameters.recordId}}`). `inputParameters` names the definition section that declares inputs; it is not an expression root. The published SDK types establish only the section keys; the `parameters.FIELD` request namespace comes from this skill's [SDK Endpoints reference](../../../references/sdk-endpoints.md) and its maintainers' own check of the runtime namespace, so treat it as local evidence rather than a public-page statement. The checker's `CK-ENDPOINT-INPUT` rule inspects the request text for `parameters.*` reads of undeclared names and for the legacy `inputParameters.*` root.
2. Keep the URL relative to Base, so the same credentials and the same host apply. A fixed `baseUrl` alone does not keep a user-supplied path on that host, because a complete URL in the input is treated as absolute (as for module requests); if the Endpoint takes a free-form path, put a fixed prefix ending with `/` directly before it, as for the universal module ([universal-modules-and-scopes](universal-modules-and-scopes.md)).
3. Inherit Base headers (use the spread described in [headers-merge](headers-merge.md) if you add some).
4. An Endpoint may overlap what a module already does; there is no rule against it. Overlap is a design choice (different callers, a wire-contract input shape), and the Endpoint need not mirror a module's form. Reuse Base so the credentials and host rules stay in one place.

```json
{
  "optional": true,
  "endpoint": {
    "inputParameters": [{ "name": "path", "type": "text", "label": "Path" }],
    "api": { "url": "{{parameters.path}}", "method": "GET" }
  }
}
```

The wrapper (`optional`, `endpoint`) belongs to this tree's synthetic fixtures. It is not a whole deployable Endpoint definition, and the example above only shows the declare-then-read relationship. Whether a free-form `path` input should exist at all is the arbitrary-call question the SDK reference treats separately.

### State repeat, reply and replace behaviour in the context

The input and output schema does not tell a caller what a second identical call does, what the reply describes, or whether a list or role input adds to the current value or replaces it. Write these facts into the Endpoint's context, as part of the side effects the [SDK Endpoints reference](../../../references/sdk-endpoints.md) already asks it to document, and choose the annotations from the same provider evidence:

* **Repeat call.** Say what a second identical call does. It may leave the record unchanged, return the existing record (a create-or-get by name), create a second record, or fail (a delete that answers "not found" because the record is already gone). `idempotentHint` describes effects, not replies: a repeat that creates a duplicate is not idempotent, while a repeat that has no further effect but returns an error can be. Say which case applies, so that a caller's retry does not read that error as a new failure. For a create that is not idempotent, say how to check before retrying (for example a search by a unique field), and name the upsert Endpoint by its exact name if the app has one.
* **What the reply reflects.** Say whether the reply shows the record as it was *before* the change (a delete whose reply still shows the record as active) or the new state. Replies with only identifiers or no body, and naming the Endpoint that reads the record back, are covered under **Write results** in the [SDK Endpoints reference](../../../references/sdk-endpoints.md).
* **Set, not add.** Say when an input replaces the current value instead of adding to it: a role that is set, or a list that becomes the complete set. Such an input removes what was there, so `destructiveHint` cannot be `false`, which the SDK type reserves for only additive updates. Repeat the warning in that input's `help`, where the caller reads it while filling in the value. Warn explicitly when the call can remove the connected account's own access: a lower role set on the connection's own user can make every later call on that resource fail with a permission error.

~~~json
{
  "name": "role",
  "type": "select",
  "label": "Role",
  "options": [
    { "label": "Owner", "value": "owner" },
    { "label": "Member", "value": "member" }
  ],
  "help": "Replaces the user's current role instead of adding to it, including an owner role. Setting a lower role on the connected account's own user removes its own access."
}
~~~

**Inferred implementation pattern.** Approved apps with Endpoints were seen stating these facts in their contexts and repeating the replace warning in the input help, and the parameter hints convention asks a hint to describe the result of a value. A missing note is context quality to improve, an advisory point. A note or annotation that contradicts the provider-evidenced behaviour is a finding to fix; its approval impact follows [Approval gating](../../../references/review-and-qa.md#2a-approval-gating).

### Empty lists in Endpoint inputs

**Documented behaviour.** The IML guide lets `ifempty` fall back only when the value is not defined, `null` or an empty string. An empty array is none of these, so `{{ifempty(parameters.fields, undefined)}}` still sends `[]`. To test a list, use `length()`, which returns the number of items in an array; the IML library also returns `0` for a missing value.

**Inferred implementation pattern.** An Endpoint caller sends literal data, not scenario mappings: no erase pill and no scenario empty-value setting applies, and the caller tells omission and `[]` apart itself (under `fillDefaults: 'requiredOnly'` an optional input it leaves out stays absent). Verify that on the selected runner, then decide per list input from what the provider does with `[]`:

* **A list that only shapes a read** (selected fields, sort keys), where the provider treats an absent list as its default but rejects `[]` or returns nothing useful for it. An empty list has no useful meaning there, so omit it with a length test and say so in the input's `help`. Do not apply this to a list of records to match, where omission would widen the read to every record.

~~~json
"fields": "{{if(length(parameters.fields) > 0, parameters.fields, undefined)}}"
~~~

* **A list on an update.** Forward the list as given: an omitted list leaves the field unchanged, and `[]` clears it where the provider clears with `[]`. Do not use the length test here. If the mapping must still drop `[]` (the provider rejects it, or clears through another value), give the caller an explicit way to clear, such as a boolean input that sends the provider's clear value. Without one the Endpoint cannot clear that field, and the clearing operation becomes a no-op.
* **Say it where the caller reads it.** In the context and in the input's `help`, state what an omitted list does (for example the provider's default field set), what an empty list does, and how to clear.

The length test on a read list is a narrow exception to the documented input-processing recommendation, which calls dropping empty arrays with `if` and `length` a bad practice because the user then cannot remove all values. That reason applies to updates, and there the recommendation stands. Test each list input with the value omitted, `[]` and one item through the actual request mapping, as the [SDK Endpoints reference](../../../references/sdk-endpoints.md) asks for empty containers.

## Never required

The rule here is deliberately one-directional. An Endpoint is optional by request scope. It is not a gate on approval unless the request explicitly requires endpoints (class (d) in [Approval gating](../../../references/review-and-qa.md#2a-approval-gating)), never something a review may demand because a provider has "more routes", and ordinary modules must never depend on one. `CK-ENDPOINT-OPTIONAL` enforces that a fixture marks it optional, and the catalog rejects a recipe that depends on the Endpoint recipe.

When a request does ask for Endpoint definitions, the design questions are the ones in the SDK reference: one useful provider operation per regular Endpoint, inputs that follow the provider's wire contract (not a module's form layout, mapping pills or UI defaults), outputs that keep continuation metadata, connection and scope attachment by definition name, annotations selected from actual effects, and a separate, explicitly marked arbitrary-call fallback. A module run is not proof that an Endpoint works; an Endpoint needs its own execution evidence.

Likewise, a provider route that no reviewed page lists is **not proven nonexistent**, and its absence from a partial specification is an evidence gap, not a missing capability. If you cannot show a route, record it as unverified (see [compatibility-evidence](compatibility-evidence.md)). Do not invent a list endpoint or lookup to make an Endpoint or a selector possible.

## Rationale

A feature that many apps skip must not turn into a checklist item. Marking it optional protects reviewers from inventing "required Endpoint coverage" and protects authors from building catch-all routes with the security risks that come with free-form paths.

## Pitfalls

* A review comment "add Endpoints for all provider routes". There is no such requirement.
* A free-form absolute URL in the Endpoint; this lets a user send the connection's token anywhere.
* An Endpoint that reads an input it never declared; the user cannot fill it in.
* Writing `{{inputParameters.name}}` in request IML. `inputParameters` is the declaring section; the request reads `parameters.name`.
* Treating an unlisted provider route as proven absent or as proof an Endpoint is needed.
* Making a module depend on an Endpoint, so that the module stops working if the Endpoint is removed.

## Exceptions and applicability

* Applies only to apps that choose to offer an Endpoint; nothing here applies to apps that do not.
* If the SDK reference or the selected runner documents Endpoints differently from this guide, that documentation overrides this pattern.
* The relative-path rule is a documented requirement for the universal module; applying it to an Endpoint's destination is a sound inference, but the exact Endpoint contract is in the SDK reference.

## Evidence and limits

* Universal-module relative path: **documented requirement** (that module only).
* Endpoint feature, sections and annotations: established by the published SDK types and the local SDK reference. Endpoint optionality and declared inputs in the fixture: **inferred implementation pattern**. The public guide pages' limited coverage of Endpoints is a documentation gap, not evidence against the feature.
* The checker only reads declared fixture fields; it does not know whether any provider offers a route or whether an Endpoint executes.

## Fixtures

Static, synthetic teaching fixtures; they say nothing about whether a real Endpoint executes.

* Correct: [correct.json](../recipes/optional-endpoint/correct.json): the synthetic wrapper marks the Endpoint optional, and every `parameters.*` name its request reads (a required path input plus an optional bound query input) is declared in `inputParameters`.
* Incorrect, `CK-ENDPOINT-OPTIONAL`: [marked-required.json](../recipes/optional-endpoint/incorrect/marked-required.json). The fixture makes the Endpoint mandatory for the app. An Endpoint is never a required artifact; a module-only app is complete.
* Incorrect, `CK-ENDPOINT-INPUT`: [undeclared-input.json](../recipes/optional-endpoint/incorrect/undeclared-input.json). The request reads `parameters.recordKey`, a name that `inputParameters` never declares, so a caller cannot supply it.

## Sources

* [SDK Endpoints reference of this skill](../../../references/sdk-endpoints.md): a local reference that routes to the published type contracts and to scoped runtime knowledge; it is not itself the primary source for the Endpoint definition contract.
* https://developers.make.com/custom-apps-documentation (entry point; it does not give Endpoints page-level coverage)
* https://developers.make.com/make-sdk/make-typescript-sdk (scope clarification only: this is the `@makehq/sdk` platform management client, also distributed for Deno as `jsr:@make/sdk`; the page is not a detailed Endpoint definition semantic contract)
* https://developers.make.com/custom-apps-documentation/app-components/modules/universal-module
* https://developers.make.com/custom-apps-documentation/app-components/base
* https://developers.make.com/custom-apps-documentation/app-components/base/advanced-inheritance
* https://developers.make.com/custom-apps-documentation/component-blocks/api/making-requests
