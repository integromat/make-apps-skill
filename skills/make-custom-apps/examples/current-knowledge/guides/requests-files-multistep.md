# Requests, files, multi-step communication and bounded repeats

Back to the [knowledge index](../README.md).

Most modules are one request. Some are not: a file moves as bytes rather than text, a provider wants multipart form data, an upload needs a session, an export is a job you have to wait for. This guide covers building those requests faithfully, chaining requests inside one module, and bounding repeats so waiting never turns into an unbounded loop.

## Build each request from the provider's contract

Map every path, query, header and body field to its input or execution-context source. Verify requiredness, encoding, content type, data type and nested shape. Keep shared authentication and stable defaults in Base ([headers-merge](headers-merge.md)) and see how the operation overrides them. Use `qs` and `headers` as flat collections; arrays in `qs` become repeated keys. Sanitise sensitive locations, including token exchanges and credentials outside headers ([auth-context](auth-context.md)). For signed requests, the signature inputs must match the transmitted method, URL encoding, headers and payload bytes exactly.

### Multipart bodies you build yourself

**Documented behaviour.** With the request `type` `multipart/form-data`, Make builds the body and its boundary itself. An array of `{ "name", "value" }` items keeps the field order. The other request types are `json`, `urlencoded`, `text` (or `string` or `raw`) and `binary`. Make sets the `Content-Type` header automatically only for `json`, `urlencoded` and `multipart/form-data`.

Some providers need a multipart flavour that Make does not encode, such as a `multipart/mixed` batch that bundles many sub-requests into one call or `multipart/related`, or an exact byte layout. For these, build the body in a custom function and send it as `text`, or as `binary` with a Buffer when the parts contain raw bytes. Then:

* Generate the boundary once, in the request's `temp` or as one constant that the function shares, and use that same value in the `Content-Type` header and in the body. Values generated separately never match.
* Strip quotes and line breaks from any value written into a part header (a file name, for example), so that the value cannot end the header line or add part headers.
* Read the answer with `response.type: "text"` and parse it into items in a function. Every part carries its own status, so an HTTP 200 for the batch does not mean that every part succeeded ([errors-and-rate-limits](errors-and-rate-limits.md)).
* Keep each call within the provider's per-batch maximum, walk longer lists in slices with a bounded `repeat`, and append the parsed results ([How `temp` merges arrays and objects](#how-temp-merges-arrays-and-objects)).

```json
{
  "url": "/batch",
  "method": "POST",
  "type": "text",
  "temp": { "boundary": "batch_{{uuid}}" },
  "headers": { "content-type": "multipart/mixed; boundary={{temp.boundary}}" },
  "body": "{{buildBatchBody(temp.pendingIds, temp.boundary)}}",
  "response": {
    "type": "text",
    "temp": { "results": "{{merge(temp.results || emptyarray, parseBatchBody(body))}}" }
  }
}
```

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

**File names for downloaded files.** Users see the name in every later module, so derive it deliberately and never output an empty one. Try these sources in order: the response's `Content-Disposition` header, then the last path segment of the download URL without its query (decoded), then a default built from the record identifier and the extension of the real content. In `Content-Disposition`, the extended form `filename*=UTF-8''…` is percent-encoded and takes precedence over `filename=`. A quoted name can contain `=` and `;`, so splitting the header on `=` and keeping the last piece cuts real names short. A small custom function handles all of these forms:

```js
function fileNameFromDisposition(header, fallback) {
  const value = String(header || '');
  const extended = /filename\*\s*=\s*"?[^']*'[^']*'([^;\s"]+)/i.exec(value);
  if (extended) {
    try { return decodeURIComponent(extended[1]); } catch (e) { /* use the plain form */ }
  }
  const plain = /filename\s*=\s*(?:"([^"]*)"|([^;]+))/i.exec(value);
  const name = plain ? (plain[1] !== undefined ? plain[1] : plain[2]).trim() : '';
  return name || fallback;
}
```

```json
"output": {
  "fileName": "{{ifempty(parameters.fileName, fileNameFromDisposition(headers.`content-disposition`, 'document-' + parameters.id + '.pdf'))}}",
  "data": "{{body}}"
}
```

The `.pdf` default fits an endpoint that always returns PDF. Where users need to choose the name, offer an optional `filename` input and let it win. Make the extension match the real content: take it from the response `Content-Type`, from the format the user requested, or from the type the provider declares, not from a fixed literal such as `output.jpg`. An IML-only expression that cannot parse every form must still fall back to a default when the header is missing.

**Base64 file content inside a JSON response.** Some providers return a generated file as a base64 string inside JSON instead of as a binary body. Passing that string on gives the next module a text field, not a file it can map. Convert the string to binary with the documented `toBinary(value, 'base64')`, either in the mapping or in a custom function as `iml.toBinary(value, 'base64')` (or `Buffer.from(value, 'base64')`). Then output it as the name and data pair with the `filename`/`buffer` types and `file:name`/`file:data` semantics described above.

```json
"response": {
  "output": {
    "fileName": "{{ifempty(parameters.fileName, 'document-' + body.id + '.pdf')}}",
    "data": "{{toBinary(body.content, 'base64')}}"
  }
}
```

The `.pdf` default fits an endpoint that always returns PDF. When the response holds several files, output one name and data pair per file, each with a distinct name (`image-1.png`, `image-2.png`), and take the extension from the real format. When the bytes are optional, for example behind an "include file content" choice, leave `data` undefined unless the user asked for it. Do not fetch or decode them anyway: each extra file can cost a request and memory.

**Files the provider wants as base64 inside JSON.** Some providers document a base64 field, or a `data:` URI, instead of multipart or raw bytes. Even then, keep the user-facing input a file: a `buffer` with `file:data` and a name with `file:name`. Convert it when the request is built, with `buffer.toString('base64')` in a custom function (Buffer is available there) or, as approved apps also do, `base64()` on the buffer in IML. Guard the conversion so that an empty optional file sends nothing: a file collection the user left empty must not be sent as `{}` or as an empty string, because the provider then rejects an image that was simply not set.

A `data:` URI needs a real media type: `data:<mime>;base64,<data>`. Take the MIME type from a type the provider declares, from the file signature, or from a verified extension map (`jpg` and `jpeg` both map to `image/jpeg`). Never build it from the raw file name or extension, which produces `image/photo.png` or `image/jpg`. The documented `mime()` function, called in a custom function as `iml.mime(name)`, returns the type for a known extension and nothing for an unknown one. When the type is unsupported, stop with a clear error instead of sending a guess. Send only metadata you actually know: an invented `size: 0` or content type can be rejected, or can mislead the provider.

```js
function toDataUri(fileName, data) {
  const types = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', pdf: 'application/pdf' };
  const name = String(fileName || '');
  const mime = name.includes('.') ? types[name.split('.').pop().toLowerCase()] : undefined;
  if (!mime) throw new Error(`Unsupported file type: ${name || '(no file name)'}`);
  return `data:${mime};base64,${Buffer.from(data).toString('base64')}`;
}
```

```json
"image": "{{if(parameters.image.data, toDataUri(parameters.image.fileName, parameters.image.data), undefined)}}"
```

Test such a helper with a realistic name, a name without an extension and an upper-case extension. A unit test that only asserts the string the helper already produces (`data:image/test.png;base64,…`) locks the defect in instead of catching it.

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

### A follow-up request to a URL the provider returned

Download and upload flows often end with a request to a URL that an earlier response supplied: a temporary download link, a signed upload URL, a CDN address, or a link relative to the API host. A relative link is appended to the Base URL, so check that the joined URL does not repeat a path segment such as the version.

**Documented behaviour.** Base is inherited by every module and RPC, and a complete `url` takes the place of the Base URL only. The rest of Base still applies to that request: its headers, including the credential, its query string and body defaults, its `response` handling and its log settings. A module `headers` collection merges with Base by name, so an empty collection (`"headers": {}`) removes nothing; a same-named entry replaces the Base value, and a whole-expression `headers` value replaces all Base headers ([headers-merge](headers-merge.md)).

**Design rules.**

* Decide the credential for that step from the provider's documentation. If the documentation says the returned URL expects the API credential (some upload URLs do), keep it and say so. Otherwise do not send the API credential to a host the provider does not document for it, such as a storage or CDN host, or to a URL that already carries a signature in its query. Sending it there hands the credential to another host, and signed-URL hosts can reject a request that carries a second authorization. Keep any header the signed URL was issued for, and leave the steps that call the API as they are.
* Remove the credential on purpose: set each credential entry to `"{{undefined}}"` by name in that step (a Base header, or a Base query parameter; see [headers-merge](headers-merge.md#dropping-one-inherited-header-in-one-request)), or give the step a whole-expression `headers` value that returns only what the step needs, for example the upload's content type. Check a test run's request log to see what the step actually sent. Treat any other form, such as a blank `""` or `"headers": null`, as unproven until that log shows the credential is gone. A credential that reaches another host is a security finding, not a masking issue ([approval gating](../../../references/review-and-qa.md#2a-approval-gating)): fix it on that step. The provider chose the host, so it is never a reason to reject.
* Validate the lookup on the request that returns the URL (`response.valid` with a message). An empty value does not fail on its own: it is treated as a relative URL, so the step calls the Base URL itself, with the credential.
* Give the step its own `response.error` message, and parse error answers per status ([requests and responses](../../../references/requests-and-responses.md)). The inherited Base `response` handling expects the API's body. A storage host answers in its own format, often XML, so an inherited message renders as a bare status code. Also check that an inherited `valid` condition or per-status error entry still fits this step: a per-status entry takes precedence over the step's generic message.
* Pass the URL exactly as it was returned. No `encodeUrl` setting fits every returned URL: with `false`, Make decodes the percent-encoded query string, which can break a signature; with the default `true`, Make encodes special characters again, `%` included, so a path the provider already percent-encoded (`my%20file.pdf`) can be sent double-encoded. Keep the default unless the test below shows a double-encoded path in the request log. Test with a file name that contains a space or a non-ASCII character.
* Repeat on each request any module-level header it needs, such as a tenant or scope header. A request in the array gets Base plus its own settings, not the headers of the request before it.

```json
[
  {
    "url": "/files/{{parameters.fileId}}/download-link",
    "method": "POST",
    "response": {
      "valid": { "condition": "{{body.url}}", "message": "The file has no download link." },
      "temp": { "downloadUrl": "{{body.url}}", "fileName": "{{body.name}}" }
    }
  },
  {
    "url": "{{temp.downloadUrl}}",
    "method": "GET",
    "headers": { "authorization": "{{undefined}}" },
    "response": {
      "type": "binary",
      "error": { "message": "[{{statusCode}}] The file host refused the download link. It may have expired." },
      "output": { "fileName": "{{temp.fileName}}", "data": "{{body}}" }
    }
  }
]
```

Approved apps were seen following both branches: some keep the credential because the provider requires it at the upload URL, and others clear it for a storage or CDN host.

### How `temp` merges arrays and objects

**Documented behaviour.** Values written to `temp` are merged into what is already there, not overwritten.

**Not stated on the public page; confirm it with a test run.** The same merge applies across requests, repeat iterations and pagination within one execution. Objects merge key by key, so a key that a later write omits keeps its old value, and a shrinking "still pending" map never empties. Arrays merge position by position: when a shorter array is written, the old elements beyond its end survive, and each element object keeps any properties the new element lacks. An `undefined` value or an empty array leaves the old value in place. A `temp` array is therefore safe while it only grows: append with `add()` or `merge()`, and use `distinct()` by id where needed. Writing a filtered, re-sorted or retried subset back to the same key is not safe. It moves records onto the wrong positions, leaves stale elements behind, and can carry one record's properties, such as an old error or a field, into another record. A happy-path test does not show this.

**Design rules.**

* Accumulate under one key, append-only.
* Write a filtered, re-ordered or retried result to a key that has not held a longer array in this execution, or compute it in the final step's `output`, and read the final shape from there.
* Do not rely on `undefined` or `[]` to clear a key. Store an explicit end value for a loop control instead, for example `"next": "{{ifempty(body.next_cursor, false)}}"`: a cursor that resolves to nothing leaves the previous one in place, and a loop that stops on `temp.next` keeps requesting it.
* Test a chain that drops or retries an item in the middle of a list, and check that every output record still carries only its own data.

```json
[
  {
    "url": "/items/batch",
    "method": "POST",
    "body": { "ids": "{{parameters.ids}}" },
    "response": { "temp": { "results": "{{distinct(merge(temp.results || emptyarray, body.results), 'id')}}" } }
  },
  {
    "response": { "output": "{{removeFailed(temp.results)}}" }
  }
]
```

The unsafe variant writes `"results": "{{removeFailed(temp.results)}}"` back into `temp` in a later request.

## Independent writes in one module

**Documented behaviour.** The [batch-actions best practices](https://developers.make.com/custom-apps-documentation/best-practices/modules/batch-actions) say that a module cannot report partial success: it either succeeds or fails as a whole, so a module that performs several independent changes can fail after the first one has already been applied. The recommendation is separate modules, one change each, so that every success and every failure is visible and can be handled on its own. The [multiple-requests page](https://developers.make.com/custom-apps-documentation/component-blocks/api/multiple-requests) defines what a request array does: the requests run in sequence and the last request's output is the module's output. It does not promise a transaction, a rollback or an automatic retry, and an HTTP error cannot be reclassified as success so that a later request can continue as recovery.

**Classify each request by its side effects, not its HTTP verb.** A `POST` that only searches is a read. A `GET` that marks something as seen, starts a job or consumes a token is a write. Then judge the sequence:

| Sequence in one module | Treatment |
| --- | --- |
| read, read (metadata, then the file download) | Valid; nothing is changed. |
| read, then write (fetch the object, merge, full `PUT`) | Valid; the read exists to make the single write correct ([outputs-empty-values-updates](outputs-empty-values-updates.md)). |
| write, then read (re-fetch the full object to return it) | Valid enrichment. The write is the change; if the read fails, the module reports an error although the change was applied, so keep that read cheap and state it. |
| the provider's own multi-step upload (open a session, send the chunks, finish) | Valid when the provider designs the sequence as one operation. |
| start a job once, then bounded polling of its status | Valid; see the next section. |
| provider upsert (read, then create or update; or one atomic provider call) | Valid when the provider defines it so. |
| two or more independent writes (create a record, then add it to a list; update two objects) | Prefer separate modules. If the first write succeeds and the second fails, the user sees one error and cannot tell what was applied, and a rerun can duplicate the first write. |

This is design guidance, not an app rejection rule: a module with several writes is a recommendation to split, argued from the provider's contract, and it is not a blocker on its own. Where the provider offers one call that performs the whole change atomically, use that call instead of a chain. Keep the earlier statement in force that several requests are legitimate when each has a reason; the question is whether the writes are independent of each other.

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

### Calling the provider once per element of a list

When the provider has no bulk endpoint, a module can request each element of a list that an earlier request returned, for example one content call per attachment or one output call per task.

```json
[
  {
    "url": "/messages/{{parameters.messageId}}",
    "method": "GET",
    "response": { "temp": { "parts": "{{body.attachments}}" } }
  },
  {
    "condition": "{{parameters.includeContent && length(temp.parts) > 0}}",
    "temp": { "partIndex": "{{ifempty(temp.partIndex, 1)}}", "includeContent": "{{parameters.includeContent}}" },
    "url": "/messages/{{parameters.messageId}}/attachments/{{get(temp.parts, temp.partIndex + '.id')}}",
    "method": "GET",
    "response": {
      "temp": {
        "contents": "{{add(temp.contents || emptyarray, body)}}",
        "partIndex": "{{temp.partIndex + 1}}"
      }
    },
    "repeat": { "condition": "{{temp.includeContent && temp.partIndex <= length(temp.parts)}}", "delay": 200, "limit": 50 }
  },
  { "response": { "output": { "attachments": "{{temp.parts}}", "contents": "{{temp.contents}}" } } }
]
```

* IML arrays are one-based, so start the position at 1 in the request's own `temp` and read the element with `get(list, position + '.field')`. Advance the position in `response.temp`, after the request has used it. The request-level `temp` runs before every repetition: if a position that starts at 1 is advanced there, the loop skips the first element and reads past the end.
* Append the results ([How `temp` merges arrays and objects](#how-temp-merges-arrays-and-objects)). Stop with `position <= length(list)`, and gate the whole step with a `condition` so that an empty list or an unset opt-in sends no request. Put the same gate into `repeat.condition`, read from `temp`, because a repeat condition can read only `temp` (the request's own `temp` copies the opt-in there before every pass): a pass that the request's `condition` skips does not advance the position, so without it the step can keep repeating until the limit.
* `temp` keys live for the whole execution, so give each loop its own position key; otherwise a second loop starts where the first one stopped.
* Each element costs one request against the call timeout and the provider's rate limit. Cap the list, set a literal `limit` at least that large, and add a `delay` where the provider needs one. A loop that reaches its limit with elements left has not finished the list. When the per-element data is large or not always needed, make fetching it opt-in.

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
* Chaining independent writes in one module and assuming a later request can undo an earlier one; nothing here is transactional.
* Classifying a request as a read or a write from its HTTP verb alone.
* Assuming that an absolute URL or an empty `headers` collection drops the Base credential, and so sending the API credential to a storage or CDN host that a response returned.
* Following a returned URL without checking that it is present; an empty value calls the Base URL.
* Setting `encodeUrl: false` on a signed URL whose query is already percent-encoded.
* Outputting an empty file name, or deriving it by splitting `Content-Disposition` on `=`.
* Passing base64 file content on as text instead of converting it to a buffer.
* Building a `data:` URI media type from a file name or extension, or sending invented file metadata.
* Writing a filtered, re-sorted or shorter array back to the same `temp` key.
* Starting a per-element loop at 0, or advancing its position before the request has used it.
* Gating a repeated request with `condition` but not its `repeat.condition`, so a skipped pass repeats until the limit.
* Generating a multipart boundary separately for the header and for the body.

## Exceptions and applicability

* Single-request modules need none of this.
* Multipart, chunking, resumable uploads, signing and size limits are provider-specific.
* Raw-file transport does not apply to SDK Endpoint calls the same way; see [optional-endpoints](optional-endpoints.md).

## Evidence and limits

* Buffer, multipart, `temp`, `repeat` semantics and the sequential output rule: **documented behaviour** (request, buffer, multipart and temp pages).
* Partial success being unsupported and separate modules being recommended: **documented best practice**. The side-effect classification and the treatment of each sequence are an authoring judgment built on it. No static rule here evaluates it, and nothing in this tree shows how a particular provider or Make execution behaves after a partial failure.
* Job states, idempotency and file protocols: **provider contract**; verify against the provider.
* The static checker does not examine files, multipart bodies or request arrays.
* Absolute URLs replacing only the Base URL, a relative URL being appended to the Base URL, Base inheritance, header merging by name and whole-expression replacement, per-status error entries taking precedence over the generic message, `encodeUrl: false` decoding the query string, `toBinary` with base64 and `mime()`, request and response types, and `temp` merging rather than overwriting: **documented behaviour**.
* `temp` arrays merging position by position, `undefined` and `[]` not clearing a key, a request's own `temp` running before every repetition, and a request in an array not receiving the headers of the request before it: **not documented**: not stated on a public page. Confirm it with a test run when a decision depends on it.
* Whether a returned URL expects the API credential, multipart batch formats, per-part statuses and `Content-Disposition` forms: **provider contract** and HTTP standards; verify them against the provider.

## Sources

* https://developers.make.com/custom-apps-documentation/component-blocks/api/making-requests
* https://developers.make.com/custom-apps-documentation/component-blocks/api/multiple-requests
* https://developers.make.com/custom-apps-documentation/best-practices/modules/batch-actions (partial success, separate modules, valid exceptions)
* https://developers.make.com/custom-apps-documentation/component-blocks/api/buffer
* https://developers.make.com/custom-apps-documentation/component-blocks/api/multipart-form-data
* https://developers.make.com/custom-apps-documentation/component-blocks/api/handling-responses/type
* https://developers.make.com/custom-apps-documentation/component-blocks/api/handling-responses/temp
* https://developers.make.com/custom-apps-documentation/block-elements/parameters/buffer
* https://developers.make.com/custom-apps-documentation/block-elements/parameters/filename
* https://developers.make.com/custom-apps-documentation/block-elements/parameters/folder-file
* https://developers.make.com/custom-apps-documentation/app-components/base
