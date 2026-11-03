# Requests and responses

Load this reference for HTTP communication, errors, files, request chains, or asynchronous
status checks. Use [modules-and-pagination.md](modules-and-pagination.md) for pagination.

## Match the provider's wire contract

Approval impact for any request-contract finding follows [Approval gating](review-and-qa.md#2a-approval-gating). Resolve `requestBody` references and read-only or write-on-create prose before calling a field writable; treat it as a defect only on an established rejection or unusable value (fix it), and keep other mismatches advisory.

- Define the exact `url`, `method`, headers, query, and body from provider evidence.
  Relative module/RPC paths use Base; connection requests need their own full configuration.
- Use `headers` and `qs` collections rather than concatenating unencoded values into URLs.
  Array query values produce repeated keys; do not assume a provider expects that encoding.
- Put the HTTP method in `method`, not `type`. Request `type` selects body encoding:
  `json`, `urlencoded`, `multipart/form-data`, `text`/`raw`/`string`, or `binary`.
- JSON, form-urlencoded, and multipart types set their appropriate Content-Type.
  Avoid a global JSON Content-Type that conflicts with a multipart or binary request.
- A GET request ignores `body` and request-body `type`; do not pretend a provider's
  required GET body will be transmitted or silently change the provider's method.
- Keep raw text distinct from JSON objects. Use `createJSON()` only when a provider
  explicitly expects a JSON string nested inside a JSON object.
- For unusual manually encoded query strings, follow the specific encoding guide.
  Do not mix such a URL query with `qs` or assume `encodeUrl: false` preserves it.

Sources: [Request directives](https://developers.make.com/custom-apps-documentation/component-blocks/api/making-requests.md),
[Special query encoding](https://developers.make.com/custom-apps-documentation/best-practices/input-parameters/processing-of-input-parameters.md#special-case-query-string-parameters-in-the-url).

### Array fields: match the shape of the input

A literal array around a single-value input is how one value reaches an array field:
`"ids": ["{{parameters.id}}"]`. Around a `multiple: true` select or an `array` input it nests
the user's array inside another one and sends `[["a", "b"]]`; pass such a parameter directly
(`"ids": "{{parameters.ids}}"`). Check every literal `[...]` in a body against the
multiplicity of what it wraps, and compare sibling components (attach and update, create and
update) that send the same field.

### Key/value rows for open maps

For a provider field that is an open map (custom attributes, metadata, template variables),
offer an array of key/value rows and convert it with `toCollection(rows, 'key', 'value')`;
the GraphQL universal module example converts its variables the same way. Combine it with
whole-parameter mapping: spread the other parameters first, then write the converted field
after the spread so it is the value that is sent.

```json
{
  "body": {
    "{{...}}": "{{omit(parameters, 'attributes')}}",
    "attributes": "{{if(parameters.attributes, toCollection(parameters.attributes, 'key', 'value'), undefined)}}"
  }
}
```

`toCollection()` returns `{}` for a missing value, and on Apps platform version 2 an array
input the user left blank is missing, so without the guard a blank field is sent as an empty
map. Test presence, not length: an erased input arrives as `[]`, still passes the test and is
sent as `{}`, so a user can clear the map where the provider documents that. A guard such as
`if(length(...) > 0, ...)` would make clearing impossible, which the input-processing best
practices list as a bad practice. Use the row field names the parameter actually declares
(`key`/`value`, `title`/`value`, `name`/`value`).

### Optional groups and empty-collection cleanup

When every field of a collection is left empty, Make still sends the collection as `{}`
([Processing of empty values](https://developers.make.com/custom-apps-documentation/other/processing-of-empty-values.md)),
and a parent written literally in the request (`"filters": {"a": ..., "b": ...}`) is sent as
`"filters": {}` when every child resolves empty. Some APIs reject an empty object or read it
differently from an absent group. Clean the whole group in one expression instead of cleaning
each child: for a collection parameter, use the `length(keys(...)) > 0` guard in
[outputs, empty values and updates](../examples/current-knowledge/guides/outputs-empty-values-updates.md#optional-collections-send-them-only-when-filled);
for a parent built from separate inputs, use a custom function (where custom IML functions are
enabled) that returns `undefined` when every child is empty. Test the all-empty case, not only a
filled form.

Check a copied removal helper before relying on it: the documented example sends an array of
plain values (`["a", "b"]`, a multiple select) as `[null, null]`, and still sends an erased
collection such as `{"street": null}` as `{}`. The branch-by-branch checks and a corrected
helper are in
[outputs, empty values and updates](../examples/current-knowledge/guides/outputs-empty-values-updates.md#recursive-cleanup-helpers-check-every-branch).
Like any removal helper, it does not belong where an empty value must clear a field.

Source: [Removal of empty collections and nulls](https://developers.make.com/custom-apps-documentation/app-components/iml-functions/removal-of-empty-collections-and-nulls.md).

### A computed method must always resolve

`method` accepts an IML expression (the request directives page shows
`{{if(parameters.create, 'POST', 'PUT')}}`), so one module can choose `POST`, `PATCH` or
`PUT` from a select. The expression must yield a method for every value the field can hold,
including an empty one. A `switch()` without a final fallback returns nothing for an
unmatched value (for example a select default `create` against option values `Create`), and
the request then goes out with the default `GET`, which drops the body without any error.

```json
{
  "method": "{{switch(parameters.action, 'create', 'POST', 'update', 'PATCH', 'upsert', 'PUT', 'POST')}}",
  "body": {"{{...}}": "{{omit(parameters, 'action', 'id')}}"}
}
```

Keep the select default identical to one option value, end `switch()` with a fallback,
remove the selector and path-only fields from the body, and say in the help what each choice
does.

### Path segments when `encodeUrl` is off

`encodeUrl: false` hands URL encoding to the module: Make no longer encodes the path. Pass
every interpolated path segment through `encodeURL()`, not only the one that prompted the
change. Do not hand-replace a single character (`:` to `%3A`): `/`, `?`, `#`, `%` and spaces
in a mapped ID stay raw, so a slash changes the route and a `?` or `#` starts a query or a
fragment.

```json
{"url": "/objects/{{encodeURL(parameters.type)}}/{{encodeURL(parameters.key)}}", "encodeUrl": false}
```

This is about path segments. Keep query values in `qs`: with `encodeUrl: false`, Make
decodes percent-encoded characters in a query string written into the `url`, so a
hand-encoded query there needs the default `true` (see the `encodeUrl` warning in the
request directives). Test IDs that contain the characters above.

### User values inside provider query languages

Some APIs take a filter, search or key expression in their own syntax: a `$filter`-style
query parameter, a search string, a key predicate in the path. When a module or helper
builds that expression from mapped values, treat each value as a literal of that language:

- escape its quote character the way the provider documents; languages that quote text with
  single quotes usually double an embedded one (`O'Brien` becomes `'O''Brien'`);
- check numbers and dates before formatting them in: a non-number becomes `NaN`, and an
  unparsable date throws inside the helper;
- take field and operator names from a fixed list or your own RPC, never from free text;
- send a finished query expression through `qs` so Make encodes it.

```js
function quoteLiteral(value) {
  return "'" + String(value).replace(/'/g, "''") + "'";
}
// `${field} eq ${quoteLiteral(value)}`
```

An unescaped quote turns a valid input, such as a surname, into a 400 or a different filter.
Give the helper tests with quotes, empty values, numbers and dates.

### GraphQL operations in ordinary modules

Keep the operation text fixed and pass every user value through `variables`, declared with
its GraphQL type in the operation signature, as the GraphQL universal module does. Splicing
mapped values into the query text breaks on quotes, backslashes, braces and newlines, lets a
mapped value change the operation, and needs string fragments for optional arguments. With
variables, an optional value left empty is simply omitted and no escaping helper is needed.

```json
{
  "url": "/graphql",
  "method": "POST",
  "body": {
    "query": "mutation ($id: ID!, $name: String!, $note: String) { renameItem(id: $id, name: $name, note: $note) { id name } }",
    "variables": {
      "id": "{{parameters.itemId}}",
      "name": "{{parameters.name}}",
      "note": "{{parameters.note}}"
    }
  }
}
```

Avoid `"query": "mutation { renameItem(id: {{parameters.itemId}}, name: \"{{parameters.name}}\") { id } }"`.

When the provider's schema expects a JSON-encoded string for a variable (check its scalar
documentation), that is the JSON-string-inside-JSON case above: serialize an object once and
pass an already encoded string unchanged, so it is not encoded twice. When part of the
document must be generated (a field selection chosen in the module), build it only from names
your own RPC returned, never from free text, and test the helper with quotes, backslashes and
newlines. Errors inside HTTP 200 responses still need `valid` (see below).

Source: [GraphQL universal module: query, operation name and variables](https://developers.make.com/custom-apps-documentation/app-components/modules/universal-module/graphql.md).

## Parse before shaping output

`response.type` controls parsing, independently of request `type`. Automatic parsing
uses Content-Type; override it when the provider's success/error formats require it.
A response type object can use `*`, exact statuses, and inclusive status ranges;
exact statuses and narrower ranges take precedence over broader matches.

For a binary success response with JSON errors, a reusable parsing fragment is:

```json
{"response": {"type": {"*": "json", "200-299": "binary"}}}
```

Choose that contract only when the provider actually returns those formats.
Check empty responses such as 204, text errors, and malformed data independently.
Preserve large identifiers: JSON numbers may already lose precision during parsing.
Prefer a documented string representation or a carefully tested text-parsing strategy;
changing an output field to `text` cannot restore digits already rounded.

For XML, inspect parsed node arrays. Use `_value` for node text with attributes and
`_attributes` for attributes. Do not substitute untested tag regexes for the parser.

Source: [Response parsing, XML, and numeric precision](https://developers.make.com/custom-apps-documentation/component-blocks/api/handling-responses/type.md).

## Validate and report errors without hiding them

Make treats HTTP 400–599 as errors. `response.valid` cannot turn these into success.
For providers returning errors with HTTP 200 or another success status, define
`response.valid` from the documented error flag, including GraphQL error arrays
when that is the provider contract. An `error.200` entry alone does not reject success.

Customize `response.error.message` for the provider's actual error shape: a nested
object, a text body, or an error array requires different extraction. Include the
HTTP status and useful non-secret provider details; do not dump arbitrary response
bodies into user-facing errors, especially token or login responses.

Preserve Make's default error types unless a specific override is justified:
HTTP 429 defaults to `RateLimitError`, and 5xx to `ConnectionError`.
A generic `response.error.type: "RuntimeError"` overrides those defaults.
Place a necessary type override under its specific status instead.

The `error` schema defines messages, types, and per-status overrides, not an
invented `response.error.429.retry` object. Expose documented retry information
without promising a particular immediate retry. Pagination delay and job polling
are not replacements for Make's rate-limit/error-handling behavior.

For invalid success responses, message/type resolution starts at `valid`, then
per-status `error`, then generic `error`, then the platform fallback.

Sources: [Valid responses](https://developers.make.com/custom-apps-documentation/component-blocks/api/handling-responses/valid.md),
[Error schema, status defaults, and precedence](https://developers.make.com/custom-apps-documentation/component-blocks/api/handling-responses/error.md),
[HTTP errors cannot be evaluated as success](https://developers.make.com/custom-apps-documentation/app-components/base/error-handling.md).

### Messages from a list of provider errors

When the provider returns a list of field errors next to, or instead of, one message, join
the list and fall back to the top-level message. The user then sees every failing field, and
an empty or missing list still leaves a message. Put the list in the per-status entries whose
body the provider documents as JSON (often 400 and 422). `map()` accepts only an array or
nothing, so in the generic message a text or HTML gateway body, or a single error object,
replaces the status with a function error.

```json
{
  "response": {
    "error": {
      "message": "[{{statusCode}}] {{body.error.message}}",
      "400": {
        "message": "[{{statusCode}}] {{ifempty(join(map(body.error.details, 'message'), '; '), body.error.message)}}"
      }
    }
  }
}
```

Map the property that holds the readable text (`message`, `detail`), keep the status prefix,
and leave credentials and request echoes out. More message shapes are in
[errors and rate limits](../examples/current-knowledge/guides/errors-and-rate-limits.md#building-the-message-from-the-providers-error-shape).

### A lookup that finds nothing

A Get module that reads one record through a list, filter, by-IDs or parent query
(`body.items[1]`, `body.data.parents[1].children`) usually receives HTTP 200 with an empty
list when the ID is unknown or deleted. The module then succeeds with an empty or almost
empty bundle, and the scenario continues with blank values. Decide it explicitly: mark the
response invalid with a not-found message, or state in the help that an empty result means
"not found".

```json
{
  "response": {
    "valid": {
      "condition": "{{length(body.items) > 0}}",
      "message": "No record found for ID {{parameters.id}}."
    },
    "output": "{{body.items[1]}}"
  }
}
```

This is a design decision to make visible, not by itself a rejection reason
(see [Approval gating](review-and-qa.md#2a-approval-gating)).

## Keep output, temporary state, and wrappers distinct

- `response.iterate` selects an array; `response.output` shapes each selected `item`.
  Without iteration, output operates once on the response `body`.
- Request-level `temp` runs before the request. `response.temp` stores values after
  receipt and before the other response directives; subsequent requests can read them.
- Temporary collections merge across a request chain and are lost after execution.
  They are not persistent connection data or a polling trigger's progress store.
- `response.wrapper` runs once at the end and its value becomes the final output.
  It can use `output` to wrap transformed results with metadata; no further output
  transformation follows it. Keep the interface aligned with the resulting shape.

Sources: [Output and wrapper](https://developers.make.com/custom-apps-documentation/component-blocks/api/handling-responses/output.md),
[Response temp](https://developers.make.com/custom-apps-documentation/component-blocks/api/handling-responses/temp.md).

### Values from response headers

Besides `body` and `statusCode`, the response context has `headers`: the response headers
of the last request. Some values exist only there: the ID or location of a resource whose
create call answers with an empty body, the file name of a download
(`Content-Disposition`), and next-page cursors or links. Read them by their lower-case name,
with backticks around a name that contains special characters
(``{{headers.`x-request-id`}}``, `{{headers.location}}`).

```json
{
  "url": "/records",
  "method": "POST",
  "body": "{{parameters}}",
  "response": {
    "temp": {"newId": "{{last(split(headers.location, '/'))}}"},
    "output": {"id": "{{temp.newId}}", "location": "{{headers.location}}"}
  }
}
```

In a request array each later response replaces `headers`, so copy a value into
`response.temp` in the step that received it. Give header-derived values a fallback (a
download without `Content-Disposition` still needs a file name), and declare every value you
output in the interface.

Source: [Action module IML variables](https://developers.make.com/custom-apps-documentation/app-components/modules/action/components.md).

### Temporary values merge, they do not replace

See [requests, files and multi-step](../examples/current-knowledge/guides/requests-files-multistep.md#how-temp-merges-arrays-and-objects)
— how `temp` merges arrays position by position and collections key by key, and why each
processing stage and loop control needs its own key and an explicit end value.

Source: [Response temp](https://developers.make.com/custom-apps-documentation/component-blocks/api/handling-responses/temp.md).

## Multiple requests and safe updates

Use an array of request specifications for a sequential chain. Persist only required
intermediate values in `temp` and define final output at the end. A later request
cannot recover an earlier HTTP error by treating that failed response as success.

For full-replacement updates, confirm actual provider behavior rather than assuming
PUT always replaces or PATCH always preserves. When replacement is required, fetch
the current object, merge explicitly supplied changes, then write it back. Preserve
unmodified fields, including `0` and `false`; honor explicit null/erase semantics.
Use provider concurrency controls where available to avoid overwriting intervening edits.
Do not blindly remove empty strings or arrays that intentionally clear a value.

Sources: [Sequential requests](https://developers.make.com/custom-apps-documentation/component-blocks/api/multiple-requests.md),
[Read/merge/write and erase](https://developers.make.com/custom-apps-documentation/best-practices/modules/batch-actions.md#put-vs-patch-behavior-in-update-modules).

### Independent writes in one module

The [batch-actions best practices](https://developers.make.com/custom-apps-documentation/best-practices/modules/batch-actions)
say a module cannot report partial success: it succeeds or fails as a whole, so a module
that makes several independent changes can fail after the first is already applied. Prefer
separate modules, one change each, so every success and failure is visible. Requests in an
array run in sequence and the last request's output is the module output; that is not a
transaction, a rollback or a retry, and an HTTP error cannot be reclassified as success so
a later request can continue as recovery.

Classify each request by its side effects, not its HTTP verb (a `POST` search is a read; a
`GET` that starts a job or consumes a token is a write), then judge the sequence:

| Sequence in one module | Treatment |
| --- | --- |
| read, read (metadata, then download) | Valid; nothing changes. |
| read, then one write (fetch, merge, full `PUT`) | Valid; the read makes the single write correct. |
| write, then read (re-fetch the object to return it) | Valid enrichment; if the read fails the change is already applied, so keep it cheap and say so. |
| provider-designed chunk upload (open, send chunks, finish) | Valid when the provider defines it as one operation. |
| start a job once, then bounded polling | Valid; see the polling section below. |
| provider upsert (read then create or update, or one atomic call) | Valid when the provider defines it so. |
| two or more independent writes | Prefer separate modules; a rerun after a partial failure can duplicate the first write. |

This is design guidance, not a rejection rule (see [Approval gating](review-and-qa.md#2a-approval-gating)): argue a split from the provider's contract,
and where the provider offers one atomic call for the whole change, use it instead of a
chain. See [requests, files and multi-step](../examples/current-knowledge/guides/requests-files-multistep.md)
and [outputs, empty values and updates](../examples/current-knowledge/guides/outputs-empty-values-updates.md).

Guides for the neighbouring questions: default 429 and 5xx handling, `valid` and per-status
errors in [errors and rate limits](../examples/current-knowledge/guides/errors-and-rate-limits.md).

### Steps without a request

An element of the request array that omits `url` sends nothing (request-less communication).
Its request directives (`method`, `qs`, `headers`, `body`, `type`) are ignored, while its
`condition`, `temp`, `valid` and `output` still run. The step has no response of its own, so
read `temp` there, not `body`: copy what it needs into `response.temp` in the step that
received it. Put the failure text in `valid.message`. The request-less page says `valid` and
`error` lose their value in this mode, and a `response.error` message is not applied to a step
that sent no request. The batch-actions asynchronous example closes its chain with such a step.
Use such a step to:

- fail early with a clear message when an input combination cannot work;
- turn a status collected by earlier steps into a success or a clear error;
- emit the output of the branch that ran: give each branch its own closing step with its own
  `condition`, instead of relying on an earlier output surviving a skipped step.

```json
[
  {"url": "/jobs", "method": "POST", "body": "{{parameters}}", "response": {"temp": {"job": "{{body}}"}}},
  {
    "response": {
      "valid": {
        "condition": "{{temp.job.status != 'rejected'}}",
        "message": "Job {{temp.job.id}} was rejected: {{temp.job.reason}}"
      },
      "output": "{{temp.job}}"
    }
  }
]
```

Omit `url` entirely: a `url` expression that resolves to an empty value is not the same and
still sends a request. Keep the closing steps' conditions mutually exclusive so exactly one
of them produces the output.

Sources: [Request-less communication](https://developers.make.com/custom-apps-documentation/component-blocks/api/request-less-communication.md),
[Asynchronous process](https://developers.make.com/custom-apps-documentation/best-practices/modules/batch-actions.md#asynchronous-process).

## Bounded asynchronous polling with repeat

Start a job once, retain its ID, then repeat a read-only status request.
Copy the status into `response.temp`: **`repeat.condition` reads `temp`, not `body`**.
Set a numeric literal `repeat.delay` in milliseconds and a numeric literal
`repeat.limit`; these fields do not support IML expressions. Do not omit the limit.

```json
{
  "response": {"temp": {"status": "{{body.status}}"}},
  "repeat": {
    "condition": "{{temp.status === 'waiting' || temp.status === 'processing'}}",
    "delay": 1000,
    "limit": 10
  }
}
```

This fragment needs a real status endpoint and a final success/failure check.
Distinguish completed, failed, canceled, and exhausted polling outcomes. Do not
return success merely because repetition stopped. Budget delays and calls against
the target runtime's time limits; a larger app timeout is not unlimited execution.
Never blindly repeat a non-idempotent creation request to wait for its completion.

Source: [Repeat, delay, limit, and temporary state](https://developers.make.com/custom-apps-documentation/component-blocks/api/making-requests.md#repeat).

### Optional waiting, user-set bounds and partial results

- **Optional waiting.** When a boolean input chooses between "start and return the job ID"
  and "wait for the result", put a `condition` on the polling step and close each branch
  with its own request-less step (see "Steps without a request"), with the same job-ID key
  and status field in both outputs. Say in the help that waiting is bounded and that a
  status module or a webhook fits long jobs.
- **A bound the user can set.** `delay` and `limit` are not evaluated, so
  `"limit": "{{parameters.maxChecks}}"` offers a setting that is ignored and can leave the loop
  without a working bound. Count the checks in `temp`, copy the user's bound into `temp` too (a
  `repeat.condition` reads only `temp`), test both there, keep a literal `limit` as the
  ceiling, and cap the input at that ceiling (`validate.max`).
- **Check before you iterate.** A failed job usually has no result array; iterating it
  returns zero bundles and no error. Check the stored status first, in a closing step whose
  `valid` accepts only success and whose message names the status and the job ID.
- **Partial results.** When a batch call or a finished job answers with success but lists
  unprocessed or failed items, do not report full success: return those items, or fail with
  them, as the provider contract allows. Do not re-send them inside the polling loop; rate
  limits stay with Make's error handling (see the error section above).

```json
[
  {"url": "/jobs", "method": "POST", "body": "{{parameters.job}}",
   "response": {"temp": {"jobId": "{{body.id}}", "accepted": "{{body}}"}}},
  {"condition": "{{parameters.wait}}", "url": "/jobs/{{temp.jobId}}", "method": "GET",
   "response": {"temp": {"status": "{{body.status}}", "job": "{{body}}", "checks": "{{ifempty(temp.checks, 0) + 1}}", "maxChecks": "{{ifempty(parameters.maxChecks, 30)}}"}},
   "repeat": {
     "condition": "{{(temp.status == 'queued' || temp.status == 'running') && temp.checks < temp.maxChecks}}",
     "delay": 5000,
     "limit": 60
   }},
  {"condition": "{{parameters.wait}}",
   "response": {
     "valid": {"condition": "{{temp.status == 'succeeded'}}",
               "message": "Job {{temp.jobId}} has status {{ifempty(temp.status, 'unknown')}}, not succeeded."},
     "output": {"{{...}}": "{{temp.job}}", "jobId": "{{temp.jobId}}"}
   }},
  {"condition": "{{!parameters.wait}}",
   "response": {"output": {"{{...}}": "{{temp.accepted}}", "jobId": "{{temp.jobId}}"}}}
]
```

## Multipart, binary, and verification

For multipart uploads, accept a `buffer` field and a filename. The file part uses
`value` for bytes and `options.filename` for its name; let the encoder construct
the multipart boundary. Do not send base64 text unless the provider explicitly requires it.

```json
{
  "type": "multipart/form-data",
  "method": "POST",
  "body": {
    "file": {
      "value": "{{parameters.file_data}}",
      "options": {"filename": "{{parameters.file_name}}"}
    }
  }
}
```

For downloads, return actual bytes and declare a `buffer` output plus a filename.
Use `semantic: "file:data"` and `semantic: "file:name"` for file mapping support.
Test binary round-tripping, zero-byte files, non-ASCII filenames, and JSON/text errors.

Sanitize authentication and token fields in every applicable request/response log;
error messages and output bundles need their own disclosure review. Keep HTTPS
certificate validation intact; use the documented custom-CA configuration only for
the host that requires it, not a blanket insecure transport bypass.

Report fixture checks, SDK execution, and authenticated provider tests separately.
A syntactically valid request or uploaded definition is not evidence of successful I/O.

Sources: [Multipart uploads](https://developers.make.com/custom-apps-documentation/component-blocks/api/multipart-form-data.md),
[Buffer and file semantics](https://developers.make.com/custom-apps-documentation/component-blocks/api/buffer.md),
[Custom CA scope](https://developers.make.com/custom-apps-documentation/other/https-custom-ca.md).

### Raw binary uploads

`type: "binary"` sends the buffer as the whole body. Unlike `json`, `urlencoded` and
`multipart/form-data`, it sets no Content-Type of its own, so set the one the provider
expects in the request `headers`: a fixed type when the endpoint accepts one format, a
mapped MIME-type input, or a type derived from the file extension with
`application/octet-stream` as the fallback. Keep the file name and the MIME type as separate
values, and check that a helper used in the header really returns a MIME type. A per-name
header in the request also replaces a JSON Content-Type inherited from Base.

```json
{
  "url": "/uploads",
  "method": "POST",
  "type": "binary",
  "headers": {"Content-Type": "{{ifempty(parameters.mimeType, 'application/octet-stream')}}"},
  "body": "{{parameters.data}}"
}
```

Providers that trust the header reject or mislabel a wrong type; others sniff the bytes and
hide the mistake until a stricter endpoint is used.
