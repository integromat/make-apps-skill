# Netlify - normalized app export

Reference for a small Make custom app (12 modules) on a REST API with bearer-token auth, page-number selectors and instant (webhook) triggers that attach and detach provider-side hooks.

This is a normalized export of an existing Make custom app. All sections (base, connection, modules, RPCs, webhook components, helpers with `test.json`, samples) are kept as reference data and none were executed. It is not a certified deployable package, and no live, authenticated, provider or Make validation was done.

## What you can learn here

- Compact base with shared header and error mapping: [`base.imljson`](base.imljson).
- Token-check connection with `GET /user`: [`connections/netlify/api.json`](connections/netlify/api.json).
- One-request modules: [`modules/getSite/api.json`](modules/getSite/api.json), [`modules/createSiteBuild/api.json`](modules/createSiteBuild/api.json).
- Page-only pagination, with no `condition`, in a list module and a selector RPC: [`modules/listSites/api.json`](modules/listSites/api.json), [`rpcs/listSites/api.json`](rpcs/listSites/api.json).
- Dependent selectors (site, then form) in a webhook component: [`webhooks/netlify/parameters.json`](webhooks/netlify/parameters.json).
- Hook lifecycle (`POST /hooks` on attach, `DELETE /hooks/{id}` on detach): [`webhooks/netlify/attach.json`](webhooks/netlify/attach.json), [`webhooks/netlify/detach.json`](webhooks/netlify/detach.json).
- One component driven by a user-chosen event: [`webhooks/netlify5/attach.json`](webhooks/netlify5/attach.json) with [`rpcs/listHooksTypes/api.json`](rpcs/listHooksTypes/api.json).
- Universal API call: [`modules/makeAnAPICall/api.json`](modules/makeAnAPICall/api.json).

## Version and API family

| Item | Value | Where |
| --- | --- | --- |
| Make app version / revision | `1` / `5` | [`metadata.json`](metadata.json) (`version`, `rev`) |
| Exported full version string | `1.7.0` | `versionFull` in [`metadata.json`](metadata.json) |
| Source API path family | Netlify REST API, `baseUrl` `https://api.netlify.com/api/v1/` | [`base.imljson`](base.imljson) |
| Provider schema checked | Netlify OpenAPI (Swagger 2.0) `info.version` `2.63.1`, host `api.netlify.com`, basePath `/api/v1` | [swagger.yml](https://raw.githubusercontent.com/netlify/open-api/master/swagger.yml) |

These are separate things, as are the connection (revision `3`) and webhook component (revision `4`) revisions.

## Setup

1. Create a Netlify personal access token in the user settings and paste it into the connection field `accessToken` ([`parameters.json`](connections/netlify/parameters.json)).
2. The connection check calls `GET https://api.netlify.com/api/v1/user` with `authorization: Bearer <token>`; the base sends the same header on every request.
3. Instant triggers need Make to supply a public webhook URL, which is registered with Netlify through `POST /hooks` on attach.
4. `install.json` is `{}`, `installSpec.json` is `[]`; `groups.json` only arranges modules in the UI.

## Inventory and coverage

- 1 base, 1 connection, 12 modules, 4 RPCs, 5 webhook components, 3 helper functions. All four RPCs are referenced as `rpc://app%23netlify@1/<name>` and exist.
- Modules by `typeId`: 5 instant triggers (10), 3 actions (4), 3 list/search (9), 1 universal API call (12). Components `netlify` to `netlify5` map to those triggers in order; their `update.json` is `null`.
- Reviewed against the provider schema: all route paths the source calls (`/user`, `/sites`, `/sites/{site_id}`, `forms`, `deploys`, `builds`, `files`, `/hooks`, `/hooks/{id}`, `/hooks/types`) and the referenced `hook`, `hookType`, `site`, `form`, `deploy`, `build` and `file` definitions. Read: base, connection, all webhook components, RPCs and helpers, and every module request definition.
- [`groups.json`](groups.json) lists `createSite` and `createAndDeploySite`, which have no module folders. [`createSiteDeploy/api.json`](modules/createSiteDeploy/api.json) holds a one-element array instead of an object. Both are kept as imported.
- Checks on the export as released: all 128 JSON/IMLJSON files parse; byte-identical to the baseline. Not performed: running helpers or tests, calling Netlify or Make, importing into Make, module-interface schema validation.

## Public changes

Two credential corrections; no other source changes.

| File | Before | After |
| --- | --- | --- |
| [`connections/netlify/parameters.json`](connections/netlify/parameters.json), field `accessToken` | `"type": "text"` | `"type": "password"` |
| [`connections/netlify/api.json`](connections/netlify/api.json), `log.sanitize` | `["request.qs.access_token"]` | `["request.qs.access_token", "request.headers.authorization"]` |

The connection check sends the token in the `authorization` header, and a `request.qs.*` mask does not cover a header; the base already masks `request.headers.authorization`. Sanitize paths use dot notation and are case-insensitive ([docs](https://developers.make.com/custom-apps-documentation/component-blocks/api/making-requests#sanitize)). Make's [basic connection documentation](https://developers.make.com/custom-apps-documentation/app-components/connections/basic-connection) uses `password` for secrets.

## Hypothesis status

Statuses: Confirmed, Not reproduced, Unresolved. Confirmed means a deterministic observation of the source files only.

| Concern | Status | Evidence |
| --- | --- | --- |
| Compact REST | Confirmed | Each module is one request on a relative path ([`getSite`](modules/getSite/api.json), [`createSiteBuild`](modules/createSiteBuild/api.json)); the base supplies URL, header and error text. [`makeAnAPICall`](modules/makeAnAPICall/api.json) uses `https://api.netlify.com/api/{{parameters.url}}`, so the caller supplies `v1/...`. |
| Paginated selectors | Confirmed | `listSites` pages with `page` = `{{pagination.page}}` and `per_page` 50: the RPC caps at `response.limit` 300, the module uses the user `limit` (default 2) via `temp.limit`. Neither has a `condition`. Make's [pagination docs](https://developers.make.com/custom-apps-documentation/component-blocks/api/pagination) stop page-only pagination on empty output or `response.limit`, so this is valid; the provider's end-of-list behavior is untested. |
| Unpaged deploy list | Confirmed | The schema documents optional `page` and `per_page` on `/sites/{site_id}/deploys`, but [`rpcs/listSiteDeploys`](rpcs/listSiteDeploys/api.json) and [`modules/listSiteDeploys`](modules/listSiteDeploys/api.json) send one request, so only the provider's default page is returned. `/forms` and `/files` document no paging parameters, so single requests there match the schema. |
| Managed hook lifecycle | Confirmed | All five components attach with `POST /hooks` (`type: url`, `data.url` = `{{webhook.url}}`), store `body.id` as `webhook_id`, and detach with `DELETE /hooks/{{webhook.webhook_id}}`. Fixed events: `submission_created`, `deploy_failed`, `deploy_created`, `deploy_building`; [`netlify5`](webhooks/netlify5/attach.json) takes `parameters.event`, and its `site_id` and `event` selectors are not marked `required`. |
| Hook creation request contract | Confirmed | The `hook` schema includes `site_id` in the body, but `POST /hooks` also marks `site_id` as a **required query** parameter. The source sends `site_id` only in the body. That is a documented request-contract mismatch. The source also sends `form_id` in the body, which the `hook` schema does not list. |
| Provider acceptance of body-only `site_id` and `form_id` | Unresolved | A body property does not show that the required query parameter may be omitted. Needs a provider response. |
| Missing credential input masking | Confirmed (corrected) | `accessToken` was `text`, now `password`. |
| Missing Authorization log masking | Confirmed (corrected) | The connection step masked only the query string; the header mask was added. |

## Limitations

- [`formatDates`](functions/formatDates/code.js) tests `updated_at` but parses `last_modified`, and tests `created_at` but parses `created`. It is applied to [`listSites`](modules/listSites/api.json) and [`listFiles`](modules/listFiles/api.json). Unchanged.
- [`rpcs/listHooksTypes`](rpcs/listHooksTypes/api.json) has the unbalanced expression `{{formatHooks(body[1].events}}` (missing `)`), unchanged. `body[1]` is the first element of the response array, so only the first hook type's events are read; how Make evaluates the expression is untested. [`formatHooks`](functions/formatHooks/code.js) keeps only event names containing `deploy`, so the form event never appears in that selector.
- [`createSiteDeploy`](modules/createSiteDeploy/api.json) sends `title` in the body, while the schema lists `title` as a query parameter; acceptance is untested.
- [`siteResponse`](functions/siteResponse/code.js) deletes `site_id` from the body. All three helpers have `test.json` equal to `null`.
- Webhook payload signing was not assessed. `samples.json` files are imported sample data, not provider-verified responses.
