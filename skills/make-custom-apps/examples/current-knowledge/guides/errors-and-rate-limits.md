# Errors, defaults and rate limits

Back to the [knowledge index](../README.md).

Make already treats failed HTTP calls in a sensible way. Good error handling in an app is mostly about *adding* what the platform cannot know: where the provider hides a failure inside a successful response, how to surface the provider's own message, and which statuses deserve a different error type. This guide explains the defaults, the directives that change them, and how to avoid both missing failures and inventing them.

## What the platform does by default

**Documented behaviour.** Statuses 400-599 are errors without any configuration. HTTP 429 becomes a rate-limit error (so the scenario can retry and back off according to Make's behaviour), 5xx becomes a connection error, and other 4xx statuses become a runtime error. You do not need a custom handler to obtain these defaults. A missing custom 429 handler is therefore not a defect.

## Changing the defaults with `response.error`

* `response.error.message` supplies the user-facing text. Prefer the provider's message (`{{body.error.message}}`) over a generic one; keep it free of credentials.
* Per-status entries (`"400": { "type": "DataError", "message": "..." }` and similar) change the type and message for one status. The Error reference requires every status-code specification to contain `message`; `type` is optional. A per-status object that has only `type` does not match that documented shape, and the generic top-level `message` does not satisfy it. (This is an authoring-contract point from the reference; static review does not prove how the runtime treats an object without `message`.) A per-status specification takes precedence over the generic `message` and `type`; when it omits `type`, the generic `type` applies, and when there is none, the default for that HTTP status.
* A generic `type` set at the top level of `response.error` **overrides** the default type mapping, including the 429 and 5xx defaults. That is easy to do by accident: setting one generic type to improve a message can turn rate limits into ordinary errors. Prefer per-status entries and leave the statuses you do not understand to the defaults.
* Error text belongs to the error directive, never to `output`.

## Failures inside successful responses

**Documented behaviour.** A 2xx or 3xx response is not an error by default. If the provider signals failure with a 200 and an envelope (`{ "ok": false, "error": ... }`), use the `valid` directive to declare when the response is valid. Per-status error entries for 200-399 only fire after `valid` has marked the response invalid. Also check batch results: a bulk call can return overall success with per-item failures, and the module must define whether it reports overall or item-level outcomes according to what the provider supplies.

A field named `error` in a success response is not automatically a failure; it may be informational. Read the provider contract and a real response before writing `valid`.

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

## Exceptions and applicability

* Providers that use only HTTP statuses for errors need no `valid`.
* Batch semantics (all-or-nothing versus item results) are provider-specific; do not impose one model.
* Webhook, RPC and connection communication handle errors with the same directives, but their consequences differ (a failed RPC affects a dropdown, a failed refresh affects the connection).

## Evidence and limits

* Default statuses, directive names and the `valid` interaction: **documented behaviour** (error handling, response `valid` and `error` pages).
* Which provider responses count as failures: **provider contract**; verify with real error responses.
* This guide is not covered by the static checker; real error cases belong in the review evidence described in [compatibility-evidence](compatibility-evidence.md).

## Sources

* https://developers.make.com/custom-apps-documentation/app-components/base/error-handling
* https://developers.make.com/custom-apps-documentation/best-practices/base/error-handling
* https://developers.make.com/custom-apps-documentation/component-blocks/api/handling-responses/error
* https://developers.make.com/custom-apps-documentation/component-blocks/api/handling-responses/valid
* https://developers.make.com/custom-apps-documentation/component-blocks/api/making-requests
* https://developers.make.com/custom-apps-documentation/create-your-first-app/error-handling
