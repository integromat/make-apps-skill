# Pagination and polling-trigger state

Back to the [knowledge index](../README.md).

Two mechanisms decide how much data a module returns and what it returns next time: **pagination** (many requests inside one execution) and **trigger state** (what Make remembers between executions). Both can lose or repeat records without any visible error, so each needs a deliberate design and a test that exposes the edge. Budgets for dropdown RPCs are in [rpc-page-budgets](rpc-page-budgets.md); date parsing is in [dates-helpers](dates-helpers.md).

## Pagination

### Identify the provider's protocol first

Page number, offset, cursor, next URL, or a has-more flag. Advance it the way the provider defines it, and keep the provider's *request page size* separate from the *total records* the module exposes to the user.

**Documented behaviour.**

* `pagination.page` starts at 1 and counts the page about to be requested. Adapt it for zero-based providers or offsets.
* Pagination `qs` and `headers` merge with the parent request by default (`mergeWithParent`, default `true`) and override same-named entries, so the first request's filters and page size carry forward. `url`, `method` and a supplied `body` are different: each **replaces** the original value regardless of `mergeWithParent`; the body is never merged, so a continuation body must be the complete body the provider requires (filters and required fields included), not only the changed field. A `body` is only used for non-`GET` methods. Setting `mergeWithParent` to `false` means no `qs` or `headers` are merged and the pagination request is used directly, so it must then be a complete, usable continuation request. Overriding only the URL does not make inherited `qs` or `headers` disappear.
* Defaults stop paging when a page has zero records or when `response.limit` is reached. An explicit stop condition is therefore not mandatory for every paginator.
* A bigger `response.limit` fetches nothing extra unless pagination is working.
* The time and request budgets are shared: a pagination `delay` counts toward the call timeout, and the request timeout setting does not raise the pagination limits.

### When the defaults are not enough

Add an explicit condition when the provider repeats its last page, returns empty intermediate pages, or hands back an explicit cursor or has-more flag. A short page is not proof of exhaustion unless the provider guarantees it. With next-URL pagination, check where the URL points and what authentication the follow-up request carries.

Keep the iterated resource, selected fields, filters and response shape the same on later pages. Client-side filtering should be tested with eligible records on later pages; do not assume an undocumented order between filtering and the limit.

### Test the edges

Initial page, one continuation, final page, empty result, and a small total limit (smaller than one page). Use distinguishable test records and a tiny page size to reveal overlap or skipped records. The pagination debugging page describes how to inspect each request.

## Polling-trigger state

**Documented behaviour.** A polling trigger declares `type` (`id` or `date`), `order` (`asc`, `desc`, `unordered`), the identifier and, for date triggers, the date field. Make exposes the previous run's last date and last ID, so a trigger does not need to write them by hand; the absence of a manual assignment is not a missing-state defect. The **epoch** controls where the first run starts and what the user picks as the starting point, via an epoch RPC whose output carries a `label` and a `date`.

**Documented recommendation.** Retrieve newest first and declare `desc`: Make keeps only a bounded window of past records, so ascending or unordered scans of a busy account can miss recent data inside pagination limits.

**How to reason about exceptions.**

* A provider filter that bounds results *after* a previous ID or date changes the analysis. Confirm inclusivity and ordering instead of declaring every ascending trigger wrong.
* Row positions or unstable IDs may not follow creation order. Choose a field that does.
* Equal timestamps need an ID tie-breaker in the design.
* Updated, deleted and late-arriving records are separate cases; decide whether the trigger watches creation or modification and say so in the module description.
* Declared order must describe the order actually requested. A mismatch between the request's direction and `order` is a genuine inconsistency; a missing manual state assignment is not.

## Rationale

Pagination and trigger state both trade completeness against budget. Make's defaults pick safe stopping points; the author's job is to give the provider's real protocol, an honest order and a bounded limit, and to prove the behaviour at the boundaries where loops end.

## Pitfalls

* Adding one to `pagination.page` for a one-based provider and skipping page two.
* Assuming a short page ends the data, or that a larger `response.limit` can substitute for a working paginator.
* Disabling `mergeWithParent` and losing filters on page two.
* Supplying a pagination `body` that carries only the cursor and assuming the original body fields are merged in; a supplied body replaces the original one, with or without `mergeWithParent`.
* Requiring an explicit stop condition for every paginator, or imposing a universal three-request cap.
* Using ascending order against a busy provider because it is the provider's default.
* Reporting missing trigger state because no assignment of previous-run values appears.
* Changing a pagination field selection between pages.

## Exceptions and applicability

* Search and list modules, RPCs and triggers have separate limits and recommendations; do not transfer one component's ceiling to another.
* Providers without ordering use `unordered` and need other safeguards.
* Instant triggers do not paginate in their own communication ([webhooks](webhooks.md)).

## Evidence and limits

* Page counting, merge behaviour, default stop conditions, trigger state and epoch: **documented behaviour** (pagination, response limit and trigger pages).
* Newest-first ordering and the lost-window reason: **documented recommendation**.
* Provider cursor semantics, tie handling and exhaustion are provider facts; only execution against the provider and fresh pagination evidence show them.

## Sources

* https://developers.make.com/custom-apps-documentation/component-blocks/api/pagination
* https://developers.make.com/custom-apps-documentation/component-blocks/api/handling-responses/limit
* https://developers.make.com/custom-apps-documentation/component-blocks/api/handling-responses/iterate
* https://developers.make.com/custom-apps-documentation/debug-your-app/debugging-of-pagination-in-list-search-modules
* https://developers.make.com/custom-apps-documentation/app-components/modules/trigger
* https://developers.make.com/custom-apps-documentation/best-practices/trigger-modules
* https://developers.make.com/custom-apps-documentation/component-blocks/epoch
* https://developers.make.com/custom-apps-documentation/best-practices/modules/search-modules
