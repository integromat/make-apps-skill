# Requests, files, multi-step communication and bounded repeats

Back to the [knowledge index](../README.md).

Most modules are one request. Some are not: a file moves as bytes rather than text, a provider wants multipart form data, an upload needs a session, an export is a job you have to wait for. This guide covers building those requests faithfully, chaining requests inside one module, and bounding repeats so waiting never turns into an unbounded loop.

## Build each request from the provider's contract

Map every path, query, header and body field to its input or execution-context source. Verify requiredness, encoding, content type, data type and nested shape. Keep shared authentication and stable defaults in Base ([headers-merge](headers-merge.md)) and see how the operation overrides them. Use `qs` and `headers` as flat collections; arrays in `qs` become repeated keys. Sanitise sensitive locations, including token exchanges and credentials outside headers ([auth-context](auth-context.md)). For signed requests, the signature inputs must match the transmitted method, URL encoding, headers and payload bytes exactly.

## Files: bytes, names and metadata

**Documented behaviour.**

* File data uses the `buffer` parameter **type**. The `semantic` (`file:name` and `file:data`) marks each role, which is what lets the file input dialog of a downstream module pre-map them. Keep the name apart from the bytes. Two contracts must not be conflated: the **typed output/download interface** (below) declares the name with the `filename` type, while the documented **multipart/form-data input** example for an upload filename uses `type: text` with `semantic: file:name`. A `filename` type is therefore not mandatory for every file-name input; the semantic carries the role.
* A request sends raw bytes from a buffer value as the body, or multipart with the request `type: "multipart/form-data"` and a body whose file entry carries `value` and `options` such as `filename`.
* A download is received with a response `type` of `binary`. The documented download interface declares a name field and a data field with their types and semantics, so a downstream module that accepts a file can map them:

  ```json
  [
    { "name": "name", "type": "filename", "label": "Name", "semantic": "file:name" },
    { "name": "data", "type": "buffer", "label": "Data", "semantic": "file:data" }
  ]
  ```

  The Buffer parameter page shows the same pair with the name field called `fileName`. The *names* (`name`/`data`, `fileName`/`data`) are free and should stay stable once published; the *types* and *semantics* carry the file contract. `buffer` and `filename` are type names, not required field names.
* File/folder browsing is a separate component (folder/file parameters with their own selection and path semantics).

**What to decide from the provider.** Whether it wants raw bytes, multipart, encoded text or a reference to an existing file; the multipart field names and metadata; the file name and content type (from headers or a metadata call); size limits; and any chunked or resumable protocol, where contiguous byte ranges and the final short chunk must follow the provider's rules. Do not generalise one provider's chunk size or an old example's buffer handling into a platform rule.

Text conversion is not a harmless default for binary content. A file-like URL or a MIME header does not prove the response was decoded as binary; the response `type` decides. Large files are subject to the same call timeout as any request.

## Several requests in one module

**Documented behaviour.**

* `communication` may be an array; requests run in sequence and the last request's output is the module's output.
* Pass values forward through `response.temp`. Temporary values merge across requests and live only inside this execution; they are not durable polling state.
* Each request keeps its own `response` handling; an HTTP error in one cannot be rescued by a later request ([errors-and-rate-limits](errors-and-rate-limits.md)).
* Several requests are legitimate: preflight lookups, read-before-write, upload sessions, asynchronous jobs. They are not a defect in themselves. Pagination is a different mechanism for plain paged lists; use it instead of a request array.

```json
[
  { "url": "/uploads", "method": "POST", "response": { "temp": { "uploadId": "{{body.id}}" } } },
  { "url": "/uploads/{{temp.uploadId}}/complete", "method": "POST", "response": { "output": "{{body}}" } }
]
```

## Bounded repeats and asynchronous work

Separate three things: *starting* a job, *observing* progress, and *retrieving* the result.

**Documented behaviour.** `repeat` re-runs a request. Its condition is evaluated after the request and reads the temporary context (`temp`), not the response body directly, so save the status you need into `temp` first. `delay` is in milliseconds, and `delay` and `limit` are literal settings, not mapped values.

**Design rules.**

* Use a finite limit and add the delays to the time budget; the whole call is bounded by the call timeout.
* Poll the documented status resource. Do not repeat a successful non-idempotent creation request while waiting.
* Distinguish terminal failure, pending work and a finished result.
* Reaching the repeat limit is not completion. Do not present it as success and do not invent an automatic error behaviour; decide explicitly what the module returns when the job is still pending.
* A long job may suit a separate "check status" or "download result" module, or a webhook callback, better than one long-running module.

An export example, in prose: step one creates the export and stores its identifier in `temp`; step two polls the status with a bounded repeat until a terminal status; step three downloads the finished file as a binary response. A failed terminal status is an error, and a still-pending state at the limit is reported as such.

## Rationale

Multi-step and binary flows add failure modes the user cannot see. Making each step's input, state and bound explicit lets a reviewer verify the chain without running it and lets the author reason about duplicates, timeouts and partial completion.

## Pitfalls

* Sending a file as text or JSON when the provider expects bytes or multipart.
* Declaring a file output without the `filename`/`buffer` types and the `file:name`/`file:data` semantics, so the downstream file dialog cannot pre-map it. The field *name* is not the contract: `name`/`data` and `fileName`/`data` are both documented; renaming an already published output to match a preferred spelling is a breaking change and not a fix.
* Reading the response body in a `repeat` condition instead of `temp`.
* Mapped values in `delay` or `limit`.
* Retrying a creation request while waiting for a job.
* Treating the repeat limit as success.
* Using `temp` for a value a later module needs.
* Using a request array where plain pagination fits.

## Exceptions and applicability

* Single-request modules need none of this.
* Multipart, chunking, resumable uploads, signing and size limits are provider-specific.
* Raw-file transport does not apply to SDK Endpoint calls the same way; see [optional-endpoints](optional-endpoints.md).

## Evidence and limits

* Buffer, multipart, `temp`, `repeat` semantics and the sequential output rule: **documented behaviour** (request, buffer, multipart and temp pages).
* Job states, idempotency and file protocols: **provider contract**; verify against the provider.
* The static checker does not examine files, multipart bodies or request arrays.

## Sources

* https://developers.make.com/custom-apps-documentation/component-blocks/api/making-requests
* https://developers.make.com/custom-apps-documentation/component-blocks/api/multiple-requests
* https://developers.make.com/custom-apps-documentation/component-blocks/api/buffer
* https://developers.make.com/custom-apps-documentation/component-blocks/api/multipart-form-data
* https://developers.make.com/custom-apps-documentation/component-blocks/api/handling-responses/type
* https://developers.make.com/custom-apps-documentation/component-blocks/api/handling-responses/temp
* https://developers.make.com/custom-apps-documentation/block-elements/parameters/buffer
* https://developers.make.com/custom-apps-documentation/block-elements/parameters/filename
* https://developers.make.com/custom-apps-documentation/block-elements/parameters/folder-file
* https://developers.make.com/custom-apps-documentation/app-components/base
