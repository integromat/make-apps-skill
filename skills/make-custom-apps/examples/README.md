# Custom-app component examples

A directly reused [library of 71 copied/adapted examples](copied-snippets/README.md), four focused component examples and 15 privacy-normalized historical app exports. The folders that hold app section sets and exports are indexed in [app-examples](app-examples/README.md); the custom IML helper and the copied snippets stay at this level. These are **teaching sections/templates and reading material, not deployable apps**. The folders are a local example convention, not an official universal Make SDK project layout.

The 15 historical exports in [app-examples](app-examples/README.md#historical-reference-exports) are normalized and anonymized: placeholders replace account-specific values, and no raw or private app export or credentials are bundled. Their samples are preserved privacy-normalized source data: no provider-response provenance or current provider behavior is certified. Imported helper code and helper `test.json` files were not executed. The files are supplied as reference data; each README states its own setup, dependency, alias, shared-connection/webhook and validation limits, and no standalone or live provider validation is claimed.

Map each file to the section or fragment specified by its README/manifest; copied QA records are planning templates, not SDK input. Component linking is a separate editor/API step, not inferred from folder names.

| Example | Teaches | Status |
| --- | --- | --- |
| [GitHub search](app-examples/github-search/README.md) | Search inputs, output interface, one-based pagination; a typed `@makehq/sdk` script that creates a private app and reads each section back | Public-read section example; SDK script mock-tested, never run live |
| [GitHub polling](app-examples/github-polling/README.md) | Date/ID ordering and Epoch overrides | Public-read section example |
| [Dropbox OAuth2](app-examples/dropbox-oauth/README.md) | Authorization code, refresh, connection info | Credentials required |
| [GitHub dedicated webhook](app-examples/github-webhook/README.md) | Connection → attach → receive → detach → instant trigger | **Deployment blocked** until signature/security work is implemented and tested |
| [Custom IML helper](custom-iml/README.md) | Nullish-only scalar defaults, executable tests | Node unit-tested; Make runtime untested |
| [Historical reference exports](app-examples/README.md#historical-reference-exports) | 15 privacy-normalized app exports (Coda through Gong), each with its own README and topic | Reference export; see each README for dependencies/limits |

Beyond component examples, the [current-knowledge index](current-knowledge/README.md) holds topic guides and authored synthetic correct/incorrect recipe fixtures. They are checked statically by `npm run check:current-knowledge`, which validates only those fixtures against the rules the catalog declares; it is not an IML interpreter, SDK validator or proof of Make or provider behavior.

## Offline validation

From the repository root, with Node.js 22 or newer and no dependencies:

```sh
node scripts/check-custom-app-examples.mjs
node --test scripts/check-custom-app-examples.test.mjs
```

The first command parses every shipped example `.json`/`.imljson`, checks the copied-snippet manifest/file coverage, expected section dependencies and local README links, checks a deliberately small set of regression invariants (copied-snippet invariants and assertions about the authored/teaching material), and **runs the authored custom IML helper source through its Node tests**. Historical exports receive only the documented parse/link/static treatment; their helper code and `test.json` files are not executed by it. The second command tests the checker against deliberately broken temporary copies, including page `+ 1`, missing dependencies, schema drift, and falsy-value loss. Temporary copies are deleted afterward. No network requests or Make/provider writes are made.

The typed SDK script in [app-examples/github-search](app-examples/github-search/README.md) is checked separately because it needs its own pinned dependencies. From the repository root, `npm run test:sdk` copies it to a temporary directory, runs `npm ci` against its lockfile (published npm packages only), then the typecheck, the unit tests and the offline dry-run, with `MAKE_*` variables removed from the environment. It needs no Make or provider credentials and makes no Make or provider request.

The repository checker also accepts `--examples-root PATH_TO_COPIED_EXAMPLES` for a synchronized plugin copy. Default discovery is relative to the script, not the working directory. The helper test can run in any copied skill folder:

```sh
node --test path/to/make-custom-apps/examples/custom-iml/default-if-null.test.mjs
```

## Evidence boundaries

- **Static:** JSON parsing, local links/required files, known expressions and the illustrated flat input/output/sample schemas. This is not an official SDK validator or a general IML parser/interpreter.
- **Unit:** the unmodified JavaScript helper executes in a Node VM without injected Node APIs. This is not Make's sandbox.
- **SDK script:** call order, request shapes, the private flag, readback comparison and live-mode gating are tested against in-memory mocks and a faked `fetch`. This is not evidence that Make accepts the uploaded sections.
- **Historical exports:** parse/link/static reading only, as each README lists. Imported helpers and `test.json` files were not executed; this is neither standalone validation nor current-provider certification.
- **Not performed:** Make component creation/upload/readback, IML evaluation, authorization/refresh, pagination/cursor execution, provider delivery, or webhook write tests. Passing offline checks does not make the disabled webhook deployable.

For the four focused teaching examples, samples are invented **UI example values**, clearly not observed provider responses. For the 15 historical exports, samples are retained privacy-normalized reference data with no guarantee of matching a provider's behavior. Every example lists its assumptions, placeholders, sources, and remaining credential/live tests. Never replace committed placeholders with secrets.
