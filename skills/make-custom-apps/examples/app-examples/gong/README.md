# Gong (compact scope, cursor pagination, alternative auth)

Reference material for a small Make custom app: one OAuth connection plus one Basic-key connection feeding the same modules, cursor pagination over `/calls`, and three small helper functions. This is an anonymized, normalized export. All sections, helpers and `test.json` files are retained as data. It is not a certified deployable package and nothing in it was validated against a live provider or a Make scenario.

## Learning goals

- Serve two credential types from one set of modules: `accountName: "gong"` with `altAccountName: "gong2"` ([SearchListCalls metadata](modules/SearchListCalls/metadata.json)), and a single `Authorization` header expression that switches between Bearer and Basic ([base.imljson](base.imljson)).
- Authorization-code OAuth with Basic client authentication on both token exchange and refresh, plus a refresh `condition` ([connections/gong/api.json](connections/gong/api.json)).
- Cursor pagination that forwards `body.records.cursor` ([SearchListCalls api](modules/SearchListCalls/api.json), [getCallId rpc](rpcs/getCallId/api.json)).
- A date-ordered polling trigger ([TriggerWatchNewCall api](modules/TriggerWatchNewCall/api.json)) and a multipart upload ([ActionAddCallMedia api](modules/ActionAddCallMedia/api.json)).
- Dependent-free RPC selectors for users, workspaces and calls ([rpcs](rpcs/getUserId/api.json)).

## Original version

| Item | Value | Source |
| --- | --- | --- |
| App version | `1` | [metadata.json](metadata.json) `version` |
| Revision | `10` | `rev` |
| Full version | `1.0.4` | `versionFull` |
| Connection revisions | `gong` 5, `gong2` 2 | [gong](connections/gong/metadata.json), [gong2](connections/gong2/metadata.json) |

## Component inventory

- Connections (2): `gong` (type `oauth`, label "Gong"), `gong2` (type `basic`, label "Gong Basic").
- Webhooks: none.
- Modules (9): TriggerWatchNewCall, ActionCreateCall, ActionAddCallMedia, ActionGetCall, SearchListCalls, ActionReportEventCustomAction, ActionReportEventOfContentShare, ActionReportEventOfContentView, MakeAPICall (grouped in [groups.json](groups.json) as Calls / Reports / Other).
- RPCs (3): [getCallId](rpcs/getCallId/api.json), [getUserId](rpcs/getUserId/api.json), [getWorkspaceId](rpcs/getWorkspaceId/api.json).
- Functions (3): [parseBuffer](functions/parseBuffer/code.js), [parseDates](functions/parseDates/code.js), [parseError](functions/parseError/code.js).
- [install.json](install.json) is `{}` and [installSpec.json](installSpec.json) is `[]`; client credentials are declared on the connection instead.

## Practical setup

1. Basic connection (`gong2`): create an Access Key and Access Key Secret in Gong as a technical administrator and enter them in the two fields ([parameters](connections/gong2/parameters.json)).
2. OAuth connection (`gong`): register an integration in Gong, then enter its Client ID and Client Secret ([metadata `installSpec`](connections/gong/metadata.json)) and register the Make redirect URI. The default scope is `api:users:read`; extra scopes come from the advanced `scopes` select ([parameters](connections/gong/parameters.json)).
3. Every module lists the scopes it needs in its own `metadata.json` (for example `api:calls:create`, `api:workspaces:read`, `api:users:read` for ActionCreateCall).

## API version, app version and documentation version

- Source API version: Gong API **V2**, from `baseUrl: https://api.gong.io/v2` ([base.imljson](base.imljson)).
- App version (`1.0.4`, rev 10) is the Make app's own and is unrelated to the API version.
- Documentation consulted (fetched 2026-10-30): the [API introduction](https://help.gong.io/apidocs/introduction-2.md) labels the API V2, lists Basic (`accessKey:accessKeySecret`) and OAuth Bearer authentication, and says the next page is requested by passing `records.cursor` with all other inputs unchanged. The API introduction supports the source's V2 path, Basic/Bearer split and cursor handling. The [OAuth app guide](https://help.gong.io/docs/create-an-app-for-gong.md) (page dated 2026-10-15; a documentation date, not an API release) supports the client-registration and authentication details, but differs from the source on the current token route and host (see hypothesis 5).

## Dependencies, bindings and limitations

- Modules bind to both connections; `MakeAPICall` builds `https://api.gong.io/{{parameters.url}}`, so callers must include the version segment themselves.
- Selectors bind to RPCs by `rpc://app%23gong@1/...` (for example `getWorkspaceId` in [SearchListCalls expect](modules/SearchListCalls/expect.json)). That reference is tied to the original app name and version; a copy under another name needs those references re-pointed.
- `ActionAddCallMedia` expects the call to exist (`callId` from ActionCreateCall); ActionCreateCall's `downloadMediaUrl` help text says not to also use the media step.
- Date parsing uses `parseDates` with the pattern `YYYY-MM-DDTHH:mm:ss.SSSZ`; no captured sample in this export shows the provider's actual date strings, so that match is unverified.

## Checks performed

- JSON parsing by the coordinator on 2026-10-30: 80 of 86 files are JSON, all parsed with zero failures (the other six are the helper `code.js`/`arguments.txt` files). Inventory counts match the list above (2 connections, 0 webhooks, 9 modules, 3 RPCs, 3 functions, 0 component exports).
- Source inspection of metadata, base, both connections, every module `api.json`/`expect.json` that bears on the hypotheses, all RPCs and all three helpers, plus caller search for each helper.
- Comparison against the two public documentation pages above.
- Post-edit static verification on 2026-10-30: parsed every JSON/IMLJSON file (80 of 86 source files), checked every relative README link, retained every original source file, found all helper/test files byte-identical, and limited structured source deltas to the documented connection-secret parameter types plus the Gong header masks.
- Not done: no helper or test code was executed, and no authenticated or live provider call, Make upload or scenario run took place.

## Hypothesis status

| # | Hypothesis | Status | Evidence |
| --- | --- | --- | --- |
| 1 | OAuth token and refresh logs do not mask the credential header | **Confirmed, fixed** | `token` and `refresh` send `Authorization: Basic base64(clientId:clientSecret)` ([api.json](connections/gong/api.json)) but their `log.sanitize` listed `request.body.client_secret`, which these requests do not carry. `request.headers.authorization` is now listed. Header sanitize matching is case-insensitive, so the `Authorization` header name versus the lower-case path is not itself a defect; the omission of any header path from `token` and `refresh` was. Make's [Requests page](https://developers.make.com/custom-apps-documentation/component-blocks/api/making-requests#sanitize) (fetched 2026-10-30) says sensitive values must be sanitized, that `log.sanitize` dot paths are case-insensitive, and that nested response fields are supported. This describes the source mask configuration only; no runtime leakage was observed or tested. |
| 2 | Credential inputs are unmasked in connection parameters | **Confirmed, fixed in connection parameters only** | `clientSecret` ([parameters](connections/gong/parameters.json)) and `accessKeySecret` ([gong2](connections/gong2/parameters.json)) are used only inside Basic headers and were `type: text`. Both are now `type: password`. `accessKey` / `clientId` are identifiers and were left as is. The `installSpec` `clientSecret` in [connections/gong/metadata.json](connections/gong/metadata.json) is **unresolved** (no context-specific UI contract was found; see below). |
| 3 | `parseDates` leaks variables | **Confirmed undeclared assignments; runtime impact unresolved** | `prop` (line 4) and `path` (line 24) are assigned without a declaration. Callers are [TriggerWatchNewCall](modules/TriggerWatchNewCall/api.json), [SearchListCalls](modules/SearchListCalls/api.json) and [ActionGetCall](modules/ActionGetCall/api.json). Reading the code, `path` is passed as a parameter to the recursive `parse`, and `prop` is consumed (or captured by `prop.forEach`) before any recursion, so no cross-call corruption was found by reading. No code was executed, and behaviour under a strict-mode runtime is **unresolved**. Not changed. |
| 4 | `parseBuffer` / `parseError` problems | **Unresolved** | `parseBuffer` has no caller in the export. `parseError` calls `errors.forEach` and so assumes `body.errors` is an array; callers are [base.imljson](base.imljson) and four error blocks in [connections/gong/api.json](connections/gong/api.json). The provider's error shapes were not observed. Not changed. |
| 5 | DOC_VERSION_DRIFT: token route and base host | **Unresolved** | Source posts to `https://app.gong.io/oauth2/generate-token` and uses `https://api.gong.io/v2`. The current OAuth page describes `/oauth2/generate-customer-token` and a per-customer `api_base_url_for_customer` in the response, which the source never stores (token `response.data` keeps only `expires`, `accessToken`, `refreshToken`). Absence from the current page does not show the older route is broken, so compatibility is undetermined. |

Additional observation (not fixed, runtime impact unresolved): [getUserId](rpcs/getUserId/api.json) paginates on `parameters.records.cursor` while [getCallId](rpcs/getCallId/api.json) uses `body.records.cursor`. The RPC declares no parameters ([parameters.json](rpcs/getUserId/parameters.json)), so the user selector may stop after one page.

## Public changes note

Two kinds of change were made: log masking of the Basic `Authorization` header on `token` and `refresh`, and the credential inputs `clientSecret` and `accessKeySecret`, which went from `type: text` to `type: password` in the connection parameters. Make's [Password parameter page](https://developers.make.com/custom-apps-documentation/block-elements/parameters/password) documents `type: password` as masking text while a connection is created or edited. All other types, expressions, bindings, null/false/0 values and date formats are preserved.

| File | Before | After |
| --- | --- | --- |
| [connections/gong/api.json](connections/gong/api.json) `token.log.sanitize` and `refresh.log.sanitize` | no `request.headers.authorization` | `"request.headers.authorization"` added (existing entries kept) |
| [connections/gong/parameters.json](connections/gong/parameters.json) `clientSecret` | `type: text` | `type: password` |
| [connections/gong2/parameters.json](connections/gong2/parameters.json) `accessKeySecret` | `type: text` | `type: password` |

Unresolved: the `installSpec` `clientSecret` input in [connections/gong/metadata.json](connections/gong/metadata.json) remains `type: text`, and the `install.common` structure is unchanged. It is retained because no context-specific UI contract for `installSpec` / `common` input masking was found. Make's [connections documentation](https://developers.make.com/custom-apps-documentation/app-components/connections) describes common data as encrypted stored data, which does not establish how those input fields are displayed. No runtime flaw is inferred.
