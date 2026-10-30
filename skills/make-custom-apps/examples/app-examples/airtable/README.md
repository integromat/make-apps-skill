# Airtable — OAuth with PKCE, schema-driven fields and offset pagination

A **normalized, anonymized reference export** of an Airtable custom app. Every section the export contained is retained: base, connection, 14 modules, 6 RPCs, 1 webhook, 16 helper functions, groups and install files. It is reading material for Make app patterns. It is **not** a certified standalone package, not a tested deployment, and not the result of any live or authenticated validation. Imported helpers, tests and samples are retained as data and were not executed during this curation.

Back to the [app examples index](../README.md).

## How to read this export

The folder is the platform's normalized export layout, not an SDK project. Each module directory holds `api.json` (communication), `expect.json` (mappable input fields), `parameters.json` (static parameters), `interface.json` (output fields), `samples.json` and `metadata.json`. RPC, webhook and connection directories follow the same idea. Start with [`metadata.json`](metadata.json), then [`base.imljson`](base.imljson), then one module.

| Item | Value (from [`metadata.json`](metadata.json)) |
| --- | --- |
| App name / label | `airtable` / Airtable |
| `version` | 3 |
| `rev` | 38 |
| `versionFull` | 3.9.13 |
| `manifestVersion` | 2 |
| Connection | `airtable3`, type `oauth`, rev 6 ([metadata](connections/airtable3/metadata.json)) |

`version: 3` is Make's app version. It is unrelated to the provider's `v0` URL path.

## Learning objectives

1. **OAuth 2 with PKCE.** [`connections/airtable3/api.json`](connections/airtable3/api.json) builds a `code_challenge` from a generated verifier in `authorize`, sends the verifier in `token`, and refreshes with a Basic client header and a one-minute early-expiry `condition`. The [`base64url`](functions/base64url/code.js) helper supports the challenge.
2. **Schema-driven field lists.** [`rpcs/RpcGetSchema`](rpcs/RpcGetSchema/api.json) reads the table-metadata route and calls [`getSchema`](functions/getSchema/code.js) to turn Airtable field types into Make fields (`for=interface`, `for=rpc`, or mappable input, with read-only field types filtered out). Module outputs use the same helper, for example [`ActionSearchRecords/interface.json`](modules/ActionSearchRecords/interface.json).
3. **Cascading selectors.** [`ActionSearchRecords/expect.json`](modules/ActionSearchRecords/expect.json) chains base, table, field and view pickers through [`RpcGetBases`](rpcs/RpcGetBases/api.json), [`RpcGetTables`](rpcs/RpcGetTables/api.json), `RpcGetSchema` and [`RpcGetTableViews`](rpcs/RpcGetTableViews/api.json).
4. **Offset pagination in two styles.** [`ActionSearchRecords/api.json`](modules/ActionSearchRecords/api.json) posts to the `listRecords` route and feeds `body.offset` back in the request body; [`TriggerWatchRecords/api.json`](modules/TriggerWatchRecords/api.json) uses a GET with `pageSize: 100` and feeds `offset` back in the query string. Both continue while `body.offset` is set.
5. **Polling trigger with a date sort.** `TriggerWatchRecords` sorts descending on a chosen field and sets `trigger.id` and `trigger.date` (through [`safeGet`](functions/safeGet/code.js)).
6. **Error shaping.** [`base.imljson`](base.imljson) builds the module error through [`parseError`](functions/parseError/code.js), which rewrites an unknown-field message using the module's record spec.
7. **Upsert endpoint helper.** [`upsertRecord/api.json`](modules/upsertRecord/api.json) and [`getUpsertEndpointUrl`](functions/getUpsertEndpointUrl/code.js) show a helper-chosen URL.
8. **A shared-proxy branch.** [`getBaseUrl`](functions/getBaseUrl/code.js) is used by `base.imljson`; see "API version" for what it does and does not show.

## Setup and permissions

- An Airtable account that can authorize an OAuth integration, plus an OAuth client (client ID and secret) registered with Airtable. The connection takes a client ID and secret ([`parameters.json`](connections/airtable3/parameters.json), both advanced and optional there; the connection `installSpec` marks them required), and the app-level [`installSpec.json`](installSpec.json) takes a `metadataClientSecret` that the metadata routes send as the `X-Airtable-Client-Secret` header.
- Secret provisioning. The installation-level and common credentials (`metadataClientSecret` in `installSpec.json`, and `clientSecret` in the `installSpec` array of [`connections/airtable3/metadata.json`](connections/airtable3/metadata.json)) must be supplied correctly by whoever installs the app. Both are retained as `type: text`. Make's [Password parameter documentation](https://developers.make.com/custom-apps-documentation/block-elements/parameters/password) establishes masking for ordinary connection create/edit parameters only, and no retrieved evidence says whether the root `installSpec` or the connection-metadata `installSpec` forms mask a `password` field, so no change or extra flag was made there. Masking in those install-time forms is unresolved. The ordinary connection parameter `clientSecret` is `password`; the [connections documentation](https://developers.make.com/custom-apps-documentation/app-components/connections) says OAuth client ID and secret live in connection common data, which Make encrypts.
- Scopes. The connection requests only `schema.bases:read` ([metadata](connections/airtable3/metadata.json)). Module metadata files request `schema.bases:read` plus `data.records:read` and, for writing modules, `data.records:write`. How the platform combines connection and module scopes was not examined.
- Which bases and tables a user can reach depends on the access they grant to the integration. This export does not establish those limits.
- The single webhook directory ([`webhooks/airtable`](webhooks/airtable/api.json)) is a `web` hook whose output is `{{query}}`; its `attach.json`, `detach.json` and `update.json` are all `null`. The export therefore contains no code that registers or removes a webhook at the provider, and no sender authenticity check. How a delivery URL gets configured is not shown.
- During this curation nothing was connected to a real Airtable account.

## Inventory and dependency closure

| Component | Count | Notes |
| --- | --- | --- |
| Modules | 14 | Group "Records" in [`groups.json`](groups.json): `TriggerWatchRecords`, `webhook` (instant trigger), `ActionSearchRecords`, `ActionGetRecord`, `ActionCreateRecord`, `ActionUpdateRecords`, `upsertRecord`, `ActionDeleteRecord`, `CreateRecordAdvanced`, `UpdateRecordAdvanced`, `searchRecordsAdvanced`. Group "Other": `makeApiCall`, `listBases`, `listTableSchemas`. |
| RPCs | 6 | `RpcGetBases`, `RpcGetTables`, `RpcGetSchema`, `RpcGetTableViews`, `searchRecords`, `warning`. |
| Webhooks | 1 | `airtable`. |
| Connections | 1 | `airtable3` only. |
| Functions | 16 | `applySort`, `base64url`, `debug`, `getBaseUrl`, `getSchema`, `getSchemaFieldSpecs`, `getUpsertEndpointUrl`, `getViews`, `joinFieldsForOutput`, `parseError`, `prepareRecord`, `prepareRecordMapped`, `processRecord`, `safeGet`, `typeMultipleAttachments`, `wrapOutput`. 10 `test.json` files contain only `null`; 6 contain retained text (see limitations). |
| Samples | 14 | Every module `samples.json` contains only `null`. |

Reviewer text search over the export found:

- Every `rpc://` reference in modules uses the app-qualified form `rpc://app%23airtable@3/...` and names one of the exported RPCs (`RpcGetBases`, `RpcGetTables`, `RpcGetSchema` with several query variants, `RpcGetTableViews`, `searchRecords`).
- **Alias gap.** 13 of the 14 modules (all but `webhook`) declare `altAccountName: "airtable2"`, and the [`searchRecords` RPC](rpcs/searchRecords/metadata.json) declares `accountName: "airtable2"`. No connection named `airtable2` is exported; only `airtable3` exists. The source proves only that these components reference the name `airtable2`; the definition of that alias, or the target it points at, is not supplied. It could be an owned second connection, a shared or external one, or something else, and this export does not say which. This is a dependency gap in the export. The aliases are preserved unchanged. The 13 modules name `airtable3` as their primary connection, so for them the gap concerns the alternative-connection path. The `searchRecords` RPC is different: it is referenced by the record selectors of [`upsertRecord`](modules/upsertRecord/expect.json), [`ActionDeleteRecord`](modules/ActionDeleteRecord/expect.json), [`ActionUpdateRecords`](modules/ActionUpdateRecords/expect.json) and [`ActionGetRecord`](modules/ActionGetRecord/expect.json), and its only connection name is the missing one. What the platform does with an unresolved alias on import or at run time was not tested.
- The `webhook` module declares `hookName: "airtable"`, which matches the exported webhook directory.

Not shown: platform import behavior, components that existed in the original app but were not exported, and runtime resolution of IML. Closure is therefore "one known alias gap, otherwise no gap found by static reading", not "verified deployable".

## API version and matching public documentation

- Source routes: `https://api.airtable.com/v0/...` for records (the `v0` segment is the provider's route prefix), `https://api.airtable.com/v0/meta/...` for base and table metadata and for `whoami`, and `https://airtable.com/oauth2/v1/...` for OAuth. **No dated API pin or version header exists in the source.**
- The `v0` and `oauth2/v1` segments are separate provider namespaces, not one version. Primary public documentation, retrieved as markdown pages (HTTP 200) on 2026-10-30. These pages are current, so **not proof of the API as it was when this export was made**, and none of them shows live behavior:

| Source area | Retrieved page | What it supports |
| --- | --- | --- |
| Records | <https://airtable.com/developers/web/api/list-records.md> | `GET /v0/{baseId}/{tableIdOrName}` and the alternative `POST .../listRecords`; `pageSize` up to 100 (default 100); an opaque `offset` in the response is passed back, and its absence ends traversal. Matches both pagination styles. |
| Table metadata | <https://airtable.com/developers/web/api/get-base-schema.md> | `GET /v0/meta/bases/{baseId}/tables`, PAT or OAuth, needs `schema.bases:read`. The page does not mention the `X-Airtable-Client-Secret` header the source sends; that omission does not show the header is rejected. |
| OAuth | <https://airtable.com/developers/web/api/oauth-reference.md> | Authorization at `/oauth2/v1/authorize` with S256 PKCE; token and refresh by form-encoded `POST /oauth2/v1/token`; Basic client authentication for client-secret integrations; 60-minute access tokens and 60-day refresh tokens; a refresh replaces both tokens. The source matches routes, PKCE, encoding and expiry fields. No explicit `state` is visible in the connection file; whether the platform adds one was not shown. |
| Errors | <https://airtable.com/developers/web/api/errors.md> | General 401, 403 (including inaccessible resources), 404 and 422 behavior. These are general, not endpoint-specific guarantees. |

  The connection check route `GET /v0/meta/whoami` was not covered by any retrieved page. The base-schema page has no endpoint-specific error section.
- **Shared proxy branch.** `getBaseUrl` returns `https://proxy.syncinc.so/` plus the base path when a connection's `proxy` value equals `sync-inc`, and `https://` plus the base path otherwise. No file in this export sets a `proxy` value on the connection, so only the default branch is visible here. The branch is preserved. Retrieved historical evidence:
  - A Stytch-hosted Sequin tutorial published 2022-03-30, <https://stytch.com/blog/build-custom-client-portal-on-airtable-using-sequin-with-next-js/>, configures `endpointUrl: "https://proxy.syncinc.so/api.airtable.com"` as the Airtable client endpoint. That matches the host-composition pattern in `getBaseUrl` and shows a **public shared proxy**, not a private customer host.
  - A Make community staff reply of 2023-05-12, <https://community.make.com/t/new-airtable-api-credential-types-announced-migration-plans/7023/17>, says "Sync Inc has actually changed their name to Sequin". That confirms the rename; it does not show the proxy option is still offered.

  Current availability of the proxy is unresolved and nothing here claims it is or is not available.
- [`metadata.json`](metadata.json) has a `docs` value pointing at a non-operational placeholder host from anonymization; no replacement was invented.

## Static checks actually performed

The final static check of this folder passed with no errors. It covered strict JSON parsing, source comparison, relative-link resolution and a private-path marker search; imported code, helpers and tests stayed data and were not executed.

- All 180 original source files were retained and none were removed; the only added file is this `README.md` (181 files in the folder).
- 148 of the files are JSON or IML-JSON and all parsed strictly with no errors. The other 32 files are `code.js` and `arguments.txt` for the 16 helpers.
- The source comparison against the original found exactly two deltas, the ordinary connection parameter `clientSecret` type change and the `request.body.refresh_token` log mask, both listed under "Public changes". Both `installSpec` definitions (the root `installSpec.json` and the `installSpec` in the connection `metadata.json`) equal the original.
- Every relative link in the README resolved, and no private-path markers were found.

Reviewer reading of the source (text search, no execution) produced the observations in this README.

**Not performed, and not claimed:** helper or test execution, Make schema/import validation, any call to Airtable or Make, and any runtime check of IML expressions.

## Retained data limitations

- All 14 `samples.json` files and 10 of 16 helper `test.json` files are `null` placeholders; there is no captured provider response in this folder.
- The `test.json` files for [`getSchema`](functions/getSchema/test.json), `getViews`, `applySort`, `prepareRecord`, `typeMultipleAttachments` and `wrapOutput` are retained as text, not as executable files here. `getSchema` has cases for an empty field list, interface output, read-only filtering and RPC output, all with a table that exists. [`getViews/test.json`](functions/getViews/test.json) is the literal string `"undefined"`. Nothing was run.
- Nine modules call `getSchema(body, parameters.table, 'interface', , true)` with an empty fourth argument (for example [`TriggerWatchRecords/api.json`](modules/TriggerWatchRecords/api.json)). That is retained as exported and is not claimed to be a defect.
- [`debug`](functions/debug/code.js) is a retained helper; text search found no call to it outside its own definition (test files excluded), so the exported communication does not exercise it.

## Hypotheses

Statuses: **confirmed** (shown by the source and by language or documented semantics), **not reproduced** (no support found), **unresolved** (needs runtime or provider evidence). No status below is a live test result.

| # | Hypothesis | Status | Evidence and limits |
| --- | --- | --- | --- |
| 1 | For a **successful** schema response that contains no table matching the selected table ID or name, `getSchema` and `getViews` throw before their null guard can help. | **Confirmed by static reading, under that stated premise** | [`getSchema`](functions/getSchema/code.js) lines 2–5 and [`getViews`](functions/getViews/code.js) lines 2–3 read `.fields` / `.views` directly on the result of `body.tables.find(...)`. In JavaScript, `find` returns `undefined` when nothing matches and a property read on `undefined` throws; the `if (!columns) return` / `if (!views) return` line only covers a matched table that lacks the property. The source reads `parameters.table` from a saved selection, so a table removed after selection is one way to meet the premise. Whether Airtable returns such a response, how often, and the exact error the platform shows were **not** established, and nothing was executed. HTTP 401, 403, 404 or 422 responses are not this premise: the retrieved general errors page does not say how they reach `response.output`, and this README does not claim they run these helpers. |
| 2 | Every Airtable API error triggers these helpers. | **Not reproduced** | Error responses build their message through the `response.error` expression in [`base.imljson`](base.imljson), which calls `parseError`, a different helper. The metadata RPCs call `getSchema` / `getViews` in `response.output`. The retrieved errors page is general and does not say how a schema error propagates. This README does not rely on how the platform treats non-success statuses for `output`, and does not claim the helpers run on errors. |
| 3 | The missing `airtable2` alias target breaks the export. | **Unresolved** | The dependency gap itself is confirmed (see inventory): the alias definition or target is not supplied. Its runtime effect on import was not tested; aliases were left as exported. |
| 4 | The refresh request body lacks a log mask for the refresh token. | **Confirmed by static reading (missing mask path); runtime logging not exercised** | The `refresh` block sends `refresh_token` in its request body, but its `sanitize` list had no request-body path. The authorization header and both response tokens (`access_token`, `refresh_token`) were **already** listed; only `request.body.refresh_token` was added. Whether the platform actually logs request bodies by default was not tested, so actual credential logging is not confirmed. |
| 5 | The token request exposes `code` and `code_verifier` in logs. | **Unresolved** | The `token` block masks the authorization header and the two response tokens, and sends `code` and `code_verifier` in its request body. Those additional request-body paths are visible in the source, but their protection or exposure, and whether any further correction is needed, were not established in this scoped review. No change was made. Being one-time values does not make them safe to log, and the Requests documentation calls for masking sensitive values generally. |
| 6 | The connection check's `Authorization` header is not masked because the mask path is lowercase. | **Not reproduced** | The `info` block sets `Authorization` and lists `request.headers.authorization`. Sanitize paths are documented as case-insensitive dot notation in the [request reference](https://developers.make.com/custom-apps-documentation/component-blocks/api/making-requests) and in this repository's [auth-context guide](../../current-knowledge/guides/auth-context.md), so the spelling difference is not a defect. Source casing is preserved. |
| 7 | The install-time secret fields (`metadataClientSecret`, connection-metadata `installSpec` `clientSecret`) are masked in their forms. | **Unresolved** | Both are `text` as exported. The Password parameter documentation covers ordinary connection parameters only; no retrieved evidence covers the root `installSpec` or `installSpec` in connection metadata. A secret-like name is not proof of masking either way, and no `password` type or other flag was substituted. |

## Public changes

Two source deltas and this README were added to the public copy. These are credential-input and log-mask deltas, not functional repairs. Nothing else differs from the normalized export.

| File | Field | Before | After |
| --- | --- | --- | --- |
| [`connections/airtable3/parameters.json`](connections/airtable3/parameters.json) | `clientSecret` `type` (ordinary connection parameter) | `text` | `password` |
| [`connections/airtable3/api.json`](connections/airtable3/api.json) | `refresh.log.sanitize` | `request.headers.authorization`, `response.body.access_token`, `response.body.refresh_token` | the same three plus `request.body.refresh_token` |
| `README.md` | new file | none | this document |

[`installSpec.json`](installSpec.json) and [`connections/airtable3/metadata.json`](connections/airtable3/metadata.json) are kept as exported, with `text` for their secret inputs, for the reason given under hypothesis 7. [`base.imljson`](base.imljson) already masked `request.headers.authorization` and `request.headers.X-Airtable-Client-Secret`, so no base path changed. The `clientId` inputs stay `text`.
