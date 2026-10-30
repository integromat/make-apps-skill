# Make Custom Apps Skill

Build, extend, review and test Make custom (SDK) apps from real provider API contracts. The skill covers connections, modules, RPCs, webhooks, app IML functions, Endpoint definitions and maintenance.

Start with [SKILL.md](skills/make-custom-apps/SKILL.md). It defaults to typed scripts using the Make TypeScript SDK (`@makehq/sdk` → `make.sdk`) to manage app components and upload IML/JSON section source, and it preserves explicitly selected MCP `custom_app_*`, CLI, Apps Editor and VS Code workflows. Installing the skill does not install tools, grant permissions or publish apps.

## Install

Use the [Skills CLI](https://github.com/vercel-labs/skills):

```sh
npx skills add integromat/make-apps-skill --skill make-custom-apps
```

To install from a local checkout, including a PR branch:

```sh
npx skills add . --skill make-custom-apps
```

Alternatively, copy the complete `skills/make-custom-apps/` directory into the agent's skills directory. Keep its references and examples together. The default repository installation follows `main`; use the local-checkout option when reviewing unmerged changes.

## What loads

One canonical skill folder contains a short workflow, topic references and the inherited example/helper library. The entry states when to load each reference; agents should open the relevant material, not the whole library.

- [References](skills/make-custom-apps/references/): SDK semantics, component design, QA, maintenance and controlled release.
- [Current knowledge](skills/make-custom-apps/examples/current-knowledge/README.md): topic guides with sources, applicability and exceptions, plus synthetic correct/incorrect fixtures. Its checker is static and fixture-only.
- [App examples](skills/make-custom-apps/examples/app-examples/README.md): four focused section sets (search, polling, OAuth2, webhook), including a typed `@makehq/sdk` script that creates a private app and reads each section back, plus 15 privacy-normalized historical app exports kept as reading material with per-app dependency and limit notes.
- [Example index](skills/make-custom-apps/examples/README.md): 71 indexed snippets, the custom IML helper and the layout of the example folders, with dependencies and limitations.
- App Endpoint **authoring** belongs here. Scenario building and execution of existing Endpoints remain in [make-skills](https://github.com/integromat/make-skills).

The examples are teaching components and reading material, not certified deployable provider apps. The historical exports are observed patterns from earlier apps, not current-provider certification; their imported helper code and tests were not executed, and their samples are retained privacy-normalized data. In particular, the focused webhook example retains its explicit security/deployment restriction. Static validation, definition upload/readback, provider execution and publication are separate evidence gates.

## Verify and package

Repository checks require Node.js 22+ and Python 3.11+. `npm test` and `npm run check` need no dependency installation or Make/provider credentials.

```sh
npm run check
npm test
npm run test:sdk
npm run build
npm run check-build
```

`npm run test:sdk` is separate because it installs the pinned, published npm dependencies of the [GitHub search SDK script](skills/make-custom-apps/examples/app-examples/github-search/README.md) (`@makehq/sdk` 1.8.1, TypeScript 7.0.2, from its lockfile) into a temporary copy, then typechecks it, runs its tests and runs its credential-free dry-run. It strips `MAKE_*` variables and sends no request to Make or a provider; the script's `--live` mode is never used by any check. CI runs it after `npm test`.

The inherited `npm run check:custom-apps` command remains available. Checks exercise the actual helper tests, example regressions, standalone links and deterministic packaging. They do not execute Make apps or provider operations.

`npm run build` creates `dist/make-custom-apps.zip`, containing the complete skill plus MIT attribution. CI builds the same archive and attaches it to the workflow run; generated ZIPs are not committed. `npm run check-build` verifies that a local archive matches the current source exactly.

## Contributing

Edit `skills/make-custom-apps/` directly; there are no generated platform mirrors. Keep the entry concise, retain source-grounded guidance, preserve evidence limitations and run the checks above.

[MIT License](LICENSE) · Copyright 2026 Make.
