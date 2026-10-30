# RPC page budgets and pagination

Back to the [knowledge index](../README.md).

A dropdown RPC runs while a person is waiting. It has a 40-second execution limit and every page is another HTTP call. This guide explains how to choose a page size and a record bound, how `pagination.page` really counts, and which numbers are platform limits and which are advice.

## Limits versus advice

**Documented requirement (hard limits).** Max Call Timeout is 40 seconds (a pagination `delay` counts toward it). Max Pagination Request Count is 50, Max Past Record is 3200, Max Request Count is 100. Pagination stops after a page with zero records or when `response.limit` is reached. Role matters: a dynamic **options** RPC must have an output limit when its endpoint can return more than 500 items ([dynamic-options page](https://developers.make.com/custom-apps-documentation/app-components/rpcs/dynamic-options-rpc#syntax-of-rpc-output)); an iterating dynamic **sample** RPC must process one item (`limit: 1`) whatever the 500 threshold ([sample page](https://developers.make.com/custom-apps-documentation/app-components/rpcs/dynamic-sample-rpc)). Dynamic fields, interface and lifecycle RPCs (for example one attach returning one stored object) do not acquire the dropdown 500-item rule merely by being RPCs; sweep them, but assess their actual bound and request cost. The shared [limit directive](https://developers.make.com/custom-apps-documentation/component-blocks/api/handling-responses/limit) is otherwise generally optional.

**Documented recommendation.** For RPCs, plan about 3 requests and 3 times the page size in records. When the provider returns at least 100 per page, the best-practices page recommends a limit of 300 to 500. For smaller pages, three pages: 25 per page gives 75.

Notice what this means: "150 records at 50 per page" is the 3×page recommendation applied once. It is **not** a provider cap, **not** a Make cap and **not** universal. A provider with 200 per page is covered by the 300-500 rule instead. A reviewer who writes "limit must be 150" has invented a rule.

## Counting pages

**Documented behaviour.** `pagination.page` is one-based and is the page *about to be fetched*; it equals 2 in the pagination block after the first request. So a provider that takes one-based `page` receives `{{pagination.page}}` unchanged. A zero-based provider needs `{{pagination.page - 1}}`. For offset APIs, `{{(pagination.page - 1) * 100}}` with a page size of 100. Pagination `qs` and `headers` merge with the original request (`mergeWithParent` defaults true) and override same-named entries, so the page size from the first request carries over.

```json
{
  "url": "/projects",
  "qs": { "limit": 50, "page": 1 },
  "pagination": { "qs": { "page": "{{pagination.page}}" } },
  "response": { "iterate": "{{body.items}}", "limit": 150, "output": { "label": "{{item.name}}", "value": "{{item.id}}" } }
}
```

## Choosing the numbers

1. Find the provider's maximum and default page size; use a size at or below the maximum.
2. Decide the budget: at least 100 per page, 300-500 records; otherwise three pages.
3. Prefer a **fixed integer** `response.limit` at or under the budget, so a runaway provider cannot exceed it. This is a conservative authoring and fixture convention, not a platform requirement: the official [pagination example](https://developers.make.com/custom-apps-documentation/component-blocks/api/pagination#limit-offset) maps `response.limit`, and a mapped expression with a known positive upper bound (for example `{{if(parameters.small, 100, 300)}}`) is not inherently defective. Where a limit is actually required (for example an options RPC that can exceed 500 items), a mapped value with an unknown bound needs evidence rather than being a definite failure; an applicable, known-unbounded or user-controlled value is a finding.
4. If the provider can filter, filter on the server. In-RPC `iterate.condition` filtering is recommended only when the API cannot filter.
5. If users may legitimately need more than the budget, give them a mappable field alongside the select; do not raise the budget past the 40-second reality.

The checker's `CK-BUDGET-PAGE` rule tests that a fixture's `qs.limit` equals its declared page size, that records do not exceed pages × size, that stated numbers stay within the documented hard limits, and that the next-page expression agrees with the first request's page base. `CK-BUDGET-BOUND` tests that `response.limit` is a positive fixed integer within the declared record budget. That is a deliberately narrow fixture restriction (the literal form is the convention); it does not claim that every mapped limit is wrong on the platform, and the checker is not broadened to evaluate bounded expressions.

## Where the rest of pagination lives

This guide is about the *budget* of a dropdown. The protocol itself (cursor, offset, next URL), stop conditions, `mergeWithParent`, the time budget and trigger state are explained in [pagination-and-trigger-state](pagination-and-trigger-state.md). A raised request timeout does not raise the pagination or RPC ceilings; consult the component's own limit table instead of promoting a number seen in one example.

## Rationale

A user opens a dropdown; two minutes of crawling is not acceptable and the platform will cut the call at 40 seconds anyway. A bounded, predictable budget turns a possible timeout into a known, explainable truncation. This is a dropdown design; a search or list module that promises all matches must not silently drop records.

## Pitfalls

* Writing `{{pagination.page + 1}}` for a one-based provider. This skips page 2 (the value is already 2).
* A known-unbounded mapped `response.limit` where a limit is required, or a missing one on an options RPC that can exceed 500 items. The bound then depends on unchecked input or does not exist. An unknown bound needs evidence first. (A bounded mapped expression is not by itself a defect; the fixtures below use the literal form as convention.)
* Using the 150/50 figures as a validator for every RPC.
* Putting a `delay` between pages and forgetting it eats the 40 seconds.
* Fetching all pages for an RPC and filtering in IML when the provider supports a search parameter.
* Raising the budget because "the user has 800 projects". That is a UX problem, not a limit to bypass.

## Exceptions and applicability

* The budget guidance targets dropdown (options) RPCs; sweep other RPC roles but branch by role (see Limits versus advice). Search modules and polling triggers have separate documented limits and recommendations (a search does not need the 3×page ceiling).
* Providers that return a total or a next-URL token use a different pagination style; the "page counter" rule is for page-number APIs only.
* Epoch RPCs: same recommendation of 3 requests and 300 records or 3× page size.

## Evidence and limits

* Time, request and record limits: **documented requirement**.
* **Approval impact** ([Approval gating](../../../references/review-and-qa.md#2a-approval-gating)). A bounded option or dropdown RPC budget is the recommended design; its bounds and the 500-item output limit are advisory. A truncated budget is class (a) only when a search, list or trigger that promises all matching records silently drops them; a broken page progression (for example skipping pages or ignoring a documented next-page signal) is class (a) wherever it occurs.
* 3-request and 3×page-size budgets, the 300-500 range: **documented recommendation**.
* Consistency between page size, qs and limit in a fixture: **inferred implementation pattern**. The checker does not call a provider, measure latency or know any real page maximum.

## Fixtures

Static, synthetic teaching fixtures. The numbers in them illustrate the declared consistency rules; they are not provider caps and not a universal budget.

* Correct: [correct.json](../recipes/rpc-page-budget/correct.json): `qs.limit` equals the declared page size, records stay within pages × size, the one-based next page passes `{{pagination.page}}` unchanged, and `response.limit` is a fixed positive integer within the record budget.
* Incorrect, `CK-BUDGET-BOUND`: [limit-missing.json](../recipes/rpc-page-budget/incorrect/limit-missing.json). The RPC declares no `response.limit`, so the fixture has no declared total-output limit of its own. Platform ceilings on calls, records and time still exist (see the pagination limits above), but they are hard stops, not a configured output budget. For an options RPC, a limit is required when the endpoint can return more than 500 items.
* Incorrect, `CK-BUDGET-BOUND`: [limit-mapped.json](../recipes/rpc-page-budget/incorrect/limit-mapped.json). `response.limit` is a mapped expression with no declared bound, so in this fixture the bound depends on user input rather than being fixed. The fixture rule requires the conservative literal form; a mapped expression with a known upper bound is not claimed to be a platform defect.
* Incorrect, `CK-BUDGET-PAGE`: [page-plus-one.json](../recipes/rpc-page-budget/incorrect/page-plus-one.json). A one-based provider receives `pagination.page + 1`, but the value is already 2 for the second request, so page 2 is skipped.
* Incorrect, `CK-BUDGET-PAGE`: [page-size-mismatch.json](../recipes/rpc-page-budget/incorrect/page-size-mismatch.json). The request asks for a page size different from the declared budget, so the budget arithmetic no longer describes the real calls. The fixture does not say that 150 records or any other figure is a cap.

## Sources

* https://developers.make.com/custom-apps-documentation/component-blocks/api/pagination
* https://developers.make.com/custom-apps-documentation/best-practices/remote-procedure-calls
* https://developers.make.com/custom-apps-documentation/app-components/rpcs
* https://developers.make.com/custom-apps-documentation/app-components/rpcs/dynamic-options-rpc
* https://developers.make.com/custom-apps-documentation/app-components/rpcs/dynamic-sample-rpc
* https://developers.make.com/custom-apps-documentation/component-blocks/api/handling-responses/limit
* https://developers.make.com/custom-apps-documentation/component-blocks/epoch
