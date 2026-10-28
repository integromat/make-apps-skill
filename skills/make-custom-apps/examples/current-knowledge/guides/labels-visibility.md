# Labels, visibility and hidden fields

Back to the [knowledge index](../README.md).

Labels and visibility are the part of a Make app that a user reads. Some problems here are cosmetic; some change what the user can do. A good review keeps them apart, so that a capitalisation nit is never blocking and a hidden required field never slips through as "just UI".

## Cosmetic: label grammar

**Documented recommendation.** Parameter labels are one to three words, sentence case, and use the third-party service's UI vocabulary. Acronyms stay capitalised (ID, URL). If the Map toggle is on by default the label should contain "ID" for ID fields; if it is off it should not. Labels should match the corresponding output labels, and interface labels are sentence case.

These are style rules. A label that says "Project Name" instead of "Project name" is a nit. It may be worth fixing before submission, but it is not an incorrect behaviour and must not be reported as one.

## Behavioural: what the label does for the user

A label can be wrong in a way that matters:

* It exposes a machine name (`project_id`, `projectId`). The user cannot tell what it means. The checker's `CK-LABEL` rule flags labels that equal the field name, contain an underscore or camel-case.
* Two fields in the same form share a label, so the user cannot tell them apart (`CK-LABEL-UNIQUE`).
* The label or description promises something the request does not do (for example "Delete permanently" on a call that archives). This one needs human review; no static rule covers it.

## Visibility: advanced fields, secrets, hidden fields

**Documented behaviour.** Parameters can be marked `advanced`, which tucks them under an "Show advanced settings" toggle, and static parameters can be mappable or not. Text parameters offer `validate.min` and `validate.max` for length and `validate.pattern` (wrapped in `^$`); the validator keys are `min`/`max`, not `maxLength` (`maxLength` is a property of the provider's JSON schema, which is a different thing).

**Inferred implementation pattern.**

* A field the provider requires and that has no default should not be hidden under advanced settings: the user will not see why the call failed. `CK-VISIBILITY` flags `advanced: true` together with `required: true`; with a default, see the exception below.
* A secret-named **connection** parameter (`apiKey`, `clientSecret`, `password`, `token`) should use `type: password` so that it is masked in the UI. **Documented behaviour:** `password` is available only in a connection; in modules and other contexts it behaves like `text` and masks nothing. So this check applies to connection parameters only. A secret-named field in a module's parameters is not made safe by `password`; do not report it as a missing mask, and do not add `password` there expecting masking. Handle such a value through the right credential mechanism and log sanitization instead.
* Hidden fields should not vanish from review. If a field is hidden for a reason (e.g. set by a connection), it should still be traceable in the module's parameters and in the catalog entry, so a reviewer can see what the request sends.

```json
{
  "connectionParameters": [
    { "name": "apiKey", "type": "password", "label": "API key", "required": true }
  ],
  "parameters": [
    { "name": "projectId", "type": "text", "label": "Project ID", "required": true },
    { "name": "note", "type": "text", "label": "Note", "advanced": true }
  ]
}
```

## Rationale

Labels are the app's only documentation at the moment of use. Hiding a required field or exposing a secret in plain text are failures the user feels immediately, so they get stronger treatment than casing. Using different words for the strengths prevents review from blocking on taste.

## Pitfalls

* Reporting "Title Case label" as a defect with the same severity as a missing required field.
* Using `maxLength` in a Make `text` parameter's `validate`; Make reads `max`/`min`.
* Marking a field advanced to "clean up the form" when it is required.
* A label like "ID" repeated for two different IDs.
* Rewording an output label so it no longer matches the input label for the same thing.
* Making a secret `text` because the connection form "looks the same".
* Expecting `type: password` to mask a field outside a connection; it behaves like `text` there.

## Exceptions and applicability

* The label-machine-name rule does not apply to fields whose provider UI itself uses that term (for example a literal "URL" or "ID" label).
* `advanced` together with `required` can be valid. Current input guidance accepts it when a default satisfies the requirement, and a project may have conventions that put expert-only required settings behind the toggle. The fixture rule in this tree treats the combination as suspicious *without* a default; if you rely on a default or a convention, say so in the review instead of reporting a defect. Do not conclude from `advanced && required` alone that the user cannot succeed.
* Similarly named flags are not interchangeable: static-parameter, mappable-parameter, connection-editability and select-validation settings each have their own documented context. Evaluate each flag where it is defined.
* The grammar rules are a recommendation for new apps and for approval; do not rewrite shipped labels in a live app only to satisfy them, since renaming can disturb users.

## Evidence and limits

* Label grammar: **documented recommendation**, cosmetic.
* `password` type for connection secrets (connection-only; `text`-like elsewhere), advanced behaviour: **documented behaviour**; hidden-required check: **inferred implementation pattern**.
* The checker looks only at declared label and flag fields in fixtures; it cannot judge whether a label is clear or a description misleads.

## Fixtures

Static, synthetic teaching fixtures. Label rules are cosmetic and a casing or spacing difference such as `ID` versus `id` is never flagged; visibility rules concern behavior.

* Correct: [correct.json](../recipes/labels-visibility/correct.json): labels are human wording and unique in the form, required fields are visible, and the connection credential field uses type `password`, and optional parameters state `required: false` explicitly.
* Incorrect, `CK-LABEL` (minor): [blank-label.json](../recipes/labels-visibility/incorrect/blank-label.json). A field has an empty label, so the user sees no wording at all.
* Incorrect, `CK-LABEL` (minor): [machine-name-label.json](../recipes/labels-visibility/incorrect/machine-name-label.json). The label exposes a machine name such as camelCase or snake_case instead of words the user knows.
* Incorrect, `CK-LABEL-UNIQUE` (minor): [duplicate-labels.json](../recipes/labels-visibility/incorrect/duplicate-labels.json). Two fields in one form share a label, so users cannot tell them apart.
* Incorrect, `CK-VISIBILITY`: [required-hidden.json](../recipes/labels-visibility/incorrect/required-hidden.json). A required field is hidden (for example advanced without a default), so the user may not find a field they must fill. `advanced` together with `required` and a default stays valid.
* Incorrect, `CK-VISIBILITY`: [secret-as-text.json](../recipes/labels-visibility/incorrect/secret-as-text.json). A secret-named connection field is `text` instead of `password`, so the credential is shown in clear.

## Sources

* https://developers.make.com/custom-apps-documentation/component-blocks/mappable-parameters
* https://developers.make.com/custom-apps-documentation/best-practices/naming-conventions/input-parameters/parameter-labels
* https://developers.make.com/custom-apps-documentation/block-elements/parameters/text
* https://developers.make.com/custom-apps-documentation/block-elements/parameters/select
* https://developers.make.com/custom-apps-documentation/component-blocks/interface
