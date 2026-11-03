# Errors, defaults and rate limits

Back to the [knowledge index](../README.md).

Make already treats failed HTTP calls in a sensible way. Good error handling in an app is mostly about *adding* what the platform cannot know: where the provider hides a failure inside a successful response, how to surface the provider's own message, and which statuses deserve a different error type. This guide explains the defaults, the directives that change them, and how to avoid both missing failures and inventing them.

## What the platform does by default

**Documented behaviour.** Statuses 400-599 are errors without any configuration. HTTP 429 becomes a rate-limit error (so the scenario can retry and back off according to Make's behaviour), 5xx becomes a connection error, and other 4xx statuses become a runtime error. You do not need a custom handler to obtain these defaults. A missing custom 429 handler is therefore not a defect.

## Changing the defaults with `response.error`

* `response.error.message` supplies the user-facing text. Prefer the provider's message (`{{body.error.message}}`) over a generic one; keep it free of credentials.
* Per-status entries (`"400": { "type": "DataError", "message": "..." }` and similar) change the type and message for one status. The Error reference requires every status-code specification to contain `message`; `type` is optional. A per-status object that has only `type` does not match that documented shape, and the generic top-level `message` does not satisfy it. (This is an authoring-contract point from the reference; static review does not prove how the runtime treats an object without `message`.) A per-status specification takes precedence over the generic `message` and `type`; when it omits `type`, the generic `type` applies, and when there is none, the default for that HTTP status.
* A generic `type` set at the top level of `response.error` **overrides** the default type mapping, including the 429 and 5xx defaults. That is easy to do by accident: setting one generic type to improve a message can turn rate limits into ordinary errors. Prefer per-status entries and leave the statuses you do not understand to the defaults.
* **Documented error shapes.** When the provider documents an error body (4xx bodies, including 422 validation errors, with a message or a list of field errors), handle it in Base `response.error` or the module, consistent with the provider's documented shape and without a generic `type`, so the user sees that message and the 429 and 5xx defaults stay. Do not leave a documented shape to the generic default.
* Error text belongs to the error directive, never to `output`.

### Pick an override type by what it does to the scenario

**Documented behaviour.** The type decides how the scenario reacts, so an override changes behaviour, not just a label ([error types](https://developers.make.com/custom-apps-documentation/component-blocks/api/handling-responses/error#error-types)):

| Type | What Make does with the scenario | Fits |
| --- | --- | --- |
| `RuntimeError` (default for 4xx other than 429) | Interrupts the run; turns the scenario off only after the consecutive-error limit (3 by default) | A request that will fail again unchanged |
| `DataError`, `DuplicateDataError` | Stores the bundle as an incomplete execution when the user enabled that, so the data can be fixed and the run resumed; otherwise behaves like `RuntimeError` | Input the provider rejected for this one record |
| `RateLimitError` (default for 429) | Suspends the scenario for a delay (about 20 minutes by default), then resumes it; does not count as a consecutive error | Throttling that waiting resolves |
| `ConnectionError` (default for 5xx) | Retries on a later run with a backoff delay; deactivates the scenario when it keeps failing | Outages and temporary server errors |
| `InvalidAccessTokenError`, `InvalidConfigurationError` | Deactivates the scenario and notifies the user | Credentials that no longer work; an account or connection setup the user must change, never one rejected record |

* Map `InvalidAccessTokenError` only to a status the provider uses for invalid, expired or revoked credentials, usually 401. The override is optional: leaving 401 on its default `RuntimeError` is also correct. Many providers also answer 403 when the credentials are fine but the user lacks a role, a permission or a plan feature for this record or call (no access to this record, a feature or region not enabled for the account). Mapping that 403 to `InvalidAccessTokenError` switches off a scenario whose connection is healthy and sends the user to re-authorise, which fixes nothing. Leave such a 403 on its default `RuntimeError` with the provider's message, or compute the type from the provider's error code when the same status covers both causes (see "Computing the type from the response").
* Do not map 401 or 403 to `ConnectionError`. Make then retries, with growing delays, a request that cannot succeed until someone reconnects or changes permissions, and deactivates the scenario only after all the retries.

```json
"error": {
  "message": "[{{statusCode}}] {{body.error.message}}",
  "401": { "type": "InvalidAccessTokenError", "message": "[{{statusCode}}] {{body.error.message}}" },
  "403": { "message": "[{{statusCode}}] {{body.error.message}} Check that the connected user may access this record." }
}
```

### Computing the type from the response

`type` is an IML expression, like `message`: the generic one, each per-status one and `valid.type`. Compute it when one status carries several causes, for example a 403 that means a revoked token for one error code and a missing permission for another. Keep such expressions safe:

* Base the decision on what the error response carries: `body`, `statusCode` and `headers`, which are the **response** headers. A header the module sent is not there. A condition on a field the provider never returns always takes the same branch, so the reclassification never happens; check every branch against a real or documented error response.
* Prefer the provider's structured error code (`body.error.code`, a GraphQL `extensions.code`) to matching text in the message. A `contains()` on a phrase breaks when the wording changes or is translated, and a rate limit then silently becomes an ordinary error.
* Return only names from the error-types list. A made-up name such as `ValidationError` is not a Make error type, so the handling it was meant to select never happens; the editor schema cannot see a wrong name inside an expression.
* A computed **generic** `type` still replaces the defaults for every status. If its last branch returns `RuntimeError` or `DataError`, 429 and 5xx lose `RateLimitError` and `ConnectionError`. Put the expression under the status it is about, or end it with the defaults.
* Use `if()` or `switch()`. IML has no `? :` operator; `{{a ? 'x' : 'y'}}` produces text, not a choice.

```json
"403": {
  "type": "{{if(body.error.code = 'token_revoked', 'InvalidAccessTokenError', 'RuntimeError')}}",
  "message": "[{{statusCode}}] {{body.error.message}} ({{body.error.code}})"
}
```

A generic version that keeps the defaults for everything it does not recognise:

```json
"type": "{{switch(body.code, 'invalid_api_key', 'InvalidAccessTokenError', 'rate_limited', 'RateLimitError', if(statusCode = 429, 'RateLimitError', if(statusCode >= 500, 'ConnectionError', 'RuntimeError')))}}"
```

### Building the message from the provider's error shape

* **Lists of errors.** Show all of them: `{{join(map(body.errors, 'message'), '; ')}}`. Empty brackets in a path, such as `{{body.errors[].message}}`, do not list anything; they return the first error's message only.
* **Field details.** When each error names a field or a code, include it (`email: is invalid`) so the user knows which input to change. For nested objects of field errors, use a small helper that walks the documented structure and returns one `path: message` line per entry. Such helpers are custom IML functions, which are not enabled for every app; confirm access first ([IML functions](../../../references/iml-functions.md)), and otherwise render the documented fields with built-in functions. Call it with the error object and keep the status in the template: `"[{{statusCode}}] {{formatFieldErrors(body.error)}}"`.
* **Bodies that are not the documented JSON.** Gateways and outages often return an empty, text or HTML body. On a text body any path below `body` (such as `body.error.message`) returns the whole text, and `map()` fails because the value is not an array, so the user sees a function error instead of the status. Keep list rendering in the per-status entries whose body the provider documents as JSON (typically 400 and 422), or in a helper that checks `Array.isArray` and returns a fixed text for `null`, strings and unexpected shapes. A helper that throws replaces the provider's error with its own.
* **Fixed paths, not searches.** Read the documented error paths. Do not stringify the body and extract values with regular expressions, or search the whole body for the first key whose name looks like an error: such searches stop at escaped quotes, break when keys are reordered, and can pick up an unrelated field.
* **Hints after the provider text.** A fixed message such as "Access denied." or "The API key is inactive." is a guess when one status has several causes; it hides the real cause and any request ID that support needs. Append the hint instead: `"[{{statusCode}}] {{ifempty(body.error.message, 'No details returned.')}} Check that the connected user can access this record."`
* Test message helpers with each documented error body, a `null` body, a text body and a body without the expected fields, and assert exact strings.

## Failures inside successful responses

**Documented behaviour.** A 2xx or 3xx response is not an error by default. If the provider signals failure with a 200 and an envelope (`{ "ok": false, "error": ... }`), use the `valid` directive to declare when the response is valid. Per-status error entries for 200-399 only fire after `valid` has marked the response invalid. Also check batch results: a bulk call can return overall success with per-item failures, and the module must define whether it reports overall or item-level outcomes according to what the provider supplies.

A field named `error` in a success response is not automatically a failure; it may be informational. Read the provider contract and a real response before writing `valid`.

**Documented behaviour.** An error raised through `valid` takes its type from `valid.type`, then `response.error.<status>.type` (for example `"200"`), then the generic `response.error.type`, and otherwise `RuntimeError`. The 429 and 5xx defaults never apply, because the HTTP status is a success status. When the provider reports throttling or a temporary outage inside a successful response, such as a GraphQL error code for a rate limit, set that type explicitly; otherwise a rate limit counts toward the consecutive-error limit instead of pausing the scenario. Put the type next to the message: on `valid.type` when `valid` sets its own `message`, otherwise on the status entry.

```json
"response": {
  "valid": "{{!body.errors}}",
  "error": {
    "message": "[{{statusCode}}] {{body.message}}",
    "200": {
      "type": "{{if(body.errors[1].extensions.code = 'RATE_LIMITED', 'RateLimitError', 'RuntimeError')}}",
      "message": "[{{statusCode}}] {{join(map(body.errors, 'message'), '; ')}}"
    }
  }
}
```

**Batch envelopes.** A batch call (a multipart batch, or an array of sub-results) can answer 200 for the envelope while each item carries its own status, and Make only sees the envelope. When the module fails on item errors:

* Read each item's status together with the key the provider echoes for it (a content ID, request ID or reference), and match results to requests by that key, not by position.
* Mark the response invalid in `valid` and list every failing item with its key, code and message in one error, not only the first.
* Choose the type with the items that already succeeded in mind. A retrying type (`ConnectionError`, `RateLimitError`) can send the whole batch again and repeat those items; use it only when every item failed for that reason or the provider documents the batch as atomic or safe to repeat. Otherwise keep the default and name the items that were applied.

## Errors in multi-step communication

An HTTP error in one request of a request array cannot be turned into success by a later request, so decide the error policy per request. Do not build a flow that expects an optional lookup to fail quietly; if a step may be unnecessary, make it conditional or split it into its own module. See [requests-files-multistep](requests-files-multistep.md) for sequences and repeats.

## Rate limits as a design input

Budget requests, paginated records, time and the provider's own limits together. Delays between pages consume the documented pagination time budget; raising a request timeout does not lift pagination or RPC ceilings ([pagination-and-trigger-state](pagination-and-trigger-state.md)). Keep meaningful rate-limit handling when you customise errors, and keep credentials out of messages and logs ([auth-context](auth-context.md)).

```json
{
  "response": {
    "valid": "{{body.ok}}",
    "error": {
      "message": "{{body.error.message}}",
      "400": { "type": "DataError", "message": "[{{statusCode}}] Invalid data: {{body.error.message}}" }
    }
  }
}
```

The example sets a generic message and one per-status specification that carries its own sanitized `message` and a `type`, and deliberately does not set a generic `type`, so 429 and 5xx keep their defaults.

### Exhausted credits, quotas and plan limits

A used-up balance is not a rate limit: credits that must be bought, or a feature missing from the plan, do not come back by waiting.

* Keep a type that does not retry; the 4xx default `RuntimeError` fits. `RateLimitError` would pause and resume the scenario again and again without counting toward the error limit, and `ConnectionError` would retry with backoff a request that cannot succeed. A quota that resets on a documented schedule (per minute or per day) is the case where `RateLimitError` fits.
* After the provider's own text, say what ran out, who can fix it (an account admin, the plan owner) and that running again will not help until then.
* Detect every shape the provider documents for the same condition: a 402, a 403 or 429 with a specific error code, or a 200 whose body carries the message. Keep the check in one helper or expression, use it in `valid` and in the per-status entries, and use the same wording in every module.
* If the provider uses one status (often 429) for both throttling and an exhausted balance, compute the type from the documented error code (see "Computing the type from the response").

```json
"402": {
  "message": "[{{statusCode}}] {{ifempty(body.error.message, 'The account has no credits left.')}} An account admin must add credits; running the scenario again before that fails the same way."
}
```

## Rationale

The platform's defaults encode what the scenario engine needs (retry for rate limits, connection errors for outages). Overriding them wholesale trades that for a slightly nicer message. Because many providers also return failures with status 200, the `valid` directive exists to make the success definition explicit instead of inferred.

## Pitfalls

* Reporting "no custom 429 handling" as a bug.
* Setting a generic error `type` and silently replacing the 429 and 5xx defaults.
* Per-status errors for 200-399 without `valid`; they never fire.
* Treating any `error` field in a 200 body as a failure without reading the contract.
* Passing business failures through as ordinary output bundles.
* Putting secrets, tokens or full request bodies into error messages.
* Expecting a later request in the same communication to rescue an HTTP error.
* Mapping a 403 that means "no permission for this record" to `InvalidAccessTokenError`, or 401/403 to `ConnectionError`.
* A computed error type that tests a field the error response never carries, returns a name outside the error-types list, or ends in a fallback that drops the 429 and 5xx defaults.
* Leaving a rate limit reported inside a 200 to the `RuntimeError` fallback of `valid`.
* Using `{{body.errors[].message}}` as if it listed every error.
* Rendering an error list with `map()` in a message that also handles non-JSON gateway bodies.
* Matching batch item results to requests by position, or giving a partly applied batch a type that retries it.
* Mapping exhausted credits or plan limits to `RateLimitError` or `ConnectionError`.
* Replacing the provider's message with a fixed guess instead of appending a hint.

## Exceptions and applicability

* Providers that use only HTTP statuses for errors need no `valid`.
* Batch semantics (all-or-nothing versus item results) are provider-specific; do not impose one model.
* Webhook, RPC and connection communication handle errors with the same directives, but their consequences differ (a failed RPC affects a dropdown, a failed refresh affects the connection).

## Evidence and limits

* Default statuses, directive names and the `valid` interaction: **documented behaviour** (error handling, response `valid` and `error` pages).
* Which provider responses count as failures: **provider contract**; verify with real error responses.
* This guide is not covered by the static checker; real error cases belong in the review evidence described in [compatibility-evidence](compatibility-evidence.md).
* Error-type consequences, `type` as an IML expression and the `RuntimeError` fallback for errors raised through `valid`: **documented behaviour** (error and valid pages).
* Empty brackets returning the first array element, a path below a text body returning the text, `map()` failing on a non-array and `? :` producing text: **not documented** (not stated on a public page); confirm with a real error response in the Make DevTool before relying on it.
* Whether a 403 means invalid credentials or a missing permission, which code marks an exhausted balance, and whether a batch is atomic or safe to repeat: **provider contract**.

## Sources

* https://developers.make.com/custom-apps-documentation/app-components/base/error-handling
* https://developers.make.com/custom-apps-documentation/best-practices/base/error-handling
* https://developers.make.com/custom-apps-documentation/component-blocks/api/handling-responses/error
* https://developers.make.com/custom-apps-documentation/component-blocks/api/handling-responses/valid
* https://developers.make.com/custom-apps-documentation/component-blocks/api/making-requests
* https://developers.make.com/custom-apps-documentation/create-your-first-app/error-handling
* https://developers.make.com/custom-apps-documentation/best-practices/modules/batch-actions
* https://developers.make.com/custom-apps-documentation/block-elements/iml
