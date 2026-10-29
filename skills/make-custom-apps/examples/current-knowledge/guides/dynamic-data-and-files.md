# Dynamic options, fields and metadata-driven schemas

Back to the [knowledge index](../README.md).

Forms that adapt to the provider at configuration time: option lists, field schemas and sample data. This guide covers dynamic RPCs and metadata-driven schemas. File bytes, multipart, request sequences and repeats are in [requests-files-multistep](requests-files-multistep.md); empty values and updates are in [outputs-empty-values-updates](outputs-empty-values-updates.md). Selector behaviour is in [selectors-mode](selectors-mode.md) and budgets in [rpc-page-budgets](rpc-page-budgets.md). This guide has no recipe fixtures.

## Pick the RPC kind that matches the job

* **Options RPC.** Returns `[{ "label", "value" }]` (optionally a default) for a select. Value is the provider's stable identifier; label is for people.
* **Fields RPC.** Returns parameter specifications for mappable input or an interface: `name` is required and the type for plain text is `text`, not `string`. An interface or `parameters` array may mix fixed fields with a single `"rpc://name"` entry, and the RPC string alone is allowed.
* **Sample RPC.** Supplies sample output for the module's interface.

Using an options RPC where a schema is expected, or the reverse, shows the user the wrong thing or nothing.

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

## Exceptions and applicability

* Apps with fixed forms need no dynamic RPC.
* Small, static provider lists can use hand-written `options`.
* An instant trigger's dynamic interface has the `webhook` context in addition to the usual ones.

## Evidence and limits

RPC kinds, inheritance and the connection rule: **documented behaviour / requirement**. Filtering and budgets: **documented recommendation**. The metadata handling steps are an **inferred implementation pattern**. This guide has no static fixtures, and the checker does not examine dynamic schemas.

## Sources

* https://developers.make.com/custom-apps-documentation/app-components/rpcs/dynamic-options-rpc
* https://developers.make.com/custom-apps-documentation/component-blocks/interface
* https://developers.make.com/custom-apps-documentation/app-components/rpcs
* https://developers.make.com/custom-apps-documentation/app-components/rpcs/dynamic-fields-rpc
* https://developers.make.com/custom-apps-documentation/app-components/rpcs/dynamic-sample-rpc
* https://developers.make.com/custom-apps-documentation/app-components/iml-functions/dynamic-mappable-parameters
* https://developers.make.com/custom-apps-documentation/best-practices/remote-procedure-calls
