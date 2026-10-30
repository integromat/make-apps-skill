# Slack (user and bot OAuth, semantic errors, shared event hook)

Reference material for a large Make custom app that offers the same modules under two OAuth connections (a user token and a bot token), treats Slack's `ok: false` replies as errors, and receives events through a shared webhook. This is an anonymized, normalized export. All sections, helpers and `test.json` files are retained as data. It is not a certified deployable package and nothing in it was validated against a live provider or a Make scenario.

## Learning goals

- Two connections for one provider: `slack2` = "Slack (user)" stores `authed_user.access_token`, `slack3` = "Slack (bot)" stores the top-level `access_token`; modules list both via `accountName` / `altAccountName` ([CreateMessage metadata](modules/CreateMessage/metadata.json), [slack2 api](connections/slack2/api.json), [slack3 api](connections/slack3/api.json)).
- Scope assembly at authorize time: `getScopes(oauth.scope, 'user' | 'bot')` filters module scopes through a per-token-type allow-list ([getScopes](functions/getScopes/code.js)).
- Semantic errors on HTTP 200: base `response.valid` and `error.message` call [isValid](functions/isValid/code.js), [getErrorMessage](functions/getErrorMessage/code.js) and [getErrorType](functions/getErrorType/code.js) ([base.imljson](base.imljson)).
- Cursor pagination with a client-side name filter ([PublicChannels rpc](rpcs/PublicChannels/api.json)).
- Shared-webhook design: a `web-shared` hook with a URL-verification reply and per-authorization fan-out ([webhooks/slack2/api.json](webhooks/slack2/api.json), [getWebhookBody](functions/getWebhookBody/code.js)).

## Original version

| Item | Value | Source |
| --- | --- | --- |
| App version | `4` | [metadata.json](metadata.json) `version` |
| Revision | `12` | `rev` |
| Full version | `4.9.3` | `versionFull` (`beta: true`) |
| Connection revisions | `slack2` 7, `slack3` 7 | [slack2](connections/slack2/metadata.json), [slack3](connections/slack3/metadata.json) |

## Component inventory

- Connections (2): `slack2` (user), `slack3` (bot), both `oauth`.
- Webhooks (2): `slack2` "New Event" (`web-shared`, `aliasTo: "slack-events"`) and `slack` "Slack Interactivity" (`web-shared`).
- Modules (65) in 14 groups ([groups.json](groups.json)): messages, files, channels, reactions, stars, saved items, pins, users, reminders, events, profile, do-not-disturb, saved item, other (`MakeAPICall`, `watchInteractivityEvents`, `inviteUser`). `NewEvent` binds to hook `slack2`; `watchInteractivityEvents` binds to hook `slack`.
- RPCs (9): [PublicChannels](rpcs/PublicChannels/api.json), [PrivateChannels](rpcs/PrivateChannels/api.json), [IMChannels](rpcs/IMChannels/api.json), [MPIMChannels](rpcs/MPIMChannels/api.json), [Users](rpcs/Users/api.json), [interfaceEvent](rpcs/interfaceEvent/api.json), [listPrivateChannels](rpcs/listPrivateChannels/api.json), [searchChannels](rpcs/searchChannels/api.json), [teams](rpcs/teams/api.json).
- Functions (21), for example `getBlocksData`, `getScopes`, `isValid`, `getWebhookBody`.
- Component exports (2): two files under [component-exports/](component-exports/), each holding a private-channel message module definition (`GetPrivateChannelMessage` / `getPrivateChannelMessage`) that [groups.json](groups.json) lists but `modules/` does not contain.
- [install.json](install.json) and [installSpec.json](installSpec.json) are present; client credentials are declared on each connection.

## Practical setup

1. Create a Slack app and note its Client ID and Client Secret.
2. Create each connection (user and/or bot) and enter the Client ID and Client Secret ([metadata `installSpec`](connections/slack2/metadata.json)); register the Make redirect URI in the Slack app. Extra scopes can be added through the advanced `scopes` array ([parameters](connections/slack2/parameters.json)).
3. Scopes are computed from the modules, not declared on the connection (`scope: []`).
4. Event delivery needs the shared hook target described below and the Events request URL configured on the Slack side; the export has no attach/detach logic for it (`attach.json` is `null`).

## API version, app version and documentation version

- Source API: Slack Web API methods under `https://slack.com/api/` (no numbered API release) with OAuth v2 endpoints `oauth.v2.access` and `/oauth/v2/authorize` ([slack2 api](connections/slack2/api.json)).
- The app's `4` / `4.9.3` / rev `12` is Make's own versioning and unrelated to Slack. RPC bindings carry the app version, e.g. `rpc://app%23slack@4/PublicChannels` ([webhooks/slack2/parameters.json](webhooks/slack2/parameters.json)).
- Docs compared (fetched 2026-10-30):
  - [oauth.v2.access](https://docs.slack.dev/reference/methods/oauth.v2.access/) matches `POST /api/oauth.v2.access`. It returns the bot `access_token` and the user `authed_user.access_token`, may answer with `ok: false`, and the tokens are secrets. Sending `client_secret` in the body is supported; Basic authentication is a recommendation, not a requirement.
  - [Verifying requests from Slack](https://docs.slack.dev/authentication/verifying-requests-from-slack/) says to verify `X-Slack-Signature` (HMAC SHA256 over timestamp and raw body) and check timestamp freshness against replay. A challenge reply alone does not establish authenticity.

## Dependencies, bindings and limitations

- `slack2` hook `aliasTo: "slack-events"`: the `aliasTo` value is itself the only reference to `slack-events`. No locally exported hook implementation or directory named `slack-events` exists (only the hook folders `slack` and `slack2`), so the alias target is not part of this export. The export documents the local half of a shared-ingress design only.
- Client Secret inputs use Make's documented [`password` parameter type](https://developers.make.com/custom-apps-documentation/block-elements/parameters/password) in the connection parameters. The `installSpec` inputs on each connection keep `type: text`; this is unresolved, see "Public changes note".
- `NewEvent` returns `valid: true` and `payload` unchanged ([api.json](modules/NewEvent/api.json)).
- The hook `scope` list in [slack2 metadata](webhooks/slack2/metadata.json) repeats `channels:read`; `getScopes` has no `emoji:read`.
- Modules reference both connections; copies renamed from `slack` need the `rpc://app%23slack@4/...` references updated.

## Checks performed

- JSON parsing by the coordinator on 2026-10-30: 484 of 526 files are JSON, all parsed with zero failures (the remainder are helper `code.js`/`arguments.txt`). Inventory counts match the list above (2 connections, 2 webhooks, 65 modules, 9 RPCs, 21 functions, 2 component exports).
- Source inspection: metadata, base, both connections, both webhooks, `NewEvent`, `CreateMessage`, [groups.json](groups.json), the paginated channel RPC, the component-export heads, and the helpers `isValid`, `getErrorMessage`, `getErrorType`, `getScopes`, `getWebhookBody`, `isWebhookCondition`, `isWebhookEvent`; text searches for `signature`, `x-slack`, `signing`, `client_secret`, `slack-events`, `isWebhookCondition` and `isWebhookEvent`.
- Comparison with the two Slack pages above. No code or tests were executed; no authenticated or live call was made.
- Post-edit static verification on 2026-10-30: parsed every JSON/IMLJSON file (484 of 526 source files), checked every relative README link, retained every original source file, found all helper/test files byte-identical, and limited structured source deltas to the documented connection-secret parameter types. No helper code execution or live tests occurred.

## Hypothesis status

| # | Hypothesis | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Shared-hook dependency is missing | **Confirmed as a local fact; deployed effect unresolved** | [webhooks/slack2/metadata.json](webhooks/slack2/metadata.json) has `aliasTo: "slack-events"`; no locally exported hook implementation or directory named `slack-events` exists. Whether an external shared ingress supplies it cannot be determined from this export. Not an inferred defect. |
| 2 | Local signature check absent | **Source absence confirmed; deployed protection unresolved** | [webhooks/slack2/api.json](webhooks/slack2/api.json) only answers `url_verification` with the challenge (`condition: body.type == 'url_verification'`). No local file reads `X-Slack-Signature`, a timestamp or a signing secret, and [webhooks/slack/api.json](webhooks/slack/api.json) (interactivity) parses `body.payload` with no check either. The provider recommends signature verification, but a shared ingress may do it elsewhere, so this is not a confirmed end-to-end unauthenticated-events defect; no source change was made. |
| 3 | Semantic `ok: false` replies are not treated as errors | **Not reproduced** | Base `valid` is `isValid(body, headers)` (true only for `body.ok` or download headers) and `error.message` is built from `body.error`; `info` and `token` use `valid: {{body.ok}}` ([base.imljson](base.imljson), [slack2 api](connections/slack2/api.json)). |
| 4 | OAuth log masking gaps | **Not reproduced** | `token` sanitizes `request.body.code`, `request.body.client_secret` and the response tokens (`authed_user.access_token` for the user connection) in both [slack2](connections/slack2/api.json) and [slack3](connections/slack3/api.json); the bot flow does not request user scopes. |
| 5 | Client Secret input unmasked in connection parameters | **Confirmed, fixed in connection parameters only** | `clientSecret` is used only in the `token` body of both connections and was `type: text`; it is now `type: password` in both parameters files. `installSpec` masking is **unresolved** (no context-specific UI contract was found; see below). |

Additional observation, not fixed, runtime impact unresolved: [isWebhookCondition](functions/isWebhookCondition/code.js) throws unconditionally (its logic is commented out), and the hook's `iterate.condition` is `{{if(data, isWebhookCondition(data, item), true)}}`. It would fail whenever `data` is truthy; whether Make supplies `data` for this shared hook is unknown. [isWebhookEvent](functions/isWebhookEvent/code.js) contains the working comparison but nothing references it.

## Public changes note

Only one change was made: the credential input `clientSecret` went from `type: text` to `type: password` in the connection parameters. Make's [Password parameter page](https://developers.make.com/custom-apps-documentation/block-elements/parameters/password) documents `type: password` as masking text while a connection is created or edited. All other types, expressions, bindings, null/false/0 values and date formats are preserved.

| File | Before | After |
| --- | --- | --- |
| [connections/slack2/parameters.json](connections/slack2/parameters.json) `clientSecret` | `type: text` | `type: password` |
| [connections/slack3/parameters.json](connections/slack3/parameters.json) `clientSecret` | `type: text` | `type: password` |

Unresolved: the `installSpec` `clientSecret` inputs in [connections/slack2/metadata.json](connections/slack2/metadata.json) and [connections/slack3/metadata.json](connections/slack3/metadata.json) remain `type: text`, and the `install.common` structure is unchanged. They are retained because no context-specific UI contract for `installSpec` / `common` input masking was found. Make's [connections documentation](https://developers.make.com/custom-apps-documentation/app-components/connections) describes common data as encrypted stored data, which does not establish how those input fields are displayed. No runtime flaw is inferred.
