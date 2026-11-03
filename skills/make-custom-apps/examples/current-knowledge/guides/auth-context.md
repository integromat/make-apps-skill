# Authentication context and log sanitising

Back to the [knowledge index](../README.md).

Make exposes slightly different variables depending on *where* an expression is evaluated: inside a connection's own communication (token, refresh, invalidate, info), inside Base, or inside an ordinary module. The aliases are not a bug and not a rule to enforce uniformly. What matters is that a credential comes from the connection in the right way for the context and never reaches a log.

## Where each variable lives

**Documented behaviour (OAuth 2.0 page).**

* In the **connection's** communication blocks (`preauthorize`, `authorize`, `token`, `info`, `refresh`, `invalidate`), the public variable table lists three separate names: `parameters` (the connection's input parameters), `data` (the connection's data collection) and `common` (the connection's common data, the non-user-specific sensitive values such as an app-level client secret). Two statements must be kept apart:
  * **Runtime-confirmed (adjudicated for this guide, not stated by the variable table):** inside connection communication, `data`, `parameters` and `connection` reach the same stored connection data, so `data.refreshToken` and `parameters.refreshToken` read the same value in a refresh block and the choice between them is naming only.
  * **Documented, and different from the alias claim:** `common` is its own store. The OAuth code-grant example reads a client credential as `ifempty(parameters.clientId, common.clientId)`: the editable parameter wins and the common value is the fallback. That fallback only makes sense because `common` is not the same store as `parameters`/`data`. Do not describe `common` as another alias of that data. Keep the verified connection-context aliases (`data`, `parameters` and, where provided, `connection`) as allowed names for the same stored connection data; `common` is distinct. Do not flag an alias-only mismatch without proof from the actual context, and evaluate any other namespace in the context where it is used.

  Documentation examples use whichever name reads best (for example `data.refreshToken` and `data.expires` in a refresh). Pagination, `response.limit`, `iterate` and `output` are not available in these blocks.
* In **Base** and in **modules and RPCs**, credentials arrive as `{{connection.accessToken}}` (or other connection data). In a module or RPC, three sources are separate (**runtime-confirmed for the pinned default module context, not stated by the variable table**): `parameters` are the module's inputs, `connection` is the attached connection's stored data, and `data` is the module's own persistent state. None of them is the connection's token-phase alias set.
* In **webhook** communication, `data` is an alias of `parameters`, next to `body`, `query`, `method` and `headers`.

So `data.refreshToken` in a refresh block and `parameters.clientId` in the token block are both fine. Moving the same expression into an ordinary module header is a different matter: there `data` is module persistent state, not the attached connection. A module that reads `data.accessToken` is not automatically defective if the value was persisted there; report a source gap only when the value lives elsewhere (for example in the connection) and the actual flow never populates the requested store. The distinction is between *execution contexts*, never between `data` and `parameters` inside one connection block. Which store a credential should come from (an editable parameter, stored data, or the common fallback) is a design decision for each value, not a naming preference: do not replace `common.clientSecret` with `parameters.clientSecret` or the reverse without checking which store actually holds the value.

**Do not** treat `data` versus `parameters` naming in a connection block as an error, and do not claim that those two names read different values there. A rule saying "only `data` is allowed in refresh" would be false. A genuine context error looks like a request reading a variable that exists only in responses (`body`, `item`, `iterate`, `output`, `pagination`) inside a request section of a connection block, or a module reading a credential from something other than `connection`. That is what `CK-AUTH-CONTEXT` tests: response-only variables inside connection requests, literals in credential headers, and non-connection sources for credentials in Base or module headers.

## Worked case: initial authorization-code token exchange with empty `common`

**Runtime-confirmed allowance, bounded.** The same-phase equivalence of `data`, `parameters` and `connection` was confirmed in a pinned runtime implementation for the connection's own communication, including the initial token request after the authorization callback, not only refresh. `common` is a separate member. This is source-confirmed semantics, not proof that any deployed engine version, provider or complete OAuth round trip works. The public variable table alone does not establish it.

Schematic (a map of separate editor sections, not a deployable connection):

```json
{
  "parameters": [
    { "name": "clientId", "type": "text", "label": "Client ID", "required": true },
    { "name": "clientSecret", "type": "password", "label": "Client secret", "required": true }
  ],
  "common": {},
  "token": {
    "url": "https://auth.example.com/token",
    "method": "POST",
    "body": {
      "grant_type": "authorization_code",
      "client_id": "{{data.clientId}}",
      "client_secret": "{{data.clientSecret}}",
      "code": "{{temp.code}}"
    },
    "response": { "data": { "accessToken": "{{body.access_token}}" } },
    "log": { "sanitize": ["request.body.client_secret", "request.body.code", "response.body.access_token"] }
  }
}
```

| Synthetic case | Boundary |
| --- | --- |
| Token reads `data.clientSecret`, `common` is `{}`, and the user-supplied credential inputs feed the same token context | Positive: no namespace-only finding, no alias rewrite, and empty `common` does not mean missing credentials. If `parameters.clientId` is populated in this token context, `data.clientId` cannot be empty merely because of its name. |
| Token reads `common.clientSecret`, `common` is empty, and the value exists only as a connection input | Negative: genuine source-selection gap; `common` is not an alias. |
| Credentials exist only in `common`, token reads only `data` | Converse gap; aliases do not copy common data. |
| Ordinary module header reads `data.accessToken` | Do not transfer token-phase aliases; check whether the value is persisted module state or lives in `connection`. |
| Inputs are declared but nothing shows their values, scopes or redirect settings | Declaration is not successful authentication; the remaining evidence limit stays. |

Do not generalise to other contexts or claim a live flow works from static reading. Provider grant type, scopes and redirect requirements need their own checks.

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

### One list per block, built from where that block puts the secret

**Documented behaviour (sanitization page).** A request without `log.sanitize` writes no request or response log, so nobody can debug it, and the list is still required. A request with a list is logged, and only the paths in the list are masked. **Runtime-confirmed:** an empty list (`"sanitize": []`) counts as a list. It turns logging on and masks nothing.

So a missing list hides the log, while a list that misses the secret shows the secret in clear text. A check that only asks whether a block has a list catches none of these common causes:

* **A list copied from another block.** The token block sends the credentials in the body. The refresh block sends the refresh token as `Authorization: Bearer`, but its list still names the token block's body paths. The same mistake shows up when an `invalidate` posts the token in the body but its list masks only the header. It also shows up when a connection check sends the token in a custom header (for example `x-session-token`) but its list names only `request.headers.authorization`.
* **The right key in the wrong section.** `request.body.client_secret` does not mask a client secret sent in `qs`. That needs `request.qs.client_secret`.
* **IML quoting in a path.** A sanitize path is not an IML expression. A hyphenated header name is one plain segment: `request.headers.x-api-key`. Backticks (`` request.headers.`x-api-key` ``) become part of the name. The path then matches nothing, and the key stays in clear text with no error.

Go through each block: `preauthorize`, `token`, `refresh`, `info`, `invalidate`, the check of a basic connection, Base, and every module or RPC that places a credential where Base does not mask it. For each one, list what the block sends (headers, query, body) and what it receives (response headers, response body). Then write that block's list from this inventory. Use an empty list only when no logged field carries a secret.

```json
{
  "refresh": {
    "url": "https://auth.example.com/refresh",
    "method": "POST",
    "headers": { "authorization": "Bearer {{data.refreshToken}}" },
    "response": { "data": { "accessToken": "{{body.accessToken}}", "refreshToken": "{{body.refreshToken}}" } },
    "log": { "sanitize": ["request.headers.authorization", "response.body.accessToken", "response.body.refreshToken"] }
  }
}
```

### Secrets inside a text, XML or raw body

**Documented behaviour (authorization and sanitization best practice).** A field path such as `request.body.client_secret` addresses a key of a parsed body (JSON or urlencoded). Some bodies are sent as one string, and a string has no keys. This covers `type` `text` (or `string` or `raw`), an XML or SOAP envelope, and a string returned by a custom function. Neither a field path nor a Base header path reaches a secret written into such a string. Mask the secret by its value instead: `request.body<parameters.secret>` replaces every occurrence of that value in the logged body with `***`. The rest of the body stays readable for debugging.

**Runtime-confirmed.** The name inside `<>` is looked up in the context where the request runs, so the [table above](#where-each-variable-lives) applies. Name the variable the request reads the secret from. In a connection block that is, for example, `parameters.*`, `data.*` or `common.*`. In a module or RPC it is `connection.*`. The value is matched exactly as stored, so an encoded copy (base64, XML-escaped) is not found. If the name resolves to nothing, the whole field is masked. `request.body` with no field and no value also masks the whole body. That is safe, but it hides the request you need for debugging.

A response declared or detected as XML is parsed before it is logged, so a field path can reach a secret in it. Below the root element every element is parsed as an array. A path that passes through such an element needs an array step on it, and array steps work only for all-lower-case names (see the next section). The last element can be named without brackets, which masks its whole array.

```json
{
  "url": "/service",
  "method": "POST",
  "type": "text",
  "headers": { "content-type": "text/xml" },
  "body": "{{buildEnvelope(parameters, connection)}}",
  "log": { "sanitize": ["request.body<connection.accessToken>", "request.body<connection.apiKey>"] }
}
```

### Arrays, and the limits of path matching

**Runtime-confirmed (not described in the public request reference).** A path step can address array elements:

* `items[*]` covers every element: `response.body.data[*].access_token` masks the token in each object of a returned list. Nested arrays need one `[*]` per level. A payload that can nest to different depths needs one entry per depth the provider can return.
* `items[1]` covers only the first element, because counting starts at 1. `items[]` and `items[0]` match nothing, and no error is shown.
* An array step only finds an array whose key is all lower-case in the payload. For a key such as `lineItems`, or an XML element such as `SessionId`, name the array without brackets (`response.body.lineItems`). This masks the whole array: a coarser mask, but the secret is hidden.
* This narrows the case-insensitivity note under Pitfalls. Only the field and header names after the section name are case-insensitive. The `request.`/`response.` prefix and the section name (`qs`, `headers`, `body`) must be lower-case. `request.headers.Authorization` works. `Request.Headers.authorization` and `request.Headers.authorization` are skipped without an error.

A listed path is masked whether or not it holds a secret. Listing a bulky non-secret field, such as base64 file content or a raw message, is a legitimate way to keep the log readable. Do not report such an entry as a defect or remove it as noise. Binary `buffer` values need no entry: the log already shows them as a short placeholder with length and checksum.

```json
"log": { "sanitize": [
  "request.headers.authorization",
  "response.body.data[*].access_token",
  "response.body.files[*].content",
  "response.body.files[*].versions[*].content"
] }
```

## Rationale

Credentials are the one thing a log must never contain. Because the connection block, Base and modules each see a different slice of variables, the safe habit is to keep credentials in Base from `{{connection.*}}`, keep token handling in the connection, and sanitise every path where a secret passes.

## Pitfalls

* "Fixing" `data.refreshToken` to `parameters.refreshToken` (or the reverse) in a refresh block because a rule demanded one alias. Inside connection communication both reach the same connection data; the change is cosmetic and must not be reported as a defect.
* Treating `common` as a third name for the same store and reading the app-level client secret from `data` or `parameters` (or the reverse). `common` holds connection common data; the documented example uses it as the fallback behind an editable parameter.
* Declaring that a refresh token is lost because the token response did not assign it. Providers may omit it or rotate it; decide preservation from the provider contract and the documented persistence model.
* Copying a connection block into a module, where `parameters` are module inputs, `data` is module persistent state and the connection is read through `connection`.
* Hard-coding a token in a header literal (even a test one).
* Sanitising only the request while the secret also appears in the response, or naming a path that is not where the secret actually sits. Sanitize paths are written in dot notation and are **case-insensitive** (documented in the request reference), so `request.headers.Authorization` and `request.headers.authorization` match the same path. Casing alone is never a sanitisation defect; the lower-case spelling used in the examples is only a consistency convention.
* Forgetting the response side: the access token appears in the token response.
* Using `token.condition` with an authorisation-code flow.
* Copying one block's `log.sanitize` list into another block, or Base's list into a connection block, without checking where that block puts the secret: a refresh token in a header, a token in an `invalidate` body, a credential in `qs` or in a custom header.
* Reading an empty `log.sanitize` list as "no logging". It turns logging on and masks nothing.
* Writing a sanitize path like an IML expression or a JavaScript index: backticks around a header name, `[]`, or the 0-based `[0]`. None of them is path syntax, and each matches nothing without an error. Use the plain name and `[*]` (or the 1-based `[1]`).
* Exception to the case-insensitivity pitfall for sanitize paths: the `request.`/`response.` prefix and the section name (`qs`, `headers`, `body`) must be lower-case. `Request.Headers.authorization` is skipped without an error and leaves the header in clear text.
* Masking a secret inside a text, XML or raw body with a field path, which cannot reach into a string. Use the value form, for example `request.body<connection.accessToken>` in a module.
* Removing a sanitize entry for a bulky, non-secret field as noise.

## Exceptions and applicability

* No credentials, no sanitising: public endpoints with no secret have nothing to mask.
* Shared webhook connections still need the `uid` in `info`; this is not a credential.
* Provider runtime behaviour (token lifetime, scopes) cannot be shown by a generic fixture; no fixture here proves any provider's OAuth works.

## Evidence and limits

* `log.sanitize` mandatory and its case-insensitive dot-notation paths: **documented requirement**. The variable roles of `parameters`, `common` and `data` in connection communication: **documented** (variable table and code-grant example). The `data`/`parameters`/`connection` equivalence in connection communication: **runtime-confirmed, adjudicated allowance**, not read from the public variable table (which describes variable roles only); `common` is outside that equivalence.
* Which header names count as sensitive and which body keys are secret-named: **inferred implementation pattern** (a regular expression in the checker). Any real secret path outside those patterns still needs your own review.
* The checker is static; it does not call an authorisation server.
* No request or response log without a sanitize list, and the value form `request.body<parameters.secret>` for a string body: **documented behaviour** (sanitization page; authorization and sanitization best practice). The following are **runtime-confirmed** and not stated by the public request reference:
  * an empty list turns logging on and masks nothing;
  * a hyphenated header name is one plain segment, and backticks become part of the name;
  * `[*]` and the 1-based `[n]` array steps work, while `[]` and `[0]` match nothing;
  * array steps need an all-lower-case key;
  * the prefix and section name must be lower-case, while field and header names are case-insensitive;
  * the name in `<>` is looked up in the request's own context, its value is matched exactly as stored, and a name that resolves to nothing masks the whole field;
  * XML responses are parsed, with every element below the root as an array, before they are logged;
  * binary buffers are logged as a placeholder with length and checksum.

  Confirm each mask in the sanitized log of a real run. A static reading cannot show that a path matched.

## Fixtures

Static, synthetic teaching fixtures with a generic OAuth shape; they prove nothing about any provider's runtime behavior.

* Correct: [correct.json](../recipes/auth-context/correct.json): Base reads the credential through `connection.*`, the token and refresh requests read the context-dependent connection variables (`data`, `connection`, `parameters`, and `common` as its own common-data store) legitimately, and every secret-bearing path is in `log.sanitize`.
* Incorrect, `CK-AUTH-CONTEXT`: [module-header-wrong-context.json](../recipes/auth-context/incorrect/module-header-wrong-context.json). A module or Base header reads the credential through `data.*` or `parameters.*`, which in that context are module inputs or module persistent state rather than the saved connection.
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
