# App examples

Two kinds of material live here, and they carry different evidence:

- **Four focused teaching examples** (below): small section sets written for this library. They are **teaching sections, not deployable apps**; the folder layout is a local convention, not an official Make SDK project layout. Map each file to the section its README names, and treat component linking as a separate editor or API step.
- **Fifteen privacy-normalized historical reference exports** (further below): whole-app exports of earlier Make custom apps, kept as reading material. They are supplied as reference data, with per-app setup, dependency, alias and validation limits in each README; no standalone or live provider validation is claimed.

Back to the [examples index](../README.md). Topic guidance lives in the [current-knowledge index](../current-knowledge/README.md); the [copied snippets](../copied-snippets/README.md) and the [custom IML helper](../custom-iml/README.md) stay beside this folder.

## Focused teaching examples

| Example | Teaches | Status |
| --- | --- | --- |
| [GitHub search](github-search/README.md) | Search inputs, output interface, one-based pagination; plus a typed `@makehq/sdk` script that creates a private app and reads each section back | Public-read section example. The SDK script is tested against mocks only and has not been run live |
| [GitHub polling](github-polling/README.md) | Date/ID ordering and Epoch overrides | Public-read section example |
| [Dropbox OAuth2](dropbox-oauth/README.md) | Authorization code, refresh, connection info | Credentials required |
| [GitHub dedicated webhook](github-webhook/README.md) | Connection, attach, receive, detach and instant trigger | **Deployment blocked** until signature/security work is implemented and tested |

Each entry carries its own assumptions, placeholders, sources and untested live steps in its README.

## Historical reference exports

Observed patterns in earlier Make apps, retained for source reading. The topic is what the README's learning section points at; it is not a recommendation that a copied implementation is correct today. Read each README first for version, dependency and limit notes.

| Reference export | Source-reading topic | Status |
| --- | --- | --- |
| [Coda](coda/README.md) | Dynamic column mapping, cursor pagination | Reference export; see README for dependencies/limits |
| [Harvest](harvest/README.md) | OAuth refresh, time-entry pagination | Reference export; see README for dependencies/limits |
| [Netlify](netlify/README.md) | Hook lifecycle, site selectors | Reference export; see README for dependencies/limits |
| [Ghost](ghost/README.md) | JWT authentication, read-before-update | Reference export; see README for dependencies/limits |
| [Grist](grist/README.md) | Bulk record mapping | Reference export; see README for dependencies/limits |
| [Clockify](clockify/README.md) | Cascading workspace/project/task selectors, read-before-update | Reference export; see README for dependencies/limits |
| [Amazon Lambda](amazon-lambda/README.md) | Native AWS request signing, Marker pagination | Reference export; see README for dependencies/limits |
| [Airtable](airtable/README.md) | PKCE, schema-driven fields | Reference export; see README for dependencies/limits |
| [Stripe](stripe/README.md) | API-key Basic auth, form encoding, cursor pagination | Reference export; see README for dependencies/limits |
| [lemlist](lemlist/README.md) | RPC selectors, Basic auth | Reference export; see README for dependencies/limits |
| [Slack](slack/README.md) | User/bot OAuth, response-level errors | Reference export; see README for dependencies/limits |
| [Asana](asana/README.md) | Dynamic custom fields, webhook handshake | Reference export; see README for dependencies/limits |
| [Mailchimp](mailchimp/README.md) | Per-account API host, merge-field mapping | Reference export; see README for dependencies/limits |
| [Trello](trello/README.md) | Board/list/card/checklist operations | Reference export; see README for dependencies/limits |
| [Gong](gong/README.md) | Alternate OAuth/Basic connections, cursor pagination | Reference export; see README for dependencies/limits |

How to read them:

- **Privacy-normalized, not raw.** Account-specific values were replaced by non-operational placeholders (for example `REDACTED` and example hosts). No credentials are included; never replace placeholders with secrets.
- **Retained reference data.** Samples are preserved privacy-normalized source data; no provider-response provenance or current provider behavior is certified. The source code is evidence of historical structure, not proof of current provider behavior. Imported helper code and `test.json` files were not executed.
- **Dependencies and aliases.** Some exports reference shared or alternate connection, webhook or alias definitions that were not part of the export (the Slack event hook is one example). Where a README says closure is incomplete, copying the folder alone does not give a working app.
- **Component linking** (importing, binding connections and hooks) remains a separate editor or API step.

## Evidence boundaries

Offline checks (`npm run check:examples`) parse JSON, check required files and local links, and apply a small set of regression invariants for the copied snippets and the authored/teaching material. Historical exports receive only the documented parse/link/static treatment, and their helper code and `test.json` files are not executed. The checks do not evaluate IML, call a provider or create anything in Make. Each historical export's README lists the static reading it did or did not perform; none of them is standalone validation, current-provider certification or a deployability claim.

For the four focused teaching examples only, samples are invented UI example values, never observed provider responses. Never replace committed placeholders with secrets.
