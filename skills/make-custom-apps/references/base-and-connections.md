# Base and connections

Load this reference when selecting authentication, implementing connection validation,
handling OAuth renewal, or diagnosing missing authorization in modules and RPCs.
Use [requests-and-responses.md](requests-and-responses.md) for transport and errors.

## Separate the contracts

- Determine the provider's actual authentication scheme before choosing a connection.
- Treat an API key, HTTP Basic credentials, OAuth tokens, and signing keys differently.
- Do not replace an unsupported signing or OAuth flow with an unsigned or bearer-token shell.
- Distinguish editor labels, SDK connection definitions, and management-tool enum values.
  Discover the selected tool's schema instead of translating an auth name into an enum.
- Treat filenames such as `base.imljson` and connection directories as editor or repository
  conventions, not a universal SDK layout or a reason to copy another app's metadata.

Sources: [Connections](https://developers.make.com/custom-apps-documentation/app-components/connections.md),
[Basic connection](https://developers.make.com/custom-apps-documentation/app-components/connections/basic-connection.md).

## Configure Base without assuming universal inheritance

Put the provider base URL, common authorization, default error handling, and log
sanitization in Base. Modules and RPCs inherit these settings; override only what
an endpoint requires. Keep service-specific request bodies out of unrelated modules.

**Connection communication does not inherit Base.** When a supported check is
configured, supply a complete validation URL, authentication, error handling, and
sanitization in the connection itself.
Repeat any necessary custom CA configuration in the relevant connection requests.

Use documented regional or tenant host rules. Validate configurable hosts before
attaching credentials; do not let an arbitrary request URL redirect authentication
material to an unrelated service. Match version prefixes and path joining explicitly.

An expression replacing an entire `headers` collection replaces inherited headers.
Use the documented `"{{...}}"` collection merge when adding computed headers, and
check collision behavior rather than assuming authorization survives every override.

Sources: [Base](https://developers.make.com/custom-apps-documentation/app-components/base.md),
[Advanced inheritance](https://developers.make.com/custom-apps-documentation/app-components/base/advanced-inheritance.md),
[Connection inheritance and CA configuration](https://developers.make.com/custom-apps-documentation/other/https-custom-ca.md).

## Use the right variable context

| Context | Read or write |
| --- | --- |
| Submitted connection fields | Read `parameters.*` in the documented Basic validation and OAuth token examples. |
| Stored connection data during renewal | Read `data.*`, such as `data.refreshToken` and `data.expires`. |
| Persisted values from a connection response | Write `response.data`; modules subsequently access those values through `connection.*`. |
| Base, modules, and RPCs | Read the selected connection through `connection.*`. |
| OAuth `info` after token acquisition | Current SDK examples use `connection.accessToken`; do not blindly replace it with `parameters.accessToken`. |
| Shared application or connection settings | Read `common.*` from the appropriate component's Common data. |

Use connection Common data for application-level OAuth secrets needed only there.
Common data is encrypted in Make, but that does not make secrets safe to commit.
Never infer variable availability from a different component's example.

Sources: [Basic variables and persisted data](https://developers.make.com/custom-apps-documentation/app-components/connections/basic-connection.md),
[OAuth variables and flow](https://developers.make.com/custom-apps-documentation/app-components/connections/oauth2.md),
[Common data](https://developers.make.com/custom-apps-documentation/app-components/connections.md#common-data).

## API key and HTTP Basic validation

1. Collect secrets with `password` parameters and provider-specific labels.
2. Use the provider's documented header, query, or Basic authorization format.
3. When the provider documents a lightweight authenticated endpoint that actually
   requires the credential, validate against it. Prefer account information or a
   bounded read; a public health check proves only reachability. If no such check is
   documented, apply the evidence decision below; never invent a route.
4. Include required scopes and tenant selection in the validation contract.
   A read-only operation may legitimately use POST; HTTP method alone does not prove safety.
5. Use `response.metadata` for a useful non-secret account label.
6. Set `response.uid` only from a real remote account identifier when needed, especially
   for shared webhooks. Never use an API key, password, token, or fabricated shared identifier.

For an API key submitted as `apiKey`, the validation header fragment is:

```json
{"headers": {"x-api-key": "{{parameters.apiKey}}"}}
```

The corresponding Base fragment reads the saved connection:

```json
{"headers": {"x-api-key": "{{connection.apiKey}}"}}
```

These are fragments, not complete validation requests. The current Basic connection
reference specifies one request and excludes pagination, iteration, and output.
Do not transplant multi-request action logic into a Basic connection without verifying
support for the selected connection surface. Legacy exports are not capability guarantees.

Sources: [Basic connection](https://developers.make.com/custom-apps-documentation/app-components/connections/basic-connection.md),
[Validation endpoints](https://developers.make.com/custom-apps-documentation/best-practices/connections.md).

### Evidence decision for Basic connections

A Make Basic connection is a container for user-entered values (for example an API key
or a username and password) plus at most one communication request. Its name says
nothing about the wire format. In OpenAPI, `type: http` with `scheme: basic` describes
HTTP Basic authentication with a username and password; the scheme *name* (for example
`basicKey`) is an arbitrary label and carries no transport semantics. Do not read
"API key sent as username with an empty password" into a label. Standard HTTP Basic
fully specified in the contract is sufficient for ordinary mapping. Only API-key-specific
placement (header, query, or a Basic-encoded key) and a literal empty password need
explicit provider support.

A server URL (OpenAPI `servers`) alone declares no operation, so a check cannot be
inferred from it. Operations come from `paths` or the provider's documentation. An
explicitly documented authenticated `GET /` operation is a valid check; what matters is
that the contract actually specifies it.

| Established facts | Conclusion |
| --- | --- |
| (a) Standard username/password HTTP Basic is specified, or provider-specific key placement is explicit, **and** a harmless authenticated check is documented | Generate the defined requests and connection check. Disclose that nothing was executed (static-only). |
| (b) Auth mapping and the requested operations are known, but **no check route is documented** | Never invent a `ping`, `me`, `health` or undocumented root request (a documented authenticated `GET /` is not invented), and do not claim a connection outage or failure. Read the selected authoring surface: if the check is genuinely optional there, omit it and state the limitation. If the surface requires a communication request and no supported check exists, hold for that essential evidence instead of fabricating one. Do not assert that omission is supported unless it is documented. |
| (c) The credential wire mapping or an essential requested operation is **unknown or contradictory** | Evidence hold with a clear question to the owner. Not ready, and not a proven defect or security claim. A partial draft must not turn essential uncertainty into optional advice. |

Sources: [Basic connection](https://developers.make.com/custom-apps-documentation/app-components/connections/basic-connection),
[OpenAPI 3.0.3 Security Scheme Object](https://spec.openapis.org/oas/v3.0.3.html#security-scheme-object).
Worked contrast: [auth evidence worked](../examples/current-knowledge/guides/auth-evidence-worked.md).

## OAuth 2.0 lifecycle

- Register the provider client and exact callback before implementing the flow.
  Follow current guidance for `oauth.makeRedirectUri` or `oauth.localRedirectUri`;
  do not copy a legacy redirect variable without checking its registered callback.
- Define the required `authorize`, `token`, `info`, `refresh`, and optional
  `preauthorize` or `invalidate` requests from provider documentation.
- Match token encoding, client authentication, scopes, and PKCE requirements.
  Store tokens under `response.data`; capture the authorization code in temporary data.
- Store the access-token expiry in **`response.data.expires`** and use it in the
  renewal condition. **`response.expires`** instead marks expiry requiring manual
  reauthorization, such as refresh-token expiry. Do not interchange these fields.
- For authorization-code grants with refresh support, renew with `refresh`; do not
  replay a single-use code. If the provider supplies no refresh mechanism, omit that
  request and document token lifetime and reauthorization instead of inventing renewal.
- Preserve the existing refresh token when the provider documents omission of an
  unchanged token; persist a replacement when rotation returns one.
- For client credentials without `authorize`, define `token.condition` explicitly.
  The documented expiry-based condition supports initial acquisition and renewal.
  An unconditional `true` requests a new token on every use; prefer known expiry.
- Use `token.condition` only for a user-independent, single-request token block,
  not an array or an authorization-code exchange. A separate refresh block is not
  needed when that token request performs renewal itself.
- Validate expired, revoked, insufficient-scope, and reauthorized connections separately.

Source: [OAuth 2.0, expiry and token conditions](https://developers.make.com/custom-apps-documentation/app-components/connections/oauth2.md).

## OAuth 1.0, JWT, and request signing

Use OAuth 1.0 when required by the provider: implement `requestToken`, `authorize`,
`accessToken`, and `info`, with the documented `oauth` signing configuration.
Do not reduce a token plus token secret to a bearer token.

JWT is not a separate connection type in the SDK guide. Use the documented `jwt`
built-in with the provider's claims, algorithm, key format, and expiry requirements.
For other signatures, verify canonicalization, timestamps, nonces, body bytes, and
available signing primitives. A documented AWS request directive is not proof that
it is supported in a connection; the connection reference explicitly restricts it.

Route custom transforms to [iml-functions.md](iml-functions.md). Do not import Node
`crypto`, `require`, or network clients into the app function runtime. Mark an
unreproducible signing flow blocked instead of weakening authentication.

Sources: [OAuth 1.0](https://developers.make.com/custom-apps-documentation/app-components/connections/oauth1.md),
[JWT](https://developers.make.com/custom-apps-documentation/app-components/connections/jwt.md),
[Request signing](https://developers.make.com/custom-apps-documentation/component-blocks/api/making-requests.md#aws).

## Current-knowledge guides

- How connection, Base, modules and webhooks layer, with a map to the other guides:
  [app architecture](../examples/current-knowledge/guides/app-architecture.md).
- Basic, JWT and OAuth lifecycles, expiry versus grant lifetime, refresh and rotation,
  connection checks and conditional extra scopes:
  [connections and OAuth](../examples/current-knowledge/guides/connections-and-oauth.md).
- Relative-path boundary, inherited auth and scopes for universal modules:
  [universal modules and scopes](../examples/current-knowledge/guides/universal-modules-and-scopes.md).
- Header precedence against Base (per-name override, collection spread, whole-expression replacement):
  [headers merge](../examples/current-knowledge/guides/headers-merge.md).
- Which context reads which credential variable, and which secret paths to sanitize:
  [authentication contexts](../examples/current-knowledge/guides/auth-context.md). Connection
  communication aliases differ from module contexts; that is documented behavior, not a defect.

## Security and readiness gates

- Sanitize every actual secret-bearing request and response path, including query
  keys, authorization, cookies, authorization codes, client secrets, and refreshed tokens.
- Configure connection logs independently of Base. Check sanitized logs rather than
  assuming a generic path matches the provider's header or token field.
- Keep credentials out of metadata, UID, samples, error messages, and function fixtures.
- Verify Base inheritance in an action and an RPC; test new connection creation and
  renewal separately. A saved app definition does not prove either flow works.
- Report local validation, remote definition readback, and provider-authenticated
  execution as different evidence levels. Never imply live verification without a run.

Source: [Sanitization](https://developers.make.com/custom-apps-documentation/app-components/base/sanitization.md).
