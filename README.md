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

One canonical skill folder contains a short workflow, 12 topic references and the inherited example/helper library. The entry states when to load each reference; agents should open the relevant material, not the whole library.

- [References](skills/make-custom-apps/references/): SDK semantics, component design, QA, maintenance and controlled release.
- [Example index](skills/make-custom-apps/examples/README.md): 71 indexed snippets and focused component examples with dependencies and limitations.
- App Endpoint **authoring** belongs here. Scenario building and execution of existing Endpoints remain in [make-skills](https://github.com/integromat/make-skills).

The examples are teaching components, not certified deployable provider apps. In particular, the webhook example retains its explicit security/deployment restriction. Static validation, definition upload/readback, provider execution and publication are separate evidence gates.

## Verify and package

Repository checks require Node.js 22+ and Python 3.11+. No dependency installation or Make/provider credentials are needed.

```sh
npm run check
npm test
npm run build
npm run check-build
```

The inherited `npm run check:custom-apps` command remains available. Checks exercise the actual helper tests, example regressions, standalone links and deterministic packaging. They do not execute Make apps or provider operations.

`npm run build` creates `dist/make-custom-apps.zip`, containing the complete skill plus MIT attribution. CI builds the same archive and attaches it to the workflow run; generated ZIPs are not committed. `npm run check-build` verifies that a local archive matches the current source exactly.

## Source and contribution

This repository carries the app-authoring work from [make-skills PR #70](https://github.com/integromat/make-skills/pull/70), pinned at `3dcad8e96a6e040e7eeaf344c16efec25685b5e8`. The initial import preserves all 122 skill files and both checker sources byte-for-byte. The immutable [baseline manifest](provenance/pr70-baseline.json) records that source; [adaptations](provenance/adaptations.json) identify the hash-pinned standalone portability changes.

Edit `skills/make-custom-apps/` directly; there are no generated platform mirrors. Keep the entry concise, retain source-grounded guidance, preserve evidence limitations and run the checks above. The provenance files record this migration, not a permanent checksum lock on subsequent improvements.

[MIT License](LICENSE) · Copyright 2026 Make.
