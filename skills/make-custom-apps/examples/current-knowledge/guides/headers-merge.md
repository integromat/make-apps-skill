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

### Dropping one inherited header in one request

**Inferred implementation pattern** (it combines the documented per-name merge above with the input-parameters page's examples, where a value of `undefined` leaves the key out of the request body). To keep one request from sending a single Base header, keep `headers` a collection and set that name to `"{{undefined}}"`. The module entry wins by name, its value evaluates to `undefined`, and the header is left out of the request. Every other Base header, including the credential, is still sent.

```json
{
  "headers": {
    "x-api-version": "{{undefined}}"
  }
}
```

Use it when the provider documents that one endpoint, or one endpoint family, rejects or misreads a header the rest of the API needs (a version header, for instance), or when one endpoint takes the same credential in a different place from where Base sends it:

```json
{
  "headers": {
    "authorization": "{{undefined}}"
  },
  "qs": {
    "access_token": "{{connection.accessToken}}"
  }
}
```

* Write the name the way Base writes it. Names are case-insensitive, but the same spelling keeps the effective set obvious and does not depend on how case-variant collisions resolve (see Evidence and limits).
* Move the credential only where the provider requires that placement for the endpoint, and mask its new location: add the path (here `request.qs.access_token`) to Base `log.sanitize`, which every module inherits ([auth-context](auth-context.md)). As a reviewer, a placement the provider accepts is not a defect; a missing `log.sanitize` path for it is fixed as credential masking.
* When computing the effective headers, remove every name whose module value is `undefined`.
* This is narrower than the alternatives. A whole-expression `headers` value drops all of Base, and repeating the whole Base set in the module copies the credential into every such module (see Pitfalls). A reviewer does not flag the dropped name as "ignoring Base" and does not replace it with a full override.

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
* **Customisable headers on universal modules.** Two independent checks. *Customisation:* the documented REST universal example exposes an optional Headers array mapped into the request headers, so assess header capability for every REST universal module, not only once a provider is already known to need one. Any equivalent mapped input counts; no parameter name is mandated. A missing REST capability is at least a documented-convention recommendation; being unable to send a header the provider requires (a version or content negotiation header) is a concrete, scoped capability defect. It is not an unqualified publication blocker: the GraphQL universal example has query/variables inputs and no Headers input (its Headers field is output), so the generic REST Headers-input convention is not by itself a GraphQL finding. That does not exempt provider-required headers: independently check that any header the provider requires can be sent (the official GraphQL example sets a request header in Communication). *Authentication:* trace whether the effective request keeps the credentials. Missing customisation never shows auth was lost, and a spread does not by itself prove every credential collision safe. Input headers and response headers are different things.
* **Pagination and repeats.** Pagination merges parent request parameters by default, and overriding only the URL does not make other inherited values vanish ([pagination-and-trigger-state](pagination-and-trigger-state.md)).
* **Signed and external file URLs in a request chain.** An absolute URL replaces only the Base URL, so the Base headers, credential included, still go with a step that calls a URL the API returned on another host. When and how to drop the credential on that step only (by name, with `"{{undefined}}"`), and how a reviewer treats it: [requests-files-multistep](requests-files-multistep.md#a-follow-up-request-to-a-url-the-provider-returned).

## Rationale

The spread exists precisely so that a computed set of headers can be added without re-specifying (and risking leaking or dropping) the credentials. A whole-expression `headers` value is a deliberate override: sometimes right, but then the author owns every header.

## Pitfalls

* Writing `"headers": "{{buildHeaders()}}"` and assuming Base auth survives. It does not; the request goes out without it.
* Treating the spread as a bug because "the module already sets headers". The spread retains Base auth by documentation.
* `Authorization` in Base and `authorization` in the module counted as two different headers. They are the same header; the module's value wins.
* Re-adding the token by hand in every module. When the credential changes, the modules silently disagree.
* Putting credentials in `qs` for convenience; then they appear in URLs and logs.
* Mixing `qs` and a query string in the URL; use one.
* Reading the module template's empty `"headers": {}` as clearing the Base headers, either to keep the credential off one step or as a finding that the module lost authentication. An empty collection merges, so every Base header, credential included, is still sent; that boilerplate is not a finding.
* Blanking an inherited header with `""`, or setting `"headers": null`, to stop it being sent. Neither is documented to remove a header, so new code sets the one name to `"{{undefined}}"` instead (see *Dropping one inherited header in one request*). In review, an existing blank or `null` on a step that works is not a finding. What `"headers": null` does to the rest of Base is not documented, so do not claim from it alone that the credential is kept off or that it leaks.

## Exceptions and applicability

* Applies to modules and RPCs that inherit Base. A universal module must use a relative path so that tokens cannot be redirected to another host; a header merge does not change that.
* A whole-expression override is legitimate for an unauthenticated provider endpoint or a sign-in call; in that case the missing Base auth is intended.
* A fixed `baseUrl`, with or without a path, does not on its own keep a user-supplied module URL on the provider host: a complete URL in the input is treated as absolute. A universal module puts its own fixed prefix, ending with `/`, directly before the input ([universal-modules-and-scopes](universal-modules-and-scopes.md)).

## Evidence and limits

* Merge, overwrite and case-insensitivity: **documented requirement** (documented behaviour).
* Replacement versus merge and case-insensitive names are what the checked primary pages establish. The within-collection "apply entries in order, later write wins" step (and mixed spread/explicit or case-variant collisions) is a **bounded fixture model, not proven platform precedence**: do not use it alone to assert an authentication failure; seek explicit documentation or runtime evidence first.
* The modelled effective-headers computation: **inferred implementation pattern**. The checker takes `spreadProduces` from the fixture; it never evaluates the helper that would really produce the headers, and it does not model every IML edge case.
* Dropping one inherited header with `"{{undefined}}"`: **inferred implementation pattern**. It combines the documented per-name merge with the input-parameters page's examples, where `undefined` leaves a key out of the request body. The headers reference itself does not mention `undefined`; do not extend the rule to `""`, `null` or an empty collection, which are not documented to remove a header.

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
