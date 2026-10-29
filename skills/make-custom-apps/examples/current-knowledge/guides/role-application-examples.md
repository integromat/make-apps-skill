# Worked examples: applying a rule, not just reading it

Back to the [knowledge index](../README.md).

All names, fields and values are synthetic. These are teaching examples written from public rules; they are not fixtures, the static checker does not evaluate them, and they prove no provider or Make behaviour.

## Example 1: preserve the whole record, convert one documented datetime

Facts (stated by the provider documentation): `createdAt` is a UTC datetime string such as `2026-03-04 10:00:00` (documented as UTC); `dueDay` is a calendar date `2026-03-04`; `localTime` has no documented zone; `sequence` is a long digits-only identifier that the provider sends as a JSON **string**, for example `"90071992547409930001"`. Because it is a string, preservation keeps that exact text; if a provider instead emitted a JSON number, precision could already be lost before Make sees it, and declaring `text` would not restore it.

The two fragments below belong to separate editor sections (Communication `response`, and Interface). They are shown as a map of sections for teaching, not as one pasteable component definition or a deployable app.

```json
{
  "communication.response": {
    "output": {
      "{{...}}": "{{body}}",
      "createdAt": "{{parseDate(body.createdAt, 'YYYY-MM-DD HH:mm:ss', 'UTC')}}"
    }
  },
  "interface": [
    { "name": "id", "type": "text" },
    { "name": "createdAt", "type": "date" },
    { "name": "dueDay", "type": "text" },
    { "name": "localTime", "type": "text" },
    { "name": "sequence", "type": "text" }
  ]
}
```

The output uses the documented collection spread (`{{...}}`) to keep every field of `body`, followed by an explicit `createdAt` that replaces the raw value. This is the preserve-plus-convert shape of the official Date output example and the documented `parseDate(text; format; timezone)` signature. It is source-grounded illustration only, not evidence that the example passes in Make's runtime. Do not use `merge()` for this: it is the array-concatenation function, not a collection update.

Application by field:

| Field | Meaning | Treatment | Why |
| --- | --- | --- | --- |
| `createdAt` | Datetime, documented UTC | Convert; declare `date` | The provider documents the zone, so conversion is applicable. |
| `dueDay` | Calendar date | Keep as provider text; declare `text` | Exception: date-only. |
| `localTime` | Local datetime, zone not documented | Keep; do not apply the user's or organization's zone | Exception: unknown zone. |
| `sequence` | Digits-only string identifier | Keep the string; declare `text` | Not established as a timestamp; magnitude is no evidence. |
| every other field | Unrelated | Preserved by returning the full record | Raw preservation and targeted conversion are compatible. |

Finding statements:

* Output omits conversion for `createdAt` while declaring `date`: applicable output/interface inconsistency (authoring correction).
* Output converts `createdAt` but the interface still says `text`: matching declaration missing.
* Output is only `{{body}}` with `createdAt` documented as non-ISO: conversion needed (documented requirement).
* A field in the response but not in the interface: declaration gap, not data loss. Output that builds a new object omitting a required field: demonstrable loss.
* Raw canonical ISO datetime text from HTTP JSON, output `{{body}}`, interface `date`, no traced conversion: record an explicit-conversion recommendation and unproven Date provenance. Not an automatic blocker, unambiguous violation or runtime failure: the focused output page recommends parsing, while the official full polling example emits an ISO field directly with a `date` interface. ISO spelling or the interface does not prove a Date conversion.
* Traced value already an actual Date (earlier valid conversion, identity pass-through): no redundant-conversion finding; do not require a second parse.
* Not a finding: no `parseDate` token for `dueDay`, `localTime` or `sequence` (documented exceptions); verify meaning, zone and matching `date` interface for every emitted datetime.

Cursor control: a polling trigger may map `trigger.date` directly when the provider field is established as the documented comparable ISO representation for that cursor pattern; a value that merely looks ISO-shaped is not enough. That is a cursor pattern and says nothing about output typing. A documented epoch cursor does need interpretation in the stated unit.

## Example 2: a REST Headers input, then the auth check separately

Provider documentation requires an `X-Api-Version` header on some calls. The REST universal module offers the fragments below. They are a map of separate editor sections (Mappable parameters and Communication), not one pasteable component definition or a deployable app; other parameters (query, body) and the response are omitted.

```json
{
  "mappable_parameters": [
    { "name": "url", "type": "text", "required": true, "label": "URL",
      "help": "Relative path only, starting with `/`, for example `/v1/items`. The fixed provider address is added for you; do not enter a full URL." },
    { "name": "method", "type": "select", "required": true, "default": "GET",
      "options": [
        { "label": "GET", "value": "GET" },
        { "label": "POST", "value": "POST" },
        { "label": "PUT", "value": "PUT" },
        { "label": "PATCH", "value": "PATCH" },
        { "label": "DELETE", "value": "DELETE" }
      ] },
    { "name": "headers", "type": "array", "label": "Headers",
      "spec": [ { "name": "key", "type": "text" }, { "name": "value", "type": "text" } ] }
  ],
  "communication": {
    "url": "https://api.provider.example.com/api/v1{{parameters.url}}",
    "method": "{{parameters.method}}",
    "headers": {
      "{{...}}": "{{toCollection(parameters.headers, 'key', 'value')}}"
    }
  }
}
```

Check 0, destination boundary: the displayed `url` puts a literal provider prefix that includes a fixed path (`https://api.provider.example.com/api/v1`) before the interpolated input, and the input help asks for a relative path starting with `/`. The literal must include the slash and path before any untrusted input. A prefix of only scheme and host (`https://api.provider.example.com{{parameters.url}}`) is not enough: by URL grammar the authority has not necessarily ended, so an input such as `@other.invalid/` is read as userinfo and the hostname becomes `other.invalid`. With the fixed `/api/v1` literal, the authority has already ended, so caller input stays in the path; `@` and `//` cannot override the host. An unrestricted `"url": "{{parameters.url}}"` is the unsafe form: the platform's request handling treats a complete URL as absolute and does not apply Base to it, so a user-typed absolute URL could send the connection's credentials to another server, which the [universal module page](https://developers.make.com/custom-apps-documentation/app-components/modules/universal-module) says relative-only input exists to prevent. A fixed Base `baseUrl` alone does not close this. This is teaching guidance on a synthetic fixture, not a complete validator, and it does not claim live execution or that any provider or Make runtime was exercised. Whether the Base-auth header collides is a separate unknown (Check 2).

Check 1, customization: the input exists (any equivalent name counts) and its value reaches the request headers through the spread. The caller can send `X-Api-Version`. No finding. Had there been no such input, the finding would be a REST capability gap, with impact raised because the provider requires a header, and still not a claim about authentication.

Check 2, authentication, separately: the module `headers` is a collection with the spread, so inherited Base headers are retained; replacement would occur only with a whole-expression value. Whether a caller-supplied `Authorization` entry collides with the inherited one is a collision question: the ordering model in [headers-merge](headers-merge.md) is a bounded fixture model, so record it as `uncertain` and name the evidence needed rather than asserting loss.

Controls:

* Whole-expression `"headers": "{{buildHeaders(parameters)}}"` that omits the inherited credential: supported replacement loss.
* A GraphQL universal module with query/variables inputs and no Headers input: absence of a Headers input is not by itself a REST-convention finding for GraphQL; independently check that any provider-required headers can be sent (the official GraphQL example sets a request header in Communication). A returned Headers field is output, not an input.

## Role-specific application table

The rows after the first seven cover RPC budgets, webhooks, input contracts, connections, labels and outputs; apply them to every matching component, not only to modules.

Record each applicable check as a row; opening a guide is not the same as applying it.

| Source | Rule | Applies because | Exception considered | Status | Evidence | Finding |
| --- | --- | --- | --- | --- | --- | --- |
| [dates-helpers](dates-helpers.md) | Output datetime: traced Date-producing conversion + `date` interface | `createdAt` emitted, zone documented UTC, non-ISO text converted by `parseDate` | date-only, time-only, unknown zone, numeric id | `passed` | output expression and interface entry locations | none |
| [dates-helpers](dates-helpers.md) | Raw canonical ISO text, `date` interface, no traced conversion | Emitted datetime from HTTP JSON | already a traced Date value; documented exceptions | `uncertain` (recommendation; source ambiguity, ISO spelling or interface does not prove conversion) | output expression, interface entry | explicit-conversion recommendation, not a blocker or runtime claim |
| [dates-helpers](dates-helpers.md) | Cursor maps directly | Trigger `type: date`, field established as the documented comparable ISO form | merely ISO-looking value; not an output exemption | `not_applicable` for parse | trigger block | none |
| [headers-merge](headers-merge.md) | REST header customization | REST universal module | GraphQL subtype | `passed` | input and its header sink | none |
| [headers-merge](headers-merge.md) | Credentials retained | Module sets headers | unauthenticated endpoint | `uncertain` (collision) | merge expression | evidence needed, not loss |
| [selectors-mode](selectors-mode.md) | Edit mode on identifier | Get module, mappable RPC selector | non-mappable selector | `finding` if absent | selector and mode | authoring correction |
| [selectors-mode](selectors-mode.md) | Hierarchy mode | List of a child entity | entity hierarchy unknown | `uncertain` or recommendation | module and provider docs | recommendation |
| [compatibility-evidence](compatibility-evidence.md) | Route evidence | Exact route not in the supplied partial docs | authoritative retirement or observed behaviour | `uncertain` | document and route lookup | evidence gap, not a broken route |
| [rpc-page-budgets](rpc-page-budgets.md) | Options RPC: output limit required if over 500 items possible; bounded and within budget | An options RPC pages a provider list (sweep all RPCs, then branch by role) | provider page size allows more; 3×page is a recommendation, not a cap; a mapped limit with a known upper bound; fields, interface and lifecycle RPCs have no dropdown 500 rule | `finding` if over-500 is possible and the limit is missing or unbounded; `passed` for a bounded mapped expression (fixed literal is a conservative convention only) | `qs.limit`, pagination, `response.limit` | authoring correction |
| [rpc-page-budgets](rpc-page-budgets.md) | Iterating dynamic sample RPC processes one item | Sample RPC iterates a collection | the 500 threshold is irrelevant here | `finding` if `limit: 1` is absent, even when over 500 is impossible | sample RPC `response` | authoring correction (sample cardinality) |
| [webhooks](webhooks.md) | Detach reads what attach stored; signature only if provider requires it | Attached webhook; provider documents signing | provider documents an unsigned control; mechanism not exported or not visible | `uncertain` if binding or code not traced | attach `response.data`, receiver block | evidence gap, not an empty-API defect |
| [interfaces-required](interfaces-required.md) | Required, default and falsy handling | Path input; boolean with `\|\|` fallback | `\|\| false` keeps `false`; no provider list route exists | `finding` or `passed` | input spec, sink | authoring correction; no invented lookup |
| [connections-and-oauth](connections-and-oauth.md) | Phase and store used by refresh | OAuth 2.0 connection | `data`/`parameters` alias in connection communication | `passed` or `uncertain` | refresh block, stored data | none unless a store is never populated |
| [labels-visibility](labels-visibility.md) | Label matches behaviour | "Delete permanently" on an archive request | casing nit | `finding` (functional); casing is minor | label and request | human-traced |
| [outputs-empty-values-updates](outputs-empty-values-updates.md) | Output, interface and sample agree | Explicit projection | raw `{{body}}` output | `passed` or declaration gap | three locations | declaration gap, not data loss |

SDK Endpoints are optional ([optional-endpoints](optional-endpoints.md)); add a row only when the review scope names them.

Status values: `finding`, `passed`, `not_applicable`, `uncertain`. Keep authoring requirements, recommendations and evidence gaps distinct in severity. A mechanically valid locator does not make the claim true, and a missing row is a coverage gap. This is static review; it does not execute QA plans.

## Sources for the claims above

* [Date parameter and output example](https://developers.make.com/custom-apps-documentation/block-elements/parameters/date)
* [parseDate signature](https://help.make.com/date-and-time-functions#parsedate-text-format-timezone)
* [REST universal module example](https://developers.make.com/custom-apps-documentation/app-components/modules/universal-module/rest#rest-universal-module-example)
* [REST URL parameter](https://developers.make.com/custom-apps-documentation/app-components/modules/universal-module/rest#url-parameter)
* [Universal module security notice](https://developers.make.com/custom-apps-documentation/app-components/modules/universal-module)
* [Making requests: URL](https://developers.make.com/custom-apps-documentation/component-blocks/api/making-requests#url)
* [Dynamic options RPC output](https://developers.make.com/custom-apps-documentation/app-components/rpcs/dynamic-options-rpc#syntax-of-rpc-output)
* [Dynamic sample RPC](https://developers.make.com/custom-apps-documentation/app-components/rpcs/dynamic-sample-rpc)
* [Limit directive](https://developers.make.com/custom-apps-documentation/component-blocks/api/handling-responses/limit)
* [Pagination: limit-offset](https://developers.make.com/custom-apps-documentation/component-blocks/api/pagination#limit-offset)
* [GraphQL universal module example](https://developers.make.com/custom-apps-documentation/app-components/modules/universal-module/graphql)
* [Interface component](https://developers.make.com/custom-apps-documentation/component-blocks/interface)
* [RPC best practices](https://developers.make.com/custom-apps-documentation/best-practices/remote-procedure-calls)
* [Webhooks](https://developers.make.com/custom-apps-documentation/app-components/webhooks)
