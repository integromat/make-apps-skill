# App architecture: Base, inheritance, errors and logging

Back to the [knowledge index](../README.md).

This guide ties the topic guides into one design. It has no recipe fixtures of its own; it cites documentation and points to the topic guides where a rule has a fixture. Authority labels follow the [index](../README.md): documented requirement, documented recommendation, inferred implementation pattern.

## Layering

A Make custom app is layered. Decide what belongs where before writing a module.

1. **Connection.** How the user proves who they are. It owns token, refresh, invalidate and info communication. In those blocks `parameters` (input parameters), `data` (stored connection data) and `common` (connection common data, such as app-level secrets) are three connection variables; `data` and `parameters` are runtime-confirmed to read the same stored data there, while `common` is a separate store (see [auth-context](auth-context.md)).
2. **Base.** What every request has in common: `baseUrl`, authentication headers or query string built from `{{connection.*}}`, default `qs`, `response` (including error handling) and `log`. **Documented behaviour:** every module and RPC inherits it. `common` data is locked after the app is approved, and the default timeout (40 seconds) can be raised to at most 300000 ms. The documented approach sets the value in the common data (`"timeout": 300000`) and wires it in Base with `"timeout": "{{common.timeout}}"`; storing `common.timeout` alone changes nothing unless Base (or another verified direct timeout setting) reads it. The timeout applies to the whole app and the Base page recommends extending it only for legitimately heavy operations.
3. **Modules and RPCs.** Per-action requests that add only what differs: a path, a method, a body, an output.
4. **Webhooks.** Instant triggers, with their own lifecycle ([webhooks](webhooks.md)).

**Inferred implementation pattern.** Put a thing in Base when two or more modules would otherwise repeat it, and in the module when only that module needs it. Authentication belongs in Base; do not re-specify it in modules, and when a module must add headers use the collection spread so Base auth is retained ([headers-merge](headers-merge.md)).

## Requests

**Documented recommendation.** Use partial URLs relative to Base (app approval suggests it); a universal module **must** use a relative path. Use `qs` and `headers` as flat collections and never combine `qs` with a query string in the URL. Send the whole parameter set with `"body": "{{parameters}}"` or omit the path ids with `omit(parameters, 'id')` instead of building each key by hand. Keep `encodeUrl` at its default when you encode manually. `shareCookies`, `followRedirect` and `encodeUrl` are static values; `repeat` has a hard-coded `delay` and `limit` and its condition can read `temp` only.

## Guide map for each design decision

| Decision | Guide |
|---|---|
| Credentials, refresh, scopes | [connections-and-oauth](connections-and-oauth.md), [auth-context](auth-context.md) |
| Request defaults and headers | [headers-merge](headers-merge.md) |
| Failures and rate limits | [errors-and-rate-limits](errors-and-rate-limits.md) |
| Lists, pages, trigger state | [pagination-and-trigger-state](pagination-and-trigger-state.md), [rpc-page-budgets](rpc-page-budgets.md) |
| Dates and helpers | [dates-helpers](dates-helpers.md), [iml-and-helpers](iml-and-helpers.md) |
| Dropdowns and dynamic forms | [selectors-mode](selectors-mode.md), [dynamic-data-and-files](dynamic-data-and-files.md) |
| Files, multi-step, repeats | [requests-files-multistep](requests-files-multistep.md) |
| Output shape, empty values, updates | [outputs-empty-values-updates](outputs-empty-values-updates.md), [interfaces-required](interfaces-required.md) |
| Webhooks | [webhooks](webhooks.md) |
| Universal modules | [universal-modules-and-scopes](universal-modules-and-scopes.md) |
| Evidence and change safety | [compatibility-evidence](compatibility-evidence.md) |

## Error handling

**Documented behaviour.** HTTP statuses 400-599 are errors by default: 429 becomes a rate-limit error, 5xx a connection error and other 4xx a runtime error. Customise in `response.error` with `message`, per-status overrides (each must carry its own `message`; `type` is optional) and `type`; a generic `type` overrides those defaults, so prefer per-status entries (details in [errors-and-rate-limits](errors-and-rate-limits.md)). A 2xx or 3xx response that is really an error needs the `valid` directive; a per-status error for 200-399 only fires after `valid` has marked the response invalid. Use `response.error.message` to surface the provider's message rather than a generic one, and keep error text out of `output`.

**Documented behaviour (multiple requests).** An HTTP error cannot be handled as success by a later request in the same array, so decide the error policy per request, not afterwards.

```json
{
  "response": {
    "valid": "{{body.ok}}",
    "error": { "message": "{{body.error.message}}", "400": { "type": "DataError", "message": "[{{statusCode}}] Invalid data: {{body.error.message}}" } }
  }
}
```

## Logging and secrets

**Documented requirement.** `log.sanitize` is mandatory for sensitive data. Put the authentication header in Base's `log.sanitize` once; add body paths where a module sends a secret.

## Design walk-through

For a small task-tracking provider the layers would be: a connection with an API key (type `password`); Base with `baseUrl: "https://api.tasks.example.com/v1"`, an `authorization` header from `{{connection.apiKey}}` and a sanitised log; a `listProjects` RPC with a bounded page budget ([rpc-page-budgets](rpc-page-budgets.md)); a `getTask` module with an edit-mode ID selector ([selectors-mode](selectors-mode.md)); a polling trigger ordered newest first ([dates-helpers](dates-helpers.md)); and no Endpoint, because none is required ([optional-endpoints](optional-endpoints.md)).

## Rationale

Inheritance is the platform's way of making a change in one place affect every module. Using it honestly (credentials and error handling in Base, differences in modules) keeps approval review small and keeps the log clean.

## Pitfalls

* Repeating the authorisation header in every module, so a token change misses one.
* Overriding `headers` with an expression and losing Base authentication.
* Using a `response.error` for a 200 response without `valid`.
* Expecting `repeat` to read the body; it reads `temp` only.
* Using an absolute URL in a universal module.
* Raising `common.timeout` to hide a slow RPC rather than fixing the budget.

## Evidence and limits

Statements above are documented unless marked inferred. This guide is not checked by the static checker; only the topic guides have fixtures, and those only prove fixture consistency, not behaviour in Make.

## Sources

* https://developers.make.com/custom-apps-documentation/app-components/base
* https://developers.make.com/custom-apps-documentation/app-components/base/advanced-inheritance
* https://developers.make.com/custom-apps-documentation/app-components/base/authorization
* https://developers.make.com/custom-apps-documentation/app-components/base/error-handling
* https://developers.make.com/custom-apps-documentation/component-blocks/api/making-requests
* https://developers.make.com/custom-apps-documentation/component-blocks/api/handling-responses/error
* https://developers.make.com/custom-apps-documentation/app-components/modules/universal-module
