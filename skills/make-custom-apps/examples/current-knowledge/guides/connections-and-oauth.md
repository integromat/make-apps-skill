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

## Additional OAuth scopes

Scopes must cover the operations the app promises. An extra-scopes input is a **conditional** capability: it matters for universal modules that can reach endpoint groups outside the baseline grant, where the guidance is a user-supplied extension merged with the normal scopes, plus an explanation of whether the user edits or recreates the connection to change the grant. It is not mandatory for every OAuth connection; a fixed set of operations covered by one baseline scope needs none. A parameter name or separator seen in one example is not a cross-provider rule. See [universal-modules-and-scopes](universal-modules-and-scopes.md).

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
* Credentials in query strings or request bodies of ordinary modules, outside Base.

## Exceptions and applicability

* Public endpoints need no connection; do not add one to satisfy a pattern.
* Provider-specific token behaviour (rotation, lifetimes, scope semantics) comes from the provider and cannot be proven by a generic fixture; execute the real flow to establish it.
* In approved apps, `common` data is locked, and changing connections can break existing scenarios; plan changes with the breaking-change guidance in [compatibility-evidence](compatibility-evidence.md).

## Evidence and limits

* Block names, expiry directives, `token.condition` restrictions and the shared-webhook `uid` requirement: **documented behaviour / requirement** (OAuth 2.0 and connection pages).
* Token response handling, rotation and check design: **provider-dependent**, with an **inferred implementation pattern** for the verification steps.
* No static check here executes an authorisation server; real authorisation, refresh and invalid-credential runs are the only proof.

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
