# Connections and the OAuth lifecycle

Back to the [knowledge index](../README.md).

A connection is the part of an app that proves who the user is and keeps proof alive. The other guides assume it works; this one explains how to author it end to end: choose the scheme, place credentials, persist and refresh tokens, check the connection, decide on scopes, and keep every dependent component on the same connection. Variable names per context and log masking are in [auth-context](auth-context.md).

## Choose the scheme from the provider's contract

Basic, JWT, OAuth 1.0 and OAuth 2.0 each have their own communication blocks and their own failure modes. Start from the provider's documented authentication, not from the scheme you know best.

* **Basic connection.** Credentials are typed by the user (API key, username/password). Use `password` parameters for secrets, put the credential in Base from `{{connection.*}}`, and add a connection check request only if the provider documents a cheap authenticated call. A Basic connection holds user-entered auth values and one communication request; the word "Basic" does not decide the wire format. OpenAPI `http`/`basic` means username/password HTTP Basic, and a scheme's name is an arbitrary label. API-key placement and an empty password need explicit provider support. When no check route is documented, do not invent one; see [auth-evidence-worked](auth-evidence-worked.md).
* **JWT.** The connection builds a signed token; signing inputs, algorithm and claims come from the provider.
* **OAuth 1.0.** A request-token step, user authorisation and an access-token step, with signed requests.
* **OAuth 2.0.** Authorisation-code flows need a user; client-credentials style flows need none and use `token.condition` (never with the authorisation-code flow, and with a single request). Choose the provider's redirect style: a dedicated app can use Make's redirect URI or a local one.

Editable connections and connection metadata are documented separately; changing what a user can edit on a connection is a design decision with compatibility consequences for existing connections.

### Connection label (metadata)

See [base and connections](../../../references/base-and-connections.md#bind-the-connection-label-to-a-returned-field) — the label's documented shape and 512-character limit, a field the check really returns, non-secret identity fields, and fallbacks for missing parts.

### Private keys, certificates and signed assertions

When the provider authenticates with key material, collect it with the parameter types built for it: `pkey` for a PEM private key and `cert` for a PEM certificate. Both accept a pasted PEM or extract it from a P12 or PFX file. Never collect a private key in a `text` parameter, which shows it in clear. Some grants have the connection sign its own assertion, such as a JWT bearer grant or a client assertion. Sign it with the documented `jwt` function and the algorithm the provider requires; for an RSA key, that is `RS256` with the `pkey` value as the key. The documentation lists `HS256`, `HS384`, `HS512` and `RS256` as the supported algorithms. Give the assertion the validity and unique identifier the provider requires, for example a few minutes and a fresh `jti`. While it is valid, a signed assertion works as a bearer credential. Add its request path (for example `request.body.assertion` or `request.body.client_assertion`) to `log.sanitize`, together with the client secret and the returned tokens.

## Trace the whole lifecycle

1. **Authorise.** Collect client credentials and user consent; keep client credentials (app-level) separate from user tokens.
2. **Exchange.** The token request returns access token, optional refresh token, expiry and sometimes extra values. Map only what the provider actually sends.
3. **Store.** Assign mapped values to connection data. What you assign is what the connection holds afterwards.
4. **Use.** Base and modules read `{{connection.accessToken}}`; they do not re-derive it.
5. **Expire.** `response.data.expires` makes Make refresh before the access token expires. `response.expires` is a different clock: the lifetime of the user's grant, after which the user must authorise again. Do not confuse them.
6. **Refresh.** The refresh block reads the stored refresh token and client credentials. In connection communication, `data` and `parameters` reach the same stored connection data (runtime-confirmed, adjudicated allowance), so the choice between `data.refreshToken` and `parameters.refreshToken` is naming only. `common` is different: it is the connection's common data (app-level secrets) and the documented code-grant example uses it as the fallback behind an editable parameter, `ifempty(parameters.clientId, common.clientId)`. Module contexts are different again ([auth-context](auth-context.md)).
7. **Invalidate and check.** Where the provider supports revocation, implement `invalidate`. Provide an `info` request for a harmless identity or account call, and test it with valid and invalid credentials. Use a capability the provider really documents; do not invent a "ping" endpoint, and do not derive a check from a server URL alone, which declares no operation. An explicitly documented authenticated `GET /` operation is valid.

### Token response nuances

Providers differ. A refresh response can omit the refresh token (keep the stored one), rotate it (replace the stored one, or later refreshes fail), omit the expiry, or omit optional fields. Decide each case from the provider contract and the documented persistence model. A missing assignment in the refresh response is not, by itself, proof of token loss; the question is whether the provider rotates. Automatic re-execution on a failed call is suitable only for a grant that can be repeated without new user interaction; never replay a one-use authorisation code.

**Lifetimes the response does not state.** When the token response has no `expires_in` but the provider documents the access-token lifetime, store that lifetime minus a safety margin in `response.data.expires`, so the renewal condition still has a date to compare. For a documented one-hour token, the OAuth 2.0 page uses `"expires": "{{addMinutes(now, 55)}}"`. When there is no `refresh_expires_in` but the documentation says how long a refresh token lives, set `response.expires` from that documented value rather than a guess, for example `"{{addYears(now, 1)}}"` for one year. A refresh token that does not expire needs no `response.expires`. A guessed lifetime that is too long lets modules start with an expired access token. It can also let the refresh token stop working before Make asks the user to reauthorise.

**Restating the grant expiry on refresh.** A `response.expires` in the `refresh` block sets the reauthorisation date again on every refresh. That is right only when a refresh starts a new refresh-token lifetime: either the refresh response returns a new refresh token with its own `refresh_expires_in`, or the provider documents a sliding lifetime. Some providers document a lifetime that counts from the original consent. There, a refresh block that writes `{{addDays(now, 90)}}` keeps moving the date forward. The provider then rejects the refresh token while Make still treats the grant as valid, and users see refresh errors instead of a reauthorisation prompt. In that case, store the original date in `response.data` when the token is first issued and write it back on refresh, for example `"expires": "{{ifempty(data.grantExpires, addDays(now, 90))}}"`. The provider's documentation decides which model applies.

### Asking for a refresh token

A `refresh` block only helps if the authorisation returned a refresh token in the first place. Many providers issue one only when the authorise request asks for offline access. They ask for it either with a query parameter or with a dedicated scope, such as the OpenID Connect `offline_access` scope, which the documented code-grant example puts in the default scope. Some issue a new refresh token on a repeated consent only when the consent screen is forced (in OpenID Connect, `prompt=consent`). Without these parameters, the first connection can work while a reauthorisation, or a second connection to the same account, comes back without a refresh token. The connection then stops working when that access token expires. Parameter names differ by provider, so send exactly what the provider documents. Forcing consent shows the consent screen on every authorisation, so add it only when the provider needs it to issue the token again. Pair it with a refresh response that keeps the stored refresh token when the provider omits it (see Pitfalls).

### Choosing the check request

See [base and connections](../../../references/base-and-connections.md#a-check-that-every-module-capable-credential-passes) — choosing a check that every credential the modules can use passes, including least-privilege keys.

### Rejecting credentials the app cannot use

Make saves a connection whenever its check request does not fail, and an HTTP status of 400 or higher fails on its own. A provider that answers 200 for an invalid credential needs `response.valid` built from its documented error flag ([requests-and-responses](../../../references/requests-and-responses.md)). The same check can reject a credential that the provider accepts but this connection's modules cannot use, for example a key of another type that the app serves with a separate connection: `"valid": {"condition": "{{body.data.me.kind == 'member'}}", "message": "This key type is not supported by this connection. Use the other connection type."}`. Base the condition on identity data that the check already returns and the provider documents. `message` is the error shown when the condition is false, so it should tell the user what to do. Never put a success text such as "Connected as …" there. The wrong credential then fails once, when the connection is created, instead of failing in every module.

## Additional OAuth scopes

Scopes must cover the operations the app promises. An extra-scopes input is a **conditional** capability: it matters for universal modules that can reach endpoint groups outside the baseline grant, where the guidance is a user-supplied extension merged with the normal scopes, plus an explanation of whether the user edits or recreates the connection to change the grant. It is not mandatory for every OAuth connection; a fixed set of operations covered by one baseline scope needs none. A parameter name or separator seen in one example is not a cross-provider rule. See [universal-modules-and-scopes](universal-modules-and-scopes.md).

When the extension is warranted, the documented pattern builds the authorise `scope` from Make's list plus the optional array parameter: `{{join(distinct(merge(oauth.scope, ifempty(parameters.additionalScopes, emptyarray))), ' ')}}`. The parameter name is the app's choice; the pages use `additionalScopes` and `scopes`. `ifempty(..., emptyarray)` keeps `merge` working when the user leaves the optional array empty. `distinct` stops a scope from being sent twice when the user repeats it or it is already requested. The `join` separator is the provider's; the documentation shows both a space and a comma. The parameter's help says that the scopes are for the universal module and that the user must add scopes for every call they plan to make. The universal module can show the documented `banner` that tells the user to edit or recreate the connection.

Declare each module's own scope on the module, including the scopes its RPCs need. Make asks the user to extend permissions when a module needs a scope the connection does not have yet. A new app can then keep the connection's default scope to what every connection needs, so users grant only what the modules they use require. In an existing app, changing the default scope or module scopes is an authentication migration, not an incidental edit ([maintenance](../../../references/maintenance.md)).

## Dependent components share one connection

Modules, RPCs, webhooks and their attach/detach RPCs each list the connections they accept. Every RPC a module uses must match the module's connection list, including an RPC that makes no request. A shared webhook additionally needs the connection relationship that routes events to the right account (`uid` in `info` and in the webhook).

## Rationale

Authentication fails far from where it is configured: a token that cannot refresh surfaces as an unrelated 401 days later. Reading the lifecycle as a chain (authorise, exchange, store, use, expire, refresh, check) makes each link inspectable, and keeping all credential reads inside the connection context keeps secrets out of module definitions.

## Pitfalls

* Using an access token's lifetime as the grant lifetime, or the reverse.
* Overwriting a stored refresh token with an empty value when the refresh response omitted it.
* Not saving a rotated refresh token.
* Putting `token.condition` on an authorisation-code flow.
* Making an extra-scopes field mandatory for a connection whose operations never need it, or declaring a universal call broken without checking its endpoint group's required scopes.
* Declaring an inconsistency because one block uses `data.x` and another `parameters.x` inside connection communication.
* Treating `common` as the same store as `data`/`parameters`, which defeats the documented `ifempty(parameters.clientId, common.clientId)` fallback.
* Reading a redacted placeholder (for example `<redacted>` or `***`) in supplied common data or connection data as missing configuration. It is present-but-hidden configuration: the value exists in the real app and was masked for review, so do not report it missing or replace it, and never write the placeholder back as a value in an adjusted file (a returned `<redacted>` would overwrite the real secret).
* Credentials placed per module (query string, body or header) instead of once in Base, which is a maintainability and sanitization risk only; a placement the provider API accepts is not a defect, and one it does not accept is a functional fix.
* A renewal condition that reads a value no block stores. For example, `{{data.expires < addMinutes(now, 1)}}` while neither the `token` response nor the `refresh` response, where there is one, writes `response.data.expires`: they write only the access token, or put the access-token lifetime in `response.expires`. With no stored expiration the documented condition is true, so Make requests a token or a refresh before every module use. That is one extra request per call, and none of the caching the condition was written for. Check every key a `condition` reads against what the `token` and `refresh` responses write to `response.data`.
* `token` and `refresh` responses that store the same value under different keys or in different types. For example, the first token is stored as `token` while refresh writes `accessToken`. Or `expires` is an epoch number (`formatDate(now, 'X')` plus seconds) in one block and a date (`addSeconds(now, body.expires_in)`) in the other. Base reads one key: if it reads the refresh key, the first token is unreachable until the first refresh; if it reads the token key, every refreshed token is ignored. A condition that compares a number with `addMinutes(now, 1)` does not measure time. Write every key that Base, modules or conditions read with the same name and type in both blocks, as the documented code-grant example does.

## Exceptions and applicability

* Public endpoints need no connection; do not add one to satisfy a pattern.
* Provider-specific token behaviour (rotation, lifetimes, scope semantics) comes from the provider and cannot be proven by a generic fixture; execute the real flow to establish it.
* In approved apps, `common` data is locked, and changing connections can break existing scenarios; plan changes with the breaking-change guidance in [compatibility-evidence](compatibility-evidence.md).

## Evidence and limits

* Block names, expiry directives, `token.condition` restrictions and the shared-webhook `uid` requirement: **documented behaviour / requirement** (OAuth 2.0 and connection pages).
* Token response handling, rotation and check design: **provider-dependent**, with an **inferred implementation pattern** for the verification steps.
* No static check here executes an authorisation server; real authorisation, refresh and invalid-credential runs are the only proof.
* Documented lifetime fallbacks, the additional-scopes expression, module scopes and the extend-permissions dialog, `response.valid` with `condition`/`message` in the check, the metadata shape and 512-character limit, the `pkey`/`cert` parameter types and the algorithms of `jwt`: **documented behaviour / requirement**. Offline-access and consent parameters (standardised by OpenID Connect, named by each provider), sliding or fixed refresh-token lifetimes, assertion validity and per-permission keys: **provider-dependent**. The effect of a condition that reads an unstored key, and of keys or types that differ between `token` and `refresh`: **inferred implementation pattern** from the documented condition semantics and the code-grant example.

## Sources

* https://developers.make.com/custom-apps-documentation/app-components/connections
* https://developers.make.com/custom-apps-documentation/app-components/connections/basic-connection
* https://developers.make.com/custom-apps-documentation/app-components/connections/jwt
* https://developers.make.com/custom-apps-documentation/app-components/connections/oauth1
* https://developers.make.com/custom-apps-documentation/app-components/connections/oauth2
* https://developers.make.com/custom-apps-documentation/best-practices/connections
* https://developers.make.com/custom-apps-documentation/best-practices/connections/connection-types
* https://developers.make.com/custom-apps-documentation/best-practices/connections/editable-connection
* https://developers.make.com/custom-apps-documentation/best-practices/connections/connection-metadata
* https://developers.make.com/custom-apps-documentation/best-practices/connections/additional-oauth-scopes
* https://developers.make.com/custom-apps-documentation/best-practices/base/authorization-and-sanitization
* https://spec.openapis.org/oas/v3.0.3.html#security-scheme-object
* https://developers.make.com/custom-apps-documentation/component-blocks/api/handling-responses/valid
* https://developers.make.com/custom-apps-documentation/component-blocks/scope
* https://developers.make.com/custom-apps-documentation/block-elements/parameters/pkey
* https://developers.make.com/custom-apps-documentation/block-elements/parameters/cert
* OpenID Connect Core 1.0, section 11, Offline Access (the `offline_access` scope and `prompt=consent`; not a Make source)
