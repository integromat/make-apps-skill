# Review sweeps: applying rules to an app

Load this when reviewing or auditing an app. Opening a guide is retrieval; this file is about application. Source rules are in the [current-knowledge index](../examples/current-knowledge/README.md); worked examples and a table template are in [role-application-examples](../examples/current-knowledge/guides/role-application-examples.md).

## Per-component rule-application table

For each applicable check, record: source/rule, strength (documented requirement, recommendation, inferred pattern), why it applies, the exception considered, status (`finding`, `passed`, `not_applicable`, `uncertain`), exact evidence, and the linked finding. A skipped applicable check is a coverage gap. Keep authoring requirements, recommendations and open evidence questions separate in severity; recommendations never block, and authoring corrections are not observed outages. Approval impact follows [Approval gating](review-and-qa.md#2a-approval-gating): a documented requirement is reported and is a defect to fix (approve with adjustments) only in classes a-d; classes a, c and d are always fixed, class b findings are fixed too; only a scam, a trash source or an unremovable exposure is rejected (see [Approval gating](review-and-qa.md#2a-approval-gating)).

## Sweeps

| Sweep | Inspect | Decide yourself (a name or locator is not enough) | Guide |
| --- | --- | --- | --- |
| Temporal fields | Every emitted date/time field: output expression or helper, interface declaration, sample | Meaning, provider zone and unit; whether the conversion is real; exceptions (date-only, time-only, unknown zone, non-timestamp numbers). Cursor mapping is separate from output typing; check the conversion, not the `parseDate` token. JSON ISO text is text and a `date` interface is not proof of conversion; raw ISO pass-through is parsed with the provider's format (Required in marketplace review), an undocumented zone is uncertain rather than dismissed, and an already-Date traced value, such as one the app's own IML function parses, needs no second parse. | [dates-helpers](../examples/current-knowledge/guides/dates-helpers.md) |
| Request headers | Universal subtype, all input branches, input-to-header sink, Base auth, collection vs expression form | REST: is any equivalent header input present and reaching the request. GraphQL: no Headers input is not by itself a REST-convention finding, but still check that provider-required headers can be sent. Credential retention is a separate trace; collision ordering is a bounded model, not proven precedence. | [headers-merge](../examples/current-knowledge/guides/headers-merge.md) |
| Selectors | Selector location, effective mode, mappability, RPC links and input counts, parent stores | Operation role and provider hierarchy. Get/Update/Delete mappable identifiers require edit mode; Search/List and Create are recommendations; many RPC inputs differ from many results. Do not invent lookup routes. | [selectors-mode](../examples/current-knowledge/guides/selectors-mode.md) |
| Routes | Exact method and path; provider documentation and its completeness | Whether the evidence is authoritative and exhaustive for that operation. Absence from partial documentation is an evidence gap, never a proven broken route; a deprecated route is not thereby removed. | [compatibility-evidence](../examples/current-knowledge/guides/compatibility-evidence.md) |
| Output declaration | Mapping, interface and samples together | A retained but undeclared raw field is a declaration gap, not data loss; an explicit projection that drops a required field is loss. | [dates-helpers](../examples/current-knowledge/guides/dates-helpers.md) |
| Auth context | Which communication block, variable and OAuth phase | See the counterexample below. | [auth-context](../examples/current-knowledge/guides/auth-context.md) |
| Module visibility | Review target; whether the module inventory is complete; each module's explicit visibility, separate from approval and from parameter `hidden` | Only an explicit marketplace or new-user target with a complete nonempty inventory all literally `false` is a class (d) readiness finding: fix it when the request or docs determine which modules are visible; otherwise report it as advisory with the decision needed, never reject. Draft or private targets, no target, unknown or truncated flags, and a single hidden legacy module are not. Never auto-expose modules. | [labels-visibility](../examples/current-knowledge/guides/labels-visibility.md#module-distribution-visibility-not-parameterhidden) |
| RPC record budget | Sweep every RPC, including attach/detach, dynamic fields/interface/sample and option RPCs, even if no one asked about RPCs, then branch by role: page-size parameter, `qs.limit`, pagination, `response.limit`, `delay`, request count | Provider documented default/maximum page size and runtime bound, compared with Make's limits. Hard ceilings (40 s call, 50 pagination requests, 3200 past records, 100 requests) apply wherever the component is subject to them. Role branches: a **dynamic options** RPC that can return more than 500 items requires an output limit (documented requirement, [dynamic-options page](https://developers.make.com/custom-apps-documentation/app-components/rpcs/dynamic-options-rpc#syntax-of-rpc-output)); an **iterating dynamic sample** RPC must process one item (`limit: 1`) regardless of the 500 threshold ([sample page](https://developers.make.com/custom-apps-documentation/app-components/rpcs/dynamic-sample-rpc)); fields, interface and lifecycle (attach/detach) RPCs do not inherit the dropdown 500-item rule, so assess their real bound and request/page cost instead. The shared `limit` directive is generally optional; the limit requirement applies only where an applicable role requires one (for example an options RPC that can exceed 500 items). A mapped `response.limit` is not inherently defective when its upper bound is known (for example a positive `if(...)` between two numbers). Where a limit is actually required, a mapped value whose bound cannot be determined is `uncertain` (needs evidence), not a definite failure; an applicable, known-unbounded value is a finding. A fixed literal is a conservative authoring and fixture convention, not a platform requirement. About 3 requests / 3× page size, or 300-500 for pages of 100+, is a recommendation, not a provider maximum; a number that differs from it is not a finding. Keep this separate from selector UI hierarchy. | [rpc-page-budgets](../examples/current-knowledge/guides/rpc-page-budgets.md), [pagination-and-trigger-state](../examples/current-knowledge/guides/pagination-and-trigger-state.md) |
| Webhook lifecycle | The actual receiver (`verification`, `respond`, `output`, `iterate`), attach, detach, update where present, what attach stores in `response.data`, connection passed to lifecycle RPCs; not the instant-trigger module's metadata binding alone | Delivery kind first. If the provider requires a signature, secret or raw body, the author must show a mechanism; a challenge reply is not signature verification, and an untested static implementation of a provider security requirement is not downgraded to minor. If the provider documents an explicit unsigned or no-auth control, do not invent a signature requirement. One-time keys must be persisted from attach. A missing export or binding is `uncertain`, not an intrinsic empty-API defect: trace code and receiver defaults (omitted `output` forwards items; `respond` is optional) before claiming anything is missing. | [webhooks](../examples/current-knowledge/guides/webhooks.md) |
| Input contract | Each input: `required`, `default`, path/body/query use, format, `||` or `ifempty` fallbacks, helper arguments, RPC and dynamic consumers | Provider requiredness and default semantics in both directions (required but unused; optional but needed; default that overrides a user value), the format, and whether `0`, `false` and empty string are kept or turned into unset. Also decide whether an ID input would benefit from provider-backed discovery even when it is plain text with no RPC, but only if the provider documents a list or search route; do not invent a lookup API. | [interfaces-required](../examples/current-knowledge/guides/interfaces-required.md), [selectors-mode](../examples/current-knowledge/guides/selectors-mode.md) |
| Connection lifecycle | Authorize, token, info, refresh, invalidate; scopes; `log.sanitize`; which supplied data (inputs, `common`) feeds each phase; Base; module `data` | The phase and store actually used, token expiry vs grant expiry, rotation, scopes vs promised operations, secrets masked. Never a namespace-only block (see the Auth row and counterexample). In a module, persistent `data` is separate from input `parameters`; do not move connection aliases there. | [connections-and-oauth](../examples/current-knowledge/guides/connections-and-oauth.md), [auth-context](../examples/current-knowledge/guides/auth-context.md) |
| Labels and descriptions | Labels, descriptions, help text against the request each module performs | Cosmetic (casing, grammar) is minor and never blocking. A label or description that promises behaviour the request lacks (for example "permanently" on an archive) is functional and needs human tracing. Preserve the module visibility row above; it is a separate check. | [labels-visibility](../examples/current-knowledge/guides/labels-visibility.md) |
| Output, interface, samples | Output projection or spread, interface entries, sample values, and the actual interface and empty-value handling in the output | Names, types and samples agree; omit, clear and set behave as promised; falsy values survive. Dates are one case of this, not the whole check. | [interfaces-required](../examples/current-knowledge/guides/interfaces-required.md), [outputs-empty-values-updates](../examples/current-knowledge/guides/outputs-empty-values-updates.md) |
| Endpoints | Only if the request or review scope names SDK Endpoints | Endpoints are optional; absence is not a finding. Review them only when explicitly in scope. | [optional-endpoints](../examples/current-knowledge/guides/optional-endpoints.md) |

### Sweep: lookup results that build the next request

Inspect every request array in which an earlier request stores a value from its response in
`temp` (often the first item of a filtered list, such as `body.items[1].id`) and a later
request puts that value into its `url`, path, query, body or headers.

Decide whether the lookup can succeed without a usable value: a list or search that answers
2xx with an empty list, or a documented optional field that is absent. A missing path resolves
to empty without any error, and an empty value inside URL text becomes an empty string, so the
next request silently runs against a different or malformed route. A write can land on a
parent route or the collection root, a read on a malformed path, and the user sees a confusing
provider error or none at all. A 4xx for no match already stops the module through error
handling, before `valid` runs; the silent case is the 2xx one.

- A route whose documented response is a list or search result can answer a no-match with an
  empty 2xx list; that documentation is enough evidence. An unguarded chain on it is a
  functional defect (class (a) in [Approval gating](review-and-qa.md#2a-approval-gating)). Fix
  it on the lookup request with `response.valid` and a message that names the missing input.
  Where an absent value is a legitimate outcome, give the later request a `condition` instead
  (object form with `default` when the module must still return something). Apply the same fix
  to every module that repeats the lookup.
- When the provider documentation cannot settle the no-match behaviour (for example a
  single-object route whose not-found answer is undocumented), record the check as `uncertain`
  with that missing fact rather than adding an unexplained guard.
- The lookup itself is legitimate ([requests, files and multi-step](../examples/current-knowledge/guides/requests-files-multistep.md));
  its extra request per run is a design point, not a finding.

```json
[
  {
    "url": "/lists",
    "qs": { "name": "{{parameters.listName}}" },
    "response": {
      "valid": {
        "condition": "{{length(body.items) > 0}}",
        "message": "No list named '{{parameters.listName}}' was found."
      },
      "temp": { "listId": "{{body.items[1].id}}" }
    }
  },
  { "url": "/lists/{{temp.listId}}/entries", "method": "POST", "body": "{{parameters.entry}}" }
]
```

Guide: [errors and rate limits](../examples/current-knowledge/guides/errors-and-rate-limits.md)
(failures inside successful responses; errors in multi-step communication).

### Sweep: comments and commented-out code

Component files are parsed as JSON with comments, and approved apps were seen shipping comments
routinely: template explanations, notes, and commented-out alternative requests, option blocks
or whole `pagination` blocks. A comment does nothing at runtime, so it is neither a defect nor
evidence. Read every comment anyway, as the author's own statement about the component, and
test it against the active code:

- A comment that admits a gap names a check to run: "add pagination" on an options RPC, a
  commented-out `pagination` block, a TODO about unhandled error fields, or a note that a
  provider field cannot drive the stop condition. Apply the matching sweep or checklist item
  to the active code (pagination where the provider pages, the RPC record budget, documented
  error shapes) and report what that check finds, not the comment.
- A comment that claims behaviour is not proof. A pagination body that writes
  `"filters": { /* unchanged */ }` relies on the original body being merged in, which the
  pagination page does not promise: it documents that a supplied pagination `body` overrides
  the original one ([pagination and trigger state](../examples/current-knowledge/guides/pagination-and-trigger-state.md)).
  Do not report lost filters on page two from the file alone; repeat the complete body instead,
  which is correct whether or not the two bodies are merged:

  ```json
  "pagination": {
    "body": {
      "filters": "{{parameters.filters}}",
      "page": "{{pagination.page}}"
    }
  }
  ```

- The comment or the dead code itself is cosmetic: never blocking, and not a reason to delete
  or rewrite it when no finding requires the change. A change that only removes comments would
  turn a plain approve into an adjustment for nothing. When building, resolve the gap a TODO
  names instead of shipping the note, and keep one active definition instead of a
  commented-out alternative, so the next reviewer does not have to guess which one is meant.

## Mandatory per-component checklist

For every component, answer each item below as `finding`, `passed`, `not_applicable` or `uncertain` with the missing fact (never skip silently):

- Output dates are parsed to the Make date type where the provider value is a real timestamp.
- Documented error shapes (4xx bodies, including 422 validation errors) are handled in Base or the module, consistent with the provider.
- Authentication is inherited from Base or the connection and not duplicated in modules.
- Pagination exists where the provider pages results: for list and search modules and also for pickers and RPCs; RPC paging stays within the RPC record budget above.
- Output and interface agree: no stale or missing fields.
- File inputs and outputs keep their file semantics (name, data, MIME type).

## Auth-alias counterexample review

A difference in spelling (`data.x` vs `parameters.x`, or `common`) is not a static defect by itself. Before reporting, trace the specific OAuth phase (authorize, token, info, refresh, invalidate; Base; module) and the store the value actually lives in. In connection communication `data`, `parameters` and `connection` reach the same stored data; `common` is a separate store with its own role. This holds in the initial authorization-code token exchange as well as refresh. An empty `common: {}` does not mean credentials are missing when they are supplied as connection inputs, and `common` is not an alias: a read of `common.x` with the value only in inputs, or the reverse, is a real source-selection gap. In an ordinary module, `data` is persistent module state, `parameters` are inputs and `connection` is the attached store; do not transfer token-phase aliases there. Do not claim namespace equivalence outside the traced context, or that a live flow works from static reading. A real defect is a response-only variable in a request, a literal credential, or a module reading credentials from a store the actual flow never populates. See the worked case in [auth-context](../examples/current-knowledge/guides/auth-context.md#worked-case-initial-authorization-code-token-exchange-with-empty-common).

## Cover every source component

Apply the checks to the whole component graph, not only modules or the capability the user named:

| Component | Applicable sweeps |
| --- | --- |
| Connections | Connection lifecycle, labels (connection parameters), secrets masking |
| Base | Request headers and auth, connection lifecycle, error handling inherited by modules |
| Modules (action, search, trigger, universal) | Input contract, selectors, output/interface, temporal, headers, labels, visibility |
| RPCs (every kind) | RPC record budget, selectors, connection match, input contract |
| Webhooks | Webhook lifecycle, output/interface, connection lifecycle |
| Helpers (custom functions) | Temporal, input contract, output; trace what they return |

Trace Base inheritance and helper calls as their own step: the effective request is Base plus module, and a helper's behaviour comes from its code. Do not infer either from the raw module text alone.

## Retrieval

Retrieve only the guides relevant to the components and claims at hand. Do not load all guides by default.

## Limits

Validate every component file against its Make editor schema as part of the sweep ([editor schema validation](editor-schema-validation.md)). Static review establishes findings and locations and applies fixes per [QA 2a](review-and-qa.md#2a-approval-gating); it does not execute QA plans, live provider calls or Make runs. Keep documented requirements, recommendations and unknown evidence distinct. Do not present a definite provider or runtime claim without evidence; record uncertainty and the evidence needed.
