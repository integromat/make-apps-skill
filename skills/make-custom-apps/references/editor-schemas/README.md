# Make editor JSON schemas

These are the JSON schemas (draft-07) that Make's web app editor uses to validate component code. The editor
shows a violation as a warning, for example a yellow underline reading "Property followRedirect is not allowed".

- Source: https://github.com/integromat/vscode-apps-sdk, directory `syntaxes/imljson/schemas/`
- Commit: `6ff5f3dd9960ccbeb24de3beb1cca935de89eaa0`
- License: MIT-style, "Copyright (c) 2022 Celonis, Inc." The full text is in [LICENSE.md](LICENSE.md), a byte-exact
  copy of the source `LICENSE.md`.
- The 14 `*.json` schema files are unmodified, byte-exact copies. They refer to each other with relative
  `$ref` values (for example `api.json` uses `sources.json`, `response.json` and `enums.json`), so keep them in
  one directory.

## Which schema validates which component

Taken from the source package's `contributes.jsonValidation`.

| Schema file | Validates |
| --- | --- |
| `parameters.json` | parameters, `expect` (mappable parameters) and `interface` |
| `common.json` | `common` |
| `api.json` | `api` of a module, RPC or connection communication, plus `attach`, `detach` and `publish` |
| `endpoint-api.json` | `api` inside `endpoints/*` |
| `samples.json` | `samples` |
| `scopes.json` | `scopes` |
| `scope.json` | `scope` (default and required scope) |
| `epoch.json` | `epoch` |
| `base.json` | `base` |
| `api-oauth.json` | OAuth connection communication (`api-oauth`) |
| `groups.json` | `groups` |
| `enums.json`, `response.json`, `sources.json` | Shared definitions referenced from the files above |

See [editor schema validation](../editor-schema-validation.md) for how to apply them in a review.
