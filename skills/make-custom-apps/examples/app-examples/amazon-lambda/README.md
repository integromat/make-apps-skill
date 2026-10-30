# Amazon Lambda — native AWS Signature V4, marker pagination and invocation errors

A **normalized, anonymized reference export** of an Amazon Lambda custom app. Every section the export contained is retained: base, connection, 9 modules, 3 RPCs, 4 helper functions, groups and install files. It is reading material for Make app patterns. It is **not** a certified standalone package, not a tested deployment, and not the result of any live or authenticated validation. Imported helpers, tests and samples are retained as data and were not executed during this curation. Nothing was invoked in an AWS account during this curation.

Back to the [app examples index](../README.md).

## How to read this export

The folder is the platform's normalized export layout, not an SDK project. Each module directory holds `api.json` (communication), `expect.json` (mappable input fields), `parameters.json` (static parameters), `interface.json` (output fields), `samples.json` and `metadata.json`. Start with [`metadata.json`](metadata.json), then [`base.imljson`](base.imljson), then one module.

| Item | Value (from [`metadata.json`](metadata.json)) |
| --- | --- |
| App name / label | `amazon-lambda` / Amazon Lambda |
| `version` | 1 |
| `rev` | 12 |
| `versionFull` | 1.1.4 |
| `manifestVersion` | 2 |
| Connection | `amazon-lambda`, type `basic`, rev 6 ([metadata](connections/amazon-lambda/metadata.json)) |

`version: 1` is Make's app version. It is unrelated to any AWS API date.

## Learning objectives

1. **Native AWS signing.** [`base.imljson`](base.imljson) uses the platform's `aws` block with `sign_version: "4"`, the connection key and secret, and a region-specific host. No signing helper is hand-written, which is the point of the example.
2. **Marker pagination.** [`modules/listFunctions/api.json`](modules/listFunctions/api.json) sends the previous `NextMarker` as `Marker` and continues while it is non-empty.
3. **Request bound versus response page.** The list request asks for `MaxItems: 1000`. Documentation says a response still holds at most 50 functions, so the pagination loop is what delivers the rest. The large bound is valid and was preserved.
4. **Selector backed by an RPC.** [`rpcs/listFunctions/api.json`](rpcs/listFunctions/api.json) feeds the function selectors in [`invokeAFunction/expect.json`](modules/invokeAFunction/expect.json) and [`getAFunction/expect.json`](modules/getAFunction/expect.json). Its label shows a version but its value does not; see hypothesis 1.
5. **Invocation errors.** [`invokeAFunction/api.json`](modules/invokeAFunction/api.json) turns a function error (HTTP 200 plus an error header) into a module error with `response.valid` and a status-200 error message that appends the stack trace.
6. **Polling triggers.** [`watchFunctions`](modules/watchFunctions/api.json) and [`watchLayerVersions`](modules/watchLayerVersions/api.json) use `trigger.id` and a parsed date with `order: desc`.
7. **Helpers.** [`functionResponse`](functions/functionResponse/code.js), [`layerResponse`](functions/layerResponse/code.js) and [`layerVersionResponse`](functions/layerVersionResponse/code.js) normalize dates; [`parseJSON`](functions/parseJSON/code.js) parses the invoke body text.

## Setup and permissions

- An AWS access key pair for an identity that may call the Lambda operations used. The connection check lists functions ([`connections/amazon-lambda/api.json`](connections/amazon-lambda/api.json), limit 1), so list permission is needed to connect. The retrieved Invoke documentation states that invocation requires permission for the `lambda:InvokeFunction` action. The IAM permissions for the other operations (get function, layers) are not recorded in the retrieved documentation findings used here and were not established.
- A region chosen in the connection; the base host is built from it. The region list is part of [`connections/amazon-lambda/parameters.json`](connections/amazon-lambda/parameters.json). Documentation lists additional endpoint variants (for example FIPS) that this export does not use.
- No webhook exists in this export (0 webhooks).
- During this curation nothing was connected to a real AWS account.

## Inventory and dependency closure

| Component | Count | Notes |
| --- | --- | --- |
| Modules | 9 | Function group: `watchFunctions`, `listFunctions`, `getAFunction`, `invokeAFunction`. Layer group: `watchLayerVersions`, `listLayers`, `listLayerVersions`, `getALayerVersion`. Other: `makeApiCall`. See [`groups.json`](groups.json). |
| RPCs | 3 | `listFunctions`, `listLayer`, `listLayerVersions`. |
| Webhooks | 0 | Triggers are polling triggers. |
| Connections | 1 | `amazon-lambda`. |
| Functions | 4 | Listed above. All four `test.json` files contain only `null`. |
| Samples | 9 | Every module `samples.json` contains only `null`. |

Reviewer text search found that every `rpc://` reference points at one of the three exported RPCs (`listFunctions`, `listLayer`, `listLayerVersions`), that all module and RPC `accountName` values are `amazon-lambda`, and that no non-null `altAccountName` or `hookName` binding exists. The metadata files do contain `altAccountName` and `hookName` keys, but every value is `null`. The export therefore has no alias to a connection or hook that is missing from it. Not shown: platform import behavior, components that existed in the original app but were not exported, and runtime resolution of IML. Closure is therefore "no gap found by static reading", not "verified deployable".

## API version and matching public documentation

- Source routes: `/2015-03-31/functions/...` for functions and `/2018-10-31/layers/...` for layers on `https://lambda.{region}.amazonaws.com`. The date-like path segments are AWS route versions. The source sends no other version header, and **there is no separate version pin**.
- Retrieved public documentation matching the source:
  - Listing: <https://docs.aws.amazon.com/lambda/latest/api/API_ListFunctions.html> — `GET /2015-03-31/functions`, `FunctionVersion=ALL`, `Marker` / `NextMarker`.
  - Invocation: <https://docs.aws.amazon.com/lambda/latest/api/API_Invoke.html> — `POST /2015-03-31/functions/{FunctionName}/invocations`; the name may be a plain name, ARN, version or alias; `Qualifier` is the query parameter for a version or alias; the log-type header applies to synchronous calls only.
  - Signing: <https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_sigv.html> — Signature Version 4 background. The source uses the platform's own signer.
  - Endpoints: <https://docs.aws.amazon.com/general/latest/gr/lambda-service.html> — `lambda.<region>.amazonaws.com` host pattern.
  - Get function: <https://docs.aws.amazon.com/lambda/latest/api/API_GetFunction.html> — `GET /2015-03-31/functions/{FunctionName}` matches [`getAFunction/api.json`](modules/getAFunction/api.json). `Qualifier` selects a published version or alias, and `FunctionName` also accepts a qualified name or ARN. The source sends no `Qualifier`.
  - List layers: <https://docs.aws.amazon.com/lambda/latest/api/API_ListLayers.html> — `GET /2018-10-31/layers` matches [`listLayers`](modules/listLayers/api.json) and [`rpcs/listLayer`](rpcs/listLayer/api.json). `Marker` / `NextMarker` paging; `MaxItems` valid range 1 to 50; each layer entry holds its latest matching version with `CreatedDate` and `Version`.
  - List layer versions: <https://docs.aws.amazon.com/lambda/latest/api/API_ListLayerVersions.html> — `GET /2018-10-31/layers/{LayerName}/versions` matches [`listLayerVersions`](modules/listLayerVersions/api.json), [`watchLayerVersions`](modules/watchLayerVersions/api.json) and [`rpcs/listLayerVersions`](rpcs/listLayerVersions/api.json). `Marker` / `NextMarker` paging; `MaxItems` valid range 1 to 50; a `LayerVersions` array; deleted versions are omitted.
  - Get layer version: <https://docs.aws.amazon.com/lambda/latest/api/API_GetLayerVersion.html> — `GET /2018-10-31/layers/{LayerName}/versions/{VersionNumber}` matches [`getALayerVersion/api.json`](modules/getALayerVersion/api.json). Both layer name and version number are required, and `CreatedDate` is documented as ISO 8601.
- These are current documentation pages. They are not proof of the API as it was when this export was made, and they do not show live behavior. The matches are route, paging-parameter and range matches only: response shapes, IAM permissions and error behavior of the layer and get-function routes were not compared.

## Static checks actually performed

The final static check of this folder passed with no errors. It covered strict JSON parsing, source comparison, relative-link resolution and a private-path marker search; imported code, helpers and tests stayed data and were not executed.

- All 87 original source files were retained and none were removed; the only added file is this `README.md` (88 files in the folder).
- 79 of the files are JSON and all parsed strictly with no errors. The other 8 files are `code.js` and `arguments.txt` for the four helpers.
- The source comparison against the original found no source change.
- Every relative link in the README resolved, and no private-path markers were found.

Reviewer reading of the source (text search, no execution) produced the observations in this README.

**Not performed, and not claimed:** helper or test execution, Make schema/import validation, any call to AWS or Make, signing verification, and any runtime check of IML expressions.

## Retained data limitations

- Samples and function tests are `null` placeholders; there is no captured AWS response in this folder.
- [`parseJSON`](functions/parseJSON/code.js) calls `JSON.parse` on its argument. The invoke body field is typed `any`, so the code expects JSON text. What the platform passes for a mapped object was not tested.
- [`metadata.json`](metadata.json) has `docs: null`, `description: null` and empty categories as exported.

## Hypotheses

Statuses: **confirmed** (shown by source plus documentation), **not reproduced** (no support found), **unresolved** (needs runtime or provider evidence). No status below is a live test result.

| # | Hypothesis | Status | Evidence and limits |
| --- | --- | --- | --- |
| 1 | The function selector loses the version it displays. | **Confirmed by static reading** | [`rpcs/listFunctions/api.json`](rpcs/listFunctions/api.json) requests every version and labels each item `FunctionName (Version)`, but its `value` is `FunctionName` alone. The invoke URL in [`api.json`](modules/invokeAFunction/api.json) uses `parameters.function` with no `Qualifier`. So choosing a versioned entry sends the same unqualified name as every other entry for that function, and the list holds label-only duplicates. A value that a user maps manually as a qualified name or ARN is not covered by this finding; the retrieved Invoke page says such names are accepted, and it was not tested. The same selector feeds [`getAFunction`](modules/getAFunction/api.json), which also has no qualifier; the retrieved Get function page documents `Qualifier` and qualified names there too. |
| 2 | A function error is not reported as a module error. | **Not reproduced** | AWS documents that a function error can still return a successful HTTP status. The source checks the lowercase error header in `response.valid` and has a status-200 error message. Header-name casing in the platform's header map and the real error body shape were not run. |
| 3 | Marker pagination misses pages. | **Not reproduced** | `Marker` / `NextMarker` match the retrieved listing page, and the loop ends when the marker is empty. `MaxItems: 1000` is a valid request bound even though a response holds at most 50 items. Layer routes use `MaxItems: 50` and the same loop; the retrieved List layers and List layer versions pages document the same `Marker` / `NextMarker` paging and a `MaxItems` range of 1 to 50, so the bound is in range. Only these parameters were compared, not response shapes or live paging. |
| 4 | Empty `log.sanitize` leaks signing secrets. | **Unresolved** | [`base.imljson`](base.imljson) and the [connection check](connections/amazon-lambda/api.json) have `sanitize: []`. The `aws` block is handled by the platform signer. Nothing retrieved shows what that signer writes to logs, so no mask path was invented and nothing was changed. |

Advisory, not a defect claim: [`invokeAFunction`](modules/invokeAFunction/api.json) always sends `X-Amz-Log-Type: Tail`, but the module output exposes only the response body. Whether the invocation-log header is recorded in Make logs was not checked.

## Evidence still needed

- Platform evidence on what the `aws` signer logs, if hypothesis 4 is to be closed.
- Runtime evidence on the points the static reading leaves open: what the platform passes to [`parseJSON`](functions/parseJSON/code.js), header-name casing in `response.valid`, the real error body shape, whether the invocation-log header is recorded, and IAM permissions for get-function and the layer operations.

## Public changes

**No source deltas; this README is the only addition** to the public copy. No credential input type and no log-mask path was changed. The `secret` input is already `password`. The `key` input is an AWS access key identifier, which does not need masking. `log.sanitize` stays empty in both [`base.imljson`](base.imljson) and [`connections/amazon-lambda/api.json`](connections/amazon-lambda/api.json).
