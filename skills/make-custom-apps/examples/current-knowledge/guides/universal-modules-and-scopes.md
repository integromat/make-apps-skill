# Universal modules, destinations and scopes

Back to the [knowledge index](../README.md).

A universal module lets a user call any route of the provider through the app's connection. That flexibility is also the reason it has the strictest rules in the platform: whatever the user types is sent with the connection's credentials. This guide explains the public contract for REST and GraphQL universal modules, the destination boundary, header and body customisation, and the interaction with OAuth scopes.

## The contract

**Documented requirement.** A universal module takes a **relative** URL from the user, so it cannot be used to send the connection's credentials to an arbitrary server. The universal "Make an API call" module itself is a Make feature and never a defect. An app has at most one universal module.

For a REST universal module the documented shape is: a clear relative URL input (help text states the fixed base and gives a valid path example), the HTTP method, optional query pairs, optional headers, an optional body, and a useful response envelope (status, headers, body). Where providers have API versions, prefer a base that lets the user put the version in the relative path, as the REST page describes. GraphQL universal modules have their own documented conventions (query, variables, response handling) and should not be forced into the REST shape.

## Keep the destination inside the service

* A fixed `baseUrl` (with or without a path prefix) is compatible with a relative user input, but on its own it does not keep a complete URL typed by the user on the provider host (see the safe pattern below). Whether a fixed prefix in the module `url` lets the user replace the host depends on where the host ends: a `/` after the host keeps the input in the path, while a host that runs straight into the input (`https://api.example.com{{parameters.url}}`) does not.
* An absolute URL typed by the user would be the boundary violation; relative-only is the documented rule. A module that accepts one is hardened (add a fixed prefix or validation), not rejected.
* Safe pattern (the REST page's good practice): put the fixed prefix in the module's own Communication `url`, directly before the input, ending with `/`: `"url": "https://api.example.com/{{parameters.url}}"` (the host may come from connection data). The prefix stops before the API version segment. The trailing `/` closes the host, so `@other.example` or `https://other.example` stays in the path. Base `baseUrl` alone does not make a bare `{{parameters.url}}` safe. The help names the base without the trailing slash and gives an example that starts with `/` and the version: "Enter a path relative to `https://api.example.com`. For example: `/v1/users`." The resulting double slash is removed automatically and is not a defect. Without such a prefix (for example a bare `{{parameters.url}}`), reject or strip an absolute URL (`scheme://` or a leading `//`) so the credential cannot be sent to another host; a module that already has the prefix needs no extra validation. Do not recommend a module that sends the user's input as the complete URL together with Base authentication.
* Inheritance must keep working when users add headers: Base authorisation stays in place when the module's `headers` collection uses the spread ([headers-merge](headers-merge.md)). For REST universal modules, assess whether an optional header input (any equivalent mapped input) exists and reaches the request, whatever the provider; a missing one is at least a documented-convention recommendation, and a concrete defect when a required provider header cannot be sent. It is not proof that authentication fails, and absence of a Headers input is not by itself a REST-convention finding for GraphQL universal modules, whose documented shape is query/variables; independently check that any provider-required headers can still be sent ([headers-merge](headers-merge.md)). Empty customisation fields must not remove inherited authorisation either; test the effective request with empty and populated fields.

## Scopes and the universal module

OAuth apps that offer a universal module may need to reach endpoint groups whose scopes are outside the baseline grant. The current REST guidance describes an optional, user-supplied scope extension merged with the normal scopes, and an explanation of whether the user edits or recreates the connection to change the grant. This is **conditional**:

1. List the provider endpoint groups the universal module may reach and the scopes each needs.
2. Compare with the baseline grant. If the baseline covers every supported operation, no extension is needed, and its absence is not a defect.
3. If groups need more, offer the extension, document the format the provider expects, and explain how to change an existing grant.
4. Do not escalate a conditional capability gap into a general authentication failure without evidence from the provider.

An example parameter name or separator is not a cross-provider convention ([connections-and-oauth](connections-and-oauth.md)).

## Authoring checklist in prose

Decide the base and the version policy; write relative-path help with an example; expose method, query, headers and body with sensible types; keep the response envelope useful for mapping; keep authorisation inherited and credentials sanitised; handle provider errors with the shared directives ([errors-and-rate-limits](errors-and-rate-limits.md)); and test through the real connection with empty and populated optional fields. Review prerequisites for public apps are a separate scope from a narrowly scoped implementation task, so apply them when the task is about publication.

## Rationale

A universal module is the only place where a user, not the author, decides the request path. The relative-path rule keeps that decision inside the service boundary, and inheritance keeps the credentials out of the user's hands.

## Pitfalls

* Accepting an absolute URL.
* Treating a fixed prefix that closes the host with `/` as a host-replacement vulnerability, or a host that runs straight into the input as safe.
* A header input that, when empty, wipes inherited authorisation, or a `{{...}}` mistake that does the same.
* Treating missing header customisation as broken authentication.
* Requiring an extra-scopes field on every OAuth connection.
* Forcing GraphQL into REST conventions.
* Copying one provider's scope names or separator into another app.

## Exceptions and applicability

* Apps without a universal module need none of this.
* The versioned-path guidance depends on the provider's API versioning.
* Provider restrictions on allowed destinations or content still apply.
* **Approval impact** ([Approval gating](../../../references/review-and-qa.md#2a-approval-gating)). A universal module input that untrusted scenario data could use to steer the connection's credential to another host is hardening: add the fixed prefix of the safe pattern above or validation and approve with adjustments. A credential placement the provider accepts (header, query string, body, Basic auth) is correct, and a host, subdomain or instance URL entered by the connection owner is a Make feature; neither is a defect. Only the app author's own code sending credentials or user data to a party other than the provider, without the user choosing it, is a scam and rejects. The double slash of the safe pattern (prefix ending with `/`, input starting with `/`) is removed automatically and is not a finding. Other path normalization effects, and scope or header conventions without a shown failure, are advisory, or `needs_evidence` only if the open question could hide a scam (unsettled, it rejects and names the missing fact). A header input that can wipe inherited authorisation makes calls fail (class (a)): fix it with a guard; it is a class (b) finding, fixed by the guard or the binding, when protected data or actions would be exposed without authentication.

## Evidence and limits

* Relative path, single module and security rationale: **documented requirement** (universal module page).
* REST and GraphQL conventions and the conditional scope extension: **documented guidance**.
* Which scopes cover which endpoint groups: **provider contract**; the static checker never evaluates scopes.

## Sources

* https://developers.make.com/custom-apps-documentation/app-components/modules/universal-module
* https://developers.make.com/custom-apps-documentation/app-components/modules/universal-module/rest
* https://developers.make.com/custom-apps-documentation/app-components/modules/universal-module/graphql
* https://developers.make.com/custom-apps-documentation/best-practices/connections/additional-oauth-scopes
* https://developers.make.com/custom-apps-documentation/best-practices/base/base-url
* https://developers.make.com/custom-apps-documentation/app-components/base/advanced-inheritance
* https://developers.make.com/custom-apps-documentation/app-review/prerequisites
