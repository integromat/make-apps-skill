# Grist - normalized app export

Reference for a mid-sized Make custom app (31 modules) on the Grist REST API: bulk record create/update/delete with nested key/value mapping, access updates, file downloads, polling triggers over a nested response, and a basic connection with a configurable team subdomain.

This is a normalized export of an existing Make custom app. All sections (base, both connections, modules, RPCs, helpers with `test.json`, samples) are kept as reference data and none were executed. It is not a certified deployable package, and no live, authenticated, provider or Make validation was done.

## What you can learn here

- Domain-aware base URL and bearer header: [`base.imljson`](base.imljson), connection check in [`connections/grist/api.json`](connections/grist/api.json).
- Bulk add and update with a repeatable "column and value" mapping converted to an object: [`modules/addRecordsToTable/api.json`](modules/addRecordsToTable/api.json), [`modules/updateTableRecords/api.json`](modules/updateTableRecords/api.json), [`functions/convertKeyValue/code.js`](functions/convertKeyValue/code.js).
- Cascading selectors (document, table, record or column): [`modules/updateTableRecords/expect.json`](modules/updateTableRecords/expect.json), backed by [`rpcs/listDocuments`](rpcs/listDocuments/api.json), [`rpcs/listColumns`](rpcs/listColumns/api.json), [`rpcs/listRows`](rpcs/listRows/api.json).
- Flattening a nested response for a selector and a trigger: [`functions/getDocs/code.js`](functions/getDocs/code.js).
- Access updates built with `toCollection`: [`modules/updateDocumentAccess/api.json`](modules/updateDocumentAccess/api.json), [`modules/updateOrgsAccess/api.json`](modules/updateOrgsAccess/api.json).
- Binary downloads with a derived file name: [`modules/getDocumentAsExcel/api.json`](modules/getDocumentAsExcel/api.json), [`modules/getDocumentTableCSV/api.json`](modules/getDocumentTableCSV/api.json), [`functions/getFileName/code.js`](functions/getFileName/code.js).
- Date triggers with `response.trigger`: [`modules/watchDocuments/api.json`](modules/watchDocuments/api.json).

## Version and API family

| Item | Value | Where |
| --- | --- | --- |
| Make app version / revision | `1` / `11` | [`metadata.json`](metadata.json) (`version`, `rev`) |
| Exported full version string | `1.0.4` | `versionFull` in [`metadata.json`](metadata.json) |
| Source API path family | Unversioned `baseUrl` `https://{{ifempty(connection.domain, 'docs')}}.getgrist.com/api/` | [`base.imljson`](base.imljson) |
| Provider documentation | [REST API usage](https://support.getgrist.com/rest-api/) and [REST API reference](https://support.getgrist.com/api/), labelled Grist API `1.0.1` | |

These are separate things, as are any Grist product release and the connection revisions (`2` and `3`). Source paths carry no version segment.

## Setup

1. In Grist, open the Developer page of your account settings and create an API key ([authentication docs](https://support.getgrist.com/rest-api/#_top)). A key carries your full account access.
2. In the connection, enter `apiKey` ([`parameters.json`](connections/grist/parameters.json)). `domain` is only the subdomain prefix: leave it empty for a personal site (`docs`) or enter, for example, `team`, not `team.getgrist.com`, because the source appends `.getgrist.com`. The field's help text mentions `<TEAM>.getgrist.com`, which is easy to misread.
3. The check calls `GET https://<domain>.getgrist.com/api/orgs`; the base sends `Authorization: Bearer <apiKey>`.
4. `install.json` is `{}`, `installSpec.json` is `[]`; `groups.json` only arranges modules in the UI.

## Inventory and coverage

- 1 base, 2 connections, 31 modules, 7 RPCs, 4 helper functions, 0 webhooks. RPCs (`listColumns`, `listDocuments`, `listOrgs`, `listRows`, `listTables`, `listWorkspaces`, `urlParameterForUniversalModule`) are referenced as `rpc://app%23grist@1/<name>`.
- Modules by `typeId`: 2 polling triggers (1: `watchDocuments`, `watchWorkspaces`), 20 actions (4), 8 list/search (9), 1 universal API call (12: [`makeApiCall`](modules/makeApiCall/api.json)).
- Every module's `accountName` is `grist`. The second connection, [`connections/grist-759204`](connections/grist-759204/metadata.json), is labelled `Grist (NOT USED)`, has the same `api.json` and `parameters.json` shape, and is referenced by no module. Both are kept as imported.
- Reviewed against the REST reference: authentication, workspace listing, downloads, record add/update/delete and the org, workspace and document access routes. Other endpoints were compared to the source structure only.
- Read: base, both connections, all four helpers, all RPCs, and the trigger, record, download and access modules.
- Checks on the export as released: all 226 JSON/IMLJSON files parse; byte-identical to the baseline. Not performed: running helpers or tests, calling Grist or Make, importing into Make, schema validation.

## Public changes

One input-type change in two files, field `apiKey`: `"type": "text"` to `"type": "password"` in [`connections/grist/parameters.json`](connections/grist/parameters.json) and [`connections/grist-759204/parameters.json`](connections/grist-759204/parameters.json). The key carries full account access, and Make's [basic connection documentation](https://developers.make.com/custom-apps-documentation/app-components/connections/basic-connection) uses `password` for secrets. `domain` stays `text`; help text, `required` and expressions are unchanged. No `log.sanitize` change: the base masks `request.headers.authorization` and both checks mask `request.headers.Authorization`, which are equivalent because sanitize paths are [case-insensitive](https://developers.make.com/custom-apps-documentation/component-blocks/api/making-requests#sanitize). No other source changes.

## Hypothesis status

Statuses: Confirmed, Not reproduced, Unresolved. Confirmed means a deterministic observation of the source files only.

| Concern | Status | Evidence |
| --- | --- | --- |
| Bulk CRUD | Confirmed | [`addRecordsToTable`](modules/addRecordsToTable/api.json) and [`updateTableRecords`](modules/updateTableRecords/api.json) send `{records: [...]}` with `POST` and `PATCH` to `/docs/{docId}/tables/{tableId}/records`, matching the reference (`fields`; `id` plus `fields`). [`deleteTableRows`](modules/deleteTableRows/api.json) posts the row ID array to `.../data/delete`, which the reference documents as deprecated and accepting an array of integer IDs; a newer `.../records/delete` also exists. Deprecated is not removed. No batching limit is applied; whether selector values arrive as integers is untested. |
| Nested mapping | Confirmed | `fields` arrays of `{key, value}` become objects in [`convertKeyValue`](functions/convertKeyValue/code.js) for add and update. It mutates its input, fails if `fields` is not an array, and a repeated `key` is overwritten by the last. Values are declared `text` in [`expect.json`](modules/addRecordsToTable/expect.json). |
| Access routes | Confirmed | Document, workspace and org access use `PATCH .../access` with `delta.users` from `toCollection(users, 'email', 'role')`; document and workspace also send `maxInheritedRole`. All three routes are documented and take a `delta` object. |
| File downloads | Confirmed | Excel (`/download/xlsx`), CSV (`/download/csv`, passing the required `tableId`) and SQLite (`/download`) modules return `data` and `fileName`. The optional header option (`colId` or `label`) is not exposed. |
| Missing filename guard | Confirmed | [`getFileName`](functions/getFileName/code.js) runs `s.match(...)[1]` with no null check, and all three download modules pass it the `content-disposition` response header. In standard JavaScript an unquoted value yields `null`, and indexing it throws. |
| Provider response failure from filename parsing | Unresolved | The reference does not specify `Content-Disposition` syntax or require a quoted file name. Needs real response headers. |
| Polling order assumption | Unresolved | Both triggers declare `order: "desc"` over `GET /orgs/current/workspaces` ([`watchDocuments`](modules/watchDocuments/api.json), [`watchWorkspaces`](modules/watchWorkspaces/api.json)). The reference lists no sort parameter or ordering guarantee for it, so descending order is neither documented nor shown to be violated. Make's [trigger documentation](https://developers.make.com/custom-apps-documentation/app-components/modules/trigger) says `order` must describe what the remote API returns. No live missed-event count exists. |
| Removing an access entry | Unresolved | The reference's removal example uses `null`. The role select has no empty option and `role` is not required ([`expect.json`](modules/updateOrgsAccess/expect.json)), so how a UI removal is expressed is untested. |

## Limitations

- `watchDocuments` flattens documents across workspaces in response order. The `event` select uses `0` (created) and `1` (updated) with `if(parameters.event, item.updatedAt, item.createdAt)`, relying on `0` being false; not checked in Make.
- [`listRows`](rpcs/listRows/api.json) labels rows with only the first three field values ([`concatColumns`](functions/concatColumns/code.js)) and caps selectors at 100; [`listRecordsFromTable`](modules/listRecordsFromTable/api.json) has no `pagination` block.
- All four helpers have `test.json` equal to `null`. `samples.json` files are imported sample data, not provider-verified responses.
