# Coda (Superhuman Docs) - normalized app export

Reference for a Make custom app on a token-authenticated REST API with cursor pagination, dynamic column mapping and polling triggers.

This is a normalized export of an existing Make custom app. All sections (base, connection, modules, RPCs, helpers with `test.json`, samples) are kept as reference data and none were executed. It is not a certified deployable package, and no live, authenticated, provider or Make validation was done.

## What you can learn here

- Dynamic mapper fields from a paginated list endpoint: [`rpcs/getColumnsShow/api.json`](rpcs/getColumnsShow/api.json), [`rpcs/getColumnsShowForUpdate/api.json`](rpcs/getColumnsShowForUpdate/api.json), helper [`functions/buildColumns/code.js`](functions/buildColumns/code.js).
- Mapping a collection or `{column, value}` array to the provider's `cells` payload: [`functions/prepareColumns/code.js`](functions/prepareColumns/code.js), [`functions/fetchKeys/code.js`](functions/fetchKeys/code.js), used by [`createARow`](modules/createARow/api.json), [`updateRow`](modules/updateRow/api.json), [`upsertRows`](modules/upsertRows/api.json).
- `pageToken`/`nextPageToken` cursor pagination: [`modules/listRows/api.json`](modules/listRows/api.json).
- Cascading selectors (doc, table, row or column): [`modules/updateRow/expect.json`](modules/updateRow/expect.json).
- Polling triggers: [`watchNewRows`](modules/watchNewRows/api.json), [`watchUpdatedRow`](modules/watchUpdatedRow/api.json), [`watchNewDocs`](modules/watchNewDocs/api.json).

## Version and API family

| Item | Value | Where |
| --- | --- | --- |
| Make app version / revision | `1` / `16` | [`metadata.json`](metadata.json) (`version`, `rev`) |
| Exported full version string | `1.5.8` | `versionFull` in [`metadata.json`](metadata.json) |
| Source API path family | Coda REST API v1, `baseUrl` `https://coda.io/apis/v1` | [`base.imljson`](base.imljson) |
| Provider schema checked | OpenAPI `info.version` 1.6.0, "Superhuman Docs API", base path `https://docs.superhuman.com/apis/v1` | [OpenAPI JSON](https://docs.superhuman.com/apis/v1/openapi.json) |

These are four different things. The source host (`coda.io`) differs from the documented host (`docs.superhuman.com`); whether the old host is an alias is unresolved.

## Setup

1. Import the sections as reference: base [`base.imljson`](base.imljson), connection [`connections/coda`](connections/coda/metadata.json) (type `basic`).
2. The only credential is an API token, field `apiKey`, type `password` ([`parameters.json`](connections/coda/parameters.json)). The check calls `GET /whoami` ([`api.json`](connections/coda/api.json)) and uses `loginId` as the connection label.
3. Requests send `Authorization: Bearer <token>` ([`base.imljson`](base.imljson)).
4. `install.json` is `{}`, `installSpec.json` is `[]`; `groups.json` only arranges modules in the UI.

## Inventory and coverage

- 1 base, 1 connection, 28 modules, 11 RPCs, 3 helper functions, 0 webhooks; no shared hook or alias is used, and every `rpc://app%23coda@1/...` URI resolves inside this export.
- Modules by `typeId`: 3 polling triggers (1), 16 actions (4), 8 list/search (9), 1 universal API call (12: [`MakeAPICall`](modules/MakeAPICall/api.json)).
- Reviewed against the OpenAPI schema: doc, table, column and row modules, the three watchers, the selector RPCs, `whoami`. Pages, folders, formulas, controls and `resolveBrowserLink` modules were read for structure but not compared endpoint by endpoint.
- Checks on the export as released: all 215 JSON/IMLJSON files parse; byte-identical to the baseline. Not performed: running helpers or tests, calling Coda or Make, importing into Make, module-interface schema validation.

## Public changes

None. The token field was already `password`. The base masks `request.headers.Authorization` and the connection check masks `request.headers.authorization`; Make's [sanitize documentation](https://developers.make.com/custom-apps-documentation/component-blocks/api/making-requests#sanitize) says paths are case-insensitive, so both requests are masked.

## Hypothesis status

Statuses: Confirmed, Not reproduced, Unresolved. Confirmed means a deterministic observation of the source files only.

| Concern | Status | Evidence |
| --- | --- | --- |
| Dynamic columns | Confirmed | [`createARow/expect.json`](modules/createARow/expect.json) nests `getColumnsShow`, which pages `/columns` (limit 100, `repeat` 30, so at most about 3000 columns); `buildColumns` maps `id` to `name` and `name` to `label`. `updateRow` and `upsertRows` use `getColumnsShowForUpdate`. `buildColumns` does not filter calculated columns, which the schema flags per column. |
| Cursor pagination | Confirmed | `body.nextPageToken` feeds `pageToken` and the condition stops when it is empty ([`listRows`](modules/listRows/api.json), [`listDocs`](modules/listDocs/api.json), the watchers). This matches the documented contract. `getColumnsUsingTableIdDocId` asks for `limit` 500 against a documented column cap of 100; the schema says larger limits are clamped. |
| Row CRUD request shapes | Confirmed | `POST rows[{cells}]`, `PUT row{cells}` and `DELETE` are consistent. `createARow` and `deleteRow` have no Map mode, while `updateRow` and `upsertRows` do. |
| Mutation status tracking | Confirmed | The schema says edits return 202 and are applied asynchronously, with a `requestId` for `getMutationStatus`. `upsertRows` sets `response.output` to `""`, and no module polls status. This is a design limit, not a proven defect. |
| Row trigger order declaration | Confirmed | [`watchNewRows`](modules/watchNewRows/api.json) and [`watchUpdatedRow`](modules/watchUpdatedRow/api.json) send no `sortBy` yet declare `trigger.order: "desc"`. The schema says unspecified row order is creation time ascending. Make's [trigger documentation](https://developers.make.com/custom-apps-documentation/app-components/modules/trigger) says `order` describes what the remote API returns, drives paging and sorting, and recommends descending retrieval because of a 3200-record limit. The declared order and the documented default disagree; `watchUpdatedRow` also keys on `updatedAt` without requesting that sort. |
| First-page-only doc selectors | Confirmed | [`getDocs`](rpcs/getDocs/api.json) and [`getAllDocs`](rpcs/getAllDocs/api.json) send `limit` 500 with no pagination block, so one page is offered. |
| Paginated selectors without an app-level cap | Confirmed | Seven RPCs (for example [`getRowsUsingTableIdDocId`](rpcs/getRowsUsingTableIdDocId/api.json), `getTablesUsingdocId`) follow every page and set no `response.limit`. Make still applies runtime limits, so they are not unlimited. The official [dynamic-options guide](https://developers.make.com/custom-apps-documentation/app-components/rpcs/dynamic-options-rpc) advises a defined limit when more than 500 options are possible. |
| Live polling impact; docs trigger order; option-list size effects; host alias | Unresolved | No run measured missed events or large-list behavior. The docs list is documented as ordered by latest user-relevant event, while `watchNewDocs` declares `desc` on `createdAt` (or `updatedAt` when `sortBy` is `updated`, a parameter not sent to the provider). `coda.io` versus `docs.superhuman.com` equivalence is not documented. |

## Limitations

- `listRows` has `limit` default 2 and offers `createdAt` and `natural` but not `updatedAt` ([`expect.json`](modules/listRows/expect.json)); the schema's `updatedAt` sort excludes calculated-value updates.
- `columns` is an array-wrapped collection in `getColumnsShow` and a bare object in `getColumnsShowForUpdate`; how Make renders each is unresolved.
- `samples.json` files are imported sample data, not provider-verified responses.
