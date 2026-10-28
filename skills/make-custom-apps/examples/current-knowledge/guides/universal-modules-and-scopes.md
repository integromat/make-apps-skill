# Universal modules, destinations and scopes

Back to the [knowledge index](../README.md).

A universal module lets a user call any route of the provider through the app's connection. That flexibility is also the reason it has the strictest rules in the platform: whatever the user types is sent with the connection's credentials. This guide explains the public contract for REST and GraphQL universal modules, the destination boundary, header and body customisation, and the interaction with OAuth scopes.

## The contract

**Documented requirement.** A universal module takes a **relative** URL from the user, so it cannot be used to send the connection's credentials to an arbitrary server. An app has at most one universal module.

For a REST universal module the documented shape is: a clear relative URL input (help text states the fixed base and gives a valid path example), the HTTP method, optional query pairs, optional headers, an optional body, and a useful response envelope (status, headers, body). Where providers have API versions, prefer a base that lets the user put the version in the relative path, as the REST page describes. GraphQL universal modules have their own documented conventions (query, variables, response handling) and should not be forced into the REST shape.

## Keep the destination inside the service

* A fixed `baseUrl` (with or without a path prefix) is compatible with a relative user input. Formatting of a fixed prefix does not by itself prove the user can replace the host.
* An absolute URL typed by the user would be the real boundary violation; relative-only is the documented rule.
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
* Treating a fixed prefix format as a host-replacement vulnerability.
* A header input that, when empty, wipes inherited authorisation, or a `{{...}}` mistake that does the same.
* Treating missing header customisation as broken authentication.
* Requiring an extra-scopes field on every OAuth connection.
* Forcing GraphQL into REST conventions.
* Copying one provider's scope names or separator into another app.

## Exceptions and applicability

* Apps without a universal module need none of this.
* The versioned-path guidance depends on the provider's API versioning.
* Provider restrictions on allowed destinations or content still apply.

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
