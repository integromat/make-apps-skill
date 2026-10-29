# Current knowledge index

This tree teaches how to build and repair Make custom apps with the facts that public Make documentation states today. Each topic has a guide (the explanation), a *correct* synthetic recipe fixture and one or more *incorrect* fixtures (what the mistake looks like). The machine-readable list of topics, sources, strengths and fixtures is [catalog.json](catalog.json).

Everything here was reviewed against public pages on 2026-10-28. All example hosts are synthetic (`*.example.com`, `*.invalid`). No provider, customer or private implementation is a source of authority.

## How to read the authority labels

Every guide separates three kinds of statement. Do not merge them when you review an app.

| Label | Meaning | What a reviewer may do with it |
|---|---|---|
| **Documented requirement** | A public Make page says "must", "required", "mandatory", or the platform demonstrably fails otherwise. | Block approval when violated and no listed exception applies. |
| **Documented recommendation** | A public page recommends, suggests or calls something best practice. | Raise as advice; explain the trade-off. Do not call it a defect or a platform limit. |
| **Inferred implementation pattern** | A way of working that follows from the documented behaviour but is not stated as such. | Use as a teaching aid and a review prompt. Never present it as a Make rule. |

Strength words in the catalog follow the same split: `must` only for documented requirements with a public source, `should` for recommendations, `consider` for inferred patterns.

## Evidence boundaries (read before trusting a green check)

* The checker, `scripts/check-current-knowledge.mjs`, is a **narrow, static validator of declared recipes**. It verifies that guides link their sources and fixtures, that each correct fixture satisfies the rule its recipe declares, and that each incorrect fixture breaks that declared rule.
* It is **not** a general IML interpreter, not an SDK or JSON-schema validator, not a Make upload check, and not a provider test. It never runs fixture code and never calls the network.
* A pass proves the teaching fixtures are internally consistent. It does not prove that your app works on Make, that a provider accepts a request, or that a webhook verifies a signature.
* Real apps still need Make's own validation, upload and readback, and execution against the real provider. Missing proof of an important behaviour can make an app *unapproved for lack of evidence*; that is different from asserting a runtime failure. See [compatibility-evidence](guides/compatibility-evidence.md).
* Routes or capabilities that the public pages do not mention are *unverified*, not proven absent.

## Core topic guides

| Guide | Teaches | Main authority |
|---|---|---|
| [dates-helpers](guides/dates-helpers.md) | Parsing provider date-times, polling order, tracing helper functions | Parsing is required where the provider format is not auto-parsed, with temporal exceptions (date-only, time-only, unknown zone, non-timestamp numbers); canonical ISO text is a documented ambiguity (recommendation to convert, not a blanket must-parse); order is a documented recommendation |
| [selectors-mode](guides/selectors-mode.md) | RPC-backed selects, `mode: "edit"`, nested selects, options vs. field schemas | Documented requirement for mappable Get/Update/Delete identifiers; hierarchy-based recommendations elsewhere |
| [rpc-page-budgets](guides/rpc-page-budgets.md) | Page size, request budget, record limit and `pagination.page` | Hard ceilings and role-specific requirements (options output limit above 500 items, sample `limit: 1`); recommendations otherwise; the fixed-literal limit is a fixture convention |
| [headers-merge](guides/headers-merge.md) | Base headers, module headers, the `{{...}}` collection spread | Documented behaviour |
| [interfaces-required](guides/interfaces-required.md) | `required`, falsy values, interface vs. output projection | Mixed: documented syntax, inferred consistency checks |
| [labels-visibility](guides/labels-visibility.md) | Label grammar, advanced fields, hidden-but-required fields, secrets | Cosmetic recommendations vs. documented behaviour |
| [auth-context](guides/auth-context.md) | Which variables exist where in connections, Base and modules; log sanitising | Documented requirement for sanitising; context-dependent aliases |
| [webhooks](guides/webhooks.md) | Attach/detach identity, challenge responses, delivery acknowledgement, shared webhooks | Documented requirements; verification is provider-dependent |
| [optional-endpoints](guides/optional-endpoints.md) | SDK Endpoints as optional by request scope, never a requirement or failure | Published SDK types and the local SDK reference; fixture rules are inferred |
| [compatibility-evidence](guides/compatibility-evidence.md) | Claims, sources, evidence gates, what may block approval | Inferred review pattern |

## Application guides

These are broad how-to guides. They have no recipe fixtures of their own and cite documentation only. Each explains the rationale, when it applies, the pitfalls and how to author the feature.

| Guide | Teaches |
|---|---|
| [app-architecture](guides/app-architecture.md) | Start here: layering of connection, Base, modules and webhooks, with a map to every other guide |
| [connections-and-oauth](guides/connections-and-oauth.md) | Basic, JWT and OAuth lifecycles, expiry versus grant lifetime, refresh and rotation, connection checks, conditional extra scopes |
| [errors-and-rate-limits](guides/errors-and-rate-limits.md) | Default 429 and 5xx handling, `valid`, per-status errors, why a generic type overrides defaults |
| [pagination-and-trigger-state](guides/pagination-and-trigger-state.md) | Pagination protocols, merge and stop defaults, polling state, epoch and ordering |
| [iml-and-helpers](guides/iml-and-helpers.md) | IML versus JavaScript, `ifempty` versus `||`, custom function runtime, tracing helpers |
| [dynamic-data-and-files](guides/dynamic-data-and-files.md) | Options, fields and sample RPCs; metadata-driven schemas |
| [requests-files-multistep](guides/requests-files-multistep.md) | Request construction, binary and multipart, request sequences, bounded repeats |
| [outputs-empty-values-updates](guides/outputs-empty-values-updates.md) | Output shaping, interface honesty, omit/clear/set, partial versus replacing updates |
| [universal-modules-and-scopes](guides/universal-modules-and-scopes.md) | Relative-path boundary, REST/GraphQL conventions, inherited auth, scopes |
| [role-application-examples](guides/role-application-examples.md) | Worked synthetic examples (full-record preservation plus date conversion; REST Headers input traced into a merge) and a per-check application table; see also [review sweeps](../../references/review-sweeps.md) |

## Where to start by task

* Designing an app: [app-architecture](guides/app-architecture.md), then the topic it points to.
* Fixing authentication: [connections-and-oauth](guides/connections-and-oauth.md), [auth-context](guides/auth-context.md). When credential placement or a connection check is undocumented: [auth-evidence-worked](guides/auth-evidence-worked.md).
* Slow or incomplete lists: [pagination-and-trigger-state](guides/pagination-and-trigger-state.md), [rpc-page-budgets](guides/rpc-page-budgets.md).
* Wrong or missing values: [outputs-empty-values-updates](guides/outputs-empty-values-updates.md), [interfaces-required](guides/interfaces-required.md), [dates-helpers](guides/dates-helpers.md).
* Writing a review or approval note: [compatibility-evidence](guides/compatibility-evidence.md).
* Endpoints (SDK definitions): [optional-endpoints](guides/optional-endpoints.md) and the [SDK Endpoints reference](../../references/sdk-endpoints.md).

## Recipes

Recipe fixtures live under `recipes/<recipe-id>/`. Each guide's Fixtures section links the correct file and every incorrect file for its topic. The catalog is the authority for which rules each incorrect fixture declares to violate.

## Maintenance

When a public page changes, update the guide, the source entry in the catalog and (if the declared rule changes) the fixtures together. Never raise a strength because something was seen often; strength comes from the documentation.
