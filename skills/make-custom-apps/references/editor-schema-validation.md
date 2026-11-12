# Editor schema validation

Load when reviewing or adjusting component files. The schemas are in [editor-schemas](editor-schemas/README.md)
(source, commit, license and the file-to-component mapping are there).

## 1. Validate every component file

Validate each component file against its editor schema, the way the web editor does (draft-07; the files refer
to each other with cross-file `$ref`, so load them from one directory). Use the mapping in the
[README](editor-schemas/README.md). The editor shows violations as warnings, so treat each one as a finding to
read, not as proof of failure. Report how many files were validated and which had warnings.

Run the bundled script instead of writing a validator: `node references/editor-schemas/validate.mjs <app-dir>`
(add `--json` for a machine-readable report). It needs Node.js 18+ and Ajv 8, which is not shipped with the
skill: in a scratch directory run `npm install --no-save ajv@8` and start the script from there. It reads files
only and makes no network request. If you validate another way, use the same settings, because the schemas do
not load with Ajv's defaults: `strict: false`, `unicodeRegExp: false`, and every schema registered under its
file name so that the cross-file `$ref` values resolve.

The script maps files to schemas as the [README](editor-schemas/README.md) lists them. A connection `api` is
checked against `api-oauth.json` when it holds OAuth steps (`authorize`, `token` and similar) and against
`api.json` otherwise. Some sections have no editor schema: the receiver `api` and `update` of a webhook,
`install`, `installSpec` and the app metadata. The script lists them as not validated. Report them the same
way: read them by hand, and do not count them as passed.

## 2. Read the warnings

An unknown key (`additionalProperties`) or an invalid enum value usually means the runtime ignores or misreads
the value. When the cited key or value is wrong, that is a class (a) defect: fix it with the documented key or
value, keeping the rest of the file unchanged (see [Approval gating](review-and-qa.md#2a-approval-gating)).

- Example: `followRedirect` and `followAllRedirect` are not allowed. The runtime reads only `followRedirects`
  and `followAllRedirects` (default `true`), so `followRedirect: false` is silently ignored and redirects are
  still followed.
- Other typical cases: a misspelled `message` in error handling, a parameter type that is not a Make type
  (for example `datetime` instead of `date`), and an error type outside the allowed list.

## 3. What is not a defect

- An IML expression string where the schema expects an object or an array. This is a schema limitation.
- A null or absent section.
- A key that the current Make documentation shows as valid but the schema does not know yet. Record an
  advisory note naming the documentation page; do not rewrite the key.
- `timeout` on a module, RPC or webhook request, or `timeout` written as an IML expression. The schemas list
  the key for Base only and as an integer, so `"timeout": 300000` in a module request and the documented
  `"timeout": "{{common.timeout}}"` both produce a warning. The runtime reads `timeout` from the request it
  sends, wherever the request is defined, so a value on one request applies to that request and overrides the
  Base value. Do not move it to Base: that would lengthen the limit of every call the app makes. Check only
  that the value is in milliseconds and no higher than 300000
  ([Base](https://developers.make.com/custom-apps-documentation/app-components/base)).

## 4. Adjusted files

Re-validate every adjusted file. An adjustment must not introduce a new editor-schema warning, and the fix for
one warning must not leave another behind.
