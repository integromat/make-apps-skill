# Harvest - normalized app export

Reference for a larger Make custom app (61 modules) on an OAuth 2 REST API with page-number pagination, polling triggers, date helpers and cascading selectors.

This is a normalized export of an existing Make custom app. All sections (base, connection, modules, RPCs, helpers with `test.json`, samples) are kept as reference data and none were executed. It is not a certified deployable package, and no live, authenticated, provider or Make validation was done.

## What you can learn here

- OAuth 2 authorization-code connection with refresh and per-step log masks: [`connections/harvest2/api.json`](connections/harvest2/api.json), [`connections/harvest2/metadata.json`](connections/harvest2/metadata.json).
- Shared headers and error mapping: [`base.imljson`](base.imljson).
- `page` / `next_page` pagination: [`modules/getTimeEntries/api.json`](modules/getTimeEntries/api.json).
- Polling triggers with a `watch` select (new vs updated): [`modules/watchTimeEntries/api.json`](modules/watchTimeEntries/api.json).
- ISO strings to dates on responses and dates to `YYYY-MM-DD` on requests: [`functions/transformResponseDates/code.js`](functions/transformResponseDates/code.js), [`functions/transformRequestDates/code.js`](functions/transformRequestDates/code.js).
- Removing a path ID from a body before PATCH: [`functions/omit/code.js`](functions/omit/code.js), used by [`modules/editATimeEntry/api.json`](modules/editATimeEntry/api.json).
- Dependent selectors through RPCs: [`modules/watchTimeEntries/parameters.json`](modules/watchTimeEntries/parameters.json).

## Version and API family

| Item | Value | Where |
| --- | --- | --- |
| Make app version / revision | `2` / `11` | [`metadata.json`](metadata.json) (`version`, `rev`) |
| Exported full version string | `2.11.1` | `versionFull` in [`metadata.json`](metadata.json) |
| Source API path family | Harvest API v2, `baseUrl` `https://api.harvestapp.com/v2` | [`base.imljson`](base.imljson) |
| OAuth / account host | Harvest ID, `https://id.getharvest.com/api/v2/...` | [`api.json`](connections/harvest2/api.json) |
| Provider documentation | Harvest "API V2 Documentation" help center (authentication, pagination, time entries); no separate numeric schema version | links below |

App version `2`, the `/v2` path, the full version string and the revisions (connection component: `5`) are separate things.

## Setup

1. Register a Harvest ID OAuth2 application ([authentication docs](https://help.getharvest.com/api-v2/authentication-api/authentication/authentication/)) with the redirect URL Make shows for the connection.
2. The connection is `type: oauth` ([`metadata.json`](connections/harvest2/metadata.json)). `clientId` and `clientSecret` are taken at install level (`install.common`) and also as optional advanced connection fields ([`parameters.json`](connections/harvest2/parameters.json)).
3. After authorization, the `info` step calls `GET /api/v2/accounts` and stores `body.accounts[].id` as `harvest_account_id`. In Make IML an empty `[]` selects the first array element ([mapping arrays](https://help.make.com/mapping-arrays)), so the first account in the response is used. The docs say that list can mix Harvest and Forecast accounts (a `product` field); the source applies no filter. Multi-account behavior was not tested.
4. The base then sends `Authorization: Bearer ...` and `Harvest-Account-Id`. The `User-Agent` in base and connection is the placeholder `Integromat (redacted@example.com)`; Harvest asks for a contact address, so use your own.
5. `install.json` is `{}`, `installSpec.json` is `[]`; `groups.json` only arranges modules in the UI.

## Inventory and coverage

- 1 base, 1 connection, 61 modules, 16 RPCs, 3 helper functions, 0 webhooks; no shared hook or alias is needed. Two modules (`createBillableRate`, `createTaskAssignment`) use the qualified `rpc://app%23harvest@2/<name>` form, the rest `rpc://<name>`, and every referenced RPC exists under [`rpcs/`](rpcs/getUsers/api.json).
- Modules by `typeId`: 8 polling triggers (1), 40 actions (4), 12 list/search (9), 1 universal API call (12: [`makeApiCall`](modules/makeApiCall/api.json)).
- Reviewed against provider docs: authentication, pagination and time entries. Clients, contacts, projects, invoices, expenses, tasks, users and assignments were compared to the source structure only.
- Read: base, connection, all three helpers, every pagination block (by search), and a sample of modules.
- Checks on the export as released: all 428 JSON/IMLJSON files parse; byte-identical to the baseline. Not performed: running helpers or tests, calling Harvest or Make, importing into Make, schema validation.

## Public changes

One input-type change, in [`connections/harvest2/parameters.json`](connections/harvest2/parameters.json), field `clientSecret`: `"type": "text"` to `"type": "password"`. `clientSecret` is sent as `client_secret` to the token endpoint, and Make's [basic connection documentation](https://developers.make.com/custom-apps-documentation/app-components/connections/basic-connection) uses `password` for secrets. `clientId` stays `text`; labels, `advanced` and every expression are unchanged.

[`metadata.json`](connections/harvest2/metadata.json) is unchanged: its `installSpec` `clientSecret` is still `"type": "text"`. The `password` type is established for connection parameters, but support in `installSpec` is not, so that field is left as released; install-level secret masking is unverified. No other source changes.

## Hypothesis status

Statuses: Confirmed, Not reproduced, Unresolved. Confirmed means a deterministic observation of the source files only.

| Concern | Status | Evidence |
| --- | --- | --- |
| OAuth flow | Confirmed | Authorize URL with `client_id`, `redirect_uri`, `response_type=code`; token exchange and refresh are urlencoded POSTs to `/api/v2/oauth2/token`, matching the docs. Refresh runs when `data.expires < addMinutes(now, 1)`. |
| Missing token log masks | Not reproduced | `info` masks `request.headers.authorization`; `token` masks `request.body.code`, `client_secret` and both response tokens; `refresh` masks `client_secret`, `refresh_token` and both response tokens; the base also masks `harvest-account-id`. Sanitize paths are case-insensitive ([docs](https://developers.make.com/custom-apps-documentation/component-blocks/api/making-requests#sanitize)). `authorize` has no `log.sanitize`; it is a browser redirect and the code arrives in the callback. |
| Missing credential input masking | Confirmed (corrected) | `clientSecret` connection parameter was `text`, now `password` (see Public changes). |
| Shared page pattern | Confirmed | 34 files (19 modules, 15 RPCs) use `page` = `{{pagination.page}}` with `condition` `{{body.next_page}}`, as in [`getTimeEntries`](modules/getTimeEntries/api.json). |
| Pagination inconsistencies | Confirmed | `per_page: 100` is set in 28 of those files and omitted in 6 (for example [`getExpenses`](rpcs/getExpenses/api.json), [`listPayments`](modules/listPayments/api.json); documented default 2000). [`watchExpenses`](modules/watchExpenses/api.json) has no pagination. [`getInvoiceLineItems`](rpcs/getInvoiceLineItems/api.json) reads embedded `line_items` of one invoice. |
| Unguarded null timestamps | Confirmed | [`transformResponseDates`](functions/transformResponseDates/code.js) guards only the top-level object (`if (!obj) return null`). For keys in `timestamp_date_keys` (including `timer_started_at`) it runs `new Date(value)` with no null check. The [time-entries docs](https://help.getharvest.com/api-v2/timesheets-api/timesheets/time-entries/) say `timer_started_at` is null for a stopped timer, and the helper is applied to time entries ([`getATimeEntry`](modules/getATimeEntry/api.json)). `transformRequestDates` also calls `iml.formatDate` on date keys without a null check. |
| Runtime results of null dates, pagination mode and account choice | Unresolved | In standard JavaScript `new Date(null)` is the Unix epoch, but the Make runtime was not run. The [pagination docs](https://help.getharvest.com/api-v2/introduction/overview/pagination/) support page and cursor modes, recommend following `links.next`, and say `next_page` may be null under cursor pagination; that does not show page numbers fail. First-account selection, token-request `redirect_uri` handling (the docs example omits it) and `installSpec` masking are also untested. |

## Limitations

- `timestamp_time_keys`, `exceptions` and unused arrays in the helpers are empty and kept as imported.
- `transformResponseDates/test.json` is `null`; other `test.json` files are imported data.
- `samples.json` files are imported sample data, not provider-verified responses.
