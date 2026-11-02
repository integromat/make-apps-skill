# Editor schema validation

Load when reviewing or adjusting component files. The schemas are in [editor-schemas](editor-schemas/README.md)
(source, commit, license and the file-to-component mapping are there).

## 1. Validate every component file

Validate each component file against its editor schema, the way the web editor does (draft-07; the files refer
to each other with cross-file `$ref`, so load them from one directory). Use the mapping in the
[README](editor-schemas/README.md). The editor shows violations as warnings, so treat each one as a finding to
read, not as proof of failure. Report how many files were validated and which had warnings.

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

## 4. Adjusted files

Re-validate every adjusted file. An adjustment must not introduce a new editor-schema warning, and the fix for
one warning must not leave another behind.
