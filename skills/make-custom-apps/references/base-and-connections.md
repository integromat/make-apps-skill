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

### Client certificates (mutual TLS)

When the provider authenticates the client by certificate as well as by token, collect the PEM
certificate with a `cert` parameter and the PEM private key with a `pkey` parameter (both are
documented parameter types). Name the expected file format in the help text, keep any other secret
(such as a client secret) a `password`, and mark the certificate and key `editable` so a rotated
certificate does not force a new connection.

Send the pair with the `cert` and `key` request directives in Base and in every connection request
that reaches the certificate-protected host. Connection communication does not inherit Base, and,
as the custom-CA guide documents for `ca`, each OAuth 2.0 request (`token`, `refresh`, `info`)
carries its own configuration, so a value at the top level of an OAuth 2.0 communication does
nothing. Leaving the pair out of Base is the typical failure: the token request succeeds, then
every module call fails the TLS handshake.

```json
{"cert": "{{connection.certificate}}", "key": "{{connection.privateKey}}"}
```

In the connection's own requests, read the same values as `{{parameters.certificate}}` and
`{{parameters.privateKey}}`. `cert` and `key` are not on the public request reference; released
apps rely on them and the runtime applies them, so prove the wiring with a real connection and one
module call, not from the definition alone.

Sources: [Cert parameter](https://developers.make.com/custom-apps-documentation/block-elements/parameters/cert.md),
[Pkey parameter](https://developers.make.com/custom-apps-documentation/block-elements/parameters/pkey.md),
[Connection inheritance and CA configuration](https://developers.make.com/custom-apps-documentation/other/https-custom-ca.md).

### Apply one host rule everywhere

When the host depends on connection values (subdomain, tenant, region, environment or a
self-hosted URL), write the rule once and use the same expression in Base, in the connection's
own requests, and in every module or RPC whose URL leaves Base. The documented variable base URL
example puts the condition in both the connection and Base for this reason. Two failures seen in
released apps:

- The connection check goes to a fixed host. It proves only that the key works somewhere, so a
  wrong subdomain or workspace ID is accepted at connect time and every module fails later. Check
  against the host built from the submitted values, preferably on a path that includes the tenant
  identifier, so both are verified.
- A component needs a second host (for example a separate messaging service). One module derives
  it from the connection while the matching RPC hard-codes it, so a self-hosted connection lists
  from one server and writes to another. Use the identical expression in both.

```json
{"url": "https://{{parameters.subdomain}}.example.com/api/v2/workspaces/{{parameters.workspaceId}}"}
```

Sources: [Base URL](https://developers.make.com/custom-apps-documentation/best-practices/base/base-url.md),
[Variable base URL](https://developers.make.com/custom-apps-documentation/app-components/base/base-url.md).

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

### Trace every `connection.*` read to a writer

In Base, modules, RPCs and webhooks, `connection.X` holds only what the connection stored: one of
its parameters or a key written by `response.data`. A key that nothing stores does not raise an
error; it evaluates to empty. `if(connection.sandbox, 'sandbox.', '')` then never selects the
sandbox host, and help text or URLs built from an unstored region render broken. For each distinct
`connection.*` key, find the parameter or `response.data` assignment in every connection the
component accepts; a key that only one connection variant stores is empty for the others. Declare
the parameter (and use it in the connection's own requests too, as the documented sandbox example
does) or store the value.

Sources: [Variable base URL](https://developers.make.com/custom-apps-documentation/app-components/base/base-url.md),
[Basic connection data](https://developers.make.com/custom-apps-documentation/app-components/connections/basic-connection.md).

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
| (b) Auth mapping and the requested operations are known, but **no check route is documented** | Never invent a `ping`, `me`, `health` or undocumented root request (a documented authenticated `GET /` is not invented), and do not claim a connection outage or failure. Read the selected authoring surface: if the check is genuinely optional there, omit it and state the limitation. If the surface requires a communication request and no supported check exists, that is a missing fact: state the limitation as advisory and do not fabricate a check; never reject for it. Do not assert that omission is supported unless it is documented. |
| (c) The credential wire mapping or an essential requested operation is **unknown or contradictory** | Resolve it from the supplied provider documentation first; if it stays unknown, report it as advisory and name the exact missing fact and the decision needed, and never reject for it. It is not a proven defect or security claim. `needs_evidence` applies only when the open question could hide a scam (author-controlled sending of credentials or user data to a party other than the provider); if the documentation cannot settle that, reject and name the missing fact. |

Sources: [Basic connection](https://developers.make.com/custom-apps-documentation/app-components/connections/basic-connection),
[OpenAPI 3.0.3 Security Scheme Object](https://spec.openapis.org/oas/v3.0.3.html#security-scheme-object).
Worked contrast: [auth evidence worked](../examples/current-knowledge/guides/auth-evidence-worked.md).

### A check that every module-capable credential passes

Pick the check so that it succeeds for every credential that can run the modules; the
validation-endpoint guidance asks for an endpoint "that will work in every case". Providers that
authorise per action (scoped keys, policy-based permissions) can reject a valid, narrowly scoped key
on a convenient list call that no module makes. Prefer, in this order: an identity, account or
token-introspection call that any valid credential may make; then a cheap, bounded read (page size
1) that the modules themselves need. A lookup of a fixed record (a hard-coded domain, email or ID)
is not such a call: its result depends on data outside the user's account, and on usage-metered APIs
it spends quota on every check. If no call fits, state in the connection help which permission the
check needs, so a missing permission is not mistaken for invalid credentials. A list call is fine
when every supported key can make it. In review, replace an existing check only with provider
evidence that a supported key lacks the permission it needs. Without a shown failure, a weaker check
stays advisory (see the gate below).

Source: [Validation endpoints](https://developers.make.com/custom-apps-documentation/best-practices/connections.md).

### Bind the connection label to a returned field

`response.metadata`, in `info` or in the single request of a Basic connection, is the label that
lets a user with several connections to one service tell them apart. It takes `type` (`text` or
`email`; use `email` only for an email address) and `value`; Make keeps up to 512 characters of a
string. Bind `value` to a field the check response really returns. A path the response lacks
(for example `{{body.email}}` on an endpoint that returns a list) and a zero index
(`{{body.items[0].name}}`; IML arrays start at 1) both evaluate to empty without an error, so the
connection simply shows no label. When the check returns no identity, use a non-secret value the
user entered (an account or company ID) or fixed text, never a credential, and confirm the label
against a real check response. Build the value from non-secret identity fields that every account
has (name, email, account or workspace name, user ID), never from a token or session identifier,
not even part of one. When the label joins optional fields, give each part a fallback, for example
`{{ifempty(body.account.name, body.user.email)}}`. A helper that joins parts must skip missing ones
and fall back to a stable value; a part that returns `false` or `undefined` produces labels such as
`false false`, so test it with missing parts, not only with a complete profile. A missing or empty
label is advisory.

Sources: [Connection metadata](https://developers.make.com/custom-apps-documentation/best-practices/connections/connection-metadata.md),
[Basic connection metadata](https://developers.make.com/custom-apps-documentation/app-components/connections/basic-connection.md#metadata).

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

### Token conditions and edited connections

Make evaluates `token.condition` against the stored connection data whenever a module is about to
use the connection, and when the connection is created or verified; when it is false, the stored
token is used. Two consequences for any `token` block with a condition (client credentials or
another grant that needs no user):

- The condition can read only what the token response stored. When the connection has no stored
  expiry, the documented condition is true, so a `token` whose `response.data` never writes
  `expires` requests a new token on every use, exactly like `"condition": true`. Store the
  provider's expiry, or a fixed lifetime such as `addMinutes(now, 55)` for a one-hour token.
- An expiry-only condition does not react to an edit. Changing the credentials, company or tenant
  of an editable connection does not make `data.expires < ...` true, so the old token can stay in
  use until it expires, and a verification after the edit can pass with that old token. One
  pattern from released apps: an advanced, editable boolean (for example `forceRefresh`, help:
  request a new token after you edit this connection), checked before the expiry and written back
  as `false` in `response.data` so it acts once; in connection communication `parameters` and
  `data` are the same store. Without that reset, a ticked flag requests a new token on every use.
  Prove the edit path with a real connection.

```json
{
  "condition": "{{parameters.forceRefresh || data.expires < addMinutes(now, 15)}}",
  "response": {"data": {
    "accessToken": "{{body.access_token}}",
    "expires": "{{addSeconds(now, body.expires_in)}}",
    "forceRefresh": false
  }}
}
```

Source: [token.condition](https://developers.make.com/custom-apps-documentation/app-components/connections/oauth2.md#token.condition).

### Hosts returned by the authorization callback

Some multi-region providers return the account's server in the authorization callback; the app
stores that query value through `authorize.response.data` and uses it as the host of `token`,
`refresh`, `info` and Base. The callback passes through the browser of whoever runs the flow, so
that person can change the value, and the token request then sends the authorization code, the
client ID and secret and later the refresh token to the host it names. When the client ID and
secret can come from the connection's common data (for example
`ifempty(parameters.clientSecret, common.clientSecret)`), a tampered callback hands the app's
shared secret to a host of the user's choosing. That differs from an owner-entered host, which the
gate below treats as a Make feature because the owner can only send their own credential: it is a
fixable class (b) finding (add the allowlist), not a reason to reject. When everything the token
request sends belongs to the user, the owner-entered rule applies and the allowlist is advisory.

Accept the value only if it is one of the provider's documented hosts, before it is stored or used.
`authorize.response.valid` is evaluated against the callback query before the token request, so an
unknown host fails the flow there:

```json
{"authorize": {"response": {
  "valid": "{{query.server === 'https://accounts.example.com' || query.server === 'https://accounts.eu.example.com'}}",
  "temp": {"code": "{{query.code}}"},
  "data": {"accountsServer": "{{query.server}}"}
}}}
```

Use an exact list, or a pattern anchored on scheme and full host suffix with no user info, port or
path; a substring or replace check passes unknown hosts through. A callback value inserted into a
host label (`https://{{connection.account}}.api.example.com`) needs the same care: allow only the
provider's identifier characters, because `/`, `?` or `#` end the host early. Test with every
documented region, an unknown host and a look-alike host.

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

### Signed requests with the `aws` directive

Some providers sign every request with an access key pair instead of sending a token. Make's
`aws` directive does the signing; put it in Base and read the pair from the connection.

```json
{
  "baseUrl": "https://service.{{connection.region}}.example.com",
  "aws": {
    "key": "{{connection.key}}",
    "secret": "{{connection.secret}}",
    "sign_version": "4",
    "service": "example-service"
  }
}
```

- The documented property table lists `secret`, `session`, `bucket`, `sign_version` and `service`;
  released apps pass the access key identifier as `key`, which the signer needs.
- Set `sign_version` to 4 explicitly; the documented default is 2. `service` applies only to
  version 4 and must be the provider's signing name for the endpoint, which is not always the
  first label of the host. A module that calls an endpoint signed under another service name
  needs its own complete `aws` block.
- The directive has no documented region property. Released apps on AWS hosts keep the region in
  the host name, taken from one connection value (a required select), and set no region in the
  block. For any other host whose signature includes a region, prove a non-default region with a
  real signed call before relying on it.
- Collect the secret as `password`. The access key identifier is not the secret and may be `text`.
- The credentials appear only inside the signing block. When tracing which context reads each
  credential, trace the `aws` block: a request with no Authorization header is not unauthenticated.
- Signing does not remove the need to mask. List `request.headers.authorization` (the signed
  header carries the access key identifier) and, when `session` is set,
  `request.headers.x-amz-security-token` in `log.sanitize`. An empty list does not show that
  nothing needs masking.
- The connection does not inherit Base, and an unsigned check does not test the key pair. Released
  apps sign the Basic connection check with the same block, reading `parameters.*`, although the
  connection references list `aws` as not available there (see the caution above). Treat a signed
  check as a runtime fact to prove: create one connection with a valid pair and one with a wrong
  secret. Do not replace it with an unsigned request, and do not report it as a defect from that
  reference line alone.

Sources: [aws request directive](https://developers.make.com/custom-apps-documentation/component-blocks/api/making-requests.md#aws),
[Basic connection communication](https://developers.make.com/custom-apps-documentation/app-components/connections/basic-connection.md).

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

Approval impact follows [Approval gating](review-and-qa.md#2a-approval-gating): a consumer with no credential binding is a class (c) defect (fix it by binding the compatible connection; when several exist, choose the one the module's API and scopes require and state the choice), a user-entered secret in a non-password parameter is class (b) credential handling (change it to `password`; approve with adjustments), a host, subdomain, region or instance URL entered by the connection owner is a Make feature and not a defect, a credential placement the provider API accepts is correct, an omitted shared or external connection import is `needs_evidence` only if the open question could hide a scam (unsettled, it rejects and names the missing fact; otherwise advisory), and a connection check that may not distinguish valid credentials is advisory without evidence.

Source: [Sanitization](https://developers.make.com/custom-apps-documentation/app-components/base/sanitization.md).

### Leftover connection scaffolds

Review every connection directory, not only the one the modules use. Released apps ship extra
connections that still hold the editor's prefilled template: a check against a placeholder host
(`https://www.example.com/api/whoami`), the template comments and no help text. While no module,
RPC or webhook accepts such a connection it does no harm, so report it as advisory: remove it, or
finish it with a real check, help text and the same host rule as Base. A connection that a
component does accept but that still points at the placeholder host can never pass its check;
that is a functional defect to fix.

Source: [Connections](https://developers.make.com/custom-apps-documentation/app-components/connections.md).
