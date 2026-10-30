# GitHub repository search

A complete set of **search module sections** for public repository search, not a complete app. No connection is required: Communication uses an absolute public API URL. The sections can be pasted into a Search module by hand, or created with the typed SDK script described under "Create the private app with the SDK script". The local filenames below are an example convention.

## Section mapping and dependencies

Create a Search module and map:

| File | Make section |
| --- | --- |
| [base.imljson](base.imljson) | App Base (only used by the SDK script; see below) |
| [api.imljson](api.imljson) | Communication |
| [parameters.imljson](parameters.imljson) | Static parameters (empty) |
| [expect.imljson](expect.imljson) | Mappable parameters |
| [interface.imljson](interface.imljson) | Interface |
| [samples.imljson](samples.imljson) | Samples (one synthetic output bundle) |

`q` and `limit` are the only inputs referenced by Communication. `response.iterate` selects `body.items`; the explicit output projection has exactly the five fields in Interface and Samples. Search modules iterate results into separate bundles.[16]

## Assumptions and placeholders

- Uses documented `GET https://api.github.com/search/repositories` with `q`, `sort=stars`, `order=desc`, `per_page=100`, and `page`. Only public resources are in scope; no token placeholder is needed.[2]
- The first request explicitly uses `page: 1`. Subsequent requests use **`{{pagination.page}}` without `+ 1`**: Make prepares page 2 for the second request. Pagination stops on an empty page or the response limit.[12]
- The user-facing limit is bounded to 1–1000, matching GitHub's maximum accessible search results, not a claim that all matching repositories can be exported. `per_page` is independent of that bundle limit.[2][12]
- A successful page must have `incomplete_results === false`; otherwise `response.valid` raises an error rather than presenting a timeout result as complete.[2][13]
- Stars and archived flags are mapped directly, preserving `0` and `false`. Samples contain fictional IDs/names for UI illustration only.
- Nested `validate.min` / `validate.max` are SDK parameter fields; they are not JSON Schema `minimum` / `maximum`.[14][28]

## Create the private app with the SDK script

[create-app.ts](create-app.ts) is a **management script** for your terminal. It uses the published [`@makehq/sdk`](https://www.npmjs.com/package/@makehq/sdk) at exactly 1.8.1 (TypeScript 7.0.2 for the typecheck; both pinned, with a lockfile in this folder) to do what the SDK-first workflow does by hand. It is not Make app runtime code, and nothing in it runs inside a scenario.

The script performs, in order, and stops at the first failure:

1. `apps.create` with `private: true`, then a full `apps.get` that must confirm `public === false`. No section is written if the app is reported public.
2. `apps.setSection('base')` with [base.imljson](base.imljson), then `getSection` readback.
3. `modules.create` (`moduleInitMode: 'blank'`), then `setSection` and `getSection` readback for `api`, `parameters`, `expect`, `interface` and `samples`, then a full `modules.get` that checks name and type.

Readback is an exact text comparison. A mismatch, a non-text response or an acknowledgement for a different name or type is reported as a failure; the script never rewrites or retries. Reports show the step, an HTTP status category and offsets or lengths, never section content, API error bodies or credentials.

### Offline default (no environment needed)

```text
npm ci                  # exact versions from package-lock.json; no scripts are run on install
npm test                # typecheck-clean build, then unit tests; mocks and a faked fetch only
npm run-script dry-run  # compiles to .build/ and prints the mock summary; works on Node 20 or later
```

`npm run-script dry-run` (the long form of `npm run` for the `dry-run` script in this folder's `package.json`, not a repository-root command) is the portable path. To run the TypeScript file directly, Node must support type stripping:

```text
node --experimental-strip-types create-app.ts   # Node 22.6 or later (also 23.x, 24 and later)
```

Plain `node create-app.ts` works only where stripping is on by default: Node 22.18 or later, 23.6 or later, and 24 or later. On Node 20, 21 and 22.0 to 22.5 there is no type stripping at all; use `npm run-script dry-run`. On 22.6 to 22.17 and 23.0 to 23.5 without the flag, Node fails with `ERR_UNKNOWN_FILE_EXTENSION`. Direct runs print an experimental-feature warning on some versions; that is expected.

With no flags the script runs against an in-memory stand-in, makes no Make API call and ignores any credentials in the environment. Its summary says so and states that the run is not evidence that Make accepts these sections. From the repository root, `npm run test:sdk` repeats the install, typecheck, tests and dry-run in a clean temporary copy, and also runs the direct TypeScript path when the running Node supports it. Inside a repository checkout, prefer that root `npm run test:sdk` over running `npm ci` here, or delete the locally generated `node_modules/` and `.build/` folders before packaging the skill, because the packager refuses generated folders.

### Explicit live run (your account, your responsibility)

`--live` creates a real **private** app in your Make account. Nothing is defaulted, and nothing here has been run live:

- Provide `MAKE_API_KEY` and `MAKE_ZONE` (a bare hostname such as `eu1.make.com`) in the environment. Credentials are never accepted as arguments, files or defaults, and the script refuses any other host so the key cannot be sent elsewhere. The key needs the SDK-apps scopes your Make account documents for creating and editing custom apps.
- Provide `--app-name` (letters, digits, `-`, `_`), `--audience` and `--module-type-id`. The SDK exposes no list of valid audience values or module type ids, so take them from your Make account or the Make documentation; this example does not guess them, and the Search type id in particular is for you to confirm.
- Run, for example (on Node 22.6 or later; on older Node, run `npm test` or the dry-run once to compile, then use `node .build/create-app.js` with the same flags instead): `node --experimental-strip-types create-app.ts --live --app-name my-github-search --audience <your-audience> --module-type-id <search-type-id>`.

Safety boundaries:

- Automatic retries are switched off. A create that fails with a 5xx response or no response has an **uncertain outcome**: look for the app in Make before running again, because a second run with the same name can conflict or leave a partial app. Completed writes are not rolled back.
- The script does not publish or request approval, create connections, run scenarios or call GitHub, and it deletes nothing.
- Base is a minimal assumption: only `baseUrl`. The module's Communication uses an absolute URL and its own headers, so this example does not need a Base, and how Make combines the two is unconfirmed here. If Make rejects the Base, the run stops at `base.write`; adjust `base.imljson` against current Make documentation rather than guessing.
- The test suites never contact Make or a provider; the live path is exercised only through mocks and a faked `fetch`.

## Validation level and remaining live tests

Offline checks parse JSON, check named inputs/output/sample types and the exact pagination mapping; they **do not evaluate IML or call GitHub**. The SDK script's tests check call order, request shapes, the private flag, readback comparison and the live-mode gates against mocks and a faked `fetch`; they do not show that Make accepts these sections. Make/provider execution remains untested.

In an explicitly authorized Make test, inspect actual requested pages **1, 2, 3**, an empty final page, a partial final page, limits smaller than a page, limits spanning pages, and the 1000-result ceiling. Inspect IDs for duplicates and report incomplete results or changing search rankings; page-number search is not a snapshot. Exercise 403/429 rate-limit handling and an invalid query. Public reads need no credentials; adding private-resource access requires a separately designed connection and authorized credential tests. No live tests have been run here.

## Sources

[2] https://docs.github.com/en/rest/search/search
[12] https://developers.make.com/custom-apps-documentation/component-blocks/api/pagination.md
[13] https://developers.make.com/custom-apps-documentation/component-blocks/api/handling-responses/valid.md
[14] https://developers.make.com/custom-apps-documentation/block-elements/parameters/text.md
[16] https://developers.make.com/custom-apps-documentation/app-components/modules/search.md
[28] https://developers.make.com/custom-apps-documentation/block-elements/parameters/integer-uinteger.md
