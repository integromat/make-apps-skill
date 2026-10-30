# Review and QA

Load before accepting an implementation, uploading a change, or preparing app-review evidence.
Review the exact app/version/origin and changed sections, including private/new components in scope.
Use the [inventory](research-and-inventory.md) to discover dependencies; notes alone are not complete coverage.

## 1. Keep four evidence gates separate

| Gate | What it establishes | What it does not establish |
| --- | --- | --- |
| Static validation | Files parse, references resolve, schemas/IML and tests were inspected or executed locally. | Remote installation or real provider behavior. |
| Upload and readback | Exact approved definitions persisted on the intended app/version/origin. | Correct credentials, outputs or side effects. |
| Live execution | Approved test cases exercised actual Make/provider behavior with recorded results. | Untested cases, all users, or publication. |
| Release/review approval | The requested distribution/release step was approved and its status verified. | A substitute for any earlier gate. |

A fixture, successful HTTP status, upload receipt, or operation count cannot stand in for output assertions.
Make's public review prerequisites require functional test scenarios and recent, non-sensitive logs.[8]

## 2. Static and UX review

Use the current public rules, not internal category codes or an old app's style as universal requirements.
Approval impact is decided separately in [Approval gating](#2a-approval-gating).
Report an **Error** for a demonstrated blocking-class defect, **Warning** for risk or missing evidence, and
**Suggestion** for optional improvement; a demonstrated convention or quality deviation is recorded as a Warning
or Suggestion, since only blocking-class findings use the Error level. Cite the applicable rule and exact component/section for each finding.

Assess each finding before deriving the overall verdict. A finding that blocks under [Approval gating](#2a-approval-gating) keeps its affected component blocked while unresolved, even if another finding already rejects the app; advisory findings leave the component acceptable. Keep recommendations and uncertainty in their evidence-based categories. Existing route-alias, optional Endpoint and essential-evidence rules remain unchanged, as do every required execution and publication gate.

- Parse every changed JSON/JSONC/IMLJSON file with the appropriate parser; report the number checked.
  Count zero files as a failed validation setup, not a passing app. Parsing does not validate IML semantics.
- Trace base/auth/error handling, connection and webhook bindings, RPC references and function calls.
- Use accurate verb/entity module labels; current guidance calls for sentence case and familiar provider
  terminology. Do not rename stable technical identifiers just to align display text.[34]
- Check labels, descriptions, field types, required flags and defaults against actual behavior.
- Check form layout and wording as advice, not as a defect list (see [parameters and RPCs](parameters-and-rpcs.md)
  and [mappable parameters](https://developers.make.com/custom-apps-documentation/best-practices/input-parameters/mappable-parameters)):
  required parameters first, then conditionally required, then optional (a logical group such as a start and
  an end may stay together); `advanced` parameters at the bottom and `Limit` last in a search or list module;
  a conditional field not marked required in every state, with help text or a supported conditional/nested
  structure that says when it applies (a nested `required: true` that is only active in its branch is fine);
  a coherent array label, item `spec.label` and `labels.add`; and, as inferred UX judgment rather than public
  documentation, an `option.description` where choices differ in meaning and the schema in use accepts it
  (confirm by upload and readback); and the accurate Make type for each value, with date-only and time-only
  values as `text` plus a stated format. Layout and wording deviations are Suggestion or Warning, never an
  Error by themselves (an advisory finding never uses the Error level). This does not downgrade a demonstrated defect: a schema-invalid type, a value lost or
  altered by the declared type, a required flag that blocks a valid state, or a mismatch with documented
  provider behavior is a concrete finding when you cite the evidence, whatever the nearby layout advice is.
  Keep legacy apps calibrated; changing names or types in place can break saved scenarios.
- Explain formats, constraints and omitted-value behavior in concise `help`; use supported Markdown,
  bold field references and code-formatted examples, not arbitrary HTML/CSS.[35]
- A module that makes several independent writes cannot report partial success; classify requests by side
  effects, not HTTP verb, and prefer separate modules unless the sequence is a valid exception (read then one
  write, write then read, provider chunk upload, bounded polling, provider upsert). See
  [requests and responses](requests-and-responses.md). Raise it as a design recommendation, not a blanket rejection.
- Test mapped input as well as picker selection. RPC options must provide usable values, not only labels;
  verify connection compatibility, dependent fields, search behavior and bounded pagination.[18]
- Compare output mapping, interface and sample bundle field-by-field, including nested/conditional fields.
  An interface should describe the available output, and a sample represents one outgoing bundle.[17][19]
- Preserve existing samples and unrelated section contents during updates; see [maintenance](maintenance.md).
- When a helper's implementation changes, review its existing tests too, and when you author or evaluate a new or changed custom-function test, assert exact values/types and edge cases;
  distinguish local JavaScript tests from the restricted Make runtime.[27] Trace the reachable call sites,
  require exact `strictEqual`/`deepStrictEqual` results and exact error type and message, and reject a vacuous
  pass (a test that never calls the helper or asserts a constant). `assert.ok(value, expected)` does not compare
  `expected`; its second argument is only the failure message. Do not demand a test for an input no call site
  can send, and a pure static helper may need no behavioral test if the reason is stated. These are standards
  for the tests under review. Missing comprehensive helper tests in a working legacy app (existing-app
  maintenance, no helper change) is an evidence limitation to report and advice to add them, not a defect or an
  approval blocker, unless the task's explicit review criteria require them or the helper's actual behavior
  lacks essential evidence (an explicit task or request-scope requirement can block when unmet).
  Incorrect helper behavior you can demonstrate stays a finding. Legacy helpers without tests, unused helper
  code, generic error types and metadata-only CRUD omissions stay advisory unless a traced consumer or an
  independently essential unknown behavior makes them gating ([Approval gating](#2a-approval-gating)). Details:
  [IML functions](iml-functions.md) and the [IML tests page](https://developers.make.com/custom-apps-documentation/get-started/make-apps-editor/apps-sdk/iml-tests).
- Verify credential sanitization in connection and base requests, responses and error paths.[36]

Do not infer HTTP Basic authentication from a connection-definition category, or normalize stored type
values into CLI/API create values. Validate the selected operation's contract separately.[28][38]

For worked synthetic examples and a per-check application table, see
[role application examples](../examples/current-knowledge/guides/role-application-examples.md) and
[review sweeps](review-sweeps.md).

## 2a. Approval gating

This section defines `approvalImpact`. Type-specific guides refine it for their topic, but none of them may raise
a convention to blocking on its own. A finding's severity (Error, Warning, Suggestion) says how serious it is;
`approvalImpact` says whether it can hold approval. Report every finding the other rules require; this section
changes only what may block.

| `approvalImpact` | Use it when |
| --- | --- |
| **blocks** | Only for class (a), (b), (c) or (d) below, established by the applicable contract and cited evidence. |
| **needs_evidence** | An independently essential fact is missing: the consequence would block, but it depends on runtime or provider behavior that the admitted documents do not establish. Name the missing fact. It holds approval until resolved. |
| **advisory** | Everything else, including documented conventions and quality. Report it as a fix or suggestion; it does not hold approval. |

Classes that may block:

- (a) **Established functional failure** under the applicable contract. This list is open; it includes a request
  the provider rejects or routes wrongly, an invalid enum or value, broken IML or JSON, a wrong key that leaves a
  mapped value unusable, a required input that cannot be supplied, pagination that loses records, and falsy or
  null values dropped or a clearing operation turned into a no-op. Also here: offered inputs ignored or lost
  across request stages or passed to the wrong helper argument; the wrong output container or iteration
  (iterating the wrapper instead of the records); a replacing update that wipes unmapped fields; precision loss
  on large identifiers; a label that promises destructive behavior the request lacks; syntactically invalid IML
  (unbalanced delimiters, an undefined function or variable), which is distinct from unestablished evaluation
  semantics; structural interface contradictions (container or nesting, number-only versus documented
  non-numeric values; see [interfaces-required](../examples/current-knowledge/guides/interfaces-required.md));
  a date trigger cursor that reads a provider format Make does not auto-parse and so skips or duplicates records;
  and pagination on documented paged responses with no, or non-advancing, page progression.
- (b) **Security or privacy exposure**: a credential in a URL, log or output; missing log sanitization of
  credentials; a user-entered secret collected through a plain `text` (non-`password`) connection or install
  parameter; an authenticated call without auth; an unsafe destination or host injection; missing webhook
  verification, only when the provider documents a verification protocol.
- (c) **A documented Make platform requirement whose violation itself causes failure**, for example a missing
  connection binding on an authenticated module.
- (d) **An explicit request-scope requirement is unmet**: requested capabilities, endpoints or operations are
  missing, an explicit marketplace or visibility target is not met, or a task-specific review criterion fails.

Advisory by default, including when a guide calls it a requirement, convention or recommendation: interface
completeness or typing (see class (a) for structural contradictions), a date typed as text, help text and labels,
selector edit mode, RPC option bounds, legacy or unused helpers, metadata-only CRUD, version drift without shown
breakage, missing setup instructions for a manually registered webhook, and ordering or polling assumptions
without evidence. A documented requirement that is not a class (a) to (d) failure is reported and stays advisory.

Rule: reject or hold approval only with at least one blocking finding of class (a) to (d) or one essential
`needs_evidence` finding; never for an accumulation of advisory items, however many.

How to record: a blocking-class defect uses the requirement-violation basis, Error severity and `blocks`;
an essential unverified consequence uses the unverified basis, Warning severity and `needs_evidence`; a
convention or quality point uses the recommendation or observation basis, Warning or
Suggestion severity and `advisory`. Name a service-specific field only where the review service defines it.

## 3. Approve a bounded test plan

Before creating resources, verifying credentials through live calls, or executing scenarios, record:

- Target app/version/variant/origin, approved test team and explicit managed provider connection.
- What changed and why; exact components verified against the current inventory.
- Acceptance criterion and changed-field to test-case mapping, including dependency consumers.
- Each case's inputs, expected request/output or error, fixture/data preconditions and evidence source.
- Maximum runs, records, pages, requests, elapsed time and acceptable provider/Make cost.
- External side effects, notification destinations, cleanup steps and any proposed retained resources.

Obtain approval for this concrete scope. A plan-only review performs no remote writes or live tests.
Use synthetic data and the fewest necessary scenarios. Prefer a related Create → Get → Update → Delete
lifecycle, with search/list branches at the end so multiple bundles cannot repeat downstream writes.[8]
Do not create data stores, folders, manual copies or recurring schedules by default.
For formal app review, cover every module in at least one scenario and include the required error case.[8]
For a narrow fix, state exactly what was not tested rather than claiming whole-app QA.

## 4. Required cases by behavior

| Surface | Cases to include when relevant |
| --- | --- |
| Inputs | Required/optional, omitted/null/empty, `0`, `false`, min/max, invalid enum/type, encoded identifiers. |
| Action | Expected result, documented empty/delete response, provider errors, exact created/updated-object readback. |
| Search/list | Zero results, one result, multi-page results, limit boundary, stable IDs, order, duplicates and stop condition. |
| Polling trigger | Initial epoch, next run, cursor persistence, duplicates, no new items and limit boundaries. |
| Instant trigger | Registration/verification, genuine event payload, output mapping and cleanup of the test subscription. |
| RPC/dynamic UI | Options, labels/values, dependencies, mapping mode, empty choices, auth errors and interface refresh. |
| Custom function (new or changed tests) | Happy path, null/undefined, false/zero, empty string/array, nested missing/null values, unexpected types the call sites can send, boundaries and every changed branch; for date helpers also a non-midnight timestamp, positive and negative offsets, a named IANA timezone, a DST boundary where zones convert, and an explicit extension timezone. |
| Universal call | Allowed method/path/query/body/headers, real input mapping, provider errors and secret redaction. |
| Upgrade | Prior/current-version parity with equivalent data and explicit intentional differences. |

Test omitted, empty and erase semantics against the app's manifest version and provider behavior;
Make documents different empty-value processing for the two platform versions.[23]
Do not convert all falsy values into omitted fields or treat a valid zero-result search as a failure.

For pagination, establish enough data to cross a page boundary; lower page size in a safe test variant
when supported. Verify requests and returned IDs across multiple pages, not just the final bundle count.[25]
Exercise the user limit, final partial/empty page, non-advancing cursors and page-index boundary.
Make's `pagination.page` starts at one and advances automatically; verify the provider's indexing.[20]
If multi-page data is unavailable, mark that case **Inconclusive**, not Pass or a pagination defect.

## 5. Run and inspect safely

Confirm the connected provider identity and permissions through an approved lightweight read before setup.
Check every test module's actual version and connection; a successful run against the wrong variant is invalid.
Approved-app development testing follows the documented browser Run once/module-only behavior; do not assume
scheduled/API runs exercise uncommitted changes.[13]
Enable confidential scenario handling only if the selected public interface supports it. Never invent a flag.
Use synthetic fixtures and sanitized evidence; if confidentiality prevents payload inspection, record that
limit rather than disabling protection or copying sensitive data to a capture store.

Inspect actual request serialization, provider status/body, Make bundles and declared output types.
For a raw-provider comparison, use an approved equivalent request and account; avoid replaying writes.
Compare changed fields individually, including nested arrays, timestamps and false/zero values.
Treat elapsed time/operations/bytes as diagnostic signals only, not proof of field-level correctness.
Record execution identifiers and sanitized evidence, with enough detail to reproduce the result.

| Failure layer | Treatment |
| --- | --- |
| Make authentication/access | Check selected origin, permissions and resource visibility; stop rather than widening access. |
| Provider authentication/scopes | Verify the intended connection; distinguish expired credentials from app request defects. |
| Provider rate limit/outage | Bound retries for safe reads; preserve the actual error and mark blocked cases appropriately. |
| App configuration/runtime | Reproduce against the correct variant and document the faulty field/mapping/behavior. |
| Missing capture or test data | Inconclusive or Blocked; no success inferred from an empty capture. |

After an uncertain write, recover with safe reads by returned ID or a documented unique marker; never resend blindly.
A delete or an update of an existing record is still a write, including a supposedly unchanged-value update.
Self-addressed messages, fictitious recipients and absent cleanup paths do not make writes automatically safe.

## 6. Cleanup and verdict

Maintain a ledger of exact objects created by this test: provider records, hooks, scenarios and any storage.
Clean up only those objects and only within the approved plan; never delete by name pattern or clear a shared store.
Perform permitted cleanup even after a later assertion fails. Verify deletion or remaining state by readback.
If no safe cleanup exists, obtain retention approval before creation and report the leftover object afterwards.
Stop/deactivate test schedules that this test activated; do not alter pre-existing schedules or shared connections.

Report each criterion/case as **Pass**, **Fail**, **Blocked**, **Inconclusive**, **Not run**, or **Not applicable**.
Pass requires the stated assertion; omitted/blocked cases cannot yield an unqualified overall QA pass.
Report exact coverage, regression findings, cleanup results, retained artifacts and the next approval needed.
Preparing evidence is not permission to publish; continue to [tooling and release](tooling-and-release.md).

## Sources

[8] https://developers.make.com/custom-apps-documentation/app-review/prerequisites.md
[13] https://developers.make.com/custom-apps-documentation/app-maintenance/updating-your-app/approved-apps.md
[17] https://developers.make.com/custom-apps-documentation/best-practices/output-parameters/interface.md
[18] https://developers.make.com/custom-apps-documentation/best-practices/remote-procedure-calls.md
[19] https://developers.make.com/custom-apps-documentation/component-blocks/samples.md
[20] https://developers.make.com/custom-apps-documentation/component-blocks/api/pagination.md
[23] https://developers.make.com/custom-apps-documentation/other/processing-of-empty-values.md
[25] https://developers.make.com/custom-apps-documentation/debug-your-app/debugging-of-pagination-in-list-search-modules.md
[27] https://developers.make.com/custom-apps-documentation/app-components/iml-functions.md
[28] https://developers.make.com/custom-apps-documentation/app-components/connections.md
[34] https://developers.make.com/custom-apps-documentation/best-practices/naming-conventions/modules/module-labels.md
[35] https://developers.make.com/custom-apps-documentation/best-practices/naming-conventions/input-parameters/parameter-hints.md
[36] https://developers.make.com/custom-apps-documentation/app-components/base/sanitization.md
[38] https://developers.make.com/api-documentation/api-reference/sdk-apps/connections.md
