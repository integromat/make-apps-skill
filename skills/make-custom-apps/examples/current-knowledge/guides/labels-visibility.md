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
* A secret-named **connection** parameter (`apiKey`, `clientSecret`, `password`, `token`) should use `type: password` so that it is masked in the UI. **Documented behaviour:** `password` is available only in a connection; in modules and other contexts it behaves like `text` and masks nothing. So this check applies to connection parameters only. A user-entered secret in a non-`password` connection or install parameter is a class (b) security defect (reject) under [Approval gating](../../../references/review-and-qa.md#2a-approval-gating).
* Separately, a secret-named field in a module's parameters is not made safe by `password`; do not report it as a missing mask, and do not add `password` there expecting masking. Handle such a value through the right credential mechanism and log sanitization instead.
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

## Form layout and array labels (UX guidance)

Make's best-practice pages for [mappable parameters](https://developers.make.com/custom-apps-documentation/best-practices/input-parameters/mappable-parameters) and [parameter hints](https://developers.make.com/custom-apps-documentation/best-practices/naming-conventions/input-parameters/parameter-hints) describe how a form should read. This is **documented UX guidance**. It is not a runtime schema rule, and a form that departs from it still runs. Report a layout or wording departure as a recommendation, never as a blocker and never as grounds to reject an app. A separate, demonstrated behavioral defect (for example a type that loses the value, or a required flag that blocks a valid state) is judged on its own evidence and is not downgraded by this advice.

**Order.** List required parameters first, then conditionally required ones, then optional ones. A logical block overrides that order: fields that belong together, such as a start and an end, or the parts of one address, stay adjacent even when their required status differs. Put `advanced` parameters at the bottom. In a search or list module the `Limit` parameter comes last.

**Conditionally required fields.** Do not mark a field `required: true` unconditionally, in every state, when the provider requires it only in some situations: the flag on a top-level field cannot express the condition, so the form would demand a value the provider does not need. Where the form structure supports it, put the field where it is only active for that case, such as nested fields in a selected branch or fields supplied by a condition-aware RPC. `required: true` on such a field is legitimate, because it applies only while that branch is active; keep it. Where no such structure exists, leave the flag off and say it in the help text, for example "Required when Type is Custom." Use only structure the documented parameter types support, and do not invent conditional syntax. Without clear help the user learns about the condition only from a failed run. Hints state the expected input, the outcome, an example, what an empty value does and where to read more; do not pad a hint with a restatement of the label.

**Arrays and collections.** Three pieces of wording appear in an array form and each names a different thing:

| Piece | Names | Example |
| --- | --- | --- |
| Array `label` | the whole list | `Attendees` |
| Item `spec.label` | one entry of the list | `Attendee` |
| `labels.add` | the add button; replaces the default "Add item" | `Add attendee` |

Keep the three coherent: a plural list label, a singular item label, and an add button that uses the singular. A list labeled `Attendees` whose button says `Add attendees` or whose items say `Item 1` reads as three unrelated labels. The valid form for an array of collections that carries an item label is a collection `spec` object with its own `label` and a `spec` array of the fields:

```json
{
  "name": "attendees",
  "type": "array",
  "label": "Attendees",
  "labels": { "add": "Add attendee" },
  "spec": {
    "type": "collection",
    "label": "Attendee",
    "spec": [
      { "name": "email", "type": "text", "label": "Email", "required": true },
      { "name": "name", "type": "text", "label": "Name" }
    ]
  }
}
```

The [Array page](https://developers.make.com/custom-apps-documentation/block-elements/parameters/array) documents both an object `spec` (a primitive such as `{"type": "text"}`, or a collection as above) and a `spec` that is an array of field definitions. The documented array-of-fields form carries no item `label` of its own; use the object form when an item label is wanted. Keep whichever valid form the app already uses, and match the nesting of the payload that the module sends. `labels.add` is wording only; it changes neither validation nor the request.

## Module distribution visibility (not `parameter.hidden`)

Three different things share the word "hidden". Do not infer one from another:

* **Module visibility** (`public` on a module; the SDK Modules API has a separate set-visibility operation, `public` or `private`) decides whether the module appears in the chooser for new use.
* **App/module approval** (`approved`, and `archived`) is a separate flag. An unapproved app does not imply hidden modules, and visible modules do not imply approval.
* **Parameter `hidden`** is a field-level setting inside a module form and is unrelated to either.

**Documented behaviour.** Test your app: newly created modules are hidden by default, which is the normal draft state. Request review (step 3): set the modules you intend to publish visible. App visibility: hidden modules still run in existing scenarios but are not offered when adding new modules, so an existing scenario running does not show distribution readiness.

**Review treatment (inferred, target-specific).** Raise a required readiness finding or owner decision (a class (d) request-scope finding under [Approval gating](../../../references/review-and-qa.md#2a-approval-gating)) only when all hold: the stated target is marketplace or new-user availability; the module inventory is complete, nonempty and unambiguous; and every module's visibility is literally `false`. This is class (d); the reviewer cannot safely fix it (the owner chooses visible modules), so reject and name the decision needed. Never expose all modules or publish automatically. When a requested fix makes an intended module visible, judge the resulting graph, not the baseline hidden flags.

Do not infer an all-hidden blocker for a private or draft target, no stated target, unknown, missing or truncated flags (a partial create or read projection is not explicit `false`), a partial module list, app-level `public: false`, or approval flags. One hidden legacy module beside an intended visible one is not an all-hidden case.

| Synthetic case | Treatment |
| --- | --- |
| Private draft app, two modules, both hidden, code review only | Probably intentional; no blocker |
| Marketplace target, complete 3-module inventory, all three `public: false` | Class (d); reject, naming the owner decision needed (not safely fixable by the reviewer) |
| Same target, 2 modules: one intended visible, one hidden legacy | No all-hidden rule; assess the intended published scope |
| App unapproved, intended modules visible | Do not infer hidden or unusable modules |
| Flags missing, truncated or contradictory | Ask for evidence; no all-hidden claim |

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

* The ordering, hint and array-wording guidance is UX advice drawn from Make's best-practice pages. A logical block of related fields, a provider whose own form uses another order, or an existing app whose users rely on its layout are all reasons to leave it. Do not reorder or relabel a live app only to satisfy it, and never treat a departure as a blocker.
* The label-machine-name rule does not apply to fields whose provider UI itself uses that term (for example a literal "URL" or "ID" label).
* `advanced` together with `required` can be valid. Current input guidance accepts it when a default satisfies the requirement, and a project may have conventions that put expert-only required settings behind the toggle. The fixture rule in this tree treats the combination as suspicious *without* a default; if you rely on a default or a convention, say so in the review instead of reporting a defect. Do not conclude from `advanced && required` alone that the user cannot succeed.
* Similarly named flags are not interchangeable: static-parameter, mappable-parameter, connection-editability and select-validation settings each have their own documented context. Evaluate each flag where it is defined.
* The grammar rules are a recommendation for new apps and for approval; do not rewrite shipped labels in a live app only to satisfy them, since renaming can disturb users.

## Evidence and limits

* Label grammar: **documented recommendation**, cosmetic.
* `password` type for connection secrets (connection-only; `text`-like elsewhere), advanced behaviour: **documented behaviour**; hidden-required check: **inferred implementation pattern**.
* Ordering, conditional-required help, hints and array wording: **documented UX guidance** (best-practice pages), advisory only. Nested `required: true` inside a branch that is active only for its case is legitimate; no conditional syntax is claimed beyond the documented parameter types. No fixture or checker rule encodes it; the guidance rests on documentation, not on how often apps follow it.
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
* https://developers.make.com/custom-apps-documentation/block-elements/parameters/password (connection-only masking claim)
* https://developers.make.com/custom-apps-documentation/block-elements/parameters/select
* https://developers.make.com/custom-apps-documentation/block-elements/parameters/array (spec forms, `labels.add`)
* https://developers.make.com/custom-apps-documentation/best-practices/input-parameters/mappable-parameters (ordering, advanced, Limit, array labels)
* https://developers.make.com/custom-apps-documentation/best-practices/naming-conventions/input-parameters/parameter-hints
* https://developers.make.com/custom-apps-documentation/component-blocks/interface
* https://developers.make.com/api-documentation/api-reference/sdk-apps/modules
* https://developers.make.com/custom-apps-documentation/create-your-first-app/test-your-app
* https://developers.make.com/custom-apps-documentation/app-review/request-app-review
* https://developers.make.com/custom-apps-documentation/create-your-first-app/app-visibility
