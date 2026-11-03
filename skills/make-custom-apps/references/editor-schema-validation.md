# Editor schema validation

Load when reviewing or adjusting component files. The schemas are in [editor-schemas](editor-schemas/README.md)
(source, commit, license and the file-to-component mapping are there).

## 1. Validate every component file

Validate each component file against its editor schema, the way the web editor does (draft-07; the files refer
to each other with cross-file `$ref`, so load them from one directory). Use the mapping in the
[README](editor-schemas/README.md). The editor shows violations as warnings, so treat each one as a finding to
read, not as proof of failure. Report how many files were validated and which had warnings.

### The schemas do not parse IML

Most expression fields are plain strings in the schemas, and the few that check for IML only require a `{{`
somewhere before a `}}`. Unbalanced parentheses therefore pass wherever an expression is allowed, and an
unclosed `{{` passes in every plain string field, such as a `url`. A clean result says nothing about
expression syntax. Check every `{{ }}` yourself, in every component and not only in module requests: RPC,
webhook and connection communication, `iterate`, `temp`, `output`, `pagination`, error `message` and
`attach`, including branches a test run rarely reaches.

- Count `(` against `)` inside each `{{ }}` after removing quoted strings and backtick-quoted property names. A
  parenthesis or brace inside them belongs to the string or the name, and GraphQL or JSON text around the
  expression has its own braces.
- Make does not report the parse error. A parenthesis missing or extra at the very end of an expression is
  usually closed silently and still returns the intended value, which is why the typo survives testing:
  `{{map(parameters.ids, 'id'}}` still returns the IDs. Inside nested calls the same typo moves an argument to
  another function without any error: `{{if(parameters.status, lower(parameters.status, 'open')}}` passes
  `'open'` to `lower`, so an empty status returns empty instead of `open`. An unclosed `{{`, as in
  `/items/{{parameters.id}/details`, is sent as literal text.
- It is still syntactically invalid IML, a class (a) defect even when the current output looks right
  ([Approval gating](review-and-qa.md#2a-approval-gating)): the recovery is not documented behavior. Fix it by
  adding the missing delimiter or deleting the extra one, and keep the rest of the expression unchanged. Where
  the intended argument list is not clear, put the delimiter where the parser closes it today, so the current
  behavior stays the same, and say so in the finding.

### Specs built at runtime are not validated

The schemas check component files only. Parameter and interface specs that a fields RPC, an interface RPC or
a custom function builds at runtime never reach the editor validation, so a clean result says nothing about
them. Read that code against `parameters.json` and the type pages yourself, with the rules in
[Dependent options, fields, and interfaces](parameters-and-rpcs.md#dependent-options-fields-and-interfaces):
valid keys, a Make `type` for every field (`text`, not `string`) and a `name` on every field. A generated
`name` is the key under which scenarios save the mapped value and that the module reads, so check its spelling
before the first release. After release, changing an RPC or a function that builds dynamic parameters is a
documented breaking change: when a misspelled name is still read consistently, keep it and correct the `label`
instead ([Preserve existing contracts](maintenance.md#4-preserve-existing-contracts)). When the misspelling
breaks the request or the mapping, it is a class (a) defect: fix it and state the compatibility impact
([Approval gating](review-and-qa.md#2a-approval-gating)).

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
