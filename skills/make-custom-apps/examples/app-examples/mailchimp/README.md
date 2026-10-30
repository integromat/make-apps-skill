# Mailchimp (dynamic API endpoint, subscriber mapping)

Reference material for a large Make custom app: OAuth with a per-account API endpoint, dynamic merge-field and interest ("Groups") forms, subscriber create/update/patch, and a list-event webhook. This is an anonymized, normalized export. All sections, helpers and `test.json` files are retained as data. It is not a certified deployable package and nothing in it was validated against a live provider or a Make scenario.

## Learning goals

- Resolve the API host per connection: `baseUrl` is `{{connection.apiEndpoint}}/3.0`, and the endpoint is stored from the OAuth metadata call ([base.imljson](base.imljson), [connections/mailchimp/api.json](connections/mailchimp/api.json) `info`).
- Build forms from the target list: merge fields ([listMergeFields](rpcs/listMergeFields/api.json) with [mergeFields](functions/mergeFields/code.js)) and interest categories ([listInterestCategories](rpcs/listInterestCategories/api.json) with [interestCategories](functions/interestCategories/code.js) and [formFieldOfInterests](functions/formFieldOfInterests/code.js)), with a manual key/value fallback ([editASubscriber expect](modules/editASubscriber/expect.json)).
- Map form values to the provider shape: [interest](functions/interest/code.js) and [mergeField](functions/mergeField/code.js) used in [editASubscriber](modules/editASubscriber/api.json) and [addUpdateASubscriber](modules/addUpdateASubscriber/api.json).
- Chain follow-up calls (tags, notes, re-read) with `condition` and `temp` ([addUpdateASubscriber api](modules/addUpdateASubscriber/api.json)).
- Offset pagination and a date-ordered trigger ([watchSubscribers](modules/watchSubscribers/api.json)); a managed webhook with attach/detach and GET validation ([webhooks/mailchimp](webhooks/mailchimp/api.json)).

## Original version

| Item | Value | Source |
| --- | --- | --- |
| App version | `2` | [metadata.json](metadata.json) `version` |
| Revision | `31` | `rev` |
| Full version | `2.16.5` | `versionFull` |
| Connection revision | `5` | [connections/mailchimp/metadata.json](connections/mailchimp/metadata.json) |

## Component inventory

- Connections (1): `mailchimp` (type `oauth`).
- Webhooks (1): `mailchimp` ("Mailchimp List Event", type `web`; files `api`, `attach`, `detach`, `update`, `parameters`).
- Modules (47) in 14 groups ([groups.json](groups.json)): Campaign (11), Merge Fields (5), Subscriber (7), List (7), Segment (4), Activity (2), Member Tag (2), Events (2), Reports (2), and single-module groups List Members (`addOrUpdateAListMember`), Orders, Survey Answers, Files, Other (`makeApiCall`).
- RPCs (29): selectors and form builders such as [listLists](rpcs/listLists/api.json), [listSubscribers](rpcs/listSubscribers/api.json), [listSegments](rpcs/listSegments/api.json), [getMergeFieldsParams](rpcs/getMergeFieldsParams/api.json).
- Functions (24), no component exports; [install.json](install.json) and [installSpec.json](installSpec.json) are present.

## Practical setup

1. Register an OAuth application in Mailchimp and note its client ID and secret.
2. Enter them in the connection's Client ID and Client Secret fields ([metadata `installSpec`](connections/mailchimp/metadata.json)) and register the Make redirect URI.
3. No scopes are declared (`scope: []`). The connection test calls `https://login.mailchimp.com/oauth2/metadata` and stores `api_endpoint`; all module calls then use `{{connection.apiEndpoint}}/3.0`.
4. The token response is stored as `accessToken` only; the source has no refresh section.

## API version, app version and documentation version

- Source API version: Marketing API **3.0** (`/3.0` suffix in [base.imljson](base.imljson)).
- App version `2` / `2.16.5` / rev `31` is the Make app's own number and not an API version. Selector references such as `rpc://app%23mailchimp@2/getMergeFieldsParams` ([addOrUpdateAListMember expect](modules/addOrUpdateAListMember/expect.json)) carry the app version `2`.
- Public documentation compared (fetched 2026-10-30): [Set up an OAuth app](https://mailchimp.com/developer/marketing/build/start-developing/set-up-an-oauth-app.md) gives the authorize URL and a token POST to `https://login.mailchimp.com/oauth2/token` with `client_id`, `client_secret`, `redirect_uri`, `code`, matching the source's `authorize` and `token`. [API structure](https://mailchimp.com/developer/marketing/api-concepts/api-structure.md) gives the root `https://api.mailchimp.com/3.0/`, with account endpoints relative to it. [Update member](https://mailchimp.com/developer/marketing/api/lists/members/update-member) documents `PATCH /3.0/lists/:list_id/members/:subscriber_hash`, `interests` as a map of interest IDs to booleans, `merge_fields` as a dictionary and `vip` as a boolean.
- Gap: the fetched pages do not describe the `oauth2/metadata` lookup that yields `api_endpoint`, so the dynamic-host design is supported by source only.

## Dependencies, bindings and limitations

- Selectors bind by RPC name (`rpc://listSubscribers`, `rpc://listSegments`, ...) and by `rpc://app%23mailchimp@2/...`; a renamed copy needs those updated.
- `connections/mailchimp/metadata.json` has `aliasTo: "mailchimp"`, the connection's own name. The export contains one locally exported connection; alias runtime semantics have not been verified, and the alias alone is not evidence of a loop and was not treated as one.
- Several RPC `condition` expressions depend on [isMapping](functions/isMapping/code.js), see observations below.
- The webhook carries no signature check in this source; provider-side authenticity guarantees were not assessed.
- Helper `test.json` files are present as data and were not run.

## Checks performed

- JSON parsing by the coordinator on 2026-10-30: 431 of 479 files are JSON, all parsed with zero failures. Inventory counts (1 connection, 1 webhook, 47 modules, 29 RPCs, 24 functions, 0 component exports) match the lists above.
- Source inspection: metadata, base, connection, webhook, both subscriber write modules, trigger/search modules, every RPC condition, and the helpers `interest`, `mergeField`, `mergeFields`, `getMergeFieldsParams`, `getInterestsParams`, `interestCategories`, `formFieldOfInterests`, `arrangeResponseSubscriber`, `generalResponse`, `processInput`, `isMapping`, `checkEmptyObject`, `normalizeMergeFieldsOptions`, `normUpdMergeFieldsOpt`, `errorDetails`, `webhookResponse`, `mergeOutput`, plus caller searches.
- Comparison with the public pages above. No helper or test code was executed; no authenticated or live call was made.
- Post-edit static verification on 2026-10-30: parsed every JSON/IMLJSON file (431 of 479 source files), checked every relative README link, retained every original source file, found all helper/test files byte-identical, and limited structured source deltas to the documented connection-secret parameter type. No helper code execution or live tests occurred.

## Hypothesis status

| # | Hypothesis | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Interests are sent in the wrong shape | **Not reproduced for category-selected IDs; manual boolean-valued maps not passed through (local mapping limitation)** | `interest()` returns an object `{ "<interestId>": true }` ([code](functions/interest/code.js)); category selects supply interest IDs ([listInterestCategoryOptions](rpcs/listInterestCategoryOptions/api.json): `value = item.id`), which matches the documented ID-to-boolean map, not an array. The limitation: each scalar input value becomes an output key and every output value is `true`, so a manual boolean-valued map (for example `{ "<id>": false }`) is not passed through and the helper never emits `false`. This is a local mapping limitation, not proof that all category forms are broken; no functional fix was made. |
| 2 | Interest read-back mapping is inconsistent | **Not reproduced** | [arrangeResponseSubscriber](functions/arrangeResponseSubscriber/code.js) keeps IDs whose value `=== true` and maps them back to names, symmetrical to the write side. |
| 3 | Null values break merge-field handling | **Unresolved** | [mergeField](functions/mergeField/code.js) calls `Object.keys(value)` whenever `typeof value === 'object'`, and `typeof null` is `'object'`, so a literal `null` entry in `merge_fields` would throw. Whether Make can deliver such a null to the helper was not determinable statically. Null is handled elsewhere: [generalResponse](functions/generalResponse/code.js) returns `null` for falsy input. Not changed. |
| 4 | Self-named alias causes recursion | **Not reproduced** | The only alias is the connection `aliasTo: "mailchimp"`. No function calls itself; `iml.*` calls in the helpers are built-ins (`toCollection`, `parseDate`, `length`) plus `iml.addressParameter()` from `mergeFields`, a different function. |
| 5 | Credential input unmasked in connection parameters | **Confirmed, fixed in connection parameters only** | `clientSecret` is used only in the `token` request body ([api.json](connections/mailchimp/api.json), which already lists `request.body.client_secret` and `response.body.access_token` in `log.sanitize`) and was `type: text`; it is now `type: password` in [parameters.json](connections/mailchimp/parameters.json). `installSpec` masking is **unresolved** (no context-specific UI contract was found; see below). |

Further observations, not fixed, runtime impact unresolved:

- [isMapping](functions/isMapping/code.js) returns `true` when the input has no `{{...}}`. [listSubscribers](rpcs/listSubscribers/api.json) and four other RPCs gate on `isMapping(x) !== false`, while [listSegments](rpcs/listSegments/api.json) and [listSegmentMembers](rpcs/listSegmentMembers/api.json) gate on `!isMapping(x)`, which is the opposite polarity for plain string IDs.
- [rpcs/listSubscribers](rpcs/listSubscribers/api.json) builds its URL from `parameters.list` but gates on `parameters.listId`.
- [getASubscriber](modules/getASubscriber/api.json) passes `body.members[1]` into `arrangeResponseSubscriber`, which reads `obj.interests` without a null check.

## Public changes note

Only one change was made: the credential input `clientSecret` went from `type: text` to `type: password` in the connection parameters. Make's [Password parameter page](https://developers.make.com/custom-apps-documentation/block-elements/parameters/password) documents `type: password` as masking text while a connection is created or edited. All other types, expressions, bindings, null/false/0 values and date formats are preserved.

| File | Before | After |
| --- | --- | --- |
| [connections/mailchimp/parameters.json](connections/mailchimp/parameters.json) `clientSecret` | `type: text` | `type: password` |

Unresolved: the `installSpec` `clientSecret` input in [connections/mailchimp/metadata.json](connections/mailchimp/metadata.json) remains `type: text`, and the `install.common` structure is unchanged. It is retained because no context-specific UI contract for `installSpec` / `common` input masking was found. Make's [connections documentation](https://developers.make.com/custom-apps-documentation/app-components/connections) describes common data as encrypted stored data, which does not establish how those input fields are displayed. No runtime flaw is inferred.
