# Compatibility, claims and evidence gates

Back to the [knowledge index](../README.md).

Every statement about a Make app is a claim, and claims have different kinds of backing. This guide explains how to record what you know, how you know it, and which checks you actually ran, so that a review can distinguish a proven fact from a plausible guess without inventing failures.

## Claims carry their source

Each claim gets a status and one or more source ids:

* **documented**: a public Make (or provider) documentation page states it. It must cite at least one public documentation source.
* **observed**: you saw it happen (an upload, a run, a log line). It needs a source, such as a recorded result, and its scope is exactly what was observed.
* **unverified**: you believe it but have no proof. Say so. This is a legitimate, honest status and not a defect.

The checker's `CK-CLAIM-EVIDENCE` rule tests that statuses are from this set, source ids exist in the catalog, "documented" has a public source and "observed" has some source. It says nothing about whether the cited page actually supports the claim: that is review work.

```json
{
  "claims": [
    { "text": "A Get module needs mode edit on its ID selector.", "status": "documented", "sourceIds": ["doc-rpc-best-practices"] },
    { "text": "The provider accepts page size 100.", "status": "unverified", "sourceIds": [] }
  ]
}
```

## Evidence gates

Four gates record what was done: `static` (a structural check such as this repository's), `uploadReadback` (the app was uploaded to Make and read back), `providerExecution` (a real call to the provider succeeded) and `publication` (the app was published or approved). Each is `performed`, `skipped` or `unavailable`.

A static-only fixture can never report the last three as performed; the checker's `CK-GATES` rule enforces that, and a performed static gate must state what was run. This keeps a green static check from being read as "works in Make".

## Missing proof

**Inferred implementation pattern.** In static review, distinguish ordinary uncertainty from an independently essential missing fact. An existing route's possible alias, its absence from a partial specification, or missing live proof is advisory uncertainty by itself. To hold approval for *insufficient evidence*, name the applicable requirement and the specific missing fact essential to judging it; the operation's importance alone is not enough. Direct contradictions in an exhaustive contract, a newly requested operation without support, and unresolved security, authentication or binding requirements can justify a hold. It is wrong to turn missing proof into a declared runtime failure ("this will fail"), or a missing public page into proof that a route does not exist.

Formal QA, provider-execution and publication gates retain their required evidence. Classifying uncertainty in a static review does not mark those gates performed or waive them.

Frequency is not evidence either. That many apps do something never raises a rule's strength; strength comes from documentation. This is why the catalog uses `must` only for a documented requirement with a public source, `should` for recommendations and `consider` for inferred patterns.

## What does and does not count as proof

* **Static inspection** can establish an unresolved reference, an undeclared input or a local transformation defect. It cannot establish authorization, permissions, cursor exhaustion, webhook delivery or publication.
* **Upload and readback** shows that the intended components exist on Make; it is not provider execution.
* **Provider execution** is the only evidence for provider behaviour. Verifying the provider's API is never optional merely because a generic, synthetic fixture cannot represent a provider-specific scheme such as request signing; it only means the fixture cannot be the evidence.
* **Dependency proof.** A number that looks like an identifier, a long numeric timestamp, or a name such as `normalizeDate` is not evidence of what a value is or of what a helper does. Trace the definition and the call, and read the provider documentation.
* **Absence.** A missing page, route, Endpoint or file is a gap in what you were given. It is never a failure by itself. An Endpoint is optional by request scope; a "missing Endpoints" finding does not exist.
* **A finding needs a contract and a consequence.** Name the applicable documented contract (Make page, provider page, or request scope) and an observable result. If the consequence depends on an unverified assumption, write a verification question or warning instead.

For public app review, apply the current prerequisites to executed scenarios: exercise every module, include a separate error case and fresh pagination evidence where pagination applies, use distinguishable test records and a small page size to expose overlap or skipped records, and remove personal data from logs. A successful upload or a generated interface does not replace that evidence.

## Exact evidence locators

**Inferred review practice**, not a documented Make requirement. A finding that cites a file and location is only as good as the location. A correct change can still have a citation that points to the wrong property, only the first array item for a whole-list claim, or a partial object as proof that something is missing.

* **A hash identifies bytes, not claims.** A file or document SHA says which bytes you read. It does not say the claim is true or that the cited place supports it.
* **Reuse the locator the tool supplied.** Copy the path, pointer or line range the reading tool returned. Never guess one, and never carry over line counts from an earlier read, because edits shift them.
* **Cite the property the claim is about.** A claim about `options.timeout` cites that property, not a neighbouring one in the same object.
* **Multiple fields or a whole list: cite the common parent.** Cite the full collection, not its first element, when the claim covers every element.
* **Absence needs the entire owning object.** A prefix, a truncated excerpt or one child cannot prove something is omitted. Cite the whole object that would contain it, or say the absence is unverified.
* **Verify before relying.** Check the returned locator against the raw, unchanged bytes. If you could not, write "uncertain" beside the citation instead of presenting it as confirmed.
* **A requirement is not its assumed consequence.** A task may validly require a deliverable, for example an explicit interface field. Breaking that request is a finding, but it does not make the assumed consequence a platform fact. A field missing from the interface is not shown to be unmappable ([interfaces-required](interfaces-required.md)).

Synthetic document (JSON Pointer locators):

```json
{
  "options": { "retries": 3, "timeout": 30 },
  "items": [{ "id": "a", "active": true }, { "id": "b", "active": false }, { "id": "c" }]
}
```

| Claim | Correct citation | Incorrect citation |
| --- | --- | --- |
| The timeout is 30. | `/options/timeout` | `/options/retries` (other property) |
| Every item has an `id`. | `/items` (whole collection) | `/items/0` (first element only) |
| Item `c` has no `active`. | `/items/2` (whole object) | `/items/2/id` (one property; it cannot show omission) |
| No item has `archived`. | `/items` (all elements) | `/items/0` |

The checker checks declared fixtures only; it is not semantic proof and does not validate that a cited locator supports a claim.

## Changing an app that is already in use

Classify the work (new operation, targeted fix, API migration, shared-component change) and record the baseline contracts for inputs, outputs, connections, selectors, dates, helpers and polling state before editing. Evaluate every consumer of a shared component and prefer documented deprecation over silent removal. Adding a request, condition, response validation, stricter parameter or different connection can break existing scenarios, while the same change in a brand-new module is harmless. An old pattern is neither automatically correct nor automatically a regression; when a provider change forces a trade-off, explain it and verify it. Renaming stable identifiers, changing defaults or tightening validation is migration work, not cosmetic cleanup.

## Compatibility metadata

Each recipe declares `minSkillVersion`, a review date and its applicability (`appliesWhen`, `notWhen`, exceptions). Compatibility is about the *knowledge*: this recipe was written for skill version X and reviewed on a given date, so a reader can tell when it may have gone stale. It is not a claim that every Make platform version behaves identically.

## Rationale

Without recorded status, a review treats every statement with the same confidence: either everything is blocked or nothing is. Splitting claims by source and gates by what was run makes a review specific: this documented thing is required; this recommendation is advice; this is unverified and needs a check.

## Pitfalls

* Marking a claim "documented" with only a research summary behind it. Documented needs a public documentation source.
* Writing "observed" with no record of what was observed.
* Reporting `providerExecution: performed` after only a static check.
* Blocking an app because a provider route is not in the docs you have. Absence of documentation is not absence of the route.
* Writing "will fail at runtime" with no run behind it.
* Raising strength because many examples did it.
* Quietly dropping an unverified claim instead of recording it.
* Citing a neighbouring property, the first array item or a prefix as if it proved a claim about another property, the whole list or an omission.

## Exceptions and applicability

* Applies to knowledge, review notes and the catalog; not to an app's runtime behaviour.
* Small teaching examples may mark everything `static: performed` and the rest `skipped`; real submissions should record each gate truthfully.
* Where a claim concerns the provider's own behaviour, provider documentation can be the public source, but a Make page is still needed for statements about Make.
* **Approval impact** ([Approval gating](../../../references/review-and-qa.md#2a-approval-gating)). Block only when an applicable contract establishes the consequence. When a static observation lacks evidence of failure (string versus integer option values, unverified IML evaluation or parser behavior (syntactically invalid IML is class (a) and blocks), absent pagination metadata, a legacy route absent from partial documentation, prose that conflicts with a schema), report `needs_evidence` or advisory and keep the observation. Version drift without shown breakage and a missing citation range are advisory; a cited range must still support its claim semantically, and an identical-content group does not replace per-component coverage.

## Evidence and limits

* The status vocabulary and gate rules: **inferred implementation pattern** (this tree's own convention).
* Public page content: **documented** only as far as the cited page says.
* The checker is a narrow, static validator of declared recipes; it never runs Make, an SDK, or a provider.

## Fixtures

Static, synthetic teaching fixtures. The recipe's own confidence is `inferred` because the status and gate vocabulary is this tree's convention.

* Correct: [correct.json](../recipes/evidence-gates/correct.json): each claim has a known status and existing source ids, a documented claim cites a public documentation source, only the static gate is performed (and says what ran), and the later gates are skipped or unavailable.
* Incorrect, `CK-CLAIM-EVIDENCE`: [documented-without-source.json](../recipes/evidence-gates/incorrect/documented-without-source.json). A claim is marked documented but cites no public documentation source, so a research summary or nothing is standing in for a page.
* Incorrect, `CK-GATES`: [provider-gate-performed.json](../recipes/evidence-gates/incorrect/provider-gate-performed.json). A static-only fixture reports the provider gate as performed. A gate that could not run is recorded as `unavailable` or `skipped`, never as performed.

## Sources

* https://developers.make.com/custom-apps-documentation/app-components/rpcs
* https://developers.make.com/custom-apps-documentation/best-practices/remote-procedure-calls
* https://developers.make.com/custom-apps-documentation/best-practices/output-parameters/processing-of-output-parameters
* https://developers.make.com/custom-apps-documentation/app-components/webhooks
* https://developers.make.com/custom-apps-documentation/app-review/prerequisites
* https://developers.make.com/custom-apps-documentation/app-maintenance/updating-your-app/approved-apps/managing-breaking-changes
* https://developers.make.com/custom-apps-documentation/debug-your-app/debugging-rpc
