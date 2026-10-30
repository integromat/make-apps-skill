# Clockify — cascading selectors, read-before-update and a second report host

A **normalized, anonymized reference export** of a Clockify custom app. Every section the export contained is retained: base, connection, 36 modules, 9 RPCs, 6 webhooks, 5 helper functions, groups and install files. It is reading material for Make app patterns. It is **not** a certified standalone package, not a tested deployment, and not the result of any live or authenticated validation. Imported helpers, tests and samples are retained as data and were not executed during this curation.

Back to the [app examples index](../README.md).

## How to read this export

The folder is the platform's normalized export layout, not an SDK project. Each module directory holds `api.json` (communication), `expect.json` (mappable input fields), `parameters.json` (static parameters), `interface.json` (output fields), `samples.json` and `metadata.json`. RPC, webhook and connection directories follow the same idea. Start with [`metadata.json`](metadata.json), then [`base.imljson`](base.imljson), then one module.

| Item | Value (from [`metadata.json`](metadata.json)) |
| --- | --- |
| App name / label | `clockify` / Clockify |
| `version` | 1 |
| `rev` | 27 |
| `versionFull` | 1.19.4 |
| `manifestVersion` | 2 |
| Connection | `clockify`, type `basic`, rev 4 ([metadata](connections/clockify/metadata.json)) |

`version: 1` is Make's app version. It is unrelated to the provider's `v1` URL path.

## Learning objectives

1. **Shared request defaults.** [`base.imljson`](base.imljson) sets the base URL, injects the API-key header from the connection and masks that header in logs. Module URLs such as [`updateTimeEntry`](modules/updateTimeEntry/api.json) are relative to it.
2. **Cascading selectors.** [`updateTimeEntry/expect.json`](modules/updateTimeEntry/expect.json) nests workspace, then project, then task, each backed by an RPC such as [`listProjects`](rpcs/listProjects/api.json) and [`listTasks`](rpcs/listTasks/api.json).
3. **Read-before-update.** [`updateTimeEntry/api.json`](modules/updateTimeEntry/api.json) does a GET into `temp`, then a PUT that merges user input over the stored values with `ifempty`. Section "Hypotheses" explains what that merge can and cannot clear.
4. **A second API host.** The four report modules post to a separate reports host through absolute URLs, for example [`getDetailedReport`](modules/getDetailedReport/api.json). They still inherit the base header.
5. **Page-number pagination.** [`findTimeEntries/api.json`](modules/findTimeEntries/api.json) and [`rpcs/listTasks`](rpcs/listTasks/api.json) request `page` and stop on a length condition. They send no page-size parameter.
6. **Helper roles.** [`parseTimeResponse`](functions/parseTimeResponse/code.js) parses time-interval dates, [`parseDates`](functions/parseDates/code.js) walks `a[...].b` paths, [`ifObjEmpty`](functions/ifObjEmpty/code.js) and [`eraseEmptyFields`](functions/eraseEmptyFields/code.js) trim filter objects, [`estimate`](functions/estimate/code.js) shapes a project estimate.
7. **Generic escape hatch.** [`makeApiCall`](modules/makeApiCall/expect.json) lets a user choose either host and send a custom request.

## Setup and permissions

- A Clockify account and a personal API key (the connection help text points at the provider's profile settings page). The key is sent as the `X-Api-Key` header.
- Which workspaces, projects, user groups, reports and expenses a key can reach depends on the account's workspace role and plan. This export does not establish those limits.
- The six webhook directories ([`webhooks/`](webhooks/clockify/api.json)) are `web` hooks whose `attach.json`, `detach.json` and `update.json` are all `null`. The export therefore contains no code that registers or removes a webhook at the provider. How a delivery URL gets configured is not shown here.
- During this curation nothing was connected to a real Clockify account.

## Inventory and dependency closure

| Component | Count | Notes |
| --- | --- | --- |
| Modules | 36 | Groups in [`groups.json`](groups.json): time entries, projects, tasks, clients, tags, timer, workspaces, reports, user groups, and `makeApiCall`. Six are instant triggers (`watch*`). |
| RPCs | 9 | `listWorkspaces`, `listUsers`, `listProjects`, `listClients`, `listTags`, `listGroups`, `listTasks`, `listTimeEntries`, `getCategories`. |
| Webhooks | 6 | `clockify` (Timer), `clockify2` (Time Entry), `clockify3` (Client), `clockify4` (Project), `clockify5` (Task), `clockify6` (Tag). |
| Connections | 1 | `clockify`. |
| Functions | 5 | Listed above. All five `test.json` files contain only `null`. |
| Samples | 36 | Every module `samples.json` contains only `null`. |

Reviewer text search over the export found:

- Every `rpc://` reference in module `expect.json` files names one of the nine exported RPCs. Two spellings occur: the short `rpc://listWorkspaces` and an app-qualified `rpc://app%23clockify@1/listWorkspaces`, which pins this app's version 1. Both resolve to the same exported RPC names. The qualified form was not tested for how it resolves after import into a differently named app.
- Each `watch*` module's `hookName` matches one exported webhook directory.
- Every module that declares an `accountName` uses `clockify`, and the six `watch*` modules declare a `hookName` instead. No `altAccountName` is set anywhere, so the export has no alias to a connection or hook that is missing from it.

Not shown: the platform's behavior when this folder is uploaded, any component that exists in the original app but was not exported, and runtime resolution of IML expressions. Closure is therefore "no gap found by static reading", not "verified deployable".

## API version and matching public documentation

- Source routes: base `https://api.clockify.me/api/v1`; reports at `https://reports.api.clockify.me/v1/workspaces/{id}/reports/...`. The paths carry a `v1` segment only. **No dated API pin or version header exists in the source.**
- Public documentation: <https://docs.clockify.me/>. It describes the main API (v1) and the separate Reports API, accepts `X-Api-Key`, and lists regional server variants of both hosts that this export does not use. The retrieved page matches the source's base path and header. It is current documentation, so it is **not proof of the API as it was when this export was made**, and it does not demonstrate live behavior.
- The current update-time-entry schema (`PUT /v1/workspaces/{workspaceId}/time-entries/{id}`) accepts an empty description (length 0 to 3000) and requires `start` in the request; `start`/`end` use `yyyy-MM-ddThh:mm:ssZ`. The current docs show `timeZone` in report requests and do not say how Make serializes date inputs.
- The time-entries-for-a-user route (`GET /v1/workspaces/{workspaceId}/user/{userId}/time-entries`) matches the route in [`findTimeEntries/api.json`](modules/findTimeEntries/api.json) line 15; its `start` and `end` query values are documented as date-times with a trailing `Z`. See hypothesis 2.
- Make date handling: <https://help.make.com/date-and-time-functions> documents that the timezone argument of `formatDate` controls the conversion to a local textual representation.
- Pagination. The list-endpoint schemas inspected are described with `page` and `page-size`, while the documentation's introduction prose says `pageSize`. The evidence recorded here does not match each list route one by one, and it does not cover the tasks route used by [`rpcs/listTasks`](rpcs/listTasks/api.json). This export sends neither a page size nor `page-size`, so the page size is left to the provider and was not established.

## Static checks actually performed

The final static check of this folder passed with no errors. It covered strict JSON parsing, source comparison, relative-link resolution and a private-path marker search; imported code, helpers and tests stayed data and were not executed.

- All 307 original source files were retained and none were removed; the only added file is this `README.md` (308 files in the folder).
- 297 of the files are JSON and all parsed strictly with no errors. The other 10 files are `code.js` and `arguments.txt` for the five helpers.
- The source comparison against the original found one delta, the `apiKey` type change listed under "Public changes", which is an allowed credential-input change, and no other difference.
- Every relative link in the README resolved, and no private-path markers were found.

Reviewer reading of the source (text search, no execution) produced the observations in this README.

**Not performed, and not claimed:** helper or test execution, Make schema/import validation, any call to Clockify or Make, and any runtime check of IML expressions.

## Retained data limitations

- Samples and function tests are `null` placeholders; there is no captured provider response in this folder.
- Helpers are reference code. [`parseTimeResponse`](functions/parseTimeResponse/code.js) reads `body.timeInterval.start` without a guard, and guards `end`. [`eraseEmptyFields`](functions/eraseEmptyFields/code.js) splices array items inside an iteration; whether that matters for the report filter was not tested.
- [`metadata.json`](metadata.json) has `docs: null`, `description: null` and empty categories as exported.

## Hypotheses

Statuses: **confirmed** (shown by source plus documented semantics), **not reproduced** (no support found), **unresolved** (needs runtime or provider evidence). No status below is a live test result.

| # | Hypothesis | Status | Evidence and limits |
| --- | --- | --- | --- |
| 1 | Date helpers that call `iml.parseDate` without an explicit timezone argument are a timezone defect. | **Not reproduced** | [`parseTimeResponse`](functions/parseTimeResponse/code.js) and [`parseDates`](functions/parseDates/code.js) parse provider date-time strings. A missing explicit timezone does not by itself show an error, the documentation retrieved does not establish one, and nothing was run. This is a separate question from hypothesis 2, which concerns a different file and a different mechanism. |
| 2 | When `environment.timezone` has a nonzero UTC offset, `findTimeEntries` sends `start`/`end` filter values that label a local wall time as UTC. | **Confirmed by static source and documentation (conditional); no runtime test** | [`findTimeEntries/api.json` lines 3 and 6](modules/findTimeEntries/api.json) call `formatDate(parameters.start/end, 'YYYY-MM-DDTHH:mm:ss.SSS', environment.timezone)` and then append a literal `Z`. Make's [date and time functions documentation](https://help.make.com/date-and-time-functions) says the timezone argument controls conversion to a local textual representation, so the text is local wall time. Clockify's current [documentation](https://docs.clockify.me/) for the matching `GET .../user/{userId}/time-entries` route shows `start`/`end` as date-times with a trailing `Z`, which denotes a UTC instant. For a nonzero offset the two disagree, so the sent instant is shifted by that offset. With a UTC timezone the text is consistent. No imported expression was executed and no request was made, so this describes the mapping, not an observed result. Kept separate from hypothesis 1 and from report timezone handling (hypothesis 3). |
| 3 | Report date and timezone inputs are mishandled. | **Unresolved** | [`getDetailedReport`](modules/getDetailedReport/api.json) maps `dateRangeStart`, `dateRangeEnd` and `timeZone` straight through; `timeZone` is a user-selectable field in [`expect.json`](modules/getDetailedReport/expect.json). How the engine serializes a date-only input is not shown. |
| 4 | A blank description cannot be cleared in `updateTimeEntry`. | **Confirmed by static reading** | [`api.json`](modules/updateTimeEntry/api.json) sends `ifempty(parameters.description, temp.description)`. Make's [General functions documentation](https://help.make.com/general-functions) has an `ifempty` example in which an empty string returns the fallback, and this repository's [IML guidance](../../current-knowledge/guides/iml-and-helpers.md) says the same. An empty text input therefore selects the stored description read into `temp`. The current provider schema accepts an empty description, so the limit comes from the mapping. Only the empty-string case is established by the fetched public page, and the platform behavior was not run against the provider. |
| 5 | `false` or `0` are lost by the same merge. | **Not reproduced** | This repository's [IML guidance](../../current-knowledge/guides/iml-and-helpers.md) says `ifempty` keeps `false` and `0`; the fetched General functions page was not used for that point. `billable: false` is therefore carried by the expression as written. Only the expression was read. |
| 6 | Null, empty tag arrays, or clearing project/task/end work. | **Unresolved** | No `ifempty` or provider evidence on these cases was retrieved. No claim is made about erase pills, arrays or other empty values beyond the empty-string case in hypothesis 4. |

Additional advisory, not a defect claim: the GET-then-PUT update is not atomic, so concurrent edits between the two requests would be overwritten.

## Public changes

One source delta and this README were added to the public copy. The delta is a credential-input type change on an ordinary connection parameter, not a functional repair. Nothing else differs from the normalized export.

| File | Field | Before | After |
| --- | --- | --- | --- |
| [`connections/clockify/parameters.json`](connections/clockify/parameters.json) | `apiKey` `type` | `text` | `password` |
| `README.md` | new file | none | this document |

The header was already masked in logs in [`base.imljson`](base.imljson) and in the [connection check](connections/clockify/api.json) (`request.headers.X-Api-Key`), so no log path changed. The `findTimeEntries` date mapping, the helpers and the help link to a public color-code website in [`addProject/expect.json`](modules/addProject/expect.json) were left as exported.
