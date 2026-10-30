# Asana (OAuth, instant webhook, dynamic custom-field forms)

Reference material for a large Make custom app that wraps the Asana REST API: 92 modules, one OAuth connection, one instant webhook, and many helpers that build custom-field inputs at design time. This is an anonymized, normalized export. All sections, helpers and `test.json` files are retained as data. It is not a certified deployable package and nothing in it was validated against a live provider or a Make scenario.

## Learning goals

- OAuth 2 against Asana with `client_secret` in a urlencoded token body and a refresh condition based on `expires` ([asana2 api](connections/asana2/api.json), [asana2 metadata](connections/asana2/metadata.json)).
- Instant-hook lifecycle: attach with `formatFilter`, store `externalHookId`, detach by id, and answer the `X-Hook-Secret` handshake ([api](webhooks/asana/api.json), [attach](webhooks/asana/attach.json), [detach](webhooks/asana/detach.json), [formatFilter](functions/formatFilter/code.js)).
- Dynamic custom-field inputs: RPCs fetch field definitions and helper functions turn them into Make parameter specs ([GenerateTaskCustomFields](rpcs/GenerateTaskCustomFields/api.json), [generateTaskCustomFieldParam](functions/generateTaskCustomFieldParam/code.js), [generateWorkspCustomFieldParam](functions/generateWorkspCustomFieldParam/code.js)).
- Offset pagination via `body.next_page.offset` and `opt_fields` shaping through helpers ([GetEnumerationFields](rpcs/GetEnumerationFields/api.json), [listTasksWithSpecificCustomField](modules/listTasksWithSpecificCustomField/api.json), [setOptFields](functions/setOptFields/code.js)).
- Base URL, bearer header and error message template ([base.imljson](base.imljson)).

## Original version

| Item | Value | Source |
| --- | --- | --- |
| App version | `2` | [metadata.json](metadata.json) `version` |
| Revision | `30` | `rev` |
| Full version | `2.19.10` | `versionFull` |
| Connection revision | `asana2` 12 | [metadata](connections/asana2/metadata.json) |
| Webhook revision | `asana` 15 | [metadata](webhooks/asana/metadata.json) |

## Component inventory

- Connection (1): `asana2`, `oauth`, scope `["default"]`.
- Webhook (1): `asana`, type `web`, `accountName: asana2`. Only [WatchProjectTask](modules/WatchProjectTask/metadata.json) ("Watch Webhook Events") has `hookName: "asana"`; the other watch modules have `hookName: null` and are not hook-bound.
- Modules (92) in 10 groups ([groups.json](groups.json)): Tasks 21, Projects 18, Workspaces/Teams/Users 13, Stories 6, Attachments 4, Tags 7, Custom Fields 10, Goals 2, Portfolios 7, Other 4 (`ListWebhooks`, `MakeanAPICall`, `watchNewTeams`, `listTasksWithSpecificCustomField`).
- RPCs (35), for example `GetCustomFields`, `GetCustomFieldsEnumOptions`, `GetEnumerationFields`, `GenerateTaskCustomFields`, `GenerateProjectCustomFieldParams`, `GenerateWorkspaceCustFieldParam`, `generateWorkspProjCustFields`, `getCustomFieldIDsForProject`, `GetProjectCustomFields`.
- Functions (32), including the `generate*CustomFieldParam(s)` family with `Alt`, `Alt2` and `Alt3` variants, `customFieldExtra`, `mergeCustomFields`, `setOptFields` / `Bis` / `Tris`, `transformRequestDates`, `parseCustomFieldDate`, `formatFilter`.
- Component exports (2): [first](component-exports/case-aab306703fb6c8e47ffb74c708f5732fc85d2407535e8411e80b874204a6d30d.json) holds an RPC labelled "... UNUSED"; [second](component-exports/case-f789a174ff802899885434ba0b4b77a76dd33e3f320f93d161e6a22054278391.json) holds a similarly named RPC.
- [install.json](install.json) and [installSpec.json](installSpec.json) are present.

## Practical setup

1. Register an Asana app and note its Client ID and Client Secret.
2. Create the `asana2` connection with those values ([installSpec](connections/asana2/metadata.json)) and register the Make redirect URI with the provider. The authorize URL and token URL are in [api.json](connections/asana2/api.json); the only requested scope is `default`.
3. For the instant module, the hook attaches with a resource gid and optional filters ([parameters](webhooks/asana/parameters.json)): `action` is one of changed, added, removed, deleted, undeleted, and `fields` is an optional array.

## API version, app version and documentation version

- Source API path: `https://app.asana.com/api/1.0/` ([base.imljson](base.imljson)). It matches the `/api/1.0` server path in Asana's published [OpenAPI description](https://raw.githubusercontent.com/Asana/openapi/master/defs/asana_oas.yaml). The `3.0.0` in that description is the OpenAPI schema version, not a service release.
- The app's `2` / `2.19.10` / rev `30` is Make's own versioning and unrelated to Asana. Docs were compared on 2026-10-30; no source-side documentation date exists in the export.
- Docs compared (paraphrased):
  - [Webhooks guide](https://developers.asana.com/docs/webhooks-guide): creating a webhook triggers a handshake in which Asana posts to the target with an `X-Hook-Secret` header and the receiver must echo that value in a 200/204 response header. Later deliveries carry a signature header computed with that secret, and the guide recommends rejecting deliveries whose signature does not match.
  - [Custom fields guide](https://developers.asana.com/docs/custom-fields-guide): `enum` and `multi_enum` fields are supported. Each enum option has `gid`, `name`, `enabled` and `color`. Disabled options remain in the metadata so old values stay readable but cannot be chosen for new values. `type` is deprecated in favour of `resource_subtype`, and `null` is a valid custom-field value.

## Dependencies, bindings and limitations

- `asana2` has `aliasTo: "asana"`; no connection folder named `asana` exists locally. The alias was not invented or removed. Local OAuth sections (`clientId` / `clientSecret` and the token flow) are present, but alias resolution and any runtime dependency on the target are unresolved because the target `asana` is absent. No claim of independence from the alias and no runtime security defect is made.
- The webhook's `accountName` is `asana2`. Its [parameters](webhooks/asana/parameters.json) bind RPCs as `rpc://app%23asana@2/<name>` (for example [GetWorkspaces](rpcs/GetWorkspaces/api.json), [GetProjects](rpcs/GetProjects/api.json), [GetTasks](rpcs/GetTasks/api.json)); the app name is `asana` and the version `2`, so copies renamed from `asana` need those references updated.
- Sample-map numeric keys in the exported samples were anonymized with cardinality and types preserved. They are example IDs, not runtime defects.
- Several helpers exist in `Alt` variants and one component export is labelled unused; which variant a module reaches is determined by its own expressions, not by this README.

## Checks performed

- JSON parsing by the coordinator on 2026-10-30: 737 of 801 files are JSON, all parsed with zero failures (the remainder are helper `code.js` / `arguments.txt`). Inventory counts match the list above (1 connection, 1 webhook, 92 modules, 35 RPCs, 32 functions, 2 component exports).
- Source inspection: base, connection api and metadata, the webhook files, `formatFilter`, [groups.json](groups.json), the enum RPCs, the task, project and workspace custom-field helpers, the `opt_fields` lists of the generating RPCs, and text searches for `X-Hook`, signature, secret and alias terms.
- Comparison with the two Asana pages and the OpenAPI description above. No code or tests were executed; no authenticated or live call was made.
- Post-edit static verification on 2026-10-30: parsed every JSON/IMLJSON file (737 of 801 source files), checked every relative README link, retained every original source file, found all helper/test files byte-identical, and limited structured source deltas to the documented connection-secret parameter type. No helper code execution or live tests occurred.

## Hypothesis status

| # | Hypothesis | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Missing `asana` alias target | **Confirmed as a local fact; runtime effect unresolved** | [metadata](connections/asana2/metadata.json) `aliasTo: "asana"`, no local `connections/asana`. Local OAuth sections are present, but alias resolution and runtime dependency are unresolved because the target `asana` is absent; no independence and no runtime security defect is claimed. Not repaired. |
| 2 | Webhook handshake does not echo `X-Hook-Secret` | **Not reproduced** | [api.json](webhooks/asana/api.json) `verification.condition` fires when the header is present and `verification.respond` returns status 200 with `X-Hook-Secret` set from `get(headers, 'X-Hook-Secret')`. |
| 3 | No verification after the handshake | **Confirmed locally; deployed protection unresolved** | The secret is not stored (attach keeps only `externalHookId`) and no file reads a signature header. The provider recommends signature rejection; this is a hardening gap, not an unconditional blocker, and no source change was made. |
| 4 | Enum filtering fails to omit disabled options | **Confirmed by static reading; runtime effect unresolved; not fixed** | In [generateTaskCustomFieldParam](functions/generateTaskCustomFieldParam/code.js), [generateWorkspCustomFieldParam](functions/generateWorkspCustomFieldParam/code.js) and [generateProjectCustomFieldParam](functions/generateProjectCustomFieldParam/code.js), `.map(option => ({label, value}))` runs before `.filter(option => option.enabled !== false)`, so the filter reads `undefined` and keeps every option. The generating RPCs request `enum_options.enabled`, so the data is available before the map. Fixing it is a functional change, outside this task. |
| 5 | `type` vs `resource_subtype` | **Unresolved compatibility / no break proven** | The helpers switch on `field.type` and RPCs request `this.type`; the docs call it deprecated, not removed. [generateWorkspProjCustFields](rpcs/generateWorkspProjCustFields/api.json) also requests `resource_subtype`. |
| 6 | Null / missing options | **Not reproduced** | The helpers use `(field.enum_options \|\| [])` and return `null` for unsupported types. [generateTaskCustomFieldParam](functions/generateTaskCustomFieldParam/code.js) handles only `text`, `number` and `enum`; the workspace variant also covers `multi_enum`, `date` and `people`. |
| 7 | Client Secret input unmasked in connection parameters | **Confirmed, fixed in connection parameters only** | `clientSecret` is used only in the token request body and was `type: text`; it is now `type: password` in [parameters.json](connections/asana2/parameters.json). `installSpec` masking is **unresolved** (no context-specific UI contract was found; see below). Sanitize lists already cover code, secret and tokens. |

## Public changes note

Only one change was made: the credential input `clientSecret` went from `type: text` to `type: password` in the connection parameters. Make's [Password parameter page](https://developers.make.com/custom-apps-documentation/block-elements/parameters/password) documents `type: password` as masking text while a connection is created or edited. All other types, expressions, bindings, null/false/0 values and date formats are preserved.

| File | Before | After |
| --- | --- | --- |
| [connections/asana2/parameters.json](connections/asana2/parameters.json) `clientSecret` | `type: text` | `type: password` |

Unresolved: the `installSpec` `clientSecret` input in [connections/asana2/metadata.json](connections/asana2/metadata.json) remains `type: text`, and the `install.common` structure is unchanged. It is retained because no context-specific UI contract for `installSpec` / `common` input masking was found. Make's [connections documentation](https://developers.make.com/custom-apps-documentation/app-components/connections) describes common data as encrypted stored data, which does not establish how those input fields are displayed. No runtime flaw is inferred.
