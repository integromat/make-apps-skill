# Webhooks and polling

Load this reference when implementing event delivery, webhook lifecycle operations,
webhook responses, or scheduled change detection. Use [base-and-connections.md](base-and-connections.md)
for authentication and [modules-and-pagination.md](modules-and-pagination.md) for paging.

## Choose the event contract

| Provider capability | Make component |
| --- | --- |
| Per-account registration and deletion endpoints | Attached dedicated webhook plus linked instant trigger. |
| Manual callback URL registration only | Non-attached dedicated webhook plus setup instructions and instant trigger. |
| One developer-registered callback for all users | Shared webhook with connection-based recipient matching. |
| No webhook, but ordered change/list API | Polling trigger with progress and Epoch behavior. |

A URL registered under each user's account is dedicated even if it receives all
that account's event types. Do not call it shared merely because one URL handles
several events. Do not invent attach/detach endpoints from a provider's event names.

Sources: [Webhook types](https://developers.make.com/custom-apps-documentation/app-components/webhooks.md),
[Dedicated webhooks](https://developers.make.com/custom-apps-documentation/app-components/webhooks/dedicated.md).

### Callback URL sent with each job request

Some providers have no subscription endpoint. Instead, each job-creating request
accepts a callback URL, and the provider posts the result there when the job ends.
Model this as manual registration:

- Use a non-attached dedicated webhook (no attach or detach) and an instant trigger.
  Make generates the address when the user creates the webhook in that trigger. The job
  module does not receive that address, so it offers an optional URL field for it. The
  field's help names the watch module whose address belongs there, and the trigger's
  banner explains the same pairing.
- If the job module also offers a mode that waits for the result with
  [bounded asynchronous polling](requests-and-responses.md#bounded-asynchronous-polling-with-repeat),
  do not send the callback URL in that mode, or the result reaches both the module and
  the watch module. Say in help that the waiting mode does not start the watch module.

Source: [Manual registration](https://developers.make.com/custom-apps-documentation/app-components/webhooks/dedicated/not-attached.md).

## Implement attach and detach together

1. Link the instant trigger to the intended webhook definition and connection.
2. Register `webhook.url` using the documented provider method, event list, and scope.
3. Persist the returned remote subscription ID under `response.data`.
4. Read that saved field through `webhook.*` in detach; do not confuse it with
   Make's internal `webhook.id`.
5. Persist only other values actually needed later, such as a provider verification token.
   Sanitize secret values and avoid exposing them as ordinary event output.
6. Define cleanup against the exact remote subscription created by attach.
   Do not delete an account-wide subscription without verifying its ownership.
7. Test failed registration, repeated setup, and already-removed subscriptions according
   to the provider's behavior. Do not turn all HTTP errors into success to hide failures.

Reusable attach persistence fragment:

```json
{"response": {"data": {"externalHookId": "{{body.id}}"}}}
```

The detach path uses `{{webhook.externalHookId}}`. Its method and endpoint still
come from the provider contract; the saved field name is only an app convention.
For manual registration, omit fictitious lifecycle requests and explain where to
paste the generated URL. Add a connection only when authentication, RPCs, or event
enrichment requires one.

Sources: [Attached webhook lifecycle](https://developers.make.com/custom-apps-documentation/app-components/webhooks/dedicated/attached.md),
[Manual registration](https://developers.make.com/custom-apps-documentation/app-components/webhooks/dedicated/not-attached.md).

## Process incoming data at the correct layer

Webhook communication uses top-level `verification`, `respond`, `condition`,
`iterate`, `output`, and, for shared routing, `uid`. Do not wrap these directives
inside an HTTP request's `response` object simply because an action uses that shape.

- Use `body`, `headers`, `query`, and `method` for the incoming webhook request.
- Separate challenge verification from ordinary events with `verification.condition`.
  Set the exact verification response status, encoding, headers, and body.
- Use `condition` for documented event filtering. For batched event payloads, use
  webhook iteration and output; do not place that iteration in instant-trigger communication.
- Validate the provider's event-authentication mechanism separately from the challenge.
  A successful challenge is not proof that later deliveries are authentic.
- Verify signature algorithms, timestamp/replay rules, and raw-byte requirements before
  claiming verification works. If required data or primitives are unavailable, report
  the limitation rather than inventing an unsigned substitute.
- Treat duplicate delivery as possible. Preserve a useful event ID and document the
  deduplication responsibility; do not promise exactly-once processing from HTTP delivery.

An instant trigger can optionally make **one** enrichment request for each webhook
item, using `payload.*`. Its communication does not support iteration or pagination.
After that request, `body` is the enrichment response, not the original webhook body.

Sources: [Webhook communication](https://developers.make.com/custom-apps-documentation/app-components/webhooks.md),
[Instant-trigger constraints](https://developers.make.com/custom-apps-documentation/app-components/modules/instant-trigger.md).

## Acknowledgment, responder, and shared routing

Use webhook `respond` for the immediate protocol acknowledgment. Use a Responder
module when processed scenario data must be returned to the caller; it has no
output interface and its communication uses `response` to describe the reply.
Do not confuse either mechanism with an outbound API call to the provider.

Shared webhooks require a connection and matching non-secret remote-account IDs:
connection `response.uid` identifies the account; webhook `uid` extracts the same
identity from the event. Never substitute a credential, one constant for all users,
or an unrelated tenant field. Verify cross-account isolation explicitly.

The SDK guide requires publishing the app to activate shared-webhook listening.
Treat publication and provider registration as separate approval-bound side effects,
not automatic consequences of writing or uploading a webhook definition.

Sources: [Responder](https://developers.make.com/custom-apps-documentation/app-components/modules/responder.md),
[Shared webhook routing and activation](https://developers.make.com/custom-apps-documentation/app-components/webhooks/shared.md).

## Polling progress, ordering, and deduplication

Use `response.trigger`, not an invented `response.state`/`state.lastCheck` protocol.
The trigger manages progress using the record's identity and, when present, date.

- Set `type: "date"` for creation/update timestamps; `id` remains required.
- Use `type: "id"` only when the provider's IDs support the intended ordered progress.
  Do not assume opaque UUIDs or a loosely sorted list provide a valid change cursor.
- Set `order` to the provider's actual `asc`, `desc`, or `unordered` response order.
  Prefer requesting descending order where supported, as the SDK recommends, to
  avoid exhausting the record ceiling before reaching the latest records.
- For date triggers, Make sorts by date and ID and emits unprocessed items in
  ascending order. Preserve timestamp precision and a stable identity for ties.
- Use `data.lastDate` and `data.lastId` only with the provider's documented filtering
  semantics. Avoid strict time boundaries that discard other records sharing a timestamp.
- Include the actual array, output item, result limit, and pagination when supported.

Response fragment for records with an ISO-compatible `created` field:

```json
{
  "response": {
    "iterate": "{{body.users}}",
    "output": "{{item}}",
    "limit": "{{parameters.limit}}",
    "trigger": {
      "id": "{{item.id}}",
      "date": "{{item.created}}",
      "type": "date",
      "order": "desc"
    }
  }
}
```

Use the actual change field for an updated-record trigger. Parse non-standard dates
with an appropriate IML conversion; do not manufacture timestamps to mask missing data.

Source: [Polling trigger contract](https://developers.make.com/custom-apps-documentation/app-components/modules/trigger.md).

### Polls that change provider state

Some sources change state when they are read. A queue receive can hide each item
for a lease period, and a list option can mark fetched items as read or processed.
Classify such a trigger request as a write, as
[requests and responses](requests-and-responses.md#independent-writes-in-one-module)
does for any request with side effects, not as a plain read.

- The epoch inherits the trigger's request, so each opening of **Choose where to start**
  also leases or marks the items it lists. Where the provider documents one, override
  the epoch request with a non-claiming variant, such as a zero lease or a peek.
- Make restores its saved trigger progress after a failed run, but not the provider-side
  change. A leased item stays hidden until its lease expires, an item marked as read no
  longer matches a filter on unread items, and an item that returns with a date older
  than the saved progress is skipped by a date trigger. No module reports an error.
- Make chooses the items to emit only after the trigger's requests have run: it drops
  items already covered by the saved progress, sorts, and applies the limit. A marking
  flag on the list request therefore also marks items that Make drops or holds back for
  a later run, and a follow-up request inside the trigger cannot know which items were
  emitted. Prefer a separate action module that marks or acknowledges items after the
  scenario has processed them. Keep any built-in marking option off by default and say
  in help what it changes.
- When the lease length is a parameter, give it a safe default within the provider's
  documented range, and say in help that retrieved items stay hidden for that time and
  come back unless they are deleted or acknowledged.

Sources: [Epoch inheritance](https://developers.make.com/custom-apps-documentation/component-blocks/epoch.md),
[Polling trigger contract](https://developers.make.com/custom-apps-documentation/app-components/modules/trigger.md).

## Current-knowledge guides

- Date-only, time-only and unknown-timezone values, trigger order and helper tracing:
  [dates and helpers](../examples/current-knowledge/guides/dates-helpers.md).
- Attach/detach identity, challenge vs signature verification, acknowledgments:
  [webhooks](../examples/current-knowledge/guides/webhooks.md).

## Epoch and verification gate

Epoch controls the starting point, not a separate polling implementation. Its
request overrides merge with trigger communication; output only `label` and `date`
for the selection list, with a bounded result limit. Date and ID triggers expose
different starting options; test the options appropriate to the selected trigger.

- Test first run, chosen start, no new records, restart, ties, and updates to an existing ID.
- Test multiple pages and a backlog exceeding one execution's Limit; verify no gaps
  or repeated old records before claiming reliable progress.
- Test webhook challenge, genuine event, invalid signature, batched payload, duplicate
  delivery, enrichment failure, and detach without affecting unrelated subscriptions.
- Separate fixture tests from authenticated provider delivery and scenario execution.
  A linked trigger and successful upload do not prove registration or receipt.

Source: [Epoch inheritance and output](https://developers.make.com/custom-apps-documentation/component-blocks/epoch.md).

### Epoch overrides and the dates users pick from

The epoch request is the trigger's request plus the epoch's overrides, so review the
two files together rather than the epoch alone.

- Put an override where the trigger actually sends that value. When the trigger posts
  its query in `body`, an epoch override in `qs` does not replace it. The epoch still
  sends the inherited body, now with an extra query parameter. The provider, not the
  epoch, then decides which query runs, so an intended override (a smaller field set or
  page size) can be silently ignored.
- Map `output.date` from the same field and conversion as `trigger.date`. The start
  point a user picks comes from the inherited `response.trigger` values, so a date from
  another field (such as a creation date on an update trigger) shows the user a different
  timeline from the one the cursor follows.
- Check that `label` and `date` read fields the iterated items really contain. Blank
  labels or missing dates in the panel mean the epoch maps names the response lacks.

~~~json
{
  "response": {
    "limit": 300,
    "output": {
      "label": "{{item.title}}",
      "date": "{{parseDate(item.updatedAt, 'X')}}"
    }
  }
}
~~~

The fragment assumes a trigger whose `trigger.date` is
`{{parseDate(item.updatedAt, 'X')}}` and whose items carry `title`. Copy the
trigger's expression rather than retyping it.

Sources: [Epoch inheritance and output](https://developers.make.com/custom-apps-documentation/component-blocks/epoch.md),
[Trigger best practices](https://developers.make.com/custom-apps-documentation/best-practices/trigger-modules.md).

### A trigger that still matches the starter template

A new trigger module can start from an editor template. The template requests a
placeholder `/users` list, iterates `body.users`, uses `item.id` and `item.created` for
the trigger, has an epoch that labels items with `item.name` and dates them with
`item.created`, a user-shaped interface (`id`, `email`, `name`, `created`), empty
samples and tutorial comments. It is easy to leave all of this in place under a
resource-specific label. It is also easy to adapt the request but keep the template's
epoch field names. Either way the module uploads and validates, then returns the
wrong resource or blank **Choose where to start** entries.

When reviewing a trigger, confirm that these all describe one resource and one field
set: the module label and description, `url`, `response.iterate`, `trigger.id` and
`trigger.date`, the epoch `output`, the interface and samples, and `scope`. Leftover
template comments are a prompt for this check, not a defect on their own. The response
fragment under polling progress uses the same placeholder names, so a trigger that
matches it still needs provider evidence. A visible module with this mismatch is the
functional label mismatch described in [review sweeps](review-sweeps.md), a class (a)
defect under [Approval gating](review-and-qa.md#2a-approval-gating): fix it when the
provider documentation determines the resource and fields; otherwise report an
unverified advisory finding that names the missing fact. Treat hidden or retired modules
as [Leftover editor-template modules](review-and-qa.md#leftover-editor-template-modules)
describes; one leftover template module does not make the app trash.

Source: [Epoch inheritance and output](https://developers.make.com/custom-apps-documentation/component-blocks/epoch.md).
