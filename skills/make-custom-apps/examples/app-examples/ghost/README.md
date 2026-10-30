# Ghost - normalized app export

Reference for a small Make custom app (13 modules) on the Ghost Admin API: a JWT built from an Admin API key, a read-then-write update that carries `updated_at`, and instant triggers backed by provider-side webhooks.

This is a normalized export of an existing Make custom app. All sections (base, connection, modules, RPCs, webhook components, helpers with `test.json`, samples) are kept as reference data and none were executed. It is not a certified deployable package, and no live, authenticated, provider or Make validation was done.

## What you can learn here

- Short-lived JWT from an `id:secret` key: [`functions/createJWT/code.js`](functions/createJWT/code.js) with [`functions/base64url/code.js`](functions/base64url/code.js), used by [`base.imljson`](base.imljson) and [`connections/ghost/api.json`](connections/ghost/api.json).
- Update with collision detection (GET, then PUT with `updated_at`, plus a custom 409 message): [`modules/updatePost/api.json`](modules/updatePost/api.json).
- Page-number pagination with a `condition` on provider metadata: [`modules/listPosts/api.json`](modules/listPosts/api.json), [`rpcs/listPosts/api.json`](rpcs/listPosts/api.json).
- Make filter UI value to Ghost filter string: [`functions/filter2string/code.js`](functions/filter2string/code.js).
- Webhook attach and detach through `/webhooks`: [`webhooks/ghost/attach.json`](webhooks/ghost/attach.json), [`webhooks/ghost/detach.json`](webhooks/ghost/detach.json).
- Event selectors per resource: [`webhooks/ghost/parameters.json`](webhooks/ghost/parameters.json) (posts), `ghost2` (pages), `ghost3` (members), `ghost4` (tags).
- Selector and field-interface RPCs: [`rpcs/listTags/api.json`](rpcs/listTags/api.json), [`rpcs/interfaceMember/api.json`](rpcs/interfaceMember/api.json).

## Version and API family

| Item | Value | Where |
| --- | --- | --- |
| Make app version / revision | `1` / `6` | [`metadata.json`](metadata.json) (`version`, `rev`) |
| Exported full version string | `1.2.1` | `versionFull` in [`metadata.json`](metadata.json) |
| Source API route | `{{connection.host}}/ghost/api/v3/admin` | [`base.imljson`](base.imljson) |
| JWT audience in source | `/v3/admin/` | [`createJWT`](functions/createJWT/code.js) |
| `Accept-Version` header | not sent anywhere in the source | |
| Provider documentation | Admin API authentication, versioning, post update and webhook pages (current `/admin/` examples) | links below |

The app version, the `v3` in the route, the revisions (connection component: `3`) and any Ghost install version are separate things. The route and JWT audience are explicit legacy `v3` values, while current documentation examples use `/admin/`; whether a current server accepts the legacy route and audience is unresolved and needs version-matched evidence. Per the [versioning documentation](https://docs.ghost.org/faq/api-versioning/), `Accept-Version` states the minimum version a client works with; it does not pin the installed version, and the source does not send it.

## Setup

1. In Ghost Admin, create a custom integration (Settings, Integrations) and copy the Admin API key (`id:secret`; see the [authentication page](https://docs.ghost.org/admin-api/#token-authentication)).
2. Fill the connection ([`parameters.json`](connections/ghost/parameters.json)): `host` is the site origin, for example `https://blog.example.com`, with no path, because the source appends `/ghost/api/v3/admin`; do not paste a full `/ghost/api/admin` URL. `key` is the Admin key and `integration_id` is required. The check calls `GET {host}/ghost/api/v3/admin/users`.
3. The base sends `authorization: Ghost <JWT>` from `createJWT(connection.key)` and adds `formats=html,mobiledoc` to every request.
4. Instant triggers need Make's public webhook URL, registered with Ghost on attach.
5. `install.json` is `{}`, `installSpec.json` is `[]`; `groups.json` only arranges modules in the UI.

## Inventory and coverage

- 1 base, 1 connection, 13 modules, 9 RPCs, 4 webhook components, 4 helper functions.
- Modules by `typeId`: 4 instant triggers (10: `watchPosts`, `watchPages`, `watchMembers`, `watchTags`), 5 actions (4), 3 search (9), 1 universal API call (12: [`universal`](modules/universal/api.json)). Webhook components `ghost` to `ghost4` have `update.json` equal to `null`.
- RPCs: 5 selectors (`listAuthors`, `listMembers`, `listPages`, `listPosts`, `listTags`) and 4 `interface*` field definitions.
- Reviewed against provider docs: authentication, versioning, post update and webhook creation. Members, tags, pages and authors were compared to the source structure only.
- Read: base, connection, all four helpers, the post modules, post and page webhook components, member and tag attach/event definitions, and several RPCs.
- Checks on the export as released: all 145 JSON/IMLJSON files parse; byte-identical to the baseline. Not performed: running helpers or tests, calling Ghost or Make, importing into Make, schema validation.

## Public changes

One input-type change, in [`connections/ghost/parameters.json`](connections/ghost/parameters.json), field `key`: `"type": "text"` to `"type": "password"`. The Admin key contains the signing secret, and Make's [basic connection documentation](https://developers.make.com/custom-apps-documentation/app-components/connections/basic-connection) uses `password` for secrets. Labels, `required` and expressions are unchanged. No `log.sanitize` change: the base masks `request.headers.authorization` and the connection check masks `request.headers.Authorization`, which are equivalent because sanitize paths are [case-insensitive](https://developers.make.com/custom-apps-documentation/component-blocks/api/making-requests#sanitize). No other source changes.

## Hypothesis status

Statuses: Confirmed, Not reproduced, Unresolved. Confirmed means a deterministic observation of the source files only.

| Concern | Status | Evidence |
| --- | --- | --- |
| JWT Admin auth recipe | Confirmed | [`createJWT`](functions/createJWT/code.js) splits the key on `:`, uses `HS256`, `kid` = id, `typ` `JWT`, `iat` = now, `exp` = now + 5 minutes, decodes the secret from hex and sends `Ghost <token>`, matching the documented recipe. `aud` is `/v3/admin/` where the docs show `/admin/`. |
| Conflict-detecting update | Confirmed | [`updatePost`](modules/updatePost/api.json) GETs the post, stores `body.posts[1].updated_at` (IML index 1 is the first element) in `temp`, then PUTs it as `updated_at`. The [update docs](https://docs.ghost.org/admin-api/posts/updating-a-post/) require `updated_at` for collision detection and recommend fetching the latest post first. A 409 gets a custom message from `details.clientUpdatedAt` and `details.serverUpdatedAt`. |
| Missing admin-key input masking | Confirmed (corrected) | `key` was `text`, now `password`. |
| Missing local webhook signature verification | Confirmed | No source file verifies a webhook signature, and all four `attach.json` files send `"secret": null`. The [creation docs](https://docs.ghost.org/admin-api/webhooks/creating-a-webhook/) make `secret` optional, and the [webhook overview](https://docs.ghost.org/webhooks/) specifies no signature algorithm or header, so this is a gap in the example, not a violated provider rule. |
| Provider signing contract and runtime exploitability | Unresolved | Needs the provider's signing specification (header, algorithm). |
| Legacy `v3` route and audience on current servers; `iml` JWT helper behavior | Unresolved | Needs version-matched evidence and a Make run; `iml.sha256`/`iml.base64url` were not exercised. |

## Limitations

- The fetched `updated_at` is read immediately before the PUT, so the check covers only that short window, not an older read held by the scenario. Docs also say tags and authors are replaced, not merged; how an unmapped array serializes is unresolved.
- `integration_id` is required in the form and sent in every webhook body, while the docs require it for user authentication, not token authentication. Whether it is harmless here is unresolved; the check defaults it to `integromat` when empty.
- [`filter2string`](functions/filter2string/code.js) has no branch for filter types other than `bool`, `text` and `date`; the effect is unresolved.
- All four helpers have `test.json` equal to `null`. `samples.json` files are imported sample data, not provider-verified responses.
