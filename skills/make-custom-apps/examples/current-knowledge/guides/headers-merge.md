# Headers: Base, module and the collection spread

Back to the [knowledge index](../README.md).

Authentication usually lives in the Base `headers`. A module that adds a header of its own can accidentally delete that authentication, or can keep it, depending on one syntactic choice. This guide explains the choice and how to compute the headers a request actually sends.

## How inheritance works

**Documented behaviour.** Base is inherited by every module and RPC (`baseUrl`, `headers`, `qs`, `body`, `response`, `log`). A module that declares `headers` as a collection merges with Base by header name: the module's value wins for a same-named header and the rest of Base stays. Header names are case-insensitive.

**Documented behaviour (advanced inheritance).** If a module sets `headers` to a whole expression, `"headers": "{{fn()}}"`, the expression's result **overwrites** the Base headers. If it sets a collection that includes the spread key, `{ "{{...}}": "{{fn()}}" }`, the produced entries are merged and the Base authentication is **retained**. A Headers collection spread keeps Base auth; that is the entire point of the spread.

```json
{
  "headers": {
    "{{...}}": "{{extraHeaders(parameters)}}",
    "x-request-source": "make"
  }
}
```

## Computing the effective headers

Do it in this order and write the result down:

1. Start with Base headers, lower-casing names.
2. If the module `headers` is a whole expression, discard step 1's set; only the expression's output counts.
3. If it is a collection, apply entries in order: explicit names replace, the spread adds what it produces (same-name collisions follow the later write).
4. Compare with what the provider needs, including `authorization`.

The checker's `CK-HEADERS-MERGE` rule does this computation over a declared fixture (`base.headers`, `request.headers`, the declared `spreadProduces`) and compares it with `expectedEffectiveHeaders`. `CK-HEADERS-DUPLICATE` rejects a block that repeats the same header with different case, because the effective value is then ambiguous.

## Separating custom headers from auth

**Inferred implementation pattern.** Keep credentials in Base, built from `{{connection.*}}`, and keep per-request extras in the module. If a module truly must change the credential (a different token endpoint, for instance) that belongs in a dedicated connection communication block, not in a module header that hides the change. Sanitise credential headers in logs: see [auth-context](auth-context.md).

## Related request-level inheritance rules

* **Query and body defaults.** Base `qs` and `body` follow the same inheritance idea as headers. Use `qs` as a flat collection; arrays become repeated keys. If a provider needs hand-built query syntax, follow the request reference's encoding guidance and do not mix a hand-built URL query with the `qs` collection.
* **Absolute URLs.** An absolute request URL does not by itself prove that inherited authentication is lost. Check which configuration the documented context applies and what the effective request carries. The security question for user-supplied destinations is separate (see [universal-modules-and-scopes](universal-modules-and-scopes.md)).
* **Customisable headers on universal modules.** A universal module that offers no way to add headers has a real contract gap for providers that need extra headers, such as a version or content negotiation header. That is a design finding to weigh, not proof that authentication is broken: Base authentication still applies, and a Headers collection that uses the spread preserves it.
* **Pagination and repeats.** Pagination merges parent request parameters by default, and overriding only the URL does not make other inherited values vanish ([pagination-and-trigger-state](pagination-and-trigger-state.md)).

## Rationale

The spread exists precisely so that a computed set of headers can be added without re-specifying (and risking leaking or dropping) the credentials. A whole-expression `headers` value is a deliberate override: sometimes right, but then the author owns every header.

## Pitfalls

* Writing `"headers": "{{buildHeaders()}}"` and assuming Base auth survives. It does not; the request goes out without it.
* Treating the spread as a bug because "the module already sets headers". The spread retains Base auth by documentation.
* `Authorization` in Base and `authorization` in the module counted as two different headers. They are the same header; the module's value wins.
* Re-adding the token by hand in every module. When the credential changes, the modules silently disagree.
* Putting credentials in `qs` for convenience; then they appear in URLs and logs.
* Mixing `qs` and a query string in the URL; use one.

## Exceptions and applicability

* Applies to modules and RPCs that inherit Base. A universal module must use a relative path so that tokens cannot be redirected to another host; a header merge does not change that.
* A whole-expression override is legitimate for an unauthenticated provider endpoint or a sign-in call; in that case the missing Base auth is intended.
* A fixed `baseUrl` containing a path is not changed by a suffix in the module URL pointing elsewhere.

## Evidence and limits

* Merge, overwrite and case-insensitivity: **documented requirement** (documented behaviour).
* The modelled effective-headers computation: **inferred implementation pattern**. The checker takes `spreadProduces` from the fixture; it never evaluates the helper that would really produce the headers, and it does not model every IML edge case.

## Fixtures

Static, synthetic teaching fixtures. Each declares Base headers, request headers, what the spread produces, and the effective headers the author expects.

* Correct: [correct.json](../recipes/headers-merge/correct.json): the per-name override wins over Base, the collection spread keeps Base headers, and the expected effective set equals the modelled merge.
* Incorrect, `CK-HEADERS-MERGE`: [base-wins.json](../recipes/headers-merge/incorrect/base-wins.json). The expectation keeps the Base value for a header the request overrides, but the request value wins per name (case-insensitively).
* Incorrect, `CK-HEADERS-MERGE`: [whole-expression-overwrites.json](../recipes/headers-merge/incorrect/whole-expression-overwrites.json). `headers` is one whole expression yet the expectation still lists Base headers; a whole expression replaces Base, so the inherited authentication is gone.
* Incorrect, `CK-HEADERS-MERGE`: [drops-inherited.json](../recipes/headers-merge/incorrect/drops-inherited.json). The request uses the collection spread, which keeps Base, but the expectation omits an inherited header.
* Incorrect, `CK-HEADERS-DUPLICATE`: [duplicate-case.json](../recipes/headers-merge/incorrect/duplicate-case.json). One block repeats a header name that differs only by case, so the effective value is ambiguous.

## Sources

* https://developers.make.com/custom-apps-documentation/app-components/base
* https://developers.make.com/custom-apps-documentation/app-components/base/advanced-inheritance
* https://developers.make.com/custom-apps-documentation/app-components/base/authorization
* https://developers.make.com/custom-apps-documentation/component-blocks/api/making-requests
* https://developers.make.com/custom-apps-documentation/best-practices/input-parameters/processing-of-input-parameters
