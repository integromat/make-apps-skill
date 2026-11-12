# Pagination and polling-trigger state

Back to the [knowledge index](../README.md).

Two mechanisms decide how much data a module returns and what it returns next time: **pagination** (many requests inside one execution) and **trigger state** (what Make remembers between executions). Both can lose or repeat records without any visible error, so each needs a deliberate design and a test that exposes the edge. Budgets for dropdown RPCs are in [rpc-page-budgets](rpc-page-budgets.md); date parsing is in [dates-helpers](dates-helpers.md).

## Pagination

### Identify the provider's protocol first

Page number, offset, cursor, next URL, or a has-more flag. Advance it the way the provider defines it, and keep the provider's *request page size* separate from the *total records* the module exposes to the user.

**Documented behaviour and author-observed runtime behaviour.**

* `pagination.page` starts at 1 and counts the page about to be requested. Adapt it for zero-based providers or offsets.
* Pagination `qs` and `headers` merge with the parent request by default (`mergeWithParent`, default `true`) and override same-named entries, so the first request's filters and page size carry forward. `url` and `method` are different: each **replaces** the original value regardless of `mergeWithParent`. A supplied `body` is only used for non-`GET` methods. The [Pagination page](https://developers.make.com/custom-apps-documentation/component-blocks/api/pagination) says it overrides the original body, but the author-observed runtime behaviour with `mergeWithParent` at its default is a deep merge: when the original body and the pagination body are both collections (and the request `type` is `json`, `urlencoded` or `multipart/form-data`), the pagination body's keys are merged over the original body, so a continuation body holding only the page or cursor field keeps the first request's filters, page size and any body field inherited from Base. With that default, the pagination body replaces the original one only when either body is not a collection (a string, an array) or the type is something else; an array value inside the body is replaced, not concatenated. In those eligible merge cases, do not report a cursor-only or page-only pagination `body` as losing the original fields, and do not rewrite it into a full copy of the body, without a run that shows the fields missing on the second request. Setting `mergeWithParent` to `false` means no `qs`, `headers` or `body` are merged and the pagination request is used directly, so it must then be a complete, usable continuation request. Overriding only the URL does not make inherited `qs` or `headers` disappear.
* Defaults stop paging when a page has zero records or when `response.limit` is reached. An explicit stop condition is therefore not mandatory for every paginator.
* A bigger `response.limit` fetches nothing extra unless pagination is working.
* The time and request budgets are shared: a pagination `delay` counts toward the call timeout, and the request timeout setting does not raise the pagination limits.

### When the defaults are not enough

Add an explicit condition when the provider repeats its last page, returns empty intermediate pages, or hands back an explicit cursor or has-more flag. A short page is not proof of exhaustion unless the provider guarantees it. With next-URL pagination, check where the URL points and what authentication the follow-up request carries.

Keep the iterated resource, selected fields, filters and response shape the same on later pages. Client-side filtering should be tested with eligible records on later pages; do not assume an undocumented order between filtering and the limit.

Offset positions are not stable identities. When a record is created or deleted between two page requests, every later record shifts: in a newest-first list an insert pushes the last record of one page onto the next, so it is fetched twice, and a delete pulls a record into the range already fetched, so it is never fetched. A polling trigger may never return to that record, because it is older than the date saved after the run. Prefer a cursor, a next link or a filter bound by the saved date or ID when the provider offers one. With offsets, request a stable sort with a unique tie-breaker (date, then ID), and add a record created or deleted between two page requests to the edge tests.

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
* A request that sends no sort or direction parameter still declares an `order`; it then describes the provider's *default* order. Make uses the declared order to decide whether more pages are needed and how to sort what it emits, so that default has to be real. The trigger guidance accepts results that are "sorted or defaulted in descending order", so a missing sort parameter is not a defect when the provider documents a newest-first default. It is not proof of consistency either: a comparison of declared and requested direction has nothing to compare here, so check the provider documentation or a recorded response with several items. When the provider offers a sort parameter but documents no default order, send the sort explicitly in the declared direction; when neither is possible, declare `unordered`.

**Inferred implementation pattern: request the fields the trigger reads.** `trigger.id` must return each item's ID and, for a date trigger, `trigger.date` its date. When the module lets the user choose which fields the provider returns (a field list, `$select`, attributes), add the fields the trigger reads to a non-empty selection even if the user did not pick them; otherwise the provider leaves them out, the ID or date evaluates empty, and the item cannot be compared with the saved state. When the selection is empty and the provider then returns its default field set, confirm that set contains them. For a date trigger, use one field for the provider sort, any date filter, the forced field and `trigger.date`, so that the declared order describes the field Make compares; when the user chooses what to watch (for example created or updated), derive all of them from that one parameter.

```json
{
  "qs": {
    "fields": "{{if(length(parameters.fields), join(distinct(add(parameters.fields, 'id', parameters.watchBy)), ','), undefined)}}",
    "sort": "-{{parameters.watchBy}}"
  },
  "response": {
    "trigger": {
      "type": "date",
      "order": "desc",
      "id": "{{item.id}}",
      "date": "{{get(item, parameters.watchBy)}}"
    }
  }
}
```

**Documented recommendation: bound the request with the saved state.** Where the provider can return only records after a date or numeric ID, pass `data.lastDate` or `data.lastId` into that filter instead of asking the user for fixed dates; an interval API takes `data.lastDate` as the start and `{{now}}` as the end. Still request newest first where the provider allows it. Where it does not, the bound is what keeps an ascending or unordered trigger workable within the 3200-record limit, because it reduces the records fetched. In a request, `{{data.lastDate}}` is sent as ISO 8601 text in UTC with milliseconds (`1970-01-01T00:00:00.001Z`), which the trigger page does not state, so check a run's request log; convert it only when the provider's filter expects another unit or precision, for example Unix seconds with `formatDate(data.lastDate, 'X')`. Prefer an inclusive bound (`since`, `gte`): the trigger returns only unprocessed items (it compares each item with the saved date and ID), so the boundary record is not emitted twice, while an exclusive bound at second or day precision can lose records that share the boundary timestamp.

**Documented behaviour: there is no empty start date.** The **Choose where to start** options all send a date in `data.lastDate`: the current date (From now on), the given date (Since specific date), the chosen item's date (Choose manually) or the default `1970-01-01` (All). A trigger run with no saved date receives the Unix epoch start `1970-01-01T00:00:00.001Z` (not stated on the trigger page; confirm in a run), also when the trigger has no epoch. On an `id` trigger `data.lastDate` stays at that start across runs (not stated on the trigger page; confirm in a run), so bound an `id` trigger by `data.lastId`. A truthiness test such as `{{if(data.lastDate, ..., fallback)}}` is therefore not a first-run test, and a fallback window (for example "the last 24 hours") never runs in trigger executions; the user's start choice, or the epoch start when the trigger has no epoch, is the first-run policy. When the provider rejects so old a bound, test for the epoch start explicitly and omit the filter, which still means "all records". Compare the year, not an exact value: formatted in a zone west of UTC, the start falls in 1969. For a provider whose filter takes Unix seconds:

```json
{
  "qs": {
    "updated_since": "{{if(formatDate(data.lastDate, 'YYYY') <= '1970', undefined, formatDate(data.lastDate, 'X'))}}",
    "sort": "-updated_at"
  },
  "response": {
    "trigger": { "type": "date", "order": "desc", "id": "{{item.id}}", "date": "{{item.updated_at}}" }
  }
}
```

## Rationale

Pagination and trigger state both trade completeness against budget. Make's defaults pick safe stopping points; the author's job is to give the provider's real protocol, an honest order and a bounded limit, and to prove the behaviour at the boundaries where loops end.

## Pitfalls

* Adding one to `pagination.page` for a one-based provider and skipping page two.
* Assuming a short page ends the data, or that a larger `response.limit` can substitute for a working paginator.
* Disabling `mergeWithParent` and losing filters on page two.
* Reporting or rewriting a cursor-only or page-only pagination `body` as dropping original fields when `mergeWithParent` is at its default, both bodies are collections and the request `type` is `json`, `urlencoded` or `multipart/form-data`. In those eligible cases the author-observed behaviour is a merge; with `mergeWithParent: false`, a non-collection body or another request type, the continuation body replaces the original.
* Requiring an explicit stop condition for every paginator, or imposing a universal three-request cap.
* Using ascending order against a busy provider because it is the provider's default.
* Reporting missing trigger state because no assignment of previous-run values appears.
* Changing a pagination field selection between pages.
* Letting a user-selected field list leave out the field that `trigger.id`, `trigger.date` or the provider sort reads.
* Using `{{if(data.lastDate, ...)}}` as a first-run test, or overriding the user's **Choose where to start** choice with a fallback window; in a trigger run `data.lastDate` always carries a date, the Unix epoch start when nothing was saved or All was chosen.
* Accepting or rejecting a trigger that sends no sort parameter without checking the provider's documented default order.
* Offset paging over a list that changes during the run without a stable sort and a test that creates or deletes a record between pages.

## Exceptions and applicability

* Search and list modules, RPCs and triggers have separate limits and recommendations; do not transfer one component's ceiling to another.
* Providers without ordering use `unordered` and need other safeguards.
* Instant triggers do not paginate in their own communication ([webhooks](webhooks.md)).

## Evidence and limits

* Page counting, `qs`/`headers` merging, default stop conditions, trigger state and epoch: **documented behaviour** (pagination, response limit and trigger pages).
* Collection-body deep merging for eligible request types and replacement of array values: **author-observed runtime behaviour**, contrary to the Pagination page's body-replacement wording; not established by that published page or by static checks.
* Newest-first ordering and the lost-window reason: **documented recommendation**.
* Provider cursor semantics, tie handling and exhaustion are provider facts; only execution against the provider and fresh pagination evidence show them.
* Bounding the request with `data.lastDate` or `data.lastId` (with `{{now}}` as an interval end), the dates sent by the **Choose where to start** options including `1970-01-01` for All, the trigger returning only unprocessed items, and acceptance of a documented descending default: **documented recommendation** and **documented behaviour** (trigger best practices and trigger pages).
* The Unix epoch start in `data.lastDate` when no date was saved, its ISO 8601 UTC serialisation in a request, and `data.lastDate` staying at that start on an `id` trigger: **not documented**: not stated on the trigger page, so confirm them in a run's request log before relying on them.
* Requesting the fields the trigger reads, one field for sort, filter and `trigger.date`, the year test for the epoch start, and offset shifts under inserts and deletes: **inferred implementation pattern** from the documented trigger and pagination semantics; whether a provider's offsets shift, and its default order, are provider facts to check against its documentation or a recorded run.

## Sources

* https://developers.make.com/custom-apps-documentation/component-blocks/api/pagination
* https://developers.make.com/custom-apps-documentation/component-blocks/api/handling-responses/limit
* https://developers.make.com/custom-apps-documentation/component-blocks/api/handling-responses/iterate
* https://developers.make.com/custom-apps-documentation/debug-your-app/debugging-of-pagination-in-list-search-modules
* https://developers.make.com/custom-apps-documentation/app-components/modules/trigger
* https://developers.make.com/custom-apps-documentation/best-practices/trigger-modules
* https://developers.make.com/custom-apps-documentation/component-blocks/epoch
* https://developers.make.com/custom-apps-documentation/best-practices/modules/search-modules
