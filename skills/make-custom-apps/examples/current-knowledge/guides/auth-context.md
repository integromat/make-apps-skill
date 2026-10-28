# Authentication context and log sanitising

Back to the [knowledge index](../README.md).

Make exposes slightly different variables depending on *where* an expression is evaluated: inside a connection's own communication (token, refresh, invalidate, info), inside Base, or inside an ordinary module. The aliases are not a bug and not a rule to enforce uniformly. What matters is that a credential comes from the connection in the right way for the context and never reaches a log.

## Where each variable lives

**Documented behaviour (OAuth 2.0 page).**

* In the **connection's** communication blocks (`preauthorize`, `authorize`, `token`, `info`, `refresh`, `invalidate`), the public variable table lists three separate names: `parameters` (the connection's input parameters), `data` (the connection's data collection) and `common` (the connection's common data, the non-user-specific sensitive values such as an app-level client secret). Two statements must be kept apart:
  * **Runtime-confirmed (adjudicated for this guide, not stated by the variable table):** inside connection communication, `data` and `parameters` reach the same stored connection data, so `data.refreshToken` and `parameters.refreshToken` read the same value in a refresh block and the choice between them is naming only.
  * **Documented, and different from the alias claim:** `common` is its own store. The OAuth code-grant example reads a client credential as `ifempty(parameters.clientId, common.clientId)`: the editable parameter wins and the common value is the fallback. That fallback only makes sense because `common` is not the same store as `parameters`/`data`. Do not describe `common` as a third alias, and do not widen the alias equivalence beyond `data` and `parameters`.

  Documentation examples use whichever name reads best (for example `data.refreshToken` and `data.expires` in a refresh). Pagination, `response.limit`, `iterate` and `output` are not available in these blocks.
* In **Base** and in **modules and RPCs**, credentials arrive as `{{connection.accessToken}}` (or other connection data). In a module or RPC, `parameters` and `data` describe that module's own inputs, which is a different context from the connection's.
* In **webhook** communication, `data` is an alias of `parameters`, next to `body`, `query`, `method` and `headers`.

So `data.refreshToken` in a refresh block and `parameters.clientId` in the token block are both fine. Moving the same expression into an ordinary module header is a different matter: there `data` is the module's input, not the connection. The distinction is between *execution contexts*, never between `data` and `parameters` inside one connection block. Which store a credential should come from (an editable parameter, stored data, or the common fallback) is a design decision for each value, not a naming preference: do not replace `common.clientSecret` with `parameters.clientSecret` or the reverse without checking which store actually holds the value.

**Do not** treat `data` versus `parameters` naming in a connection block as an error, and do not claim that those two names read different values there. A rule saying "only `data` is allowed in refresh" would be false. A genuine context error looks like a request reading a variable that exists only in responses (`body`, `item`, `iterate`, `output`, `pagination`) inside a request section of a connection block, or a module reading a credential from something other than `connection`. That is what `CK-AUTH-CONTEXT` tests: response-only variables inside connection requests, literals in credential headers, and non-connection sources for credentials in Base or module headers.

## Credential flow in OAuth 2.0

**Documented behaviour.** `response.data.expires` makes Make refresh the token before it expires; `response.expires` makes Make ask the user to re-authorise manually. These are two different clocks: access-token lifetime stored with token data, and the lifetime of the user's grant. `token.condition` is for flows that need no user (such as client credentials), must not be used with the authorisation-code flow, and requires a single request. A `uid` in `info` is only for shared webhooks (see [webhooks](webhooks.md)). Dedicated apps can use `oauth.makeRedirectUri` or `localRedirectUri`.

The full lifecycle (stored fields, rotation, optional token-response fields, connection checks, Basic/JWT/OAuth 1 differences and scopes) is in [connections-and-oauth](connections-and-oauth.md); this guide stays focused on *which variable exists where* and on log masking.

## Sanitising logs

**Documented requirement.** `log.sanitize` is mandatory whenever a request or response carries sensitive data. Paths use dot notation: `request.headers.authorization`, `request.qs.access_token`, `request.body.client_secret`, `request.body.refresh_token`, `request.body.code`, `response.body.access_token`, `response.body.refresh_token`.

The checker's `CK-SECRET-LOG` rule applies this to fixtures: a Base authorisation header must be masked, and in connection blocks a request body with secret-named keys, a sensitive header, or a response mapping of a secret-named value must be listed in `log.sanitize`. It checks the declared fixture only; it cannot prove that every sensitive path in a real app is covered.

```json
{
  "refresh": {
    "url": "https://auth.example.com/token",
    "method": "POST",
    "body": { "grant_type": "refresh_token", "refresh_token": "{{data.refreshToken}}", "client_secret": "{{parameters.clientSecret}}" },
    "response": { "data": { "accessToken": "{{body.access_token}}" } },
    "log": { "sanitize": ["request.body.refresh_token", "request.body.client_secret", "response.body.access_token"] }
  }
}
```

## Rationale

Credentials are the one thing a log must never contain. Because the connection block, Base and modules each see a different slice of variables, the safe habit is to keep credentials in Base from `{{connection.*}}`, keep token handling in the connection, and sanitise every path where a secret passes.

## Pitfalls

* "Fixing" `data.refreshToken` to `parameters.refreshToken` (or the reverse) in a refresh block because a rule demanded one alias. Inside connection communication both reach the same connection data; the change is cosmetic and must not be reported as a defect.
* Treating `common` as a third name for the same store and reading the app-level client secret from `data` or `parameters` (or the reverse). `common` holds connection common data; the documented example uses it as the fallback behind an editable parameter.
* Declaring that a refresh token is lost because the token response did not assign it. Providers may omit it or rotate it; decide preservation from the provider contract and the documented persistence model.
* Copying a connection block into a module, where `data`/`parameters` mean the module's inputs and no longer the connection.
* Hard-coding a token in a header literal (even a test one).
* Sanitising only the request while the secret also appears in the response, or naming a path that is not where the secret actually sits. Sanitize paths are written in dot notation and are **case-insensitive** (documented in the request reference), so `request.headers.Authorization` and `request.headers.authorization` match the same path. Casing alone is never a sanitisation defect; the lower-case spelling used in the examples is only a consistency convention.
* Forgetting the response side: the access token appears in the token response.
* Using `token.condition` with an authorisation-code flow.

## Exceptions and applicability

* No credentials, no sanitising: public endpoints with no secret have nothing to mask.
* Shared webhook connections still need the `uid` in `info`; this is not a credential.
* Provider runtime behaviour (token lifetime, scopes) cannot be shown by a generic fixture; no fixture here proves any provider's OAuth works.

## Evidence and limits

* `log.sanitize` mandatory and its case-insensitive dot-notation paths: **documented requirement**. The variable roles of `parameters`, `common` and `data` in connection communication: **documented** (variable table and code-grant example). The `data`/`parameters` equivalence in connection communication: **runtime-confirmed, adjudicated allowance**, not read from the variable table; `common` is outside that equivalence.
* Which header names count as sensitive and which body keys are secret-named: **inferred implementation pattern** (a regular expression in the checker). Any real secret path outside those patterns still needs your own review.
* The checker is static; it does not call an authorisation server.

## Fixtures

Static, synthetic teaching fixtures with a generic OAuth shape; they prove nothing about any provider's runtime behavior.

* Correct: [correct.json](../recipes/auth-context/correct.json): Base reads the credential through `connection.*`, the token and refresh requests read the context-dependent connection variables (`data`, `connection`, `parameters`, and `common` as its own common-data store) legitimately, and every secret-bearing path is in `log.sanitize`.
* Incorrect, `CK-AUTH-CONTEXT`: [module-header-wrong-context.json](../recipes/auth-context/incorrect/module-header-wrong-context.json). A module or Base header reads the credential through `data.*` or `parameters.*`, which in that context mean the module's inputs rather than the saved connection.
* Incorrect, `CK-AUTH-CONTEXT`: [literal-authorization.json](../recipes/auth-context/incorrect/literal-authorization.json). The Authorization header holds a literal token instead of a connection reference.
* Incorrect, `CK-AUTH-CONTEXT`: [refresh-reads-response-variable.json](../recipes/auth-context/incorrect/refresh-reads-response-variable.json). The refresh request reads a response-only variable that does not exist when the request is built. Choosing `data.` over `parameters.` there is not the defect and is never flagged. Note that this fixture's check only looks at response-only variables; it does not rule on which of `data`, `parameters` or `common` is the right store for a given value.
* Incorrect, `CK-SECRET-LOG`: [token-without-log-masks.json](../recipes/auth-context/incorrect/token-without-log-masks.json). A token exchange or refresh has no `log.sanitize` entries for the secrets it sends and receives.
* Incorrect, `CK-SECRET-LOG`: [base-authorization-not-masked.json](../recipes/auth-context/incorrect/base-authorization-not-masked.json). Base sends an Authorization header but does not list it for sanitization.

## Sources

* https://developers.make.com/custom-apps-documentation/app-components/base
* https://developers.make.com/custom-apps-documentation/app-components/base/sanitization
* https://developers.make.com/custom-apps-documentation/app-components/connections
* https://developers.make.com/custom-apps-documentation/app-components/connections/basic-connection
* https://developers.make.com/custom-apps-documentation/app-components/connections/oauth2
* https://developers.make.com/custom-apps-documentation/app-components/base/authorization
* https://developers.make.com/custom-apps-documentation/best-practices/base/authorization-and-sanitization
* https://developers.make.com/custom-apps-documentation/component-blocks/api/making-requests
* https://developers.make.com/custom-apps-documentation/app-components/webhooks
