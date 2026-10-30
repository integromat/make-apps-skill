# Stripe — API-key Basic auth, cursor pagination and webhook registration

A **normalized, anonymized reference export** of a Stripe custom app. Every section the export contained is retained: base, connection, 51 modules, 23 RPCs, 2 webhooks, 15 helper functions, groups and install files. It is reading material for Make app patterns. It is **not** a certified standalone package, not a tested deployment, and not the result of any live or authenticated validation. Imported helpers, tests and samples are retained as data and were not executed during this curation.

Back to the [app examples index](../README.md).

## How to read this export

The folder is the platform's normalized export layout, not an SDK project. Each module directory holds `api.json` (communication), `expect.json` (mappable input fields), `parameters.json` (static parameters), `interface.json` (output fields), `samples.json` and `metadata.json`. RPC, webhook and connection directories follow the same idea. Start with [`metadata.json`](metadata.json), then [`base.imljson`](base.imljson), then one module.

| Item | Value (from [`metadata.json`](metadata.json)) |
| --- | --- |
| App name / label | `stripe` / Stripe |
| `version` | 1 |
| `rev` | 22 |
| `versionFull` | 1.32.3 |
| `manifestVersion` | 1 |
| Connection | `stripe`, type `basic`, rev 5 ([metadata](connections/stripe/metadata.json)) |

`version: 1` is Make's app version. It is unrelated to the provider's `/v1` URL path and to any dated Stripe API version. Note that `manifestVersion` is 1 here, whereas the Clockify, Amazon Lambda and Airtable exports report 2.

## Learning objectives

1. **API key as Basic auth.** [`base.imljson`](base.imljson) sends `Basic` plus the base64 of the connection key and a colon, sets the base URL to `https://api.stripe.com/v1` and masks the authorization header. The [connection check](connections/stripe/api.json) repeats the header with its own `parameters.key` because a connection does not inherit the base, and calls the balance route.
2. **Cursor pagination.** [`listCustomers/api.json`](modules/listCustomers/api.json) sends `limit` capped with `min(..., 100)`, remembers the last item ID in `temp`, sends it as `starting_after`, and continues while `body.has_more` is set. [`searchCustomers`](modules/searchCustomers/api.json) uses the iterate container's last item instead.
3. **Form-encoded writes.** [`createCustomer/api.json`](modules/createCustomer/api.json) builds a form body through [`encodeRequestBody`](functions/encodeRequestBody/code.js), which flattens nested values into `parent[child]` keys.
4. **Error mapping.** `base.imljson` maps Stripe's error type to a Make error type through [`resolveErrorType`](functions/resolveErrorType/code.js) and joins code, parameter, message and documentation link into the message.
5. **Output normalization.** [`prepareOutput`](functions/prepareOutput/code.js) converts Unix timestamps to dates per object type.
6. **Selectors from RPCs.** For example [`createPaymentIntent/expect.json`](modules/createPaymentIntent/expect.json) fills customer, currency and payment-method pickers from [`listCustomers`](rpcs/listCustomers/api.json), [`listCurrencies`](rpcs/listCurrencies/api.json) and [`listCustomerPaymentMethods`](rpcs/listCustomerPaymentMethods/api.json).
7. **Two generations of instant trigger.** [`watchEvents`](modules/watchEvents/metadata.json) uses the newer webhook [`stripe2`](webhooks/stripe2/api.json), which registers an endpoint at the provider in [`attach.json`](webhooks/stripe2/attach.json) and removes it in [`detach.json`](webhooks/stripe2/detach.json). [`WatchCharges`](modules/WatchCharges/metadata.json) uses the deprecated [`stripe`](webhooks/stripe/api.json) webhook ("Watch Events (Legacy)").
8. **Trigger output typing.** [`buildTriggerInterface`](rpcs/buildTriggerInterface/api.json) builds the output interface for the selected event group.
9. **Escape hatch.** [`makeAnApiCall`](modules/makeAnApiCall/api.json) sends any method and path to `https://api.stripe.com/`.

## Setup and permissions

- A Stripe account and an API key. The provider documents that the key is the Basic-auth username with no password, and distinguishes secret and restricted keys; the source's header matches that. The connection check reads the balance, so the key must be allowed to read it (not verified against retrieved documentation). Which other resources a restricted key may reach follows its permissions, which this export does not establish.
- Instant triggers need an endpoint at Stripe. `stripe2` can register one through the API; see the webhook notes below. The retained `docs` text in [`metadata.json`](metadata.json) and the help text of the legacy webhook say Stripe does not support automatic registration and that the endpoint is added by hand in the dashboard. That prose does not match the supplied attach implementations, which register an endpoint through `POST /webhook_endpoints`. No evidence here says which was written first or which one the platform follows at run time. Both were left as exported.
- The webhook parameter `connect` chooses whether the endpoint receives events from connected accounts; `api_version` is optional free text.
- The connection is **not** OAuth. A retrieved Stripe Connect OAuth reference page exists in the supplied evidence but does not apply to this export's `basic` connection.
- During this curation nothing was connected to a real Stripe account.

## Inventory and dependency closure

| Component | Count | Notes |
| --- | --- | --- |
| Modules | 51 | Groups in [`groups.json`](groups.json): Triggers (2), Universal (1), Charges (5), Payment Links (4), Payment Intents (7), Customers (6), Refunds (4), Payouts (5), Balance (3), Invoices (8), Invoice Items (5), Other (1). |
| RPCs | 23 | Selector lists (`list*`, `get*`), `buildTriggerInterface`, and two leftovers named `test` and `test2`. |
| Webhooks | 2 | `stripe` (legacy, deprecated) and `stripe2`. |
| Connections | 1 | `stripe`. |
| Functions | 15 | `arrayMapper`, `buildInterfaceForGroup`, `debug`, `encodeBodyArray`, `encodeRequestBody`, `encodeSearchFilter`, `expandables`, `json2urlencoded`, `log`, `mapToKeyVal`, `parseCurrencies`, `parseTimestampOutput`, `prepareOutput`, `requestBuilder`, `resolveErrorType`. All 15 `test.json` files contain only `null`. |
| Samples | 51 | 29 module `samples.json` files contain only `null`; 22 hold retained anonymized structures (see limitations). |

Reviewer text search over the export found:

- Every `rpc://` reference uses the app-qualified form `rpc://app%23stripe@1/...` and names one of the 23 exported RPCs. Five RPCs (`getCapturableCharges`, `getPayouts`, `getRefunds`, `test`, `test2`) were not referenced by any module file found.
- Every module and RPC that declares an `accountName` uses `stripe`, the exported connection. No `altAccountName` is set anywhere and every `aliasTo` is `null`.
- `watchEvents` declares `hookName: "stripe2"` and `WatchCharges` declares `hookName: "stripe"`; both match exported webhook directories. The `stripe2` webhook declares `accountName: "stripe"`; the legacy `stripe` webhook declares none, and both modules declare no `accountName`.

Not shown: platform import behavior, components that existed in the original app but were not exported, and runtime resolution of IML. Closure is therefore "no gap found by static reading", not "verified deployable".

## API version and matching public documentation

- Source routes: base `https://api.stripe.com/v1`, plus absolute `https://api.stripe.com/...` in `makeAnApiCall`. **`/v1` is the provider's URL namespace, not a dated API pin.** No `Stripe-Version` header or dated literal appears in the source, so the version used for requests is the account's default, which this export cannot show. The one place a date can enter is the optional webhook `api_version` text parameter, which has no default and which `stripe2`'s attach forwards.
- Retrieved public documentation (current, so **not proof of the API as it was when this export was made**, and none of it shows live behavior):

| Source area | Retrieved page | What it supports |
| --- | --- | --- |
| Authentication | <https://docs.stripe.com/api/authentication> | HTTP Basic Auth with the key as username and no password. Matches `base.imljson`. |
| Pagination | <https://docs.stripe.com/api/pagination> | `starting_after` / `ending_before` cursors; forward traversal while `has_more`. Matches `listCustomers`; not an audit of every list module. |
| Versioning | <https://docs.stripe.com/api/versioning> | A request uses the account default unless `Stripe-Version` is set; a webhook endpoint's `api_version` separately selects event payload rendering. |
| Endpoint create | <https://docs.stripe.com/api/webhook_endpoints/create> | `POST /v1/webhook_endpoints` returns the endpoint with its `secret` populated; `api_version` is optional. Matches both attach files. |
| Endpoint object | <https://docs.stripe.com/api/webhook_endpoints/object> | The `secret` is returned only at creation. |
| Signature checks | <https://docs.stripe.com/events/manage-webhook-endpoints#signature-errors> | Verification needs the unmodified raw body, the `Stripe-Signature` header and the endpoint signing secret. |

## Static checks actually performed

The final static check of this folder passed with no errors. It covered strict JSON parsing, source comparison, relative-link resolution and a private-path marker search; imported code, helpers and tests stayed data and were not executed.

- All 455 original source files were retained and none were removed; the only added file is this `README.md` (456 files in the folder).
- 425 of the files are JSON and all parsed strictly with no errors. The other 30 files are `code.js` and `arguments.txt` for the 15 helpers.
- The source comparison against the original found exactly the three deltas listed under "Public changes", all allowed credential-input or log-mask changes, and no other difference.
- Every relative link in the README resolved, and no private-path markers were found.

Reviewer reading of the source (text search, no execution) produced the observations in this README.

**Not performed, and not claimed:** helper or test execution, Make schema/import validation, any call to Stripe or Make, and any runtime check of IML expressions.

## Retained data limitations

- The 22 non-null `samples.json` files hold anonymized provider-shaped structures, with placeholders such as `REDACTED` and non-operational example hosts. Where they came from is not shown, and they carry no guarantee of matching the provider's behavior, past or present.
- All 15 helper `test.json` files are `null`.
- [`rpcs/test`](rpcs/test/api.json) is a leftover debug RPC (`GET https://api.stripe.com/v1/charges`) that deliberately retains a privacy-redacted literal `Authorization: Bearer <REDACTED_CREDENTIAL>` header. It is **neutralized reference data**, not a usable request: it needs an appropriate credential binding before it could be used. The original token was not reconstructed and the RPC was not rebound to the connection; the file is kept as exported. [`rpcs/test2`](rpcs/test2/api.json) returns a fixed label and is also kept as exported.
- `PaymentIntent` modules expose the provider's `client_secret` field in their output interfaces, as provider output. This was not changed.
- [`metadata.json`](metadata.json) `docs` text refers to the platform's former name and to dashboard steps that may have changed. It was left as exported.

## Hypotheses

Statuses: **confirmed** (shown by the source plus documented semantics), **not reproduced** (no support found), **unresolved** (needs runtime or provider evidence). No status below is a live test result.

| # | Hypothesis | Status | Evidence and limits |
| --- | --- | --- | --- |
| 1 | The `/v1` base is a dated API pin. | **Not reproduced** | `base.imljson` has no `Stripe-Version` header; the retrieved versioning page says the account default applies without one. The effective default is not knowable from this export. |
| 2 | The webhook `api_version` setting sets a known version. | **Unresolved** | [`stripe2/parameters.json`](webhooks/stripe2/parameters.json) defines it as optional advanced text with no default, and [`attach.json`](webhooks/stripe2/attach.json) forwards `parameters.api_version`. Whether the platform omits an empty value from the form body, or sends an empty string, was not shown. |
| 3 | The local receive code verifies Stripe's signature. | **Confirmed absent in the local source; platform-level verification unresolved** | Both receive definitions, [`stripe/api.json`](webhooks/stripe/api.json) and [`stripe2/api.json`](webhooks/stripe2/api.json), only project the body into output fields. `stripe2` also keeps `raw` as `{{body}}`, which is the parsed body; it does not establish that the exact original request bytes are available, and Stripe's signature check needs the unmodified raw body plus the `Stripe-Signature` header. Text search found no `Stripe-Signature`, raw-body check or HMAC anywhere in the export. Both webhook metadata files have `aliasTo: null` and `altAccountName: null`, so no shared alias is exported either. This does **not** show that Make's hosting layer accepts forged calls or that it verifies them; no platform behavior was tested. |
| 4 | There is no stored signing secret because there is no manual signing-secret parameter. | **Not reproduced** | No webhook or connection parameter asks for one, but that is not absence of secret storage: the `stripe2` attach stores the returned `body.secret` as hook data (`secret`). Text search found nothing else in the export that reads it, so the stored value is not used by any local receiver check. |
| 5 | The attach responses lack a log mask for the signing secret. | **Confirmed by static reading (missing mask path); runtime logging not exercised** | `stripe2` stores `body.secret` and neither attach request had a `log` section, so only the base authorization mask was inherited. The retrieved create page says the secret is returned in the creation response. Whether the platform actually logs response bodies by default was not tested, so actual signing-secret logging is not confirmed. See "Public changes". |
| 6 | The connection is OAuth. | **Not reproduced** | The connection `type` is `basic` and takes a single `key`. |
| 7 | `listCustomers` pagination skips or repeats pages. | **Not reproduced** | The `starting_after` / `has_more` pattern matches the retrieved pagination page. `temp.id` reads the last item of the current page. Only this module was compared. |
| 8 | A legacy `stripe` attach is run by the platform. | **Unresolved** | The legacy webhook's help text says the user must register the endpoint, the webhook declares no connection, and yet an `attach.json` exists. Which wins at runtime was not shown. |
| 9 | `rpcs/test` is a working request as exported. | **Not reproduced** | Its `Authorization` header is the literal `Bearer <REDACTED_CREDENTIAL>`, a privacy-redacted placeholder, not a credential. It needs an appropriate credential binding before use; nothing was reconstructed or rebound. |

The webhook-verification gap is documented, not fixed: this export does not implement verification and no signing-secret field was invented.

## Public changes

Three source deltas and this README were added to the public copy. They are one credential-input type change on an ordinary connection parameter and two log-mask additions, not functional repairs. Nothing else differs from the normalized export.

| File | Field | Before | After |
| --- | --- | --- | --- |
| [`connections/stripe/parameters.json`](connections/stripe/parameters.json) | `key` `type` | `text` | `password` |
| [`webhooks/stripe2/attach.json`](webhooks/stripe2/attach.json) | new `log.sanitize` | no `log` section (base `request.headers.authorization` inherited) | `request.headers.authorization`, `response.body.secret` |
| [`webhooks/stripe/attach.json`](webhooks/stripe/attach.json) | new `log.sanitize` | no `log` section (base `request.headers.authorization` inherited) | `request.headers.authorization`, `response.body.secret` |
| `README.md` | new file | none | this document |

The authorization path is listed again in each new `log` section so that it stays masked whether the platform merges or replaces the inherited list; that choice was not verified. The legacy attach does not read `secret` itself, but it posts to the same create route and returns the whole body as its output, so the same response field is masked there. No other log path, header or value changed, and [`rpcs/test`](rpcs/test/api.json) is intact as exported.
