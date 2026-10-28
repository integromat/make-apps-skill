# Dates, polling order and helper tracing

Back to the [knowledge index](../README.md).

Dates are a place where polling triggers and search modules can go quietly wrong. A trigger that sorts or compares dates it never parsed can skip records or emit them twice, and nothing in the scenario log will say so. This guide shows what Make does with dates for you, what you must do yourself, and how to check a custom helper by following the data rather than by noticing that a helper exists.

## What the platform does

**Documented requirement.** Make hands date parameters to your request as ISO 8601 text, `YYYY-MM-DDThh:mm:ss.sssZ`. Even `time: false` yields midnight in the user's timezone converted to UTC. If the provider wants another shape, format it in the communication, for example `{{formatDate(parameters.createdAt, 'X')}}`.

**Documented requirement.** Output date-times should be parsed so that the user gets a real date, for example `{{parseDate(item.createdAt, 'X')}}`. The public output-processing page lists the exceptions: values that are only a time, only a date, or a date and time without a timezone (unless the provider documents UTC or another fixed zone), and numeric timestamps (parse only if the provider clearly documents the field as one; never assume a long number is a timestamp). The page also says: do not substitute the Make user's or organisation's timezone for a zone the provider has not documented.

**Documented recommendation.** For date-only values, keep the provider's format and declare the interface field as `type: text`. Return the raw response (`output: "{{item}}"`, `output: "{{body}}"`) and remove only what you must; do not rename or reshape fields without reason.

## Polling trigger order

**Documented recommendation.** Polling triggers should ask the provider for newest first and declare `response.trigger.order: "desc"`. Make keeps at most 3200 past records, so with ascending order the newest records can fall outside the window. `response.trigger` needs `type` (`id` or `date`), `order` (`asc`, `desc` or `unordered`), `id` always, and `date` when the type is `date`.

**Inferred implementation pattern.** The declared `order` must describe the order the provider was actually asked for. If `qs.direction` is `asc` and the trigger says `desc`, Make's cut-off logic works from a wrong assumption. The checker's `CK-DATE-ORDER` rule tests exactly this declared-pair consistency and nothing more. Use `unordered` when the provider offers no ordering.

## A date type needs a parse

When `trigger.type` is `date`, the expression in `trigger.date` should produce a date Make can compare. If the provider field is already ISO 8601 with an offset or `Z`, Make understands it and wrapping is unnecessary. If it is another format (a custom string, epoch seconds documented as such), wrap it with `parseDate` or a helper that really converts it. The checker's `CK-DATE-PARSE` rule encodes this using a `providerFields` declaration in the fixture: a field declared with a non-auto-parsed format must pass through a parse call.

```json
{
  "response": {
    "trigger": { "type": "date", "order": "desc", "id": "{{item.id}}", "date": "{{parseDate(item.updated, 'X')}}" }
  }
}
```

## Tracing helpers instead of counting them

A helper is only useful if the field travels through it and it changes the value. Follow three links in the chain:

1. The call site passes a *provider field* (`item.updated`), not a literal or an unrelated variable.
2. The helper is defined in a declared dependency file and returns something computed from its argument.
3. The helper is not the identity function (`return value;` converts nothing).

The recipe's `functions/normalizeDate.js` is the teaching helper. The checker's `CK-HELPER-TRACE` rule performs a textual version of those three steps and rejects an undefined helper, a helper that ignores its argument, an identity helper and a call that is not given a provider field. "Given a provider field" means a real `item.FIELD` reference outside quoted literals in some argument: `normalizeDate('item.updated_at')` passes a constant string, not the field, while `normalizeDate(item.updated_at, 'YYYY-MM-DD')` passes the field plus a format literal. This is lexical provenance only; it does not execute the helper or show the conversion is correct.

## Choosing the temporal meaning first

Before choosing a function, name what the value is: a calendar date, a time of day, a timezone-aware date-time, a date-time with no zone, a duration, or a numeric timestamp. Each has its own contract.

* **Input side.** A typed date input plus formatting in communication suits date-times. The input guidance also allows a text field with a clear format hint for date-only or time-only values. A date picker without a time control still produces a representation with timezone behaviour (midnight in the user's zone converted to UTC), so pick the contract on purpose instead of applying date-time conversion to every calendar value.
* **Output side.** Parse only when the meaning and zone are established. An interface `date` field must agree with the value the output really emits; declaring a type does not convert the runtime value.
* **Numerics.** A long number is a timestamp only when its field name, the provider documentation or its metadata says so, and the unit (seconds or milliseconds) is stated. Never decide that from the digit count alone, and never decide a field is an identifier from its type name or magnitude either.
* **Existing scenarios.** Changing a string output into a date changes what downstream mappings receive. For a shipped module, add a compatible alternative or follow the breaking-change guidance in [compatibility-evidence](compatibility-evidence.md) instead of silently changing the type.

Polling state (what Make remembers between runs, what the epoch controls) is covered in [pagination-and-trigger-state](pagination-and-trigger-state.md); the language rules for `parseDate`, array indexing and fallbacks are in [iml-and-helpers](iml-and-helpers.md).

## Rationale

Make compares and sorts dates internally. A string like `03/04/2026 10:00` is ambiguous (March or April?), so Make cannot guess; only you know the provider's format. Parsing is therefore the app author's contract with the user, and the documentation lists the exceptions where parsing would invent information (for example attaching a timezone the provider never promised).

## Pitfalls

* Treating every long number as a timestamp. Only parse numerics the provider documents as dates.
* Converting a date-only value to a datetime. That adds a midnight and a timezone nobody stated; keep it text.
* Adding hours to "fix" the user's timezone for a no-timezone value. The documentation forbids using the user's or organisation's zone; the zone belongs to the provider's contract.
* Declaring `order: "asc"` because the provider's default happens to be ascending, then hitting the 3200-record window on a busy account.
* Writing a helper named `normalizeDate` that only returns its input. The name proves nothing.
* Claiming a conversion where the provider's documentation gives no format. Without a contract there is nothing to convert to; say so and keep the raw text.

## Exceptions and applicability

* Applies to output fields that are date-times, polling triggers with `type: date`, and search/list ordering.
* Does not apply to time-only values, date-only values, no-timezone values without a documented zone, and numerics not documented as dates (strength stays recommendation; no parse required).
* Does not apply to `type: id` triggers for the parse rule, but the order rule still applies.
* Epoch triggers: the epoch RPC `response.output` should carry only `label` and `date`.

## Evidence and limits

* Parsing, `time: false` behaviour and the exception list: **documented requirement** (public pages below).
* Descending order and the 3200-record reason: **documented recommendation**.
* Order-pair consistency, helper tracing: **inferred implementation pattern** implemented as static text inspection in the checker. It does not execute a helper, prove a conversion is *correct*, or model timezones.
* Whether a particular provider's format is ISO is a provider fact the fixture declares by hand; the checker cannot discover it.

## Fixtures

Static, synthetic teaching fixtures; a pass shows internal consistency with the declared rule only.

* Correct: [correct.json](../recipes/dates-helper-trace/correct.json): `trigger.order` equals the requested `qs.direction`, the non-ISO provider field goes through a parse call or a traced helper, and the helper transforms its argument.
* Helper dependency (works): [normalizeDate.js](../recipes/dates-helper-trace/functions/normalizeDate.js): a defined helper that returns something computed from its argument.
* Helper dependency (identity, used by the negative below): [passthroughDate.js](../recipes/dates-helper-trace/functions/passthroughDate.js): defined and reachable, but returns its input unchanged, so the name proves nothing.
* Incorrect, `CK-DATE-ORDER`: [order-contradicts-sort.json](../recipes/dates-helper-trace/incorrect/order-contradicts-sort.json). The declared `order` disagrees with the direction the provider is asked for, so Make's cut-off logic starts from a wrong assumption. Declaring `unordered` when the sort is unknown is the honest fix, not a guess.
* Incorrect, `CK-DATE-PARSE`: [date-not-parsed.json](../recipes/dates-helper-trace/incorrect/date-not-parsed.json). A `type: date` trigger uses a field whose declared provider format Make does not auto-parse, with no parse call or traced helper around it. This is not a claim that date-only, time-only or zone-less values must be parsed; the exceptions above stay in force.
* Incorrect, `CK-HELPER-TRACE`: [helper-undefined.json](../recipes/dates-helper-trace/incorrect/helper-undefined.json). The call names a helper that is neither a listed built-in nor defined in a declared dependency file, so the call cannot be traced.
* Incorrect, `CK-HELPER-TRACE`: [helper-passthrough.json](../recipes/dates-helper-trace/incorrect/helper-passthrough.json). The helper exists but is the identity function, so the field is never converted even though a helper "was used".

## Sources

* https://developers.make.com/custom-apps-documentation/block-elements/parameters/date
* https://developers.make.com/custom-apps-documentation/block-elements/parameters/time
* https://developers.make.com/custom-apps-documentation/best-practices/output-parameters/processing-of-output-parameters
* https://developers.make.com/custom-apps-documentation/best-practices/input-parameters/processing-of-input-parameters
* https://developers.make.com/custom-apps-documentation/app-components/modules/trigger
* https://developers.make.com/custom-apps-documentation/component-blocks/epoch
* https://developers.make.com/custom-apps-documentation/block-elements/iml (the `parseDate` and `formatDate` functions used above)
