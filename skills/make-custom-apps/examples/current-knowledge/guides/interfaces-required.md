# Interfaces, required flags and falsy values

Back to the [knowledge index](../README.md).

A module has two contracts with the user: the *input* parameters it asks for and the *interface* describing what it outputs. Both can drift from what the request actually does. This guide covers when a parameter should be `required`, how to avoid destroying legitimate `false` and `0` values, and how to keep the output interface and the `response.output` projection aligned.

## Required parameters

**Documented behaviour.** `required: true` makes Make refuse to run the module without the value. It should reflect what the *provider* needs, not what is merely convenient.

**Inferred implementation pattern.** Three practical consequences follow:

* A parameter that appears in the request **path** (`/projects/{{parameters.projectId}}`) can never be empty without producing a malformed URL, so it should be `required`. The checker's `CK-REQUIRED-FLAG` rule tests this for fixtures.
* A parameter flagged required that **nothing in the component graph reads** is a lie to the user: they must fill something in that does nothing. "Reads" covers every declared consumer, not only the module's own request: RPCs (they receive the module's parameters automatically), dynamic interface or fields RPCs, and helper arguments. A required technical parent that only an option RPC or dynamic interface consumes is legitimate; it is not a provider request-only rule, and requiredness still follows the provider's or the component's contract. Judging unused-required from the main request alone would flag these valid designs.
* A request (or RPC, or dynamic interface) that reads `parameters.x` where `x` is not declared reads something Make cannot fill in.

Do not infer "required" from a field being present in a provider's response, from its position in the form, or from a name ending in `Id`. Use the provider's documented create/update contract.

## Falsy values and empty values

**Documented recommendation.** The input-processing page recommends `"body": "{{parameters}}"` or `"{{...}}": "{{omit(parameters, 'id')}}"` and says that using `ifempty(..., undefined)` or an `if` to drop empty values is a bad practice, since `null`, empty string, `0` and empty arrays could then never be sent. On platform version 2 empty values are already ignored by default; update and universal modules show an `erase` pill so users can send an explicit empty value.

**Inferred implementation pattern.** The same loss happens with the JavaScript-style `||` fallback: `{{parameters.active || true}}` turns a user's `false` into `true`; `{{parameters.limit || 10}}` turns `0` into 10. For boolean and numeric parameters use a conditional that tests for the value's *absence*, or let the default live in the parameter spec. The checker's `CK-FALSY-LOSS` rule flags `||` applied to boolean or numeric parameters in a fixture. It does not claim that `||` is always wrong, only that it is lossy on those types.

## Interface and output must agree

**Documented behaviour.** The interface uses the same syntax as parameters; arrays use `spec`, collections use `spec: []` when the structure is unknown, dates use `type: date`, labels are sentence case, and search interfaces should drop `__IMTLENGTH__` and `__IMTINDEX__`. After changing an interface, refresh the scenario.

**Documented recommendation.** Return the raw response where you can: `output: "{{item}}"` for search, `output: "{{body}}"` for actions, deleting only unneeded fields and flattening nested outputs. Output must never carry error messages; errors belong to the error directive.

**Inferred implementation pattern.** When you *do* project fields explicitly, the interface fields and the keys of `response.output` should list the same names, and sample values should match the declared type. Otherwise users see fields that are always empty, or data that is outputted but not mappable. The checker's `CK-INTERFACE-DRIFT` rule compares names and sample types in a fixture.

```json
{
  "interface": [{ "name": "id", "type": "number", "label": "ID" }, { "name": "done", "type": "boolean", "label": "Done" }],
  "api": { "response": { "output": { "id": "{{body.id}}", "done": "{{body.done}}" } } }
}
```

## Related output and input details

* **Precision.** A provider identifier too large for a JSON number can be rounded when the response is parsed, and declaring the interface field as `text` afterwards cannot restore digits. If the provider cannot send such identifiers as strings, use the documented response-parsing option before precision is lost ([outputs-empty-values-updates](outputs-empty-values-updates.md)).
* **Fallbacks.** The IML `ifempty` function falls back for undefined, null and empty string, and keeps `0` and `false`. It is not the same operation as `||`; judge a value-loss claim by the expression's real semantics ([iml-and-helpers](iml-and-helpers.md)).
* **Mappability.** A field missing from the interface is not necessarily unmappable, and an interface type does not convert the runtime value. Check what is emitted before deciding that the interface is wrong.
* **Required and advanced.** Whether a field should be `required` follows the provider's contract. A required field may legitimately be `advanced` when it has a default; see [labels-visibility](labels-visibility.md).

## Rationale

The form and the request are written at different times by different people (or by the same person on different days). Required flags, empty-value handling and the interface are three places where the two drift apart, and none of them fails loudly: the user just gets a wrong call or a missing field.

## Pitfalls

* Reporting a required input as unused because the main request ignores it while an RPC or dynamic interface reads it.
* Marking everything required to be "safe". Users then must invent values and a provider may reject placeholder text.
* Path parameter optional: the URL ends with `/projects/` and the provider replies with a list or a 404.
* `parameters.enabled || true`: unchecking the box has no effect.
* Using `ifempty(parameters.x, undefined)` to hide empty values, then wondering why nobody can clear the field.
* Output keys renamed in the projection but the interface still lists the old names.
* Declaring an interface numeric when the provider returns an ID string, which breaks mapping downstream.

## Exceptions and applicability

* Required-ness depends on the provider; a path parameter is the only case that follows from the URL itself.
* `||` on text parameters is not covered by the falsy rule (empty string as "use default" can be intended).
* Modules that return the raw response need no projection comparison.

## Evidence and limits

* Empty-value handling, `required`, interface syntax: **documented behaviour / recommendation** as above.
* Path-parameter requiredness, unused-required, drift and `||` loss: **inferred implementation pattern**, static text checks of declared fixtures only. The checker does not execute IML, so it cannot know a runtime value, and it does not model the whole expression language.

## Fixtures

Static, synthetic teaching fixtures; they declare inputs, a flat response projection and an interface, and the checker compares those declarations as text.

* Correct: [correct.json](../recipes/interface-required-flags/correct.json): the path parameter is required, every required input is used by some declared consumer (the path parameter by the main request, a required technical parent `workspaceId` only by an RPC), an optional boolean keeps `false` by checking for absence, and the interface lists the same fields the projection emits.
* Incorrect, `CK-REQUIRED-FLAG`: [path-parameter-optional.json](../recipes/interface-required-flags/incorrect/path-parameter-optional.json). A parameter that fills a URL path segment is not required, so an empty value yields a malformed URL.
* Incorrect, `CK-REQUIRED-FLAG`: [required-but-unused.json](../recipes/interface-required-flags/incorrect/required-but-unused.json). A required input is read by no declared consumer (request, RPC, dynamic interface or helper argument), so users must fill a field that does nothing.
* Incorrect, `CK-FALSY-LOSS`: [falsy-fallback.json](../recipes/interface-required-flags/incorrect/falsy-fallback.json). An optional boolean or number uses a `||`-style fallback, so a deliberate `false` or `0` is replaced by the default. The rule targets booleans and numbers only; a text fallback where empty means unset is not flagged.
* Incorrect, `CK-INTERFACE-DRIFT`: [interface-drift.json](../recipes/interface-required-flags/incorrect/interface-drift.json). The interface names fields that differ from what the response projection emits, so downstream mapping shows the wrong fields.

## Sources

* https://developers.make.com/custom-apps-documentation/component-blocks/mappable-parameters
* https://developers.make.com/custom-apps-documentation/component-blocks/interface
* https://developers.make.com/custom-apps-documentation/best-practices/input-parameters/processing-of-input-parameters
* https://developers.make.com/custom-apps-documentation/best-practices/output-parameters/processing-of-output-parameters
* https://developers.make.com/custom-apps-documentation/other/processing-of-empty-values
* https://developers.make.com/custom-apps-documentation/block-elements/parameters/text
