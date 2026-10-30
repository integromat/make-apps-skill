# Trello (OAuth1, multipart files, paginated card search)

Reference material for a mid-size Make custom app: OAuth1 against Trello, cascading board/list/card selectors, date-ordered polling triggers, a managed instant webhook, a multipart file upload and a paginated card search. This is an anonymized, normalized export. All sections, helpers and `test.json` files are retained as data. It is not a certified standalone or deployable package, and nothing in it was validated against a live Trello account or a Make scenario.

## Learning goals

- OAuth1 with request-token, authorize and access-token stages and an optional per-connection consumer key/secret override ([connections/trello/api.json](connections/trello/api.json), [parameters.json](connections/trello/parameters.json)).
- A shared base: `baseUrl`, OAuth1 consumer key/token and a structured error message ([base.imljson](base.imljson)).
- Cascading selectors that call RPCs: board, then list, then card ([addAnAttachment expect](modules/addAnAttachment/expect.json), [listBoards](rpcs/listBoards/api.json), [getBoardsLists](rpcs/getBoardsLists/api.json), [getIDcardsUnderList](rpcs/getIDcardsUnderList/api.json)).
- Dynamic fields from a selector: [getCFid](rpcs/getCFid/api.json) with [customFieldTypeValue](functions/customFieldTypeValue/code.js), consumed by [setACustomFieldOnACard](modules/setACustomFieldOnACard/api.json) via [getType](functions/getType/code.js).
- Polling with `response.trigger` (date, descending) and page pagination ([watchCards](modules/watchCards/api.json), [watchMovedCard](modules/watchMovedCard/api.json) with [onlyListAfter](functions/onlyListAfter/code.js)).
- Paginated search with `cards_page` ([searchCards](modules/searchCards/api.json)); multipart upload ([addAnAttachment](modules/addAnAttachment/api.json), [createCard](modules/createCard/api.json) with [fileExistCreateCard](functions/fileExistCreateCard/code.js)).
- Managed webhook with attach/detach and HEAD verification ([webhooks/trello](webhooks/trello/api.json)).

## Original version

| Item | Value | Source |
| --- | --- | --- |
| App version | `4` | [metadata.json](metadata.json) `version` |
| Revision | `27` | `rev` |
| Full version | `4.15.6` | `versionFull` |
| Connection revision | `11` | [connections/trello/metadata.json](connections/trello/metadata.json) |
| Webhook revision | `7` | [webhooks/trello/metadata.json](webhooks/trello/metadata.json) |

## Component inventory

- Connections (1): `trello` (type `oauth`, empty `scope`).
- Webhooks (1): `trello` ("Watch Activities", type `web`; files `api`, `attach`, `detach`, `parameters`, `update` = `null`).
- Modules (61), [groups.json](groups.json) lists 64 entries because `assignMemberToABoard`, `unassignAMemberFromABoard` and `getACardChecklists` appear in two groups. By `typeId`: 40 actions (4), 11 searches (9), 7 polling triggers (1), 2 instant triggers (10), 1 universal (12, [makeApiCall](modules/makeApiCall/api.json)).
- Polling triggers: `watchActivities`, `watchAttachments`, `watchBoards`, `watchCards`, `watchComments`, `watchMovedCard`, `watchNotifications`. Instant triggers: [watchActivitiesInstant](modules/watchActivitiesInstant/metadata.json) (`hookName: "trello"`) and [watchBoard](modules/watchBoard/metadata.json), which is marked `deprecated: true`, `public: false`.
- RPCs (22), e.g. [listBoards](rpcs/listBoards/api.json), [getBoardsLists](rpcs/getBoardsLists/api.json), [getCFid](rpcs/getCFid/api.json), [getCFoptionID](rpcs/getCFoptionID/api.json), [getPlugins](rpcs/getPlugins/api.json) and [watchActivities](rpcs/watchActivities/api.json) (builds the event multi-select for the webhook).
- Functions (6): `checkErasePill`, `customFieldTypeValue`, `fileExistCreateCard`, `getType`, `onlyListAfter`, `stringify` (not referenced by any exported API file). Every `test.json` is `null`. No component exports. [install.json](install.json) and [installSpec.json](installSpec.json) are present.

## Practical setup

1. Obtain a Trello API key and its secret (the OAuth1 consumer key and secret) from your own Trello app registration.
2. Create the connection with an app name, the consumer key and the consumer secret ([metadata `installSpec`](connections/trello/metadata.json)). The optional connection parameters override only the consumer key and consumer secret per connection (`advanced`); otherwise `common.consumerKey` and `common.consumerSecret` are used ([api.json](connections/trello/api.json) lines 14-17). The app name is not a connection parameter: it always comes from `common.appName` (`authorize.qs.name`, line 20).
3. The authorize step requests `scope=read,write` and `expiration=never` ([api.json](connections/trello/api.json) lines 18-27). Review these for your own use.
4. The connection test calls `https://api.trello.com/1/members/me`; the stored token pair is `accessToken` / `accessTokenSecret`.
5. Instant triggers need a public callback that answers HEAD with 200 (see webhook below).

## API version, app version and documentation version

- Source API version: Trello REST API under `https://api.trello.com/1` ([base.imljson](base.imljson) `baseUrl`). The `1` is the URL path segment.
- App version `4` / `4.15.6` / rev `27` is the Make app's own number, not an API version. Selector references such as `rpc://app%23trello@4/listBoards` ([watchCards parameters](modules/watchCards/parameters.json)) use the app version `4`. Other selectors use the short form `rpc://listBoards` ([addAnAttachment expect](modules/addAnAttachment/expect.json)).
- Public documentation compared (checked 2026-10-30):
  - [Authorization](https://developer.atlassian.com/cloud/trello/guides/rest-api/authorization/) supports basic OAuth1 with `/1/OAuthGetRequestToken`, `/1/OAuthAuthorizeToken`, `/1/OAuthGetAccessToken`, with the app secret used for signing; user tokens must be kept secret. This matches the three stages in the source.
  - [API introduction](https://developer.atlassian.com/cloud/trello/guides/rest-api/api-introduction/) gives the server `api.trello.com/1`; the guide's date is not an API release version.
  - [Search](https://developer.atlassian.com/cloud/trello/rest/api-group-search/) matches `GET /1/search`. Its linked OpenAPI document declares `servers: https://api.trello.com/1`, `openapi: 3.0.0` and `info.version: 0.0.1`; these are schema labels, neither the Make app version nor an "API V3".
  - [Webhooks](https://developer.atlassian.com/cloud/trello/guides/rest-api/webhooks/): the callback must answer HEAD with 200 for the hook to be created; `idModel` selects the watched model; the optional `X-Trello-Webhook` signature is an HMAC-SHA1 over the raw body plus the exact callback URL, keyed with the app secret.
- Gaps: the provider pages fetched do not cover every route used here (for example custom-field items, attachments, checklists). Those routes are source-only.

## Dependencies, bindings and limitations

- Selectors bind by RPC name (`rpc://...`) and, in 12 files, by `rpc://app%23trello@4/...`. A renamed or re-versioned copy needs those references updated.
- `connections/trello/metadata.json` has `aliasTo: "trello"`, the connection's own name. This does not prove recursion. How such an alias resolves outside this export is unknown, and no external dependency is assumed. It is the only non-empty `aliasTo` in the export.
- `consumerSecret` is a confirmed credential input; see the changes note. The same secret in `installSpec` is still `type: text`; no context-specific masking contract was verified, so this is unresolved and left unchanged ([connections/trello/metadata.json](connections/trello/metadata.json), [installSpec.json](installSpec.json)).
- The export has docs text with legacy product naming, a `<PICTURE OF CONNECTION HERE>` placeholder ([metadata.json](metadata.json) `docs`) and an `appName` default of `Integromat` ([connections/trello/metadata.json](connections/trello/metadata.json)).
- Helper `test.json` files are `null` (no test data). No helper code was executed.

## Checks performed

- JSON parsing by the coordinator before documentation: 470 source files, 458 `.json`/`.imljson` files parsed, zero errors. Inventory (1 connection, 1 webhook, 61 modules, 22 RPCs, 6 functions, 0 component exports) matches the lists above.
- Source inspection: metadata, base, connection, webhook (all files), [groups.json](groups.json), the polling triggers listed above, [searchCards](modules/searchCards/api.json), [search](modules/search/api.json), [makeApiCall](modules/makeApiCall/api.json), [createCard](modules/createCard/api.json), [editACard](modules/editACard/api.json), [addAnAttachment](modules/addAnAttachment/api.json), [downloadAnAttachment](modules/downloadAnAttachment/api.json), [setACustomFieldOnACard](modules/setACustomFieldOnACard/api.json), key RPCs, all six helpers and a search for helper callers.
- Comparison with the public pages above. No authenticated call, no provider or Make write, no helper/test execution.
- Post-edit checks by the coordinator: all 458 `.json`/`.imljson` files parsed; all 470 original source files retained; the only new file is this README; all local README links resolved. Against the released sanitized baseline, the only source delta is `consumerSecret` `type` `text` to `password` in [connections/trello/parameters.json](connections/trello/parameters.json). `api`, all metadata, `installSpec`/`common`, all helper and test files and every other source file are byte-identical.

## Hypothesis status

| # | Hypothesis | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Token responses are not log-masked | **Configuration gap confirmed; runtime leakage not reproduced; internal OAuth logging unresolved** | [connections/trello/api.json](connections/trello/api.json) has no `log` or `sanitize` in any stage and no `oauth.transport_method` override (documented default: header, see [OAuth1](https://developers.make.com/custom-apps-documentation/app-components/connections/oauth1)). `accessToken` and `requestToken` read `body.oauth_token` and `body.oauth_token_secret` from urlencoded responses (lines 44-49, 55-60). Per [Making requests](https://developers.make.com/custom-apps-documentation/component-blocks/api/making-requests) and [Sanitization](https://developers.make.com/custom-apps-documentation/app-components/base/sanitization), `log.sanitize` takes case-insensitive dot paths, and without it developer logs may be unavailable. A missing mask does not prove exposure, and what Make logs automatically for OAuth steps was not determined. Not changed: enabling connection logs was deliberately out of scope. Module and RPC calls are masked by the base ([base.imljson](base.imljson) lines 2-6, `request.headers.authorization`). |
| 2 | Consumer secret is entered unmasked | **Confirmed; fixed in connection parameters only** | `consumerSecret` feeds `oauth.consumer_secret` ([api.json](connections/trello/api.json) line 16), and was `type: text` in [parameters.json](connections/trello/parameters.json). Now `type: password`, as documented for [connection parameters](https://developers.make.com/custom-apps-documentation/block-elements/parameters/password). `consumerKey` stays `text`. `installSpec` masking is **unresolved**. |
| 3 | Pagination caps polling coverage | **Confirmed as source design; not shown to be a bug** | Six polling modules send a fixed `limit: 100`; `pagination.qs.page = pagination.page - 1` runs only while `pagination.page <= 10 && parameters.limit > 100 && length(body) === 100` (for example [watchCards](modules/watchCards/api.json) lines 22-27). With `limit` of 100 or less there is one request; above 100 the source gate allows at most ten requests, an upper bound of about 1000 items, not a claim that ten requests always run or that 1000 items are returned. Per Make's [pagination](https://developers.make.com/custom-apps-documentation/component-blocks/api/pagination) page, `pagination.page` starts at 1 and is 2 after the first request when the next page is prepared, and pagination stops automatically at an empty response or when `response.limit` is met, so it can stop earlier. Actual checkpoint and data coverage were not tested. `limit` has `max: 1000` in [watchCards](modules/watchCards/parameters.json), `watchBoards`, `watchMovedCard`, `watchComments`, `watchActivities`, `watchAttachments`, but none in [watchNotifications](modules/watchNotifications/parameters.json), where the same gate still applies. [watchAttachments](modules/watchAttachments/api.json) sends `limit: 1000` with no pagination. |
| 4 | `page` is invalid for action endpoints | **Not reproduced** | The provider [boards API page](https://developer.atlassian.com/cloud/trello/rest/api-group-boards/) (matching [OpenAPI](https://dac-static.atlassian.com/cloud/trello/swagger.v3.json?_v=1.1274.0)) documents `page` (default 0), `before` and `since` for `/boards/{boardId}/actions`. Its documentation for `/members/{id}/actions` and `/lists/{id}/actions` lists only `id` and `filter`. Absent documentation alone does not prove a parameter invalid; support of `page` on those two routes is **unresolved**. |
| 5 | Trigger checkpoints lose items | **Unresolved** | Triggers use `trigger: { id: item.id, date: item.date, type: "date", order: "desc" }`. Live checkpoint behavior across pages was not observed. This is separate from hypothesis 3. |
| 6 | Card search paging is wrong | **Not reproduced** | [searchCards](modules/searchCards/api.json) sends `cards_limit: 100` and `cards_page = pagination.page-1`, continuing while `pagination.page < (parameters.limit/100) + 1`. The [Search](https://developer.atlassian.com/cloud/trello/rest/api-group-search/) spec's linked OpenAPI defines `cards_page` from 0 (max 100) and `cards_limit` (max 1000). The source condition checks `limit`, not response length; Make's documented [automatic stop](https://developers.make.com/custom-apps-documentation/component-blocks/api/pagination) at an empty response or when `response.limit` is met applies, while how Trello behaves when a page past the last one is requested (for example repeating the last page) was not tested. `limit` has no `max` in [expect.json](modules/searchCards/expect.json). |
| 7 | `onlyListAfter` can throw | **Unresolved** | [code.js](functions/onlyListAfter/code.js) guards non-array input and empty `listId`, then reads `action.data.listAfter.id` for every item. The request filters `updateCard:idList` ([watchMovedCard](modules/watchMovedCard/api.json)); that every returned action has `data.listAfter` was not observed. The pagination gate counts the unfiltered `body`. |
| 8 | Webhook lacks signature verification | **Confirmed absent locally; recommendation only** | [webhooks/trello/api.json](webhooks/trello/api.json) answers `HEAD` with 200 (`verification`) as the docs require, and has no `X-Trello-Webhook` comparison. The docs describe the signature as optional. Whether Make exposes the raw body and header to such a check was not determined. Not changed. |
| 9 | Self-named alias recurses | **Not reproduced** | See dependencies. The alias alone is not evidence of a loop. |

Further observations, not fixed, runtime impact unresolved:

- [addAnAttachment](modules/addAnAttachment/api.json) line 25 reads `"knownLength": "{{length(parameters.data}}"`, missing the closing parenthesis. Its sibling helper [fileExistCreateCard](functions/fileExistCreateCard/code.js) uses `iml.length(fileData)`. The file branch is untested and not claimed to work; the URL branch is a separate request.
- [setACustomFieldOnACard](modules/setACustomFieldOnACard/api.json) calls `/card/{id}/customField/{id}/item` (singular `card`), while other card routes use `/cards/`. This was not compared with provider docs in this pass.
- The webhook `condition` compares `parameters.actions = 'all'` where `actions` is a multi-select ([rpcs/watchActivities](rpcs/watchActivities/api.json), `multiple: true`); how an array is compared was not determined.
- [checkErasePill](functions/checkErasePill/code.js) maps only `null` to `''`; `undefined` passes through unchanged.
- [base.imljson](base.imljson) `oauth` lists only `token` and `consumer_key`, and the connection `info` stage uses `connection.token` while the base uses `connection.accessToken`. How the platform supplies signing secrets was not verified.

## Changes from the original export

Only one structured change was made, in [connections/trello/parameters.json](connections/trello/parameters.json):

| Field | Before | After |
| --- | --- | --- |
| `consumerSecret` `type` | `"text"` | `"password"` |

Connection metadata, `installSpec`, `common` install data, every `api.json` and all helper/test files are unchanged, including expressions, bindings, casing, `null`/`false`/`0` and date values. No runtime leakage was reproduced, and no log-enabling change was made.
