# Modules and pagination

Load this reference when choosing module behavior, mapping a response to bundles,
or implementing list/search pagination. Use [webhooks-and-polling.md](webhooks-and-polling.md)
for trigger state and [parameters-and-rpcs.md](parameters-and-rpcs.md) for field schemas.

## Choose behavior before generating files

| Requirement | Component and behavior |
| --- | --- |
| Create, update, delete, retrieve one object, upload, or download | Action: one output bundle; one or several requests. |
| Find or list multiple records | Search: one bundle per selected result; bounded iteration and pagination. |
| Discover new or updated records on a schedule | Polling trigger: persisted progress, ordering, and an Epoch configuration. |
| Receive provider events | Instant trigger linked to a real webhook definition. |
| Expose authorized arbitrary API requests | Universal module with an explicit URL/auth contract. |
| Return processed data to an incoming webhook request | Responder, not an ordinary outgoing API action. |

Do not impose search semantics on actions merely because a response contains an
array. An action can return a single collection containing an array. Conversely,
a list endpoint intended to produce multiple bundles needs search behavior.
Select component kinds using the current editor/tool schema, not a copied `typeId` table.

Sources: [Action](https://developers.make.com/custom-apps-documentation/app-components/modules/action.md),
[Search](https://developers.make.com/custom-apps-documentation/app-components/modules/search.md),
[Responder](https://developers.make.com/custom-apps-documentation/app-components/modules/responder.md).

## Establish the output contract

1. Record the exact method, path, request fields, success shape, error shapes, and
   pagination fields from the provider contract or sanitized observed responses.
2. For a search, point `response.iterate` at the actual array, not its envelope.
3. Set `response.output` from the iterated `item`, not the whole page's `body`.
4. Add a user-facing Limit and wire it to `response.limit`.
5. Keep the interface and sample aligned with **one emitted bundle**, not the
   complete provider response or a guessed generic `data` field.
6. Preserve provider field names where practical; transform only for an intentional
   output contract, dates, binary data, or other documented conversion.

`iterate` also supports `{ "container": "{{body.items}}", "condition": "..." }`
for per-item filtering. Prefer provider-side filters where available. Do not
reject this documented object form because an older example only uses a string.

Without iteration, output defaults to `body`; with iteration, it defaults to
`item`. Make the intended shape explicit when it is otherwise ambiguous.
In request chains, only the final output is the module result; the last request's
`response.limit` governs the chain, including its unlimited default when omitted.

Sources: [Iterate](https://developers.make.com/custom-apps-documentation/component-blocks/api/handling-responses/iterate.md),
[Output](https://developers.make.com/custom-apps-documentation/component-blocks/api/handling-responses/output.md),
[Limit](https://developers.make.com/custom-apps-documentation/component-blocks/api/handling-responses/limit.md).

## Keep page size separate from result limit

- Provider page size controls records requested in one HTTP call.
- `response.limit` controls the total records returned by a module execution and
  also participates in deciding whether another page is needed.
- Pagination stops on an empty iterated page or when `response.limit` is reached;
  add the provider's next-page condition rather than relying only on empty results.
- Choose a provider-supported page size; do not send the entire user limit as a
  page size when it exceeds the endpoint maximum.
- Verify small limits, limits spanning pages, and an empty first page.
- Do not promise an unbounded export: request counts, pagination counts, records,
  and execution time have platform limits, independent of the configured Limit.

Approval impact follows [Approval gating](review-and-qa.md#2a-approval-gating): pagination that loses records is an established failure only when shown; absent pagination metadata is not proved truncation (absent or non-advancing progression on documented paged responses is class (a)), a declared polling order is an assertion needing evidence, and an exact response-key mismatch differs from a likely typo inferred from siblings (an evidence gap).

Source: [Pagination specification and limits](https://developers.make.com/custom-apps-documentation/component-blocks/api/pagination.md).

### Reads that claim items take their batch size from the Limit

For an ordinary read, a fixed provider page size with `response.limit` is correct: records
beyond the Limit are simply not emitted, and the search best practice asks for the largest
page size. Sending a smaller page for a small Limit is an optional optimisation, never a
finding; if you do it, derive the offset step from the same expression as the page size.

A read that changes provider state is different: receiving from a queue, claiming or
leasing items, or marking them as read. `response.limit` trims the bundles only after the
provider has handed the items out, so a batch larger than the Limit hides the extra items
until a timeout, or consumes them, without any bundle carrying them. Send the smaller of the
Limit and the documented maximum as the batch size, for example
`{{min(ifempty(parameters.limit, 10), 10)}}` for a maximum of 10. Keep the `ifempty`
fallback, because a search Limit may be left empty to return everything.

Such a read often pages by re-sending the identical request, each call returning the next
items. A pagination block with nothing that changes per page is valid only for such a read;
on any other endpoint it fetches the first page again. When a claiming read pages, every
call claims a full batch, so the last one can claim more than the Limit leaves room for.
Either cap the Limit at the provider maximum and send one request, or size each later call by
the items still missing (count the items received so far in `response.temp`).

### Leave the Limit stop to `response.limit`

Do not re-implement the Limit inside `pagination.condition`: Make already stops paging
once `response.limit` items are collected. A condition such as
`{{pagination.page * 50 < parameters.limit}}` only adds risk, because `pagination.page` is
already the upcoming page, so it stops one page early (a Limit of 100 returns 50 records).
The same slip against a provider record total, `{{pagination.page * 50 < body.total}}`,
skips the last page; the records already requested are `(pagination.page - 1) * 50`. A page
size that appears only in the condition, and is not sent in the request, also depends on the
provider's default page size staying the same. Use the condition for the provider's own
signal (cursor, has-more flag, total), and test Limits of exactly one page, one page plus
one record, and two full pages.

## Page-number pagination

**`pagination.page` starts at 1 and advances automatically. After the first request,
it is 2 for the second request. Do not add an unconditional `+ 1`.**
For a zero-based provider page number, adapt with `pagination.page - 1`.

The following fragment assumes a fixture API with `items`, `totalPages`, `page`,
and `per_page`; substitute only fields confirmed for the target provider:

```json
{
  "qs": {"page": 1, "per_page": 100},
  "response": {
    "iterate": "{{body.items}}",
    "output": "{{item}}",
    "limit": "{{parameters.limit}}"
  },
  "pagination": {
    "qs": {"page": "{{pagination.page}}"},
    "condition": "{{body.totalPages >= pagination.page}}"
  }
}
```

The condition uses the upcoming page index, as in the SDK total-pages example.
Validate it against the provider's meaning of total pages, not a similarly named
record count. The fragment omits the endpoint and is not an upload-ready module.

Source: [Total pages and indexing](https://developers.make.com/custom-apps-documentation/component-blocks/api/pagination.md#total-pages).

## Offset, cursor, and next-link pagination

| Provider contract | Implementation decision |
| --- | --- |
| Offset and page size | Start at offset 0; compute `(pagination.page - 1) * pageSize`, using the same page size as the request. |
| Opaque next cursor | Copy the previous response's next cursor into the documented query or body field; stop when absent. |
| Full next-page URL | Use `pagination.url`; inspect query merging and allowed destination hosts before retaining credentials. |
| Boolean has-more flag | Use the flag as the stop condition and advance the provider's cursor or page separately. |
| Page-only API | Verify that exhaustion returns an empty array rather than repeating the last page forever. |

For a fixture page size of 100, the offset override is:

```json
{"pagination": {"qs": {"offset": "{{(pagination.page - 1) * 100}}"}}}
```

Do not fabricate a cursor from the last ID unless the provider defines that rule.
Keep opaque cursor bytes intact. Do not stop on a short page unless the provider
contract guarantees that it means exhaustion.

`pagination` belongs beside `url`, not inside `response`. Its default
`mergeWithParent: true` merges headers and query fields with the original request;
URL, method, and body overrides have their own replacement behavior. An alternate
pagination endpoint can require a different method or body; inspect it explicitly.

Source: [Pagination patterns and merging](https://developers.make.com/custom-apps-documentation/component-blocks/api/pagination.md).

### Cursor or next link in a response header

Some providers return the continuation in a response header instead of the body.
`headers` is available to the pagination `condition` and to the override fields, like
`body`. Read the header name in lower case, as it appears in a logged response, not in the
provider's capitalisation such as `headers.Link`. A hyphenated name needs backticks or
`get()`, because `{{headers.x-next-cursor}}` is evaluated as a subtraction.

~~~json
{"pagination": {
  "qs": {"after": "{{headers.`x-next-cursor`}}"},
  "condition": "{{headers.`x-next-cursor`}}"
}}
~~~

For a `Link` header, follow only the URL of the `rel="next"` entry, and let the condition
and the URL test the same relation:

~~~json
{"pagination": {
  "url": "{{replace(headers.link, '/^.*<([^>]+)>;\\s*rel=\"next\".*$/', '$1')}}",
  "condition": "{{contains(headers.link, 'rel=\"next\"')}}"
}}
~~~

A bare `contains(headers.link, 'next')` is also true when the word only appears inside
another link's URL, and `replace()` returns the whole header unchanged when its pattern does
not match, so the module then requests the header text as a URL. A custom function that
returns the next URL or nothing, used for both fields, avoids the mismatch. The next-URL
rules above (query merging, allowed destination hosts, retained credentials) still apply.

### Lookups by a list of IDs

An endpoint that returns the records for IDs the user supplies is not paginated: its result
size is set by the input. Providers usually cap the number of IDs per call and return no
cursor, so a call above the cap fails or drops IDs. Declare the documented cap on the input
array and state it in the help:

~~~json
{"name": "ids", "type": "array", "label": "IDs", "spec": {"type": "text", "label": "ID"},
 "validate": {"maxItems": 25}, "help": "Up to 25 IDs per run."}
~~~

Pagination does not lift the cap. Do not ask for a `pagination` block on such an endpoint;
an existing cursor block there never runs when no cursor is returned, and it only suggests
that the module handles more IDs than one call accepts.

## Universal and multi-request boundaries

A universal module is a deliberate coverage fallback, not proof of endpoint-specific
product completeness. Choose its scope rather than treating a local generator's
mandatory-universal convention as a platform law.

Define allowed hosts, version handling, relative-path help, methods, query fields,
and raw-body encoding. Preserve connection authorization when merging custom headers.
The documented REST universal output intentionally wraps `body`, `headers`, and
`statusCode`; a blanket rule against output wrappers would break that contract.

For read-before-write updates or asynchronous jobs, use the actual multi-request
contract in [requests-and-responses.md](requests-and-responses.md). A request chain,
pagination, and repeat polling solve different problems and are not interchangeable.

Sources: [REST universal module](https://developers.make.com/custom-apps-documentation/app-components/modules/universal-module/rest.md),
[Multiple requests](https://developers.make.com/custom-apps-documentation/component-blocks/api/multiple-requests.md).

## Current-knowledge guides

- Pagination protocols, merge and stop defaults, polling state and ordering:
  [pagination and trigger state](../examples/current-knowledge/guides/pagination-and-trigger-state.md).
- Relative-path boundary, REST and GraphQL conventions, inherited auth and scopes:
  [universal modules and scopes](../examples/current-knowledge/guides/universal-modules-and-scopes.md).
- Output shaping, interface honesty, omit, clear and set, partial versus replacing updates:
  [outputs, empty values and updates](../examples/current-knowledge/guides/outputs-empty-values-updates.md).
- Several writes in one module are not reported as partial success; classify requests by
  side effects and see the valid exceptions in
  [requests, files and multi-step](../examples/current-knowledge/guides/requests-files-multistep.md).

## Verification gate

- Exercise at least three pages; inspect the exact outgoing page or offset sequence.
- Assert no missing first/second page, duplicate boundary records, or repeated cursor.
- Check zero results, one result, a full final page, absent cursors, and user-limit truncation.
- Check stable provider sorting and behavior while records are inserted or removed.
- Compare every output bundle with the interface and sample; retain `false` and `0`.
- Distinguish fixture-based pagination checks from a real provider run. JSON parsing
  alone proves neither IML evaluation nor completeness against a changing dataset.
