# Auth evidence, worked contrast

Back to the [knowledge index](../README.md) and [connections-and-oauth](connections-and-oauth.md).

This guide contrasts two synthetic contracts to show which facts decide how a Basic connection is authored. Both providers use `.invalid` hosts and are invented. The snippets are labelled **fragments**; neither is a whole app, and nothing here was executed.

## Principles

* A Make Basic connection collects user-entered auth values and holds at most one communication request ([Basic connection](https://developers.make.com/custom-apps-documentation/app-components/connections/basic-connection)). It does not itself define how the provider wants credentials.
* In OpenAPI, `type: http` with `scheme: basic` is HTTP Basic with username and password. The scheme **name** (the key under `securitySchemes`, such as `basicKey`) is an arbitrary label with no transport semantics ([Security Scheme Object](https://spec.openapis.org/oas/v3.0.3.html#security-scheme-object)). A label never implies "API key as username, empty password".
* Standard username/password HTTP Basic that the contract states in full is enough for ordinary mapping. API-key-specific placement, and a literal empty password, need explicit provider support.
* `servers` lists base addresses; operations live under `paths`. A server URL alone does not declare an operation, so a check cannot be inferred from it. If the contract explicitly documents an authenticated `GET /` operation (under `paths`, or stated in the provider's docs), that is a valid check; the test is whether the contract specifies it, not what the path looks like.
* Omitting a connection check depends on the selected authoring surface. This guide does not make checks optional in general.

## Positive: explicit Basic username/password, documented check

Contract facts (synthetic provider `ledger.example.invalid`):

* Security scheme `accountAuth`: `type: http`, `scheme: basic`.
* `servers`: `https://api.ledger.example.invalid/v1`.
* Documented `GET /account` (authenticated, read-only) and `GET /records/{recordId}`.

Facts to establish: the scheme is standard username/password Basic (stated); the check route is documented; the requested operation is documented.

Conclusion: **ready to generate, static-only.** Collect `username` and a `password`-type `password`; the check is `GET /account`; the module reads `GET /records/{recordId}`. Say plainly that no request was run against the provider.

Fragments (not complete requests; no credential values appear):

Connection check fragment. The connection does not inherit Base, so it carries an absolute URL and its own authorization header, built as documented for Basic connections (`Basic ` plus the base64 of username, a colon and password), and sanitizes that header in its log:

```json
{
  "url": "https://api.ledger.example.invalid/v1/account",
  "method": "GET",
  "headers": {
    "authorization": "Basic {{base64(parameters.username + ':' + parameters.password)}}"
  },
  "log": {"sanitize": ["request.headers.authorization"]}
}
```

Module fragment. The URL is relative to Base, and `recordId` is URL-encoded with `encodeURL` because it is user input placed in a path:

```json
{"url": "/records/{{encodeURL(parameters.recordId)}}", "method": "GET"}
```

Base (not shown in full) supplies `https://api.ledger.example.invalid/v1` and the same header shape, but reads the saved connection: `Basic {{base64(connection.username + ':' + connection.password)}}`. That is how modules use the connection's credentials without repeating them.

### Counterexample: an explicit `GET /` check is valid

Suppose another synthetic contract (`gateway.example.invalid`) lists `servers: https://api.gateway.example.invalid` and also documents, under `paths`, an authenticated read-only `GET /` that returns the caller's account summary. Conclusion: use `GET /` as the check. It is a documented operation, not an invention. Contrast with the `vault` contract below, where only the server URL is known and no operation backs a check.

## Negative: API key required, placement unstated, no check

Contract facts (synthetic provider `vault.example.invalid`):

* Prose says "an API key is required"; the security scheme is named `basicKey` and its definition is missing or contradictory.
* `servers`: `https://api.vault.example.invalid`.
* Documented `GET /items/{itemId}`; no account or check route.

Facts to establish: where the key goes (header name, query parameter, Basic-encoded and with what username and password split); whether an empty password is intended; whether a harmless authenticated check exists.

Conclusion: **reject for missing essential evidence (`needs_evidence`).** The credential wire mapping, which is essential to the requested operation, is unknown and the supplied documentation cannot settle it. Do not read it from the name `basicKey`. Do not derive a check from the server URL alone, and do not invent `/ping`, `/me` or `/health`. (A `GET /` would be fine only if the contract documented it as an authenticated operation, which it does not here.) Do not claim the connection is broken or insecure: nothing was observed. Name the missing fact in the rejection: "How is the API key transmitted (header or query name, or Basic with which username and password)? Is there a documented authenticated read-only route usable as a check?"

Once placement is answered, the check route is a separate question, resolved as follows:

| Placement | Check route | Action |
| --- | --- | --- |
| Known | Documented and harmless | Generate both, disclose static-only |
| Known | Not documented | Do not invent one. If the selected authoring surface genuinely allows no check, omit it and state the limitation; if it requires a communication request and none is documented, that is a missing essential fact: reject and name it. Do not assert omission is supported unless documented |
| Unknown or contradictory | Any | Reject (`needs_evidence`) naming the missing fact; a partial draft must not downgrade this to optional advice |

## Evidence and limits

* The Basic connection page and OpenAPI Security Scheme Object define the **documented** behaviour used above; the decision procedure itself is an **inferred review pattern**.
* Whether a particular Make authoring surface lets a check be omitted must be read from that surface, not assumed here.
* No provider call was made; real credentials and an authenticated run are the only proof of acceptance.

## Sources

* https://developers.make.com/custom-apps-documentation/app-components/connections/basic-connection
* https://spec.openapis.org/oas/v3.0.3.html#security-scheme-object
