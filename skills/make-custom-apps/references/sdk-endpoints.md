# SDK Endpoints: design, author, verify

For app **Endpoint definitions**, not consuming existing Endpoints. Use advertised, authorized
`custom_app_endpoint_*` tools and their current contracts. Explicit SDK/CLI workflows use the
[authoring route](tooling-and-release.md#typescript-sdk-upload-and-readback): `make.sdk.endpoints`
manages definitions; `@makehq/endpoints-sdk` executes them.[1][2]

## 1. Design the operation set

- Default to one useful vendor operation per regular Endpoint: method/path/version, inputs, response,
  connection and scopes. Keep business orchestration and async-job polling with the caller.
- Inspect existing module requests, then verify the vendor's current contract. Decompose multi-call modules,
  deduplicate operations, and record missing or deprecated coverage. A foreign-API call belongs with its
  owning API; similar module names do not establish Endpoint coverage.
- Prefer stable, verb-first camelCase names and clear labels/descriptions. Retain existing callable IDs.
  These are design conventions, not a claim that every runtime enforces one HTTP request or forbids
  documented transformations.

## 2. Define the caller contract

- **Inputs:** explicit Forman definitions with accurate names, types, required flags, enums, nested shapes,
  constraints and field help. Follow the provider's wire contract, not a module's form layout. Do not rely
  on UI defaults, coercion, mapping pills or RPC-backed field resolution; keep connection IDs out of inputs.
- **Outputs:** describe the actual resource, including arrays, nested values and continuation metadata;
  exclude write-only fields. Do not invent success fields for an empty response. Returning only an item
  array is insufficient when it discards the next-page token or other required metadata.
- **Context:** document prerequisite IDs, usage, limits, pagination, side effects and safe examples.
  Reference related Endpoints by exact name; explain aliases, transformations and intentional clearing.
- **Connections/scopes:** attach compatible app connection-definition names, not runtime credential IDs.
  Verify minimum scopes against those connections. New permissions require an approved connection/consent
  change, not merely adding a vendor scope string to the Endpoint.
- **Annotations:** select `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint` and
  `arbitraryCallHint` from actual effects, not HTTP verbs. A POST query can be read-only; idempotence needs
  provider evidence. Hints are neither permission grants nor retry guarantees.[1]

## 3. Implement and verify request semantics

Use a small RPC-compatible communication block. Map each input to its actual path/query/header/body field;
reuse Base authentication/error handling and verified app helpers. Keep regular operations provider-faithful
rather than adding convenience calls or undocumented reshaping. For GraphQL, use a fixed operation document
and schema-grounded variables; check errors inside HTTP 200 responses.

Expose provider paging controls as inputs and continuation values as outputs. Callers own complete
traversal unless the exact Endpoint documents otherwise. Do not infer internal pagination from a similarly
named module, or assume that one SDK call proves one provider request.

Treat inputs as literal data, not scenario-mapper expressions. Test omitted, null, empty text/containers,
`0` and `false` through the actual request mapping. In Forman's `fillDefaults: 'requiredOnly'` mode,
optional omission stays absent; usable defaults fill missing required values, but explicit required null
fails rather than receiving a default.[3] Verify the selected runner's behavior instead of assuming this
mode or the legacy fill behavior applies everywhere.

Keep compatibility handling field-specific. `ifempty` collapses omission, null and empty text; blanket
cleanup can erase an intentional PATCH clear.[4] An app-defined `stripEmpty` is not a universal platform
requirement. Any helper must exist before use and preserve the operation's valid values, including nested
containers, false/zero, dates and intentional clearing.

For an in-scope generic fallback, keep `arbitraryCall` separate from regular operations and set
`arbitraryCallHint: true`.[1] Derive its base/version prefix and nonstandard request behavior from the
existing API-call module or verified Base; constrain destinations to the authorized provider. Test method,
headers, query, Content-Type, structured bodies and already-serialized text. Reproduce a serializer defect
on the selected runtime before adding a workaround; do not assume an old defect still applies.

A JSON execution envelope is not raw-file transport. Prefer documented URL/base64 inputs where suitable;
verify provider-facing binary/multipart support end-to-end rather than claiming a universal ban or inventing
an equivalent operation.

## 4. Save in stages and read back

1. Read current app/version/origin, Endpoint metadata and sections; preserve unrelated/concurrent edits.
   Establish connection/helper dependencies before writing their consumers.
2. Create with supported CREATE fields, then UPDATE context and annotations: these are UPDATE fields in
   the verified SDK contract, not CREATE fields.[1] Keep returned identity; a configure message is not full
   metadata readback.
3. Write `api`, `scope`, `inputParameters` and `outputParameters` sections. `context` is metadata, not a
   fifth section; local filenames do not change remote keys. Preserve JSONC comments. Metadata updates to
   `attachedAccounts` replace the list, so include every intended binding.[1]
4. Read back every changed section, metadata value and binding. Configure can create the entity while
   individual section writes fail: inspect each result and repair with UPDATE, not another CREATE.
   Keep visibility/publication separate and explicitly approved.

## 5. Test and maintain

Use the actual approved Endpoint execution surface with the exact app/version/name and compatible managed
connection. A similarly named module run, ordinary RPC test or definition getter is not Endpoint proof.
Follow the bounded [QA plan](review-and-qa.md): inspect wire inputs, typed outputs, errors, paging boundaries,
defaults and clearing. Isolate writes and clean up only owned test records; missing access or test data
means Blocked/Not run, not Pass. A runtime-only test does not authorize definition changes.

Check compatibility for SDK/CLI/MCP callers and other dependents regardless of scenario usage.[2] Update
cross-referenced context after renames or behavior changes. Trace shared Base/connection/helper consumers;
use a separate helper if Endpoint-specific normalization would change existing modules. Apply the
[maintenance](maintenance.md) and [release](tooling-and-release.md) gates. Report definition review/readback,
actual runtime assertions and publication separately.

## Current-knowledge guide

An Endpoint is an optional addition; a module-only app is complete without one. See
[optional Endpoints](../examples/current-knowledge/guides/optional-endpoints.md).

## Sources

[1] https://raw.githubusercontent.com/integromat/make-typescript-sdk/a21b6b60de71ca96341da76b5329eff83c9ebc2a/src/endpoints/sdk/endpoints.ts
[2] https://unpkg.com/@makehq/endpoints-sdk@0.9.0/README.md
[3] https://unpkg.com/@makehq/forman-schema@2.0.1/README.md
[4] https://developers.make.com/custom-apps-documentation/block-elements/iml.md
