# lemlist — Basic-auth API key, RPC-backed selectors, offset pagination and an instant trigger

A **normalized, anonymized reference export** of a lemlist custom app. Every section the export contained is retained: base, connection, 10 modules, 1 RPC, 1 webhook, groups and install files. This app has no helper functions. It is reading material for Make app patterns. It is **not** a certified standalone package, not a tested deployment, and not the result of any live or authenticated validation. Samples are retained as data and nothing was executed during this curation.

Back to the [app examples index](../README.md).

## How to read this export

The folder is the platform's normalized export layout, not an SDK project. Each module directory holds `api.json` (communication), `expect.json` (mappable input fields), `parameters.json` (static parameters), `interface.json` (output fields), `samples.json` and `metadata.json`. RPC, webhook and connection directories follow the same idea. Start with [`metadata.json`](metadata.json), then [`base.imljson`](base.imljson), then one module.

| Item | Value (from [`metadata.json`](metadata.json)) |
| --- | --- |
| App name / label | `lemlist` |
| `version` | 1 |
| `rev` | 5 |
| `versionFull` | 1.1.0 |
| `manifestVersion` | 2 |
| Connection | `lemlist`, type `basic`, rev 3 ([metadata](connections/lemlist/metadata.json)) |

`version: 1` is Make's app version. It is unrelated to any provider API version, and the source routes carry no numeric version segment (see "API version").

## Learning objectives

1. **Basic auth with an empty user name.** [`base.imljson`](base.imljson) builds `Basic base64(':' + apiKey)`, masks the `authorization` header in logs and maps status codes 400 to 503 to readable messages. The [connection check](connections/lemlist/api.json) calls a team endpoint with its own header and also masks it.
2. **One endpoint, two roles.** [`modules/listCampaigns`](modules/listCampaigns/api.json) lists campaigns as module output. [`rpcs/listCampaigns`](rpcs/listCampaigns/api.json) calls the same route to fill a selector with `label`/`value` pairs.
3. **RPC-backed selectors.** [`addALeadInACampaign`](modules/addALeadInACampaign/expect.json), [`deleteALead`](modules/deleteALead/expect.json), [`exportStatisticsOfACampaign`](modules/exportStatisticsOfACampaign/expect.json) and the [webhook parameters](webhooks/lemlist/parameters.json) all use `rpc://app%23lemlist@1/listCampaigns`, an app-qualified reference that pins this app's version 1.
4. **Local output cap versus provider paging.** The campaign module caps output with `response.limit` and does not paginate. [`listUnsubscribes`](modules/listUnsubscribes/api.json) adds an offset step. Section "Hypotheses" separates what the source shows from what the provider does.
5. **Instant trigger lifecycle.** [`watchEmails`](modules/watchEmails/metadata.json) names hook `lemlist`. [`attach.json`](webhooks/lemlist/attach.json) registers the callback and stores the returned id as `externalHookId`; [`detach.json`](webhooks/lemlist/detach.json) deletes by that id; [`update.json`](webhooks/lemlist/update.json) is `null`; [`api.json`](webhooks/lemlist/api.json) outputs `{{body}}`, the request body as the platform provides it.
6. **Binary output.** [`exportStatisticsOfACampaign`](modules/exportStatisticsOfACampaign/api.json) chooses between two routes with an `if(...)` suffix and returns the response as a binary file named `file.csv`.
7. **Key/value collections.** [`addALeadInACampaign`](modules/addALeadInACampaign/api.json) spreads a `customFields` array into the request body with `toCollection`. [`makeApiCall`](modules/makeApiCall/api.json) does the same for headers and query string.

## Setup and permissions

- A lemlist account and its API key. The connection help text links to the provider's integrations page. The key is sent as the password half of a Basic authorization header. The public Authentication page, <https://developer.lemlist.com/api-reference/getting-started/authentication.md>, says the same: HTTP Basic, an always-empty login, the API key as password, a leading colon before the key, and the key generated under Settings, Integrations (it is shown only once). The source's `Basic base64(':' + apiKey)` matches that description.
- Which campaigns, leads and unsubscribes a key can reach depends on the account and its team. This export does not establish those limits.
- The trigger registers a webhook at the provider through `POST /hooks` with the Make-generated callback URL, and removes it through `DELETE /hooks/{id}`. The public Delete Webhook page, <https://developer.lemlist.com/api-reference/endpoints/webhooks/delete-webhook.md>, matches the delete route and records that the API key's user must have the "Edit integrations" permission, otherwise the request fails with `403` and the webhook is kept. Whether the account's plan allows webhooks, and the permission needed to create one, were not established here.
- During this curation nothing was connected to a real lemlist account.

## Inventory and dependency closure

| Component | Count | Notes |
| --- | --- | --- |
| Modules | 10 | Groups in [`groups.json`](groups.json): Email (`watchEmails`, an instant trigger), Campaign (2), Lead (3), Unsubscribe (3), Other (`makeApiCall`). |
| RPCs | 1 | `listCampaigns`. |
| Webhooks | 1 | `lemlist` (label "Email"). `update.json` is `null`. |
| Connections | 1 | `lemlist`. |
| Functions | 0 | No `functions` directory. There are no helpers or helper tests. |
| Samples | 10 | Every module `samples.json` contains only `null`. |
| Files | 77 | All 77 are JSON-format files; see "Static checks". |

Reviewer text search over the export found:

- Four `rpc://` references (three module `expect.json` files and the webhook `parameters.json`). All name `listCampaigns`, which is exported.
- `watchEmails` has `hookName: "lemlist"` and `accountName: null`; the nine other modules have `accountName: "lemlist"`. The webhook has `accountName: "lemlist"`. No `altAccountName` or `aliasTo` is set anywhere, so no alias points at a component missing from the export.
- [`installSpec.json`](installSpec.json) is `[]`; the connection has a single `apiKey` field.

Not shown: the platform's behavior when this folder is uploaded, components that exist in the original app but were not exported, and runtime resolution of IML expressions. Closure is "no gap found by static reading", not "verified deployable".

## API version and matching public documentation

| Aspect | Source | Current public documentation |
| --- | --- | --- |
| Host and base path | `https://app.lemlist.com/api` (the [base](base.imljson), the [connection check](connections/lemlist/api.json) and the absolute URL in [`makeApiCall`](modules/makeApiCall/api.json)) | `https://api.lemlist.com/api` |
| Numeric version segment | None | None |
| OpenAPI document | Not present | `openapi: 3.0.0` (OpenAPI format), `info.version: 1.0.0` (document version) |
| Campaign list `version` query | Not sent by the module or the RPC | Current `/campaigns` docs advise `version=v2`; the schema lists `v2` as the default |

- **Host drift.** The source host differs from the host in current documentation. This is classified as version/host drift, not as a defect: current documentation does not show that the older host stopped working, and nothing was requested. The host was left unchanged.
- **Different "versions".** `info.version: 1.0.0` is the version of the OpenAPI document, not a `/v1` API that this source used, and `openapi: 3.0.0` names the OpenAPI format the document is written in. Neither is a provider API version the source pins. The source routes are unversioned (no numeric path segment), the campaigns `version=v2` query is a separate current-documentation parameter that the source does not send, and the source has **no dated or numbered API pin**.
- **Current is not historical.** The pages below describe the provider today. They are not proof of the API as it was when this app was exported.

Public documentation used (current pages retrieved as markdown, so not historical contracts):

- [Authentication](https://developer.lemlist.com/api-reference/getting-started/authentication.md): Basic authentication with an empty login and the API key as password; its `curl` example uses `https://api.lemlist.com/api/{endpoint}`.
- [Delete webhook](https://developer.lemlist.com/api-reference/endpoints/webhooks/delete-webhook.md): `DELETE /hooks/{hookId}`; `200` returns the deleted webhook object; `403` when the API key's user lacks the "Edit integrations" permission, in which case the webhook is kept; `404` when not found. Its embedded API introduction also states a rate limit of 20 requests per 2 seconds per API key and shows `https://api.lemlist.com/api/team` as an authentication example; the response schema of `/team` was not retrieved.
- [Get many campaigns](https://developer.lemlist.com/api-reference/endpoints/campaigns/get-many-campaigns.md): paginated list with `offset`, `limit` (default 100, maximum 100) and `page`, plus the `version=v2` warning.
- [Get many unsubscribes](https://developer.lemlist.com/api-reference/endpoints/unsubscribes/get-many-unsubscribes.md): labelled legacy, integer `offset` and `limit`, default limit 100 and no stated maximum. A newer "unsubscribed variables" API is a separate contract and is not used here.
- [Add webhook](https://developer.lemlist.com/api-reference/endpoints/webhooks/add-webhook.md): optional `secret` that is sent back as a `secret` field in the JSON body of each webhook call.

Not matched to any retrieved page: the lead routes, the campaign export routes, the `POST /hooks` request fields, and the response schema of `/team`. Those source routes are described here only as written in the export; no completeness of this list of pages is claimed.

## Static checks actually performed

The final static check of this folder passed with no errors. It covered strict JSON parsing, source comparison, relative-link resolution and a private-path marker search; imported code and samples stayed data and were not executed.

- All 77 original source files were retained and none were removed; the only added file is this `README.md` (78 files in the folder).
- All 77 source files are JSON-format (including `base.imljson`) and all parsed strictly with no errors.
- The source comparison against the original found one delta, the `apiKey` type change listed under "Public changes", which is an allowed credential-input change, and no other difference.
- Every relative link in the README resolved, and no private-path markers were found.

Reviewer reading of the source (text search, no execution) produced the observations in this README.

**Not performed, and not claimed:** Make schema/import validation, any call to lemlist or Make, and any runtime check of IML expressions. There are no helpers to execute.

## Retained data limitations

- All 10 samples are `null`; no captured provider response exists in this folder, and `interface.json` output fields were not compared with a live response.
- [`metadata.json`](metadata.json) has `docs: null` and `description: null` as exported.
- Field placement differs between two similar modules. The `limit` input of [`listCampaigns`](modules/listCampaigns/expect.json) is in `expect.json` (mappable), while the `limit` input of [`listUnsubscribes`](modules/listUnsubscribes/parameters.json) is in `parameters.json` (static). Both default to 10. This is noted as an observation, not a defect.
- [`makeApiCall`](modules/makeApiCall/api.json) uses an absolute URL. Whether the base `authorization` header is applied to it follows platform behavior that was not tested here.
- The webhook callback URL is sent to the provider in the `targetUrl` field of [`attach.json`](webhooks/lemlist/attach.json). That request body is not in a log-masking list; this is an observation and was left unchanged.

## Hypotheses

Statuses: **confirmed** (shown by source plus documented semantics), **not reproduced** (no support found), **unresolved** (needs runtime or provider evidence). No status below is a live test result.

| # | Hypothesis | Status | Evidence and limits |
| --- | --- | --- | --- |
| 1 | The source host differs from the currently documented host. | **Confirmed** (as drift) | [`base.imljson`](base.imljson) uses `app.lemlist.com/api`; current documentation uses `api.lemlist.com/api`. |
| 2 | The older host no longer works. | **Not reproduced** | No evidence either way. Documentation naming a new host does not show the old one fails. No request was made. |
| 3 | The campaign module and RPC do not paginate and send no `limit`, `offset`, `page` or `version`. | **Confirmed by static reading** | Neither [module](modules/listCampaigns/api.json) nor [RPC](rpcs/listCampaigns/api.json) has a `pagination` section or any of those query parameters; both call `/campaigns` on the historical `app.lemlist.com` host once per run. |
| 3b | Because of that, a campaign list is truncated at 100 items. | **Unresolved** | Current docs describe a paginated route (default and maximum `limit` of 100) and a `version=v2` warning. Whether the route behaved that way at export time, and whether a single unversioned request on the historical host returned at most 100 items, is not established. Missing pagination is confirmed (row 3); actual truncation needs provider evidence for the route as it behaved then. |
| 4 | The module's local `limit` can reach beyond the first provider page. | **Not reproduced** | `response.limit` only caps items already returned by one request. It cannot fetch later pages. The default of 10 caps output at 10 by the module's own setting. |
| 5 | The RPC `limit` of 500 gives complete selector lists. | **Unresolved** | `response.limit: 500` in [`rpcs/listCampaigns`](rpcs/listCampaigns/api.json) is a local cap on one response. If the available campaigns span more than one provider page, a single request does not fetch the later pages, so that cap cannot make the list complete. Whether the current `v2` page size of 100 applied to the historical route is unresolved, so no claim is made that the selector lists are complete or incomplete. |
| 6 | Omitting `version=v2` changes the campaign response. | **Unresolved** | Current docs carry a `v2` warning and default; the source sends no `version` and uses the historical host. How the older unversioned route behaved is not established. |
| 7 | `listUnsubscribes` sets `limit` and advances `offset` with different numbers. | **Confirmed by static reading** | [`api.json`](modules/listUnsubscribes/api.json) sends `limit={{parameters.limit}}` on every page but steps `offset` by `min(parameters.limit, 100)`. They match when the limit is 100 or less. |
| 8 | That mismatch returns duplicate rows. | **Unresolved** | Overlap occurs only if the provider honors a limit above 100 on each page. Current docs state no maximum, so neither a cap nor overlap is proved. Completeness was not validated. |
| 9 | Webhook callbacks are not verified by this source. | **Confirmed absent in source; effect unresolved** | [`attach.json`](webhooks/lemlist/attach.json) does not send a `secret` and [`api.json`](webhooks/lemlist/api.json) outputs `{{body}}`, the request body as provided, with no check; `{{body}}` is not evidence of exact raw request bytes. Current docs describe an optional shared secret that is echoed as a `secret` field in the JSON body of each call: a shared-password check, not a signature or HMAC. The source omits it. When the option was introduced, and whether historical or platform-level protection of the callback URL exists, were not verified. The claim "lemlist has no mechanism" is not made. |
| 10 | An HMAC or signature header is required by the provider. | **Not reproduced** | Nothing in the supplied documentation describes one. None is asserted. |
| 11 | The API key input exposed the key. | **Confirmed by static reading; input type changed** | `apiKey` was `type: text`; now `password` (see "Public changes"). Log masking of the `authorization` header was already present in [`base.imljson`](base.imljson) and in the [connection check](connections/lemlist/api.json). |
| 12 | A blank webhook `type` or `isFirst` is sent as an empty value. | **Unresolved** | The [parameter help](webhooks/lemlist/parameters.json) says a blank type triggers for all types. How the engine serializes an unset select or boolean in the [attach body](webhooks/lemlist/attach.json) was not tested. |

Additional advisory, not a defect claim: [`update.json`](webhooks/lemlist/update.json) is `null`, so changing trigger parameters is not shown to update the provider-side hook.

## Public changes

One source delta and this README were added to the public copy. The delta is a credential-input type change on an ordinary connection parameter, not a functional repair. Nothing else differs from the normalized export.

| File | Field | Before | After |
| --- | --- | --- | --- |
| [`connections/lemlist/parameters.json`](connections/lemlist/parameters.json) | `apiKey` `type` | `text` | `password` |
| `README.md` | new file | none | this document |

No log path changed. The `authorization` header was already listed in `log.sanitize` in [`base.imljson`](base.imljson) and in the [connection check](connections/lemlist/api.json). The base host, pagination, webhook and every other value were left as exported.
