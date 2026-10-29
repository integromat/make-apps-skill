# App examples

Section sets for custom-app components, grouped by what they teach. They are **teaching sections, not deployable apps**; the folder layout is a local convention, not an official Make SDK project layout. Map each file to the section its README names, and treat component linking as a separate editor or API step.

Back to the [examples index](../README.md). Topic guidance lives in the [current-knowledge index](../current-knowledge/README.md); the [copied snippets](../copied-snippets/README.md) and the [custom IML helper](../custom-iml/README.md) stay beside this folder.

| Example | Teaches | Status |
| --- | --- | --- |
| [GitHub search](github-search/README.md) | Search inputs, output interface, one-based pagination; plus a typed `@makehq/sdk` script that creates a private app and reads each section back | Public-read section example. The SDK script is tested against mocks only and has not been run live |
| [GitHub polling](github-polling/README.md) | Date/ID ordering and Epoch overrides | Public-read section example |
| [Dropbox OAuth2](dropbox-oauth/README.md) | Authorization code, refresh, connection info | Credentials required |
| [GitHub dedicated webhook](github-webhook/README.md) | Connection, attach, receive, detach and instant trigger | **Deployment blocked** until signature/security work is implemented and tested |

More curated examples will be added to this table as they land. Each entry must carry its own assumptions, placeholders, sources and untested live steps in its README.

## Evidence boundaries

Offline checks (`npm run check:examples`) parse JSON, check required files, local links and a small set of regression invariants. They do not evaluate IML, call a provider or create anything in Make. Samples are invented UI example values, never observed provider responses. Never replace committed placeholders with secrets.
