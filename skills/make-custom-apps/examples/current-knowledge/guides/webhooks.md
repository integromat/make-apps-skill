# Webhooks: lifecycle, verification and delivery

Back to the [knowledge index](../README.md).

An instant trigger is more than a receiver. There is a lifecycle (how the provider learns the URL and forgets it), a handshake some providers require, and a delivery contract (how the receiver answers and what bundle comes out). Each part can be right or wrong independently, and they are easy to confuse.

## Three kinds of webhook

**Documented behaviour.**

* **Dedicated, attached.** Make registers the URL with the provider by running an *attach* RPC when the scenario is activated, and removes it by running *detach* when it is deactivated or deleted.
* **Dedicated, not attached.** The user copies the URL and pastes it into the provider by hand. For an app Make is to approve, the documentation asks for instructions on how to connect the webhook, delivered as an `info` banner in the instant trigger's static parameters. Report missing instructions as a fix; they are advisory and do not block a working webhook. Usually no connection is linked, unless RPCs or extra requests need one.
* **Shared.** The provider sends all events for all users to one URL that the *developer* registers. The app must be published, the connection's `info` and the webhook must both define `uid`, and a connection is mandatory. A single URL registered under a user's account is a dedicated webhook even if the provider sends everything to it.

## Attach and detach identity

**Documented requirement.** The attach RPC receives `webhook.id` and `webhook.url`. Only values it stores in `response.data` (for example `externalHookId` and a `token`) are available as `webhook.*` in detach. A typical attach sends `"url": "{{webhook.url}}"` in its body; detach is `DELETE .../{{webhook.externalHookId}}`.

When attach or detach uses `connection.*` credentials, associate the intended connection with the webhook and verify that the lifecycle RPCs receive that auth context; do not assume the instant trigger's connection link supplies it.

If detach reads a name attach never saved, detach cannot find the provider-side webhook and orphans pile up on the provider. The checker's `CK-WEBHOOK-IDENTITY` rule tests that every `webhook.<name>` in detach is among attach's `response.data` keys. One-time secrets returned by attach must be persisted this way too, because the provider will not show them again; mask them in `log.sanitize` (`CK-SECRET-LOG`).

### One webhook, several provider subscriptions

**Inferred implementation pattern** (documented `response.data`, `repeat`, `temp` and [request-less items](https://developers.make.com/custom-apps-documentation/component-blocks/api/request-less-communication)). Some attach RPCs create one provider subscription per selected event, with `repeat` or a `communication` array. When every pass writes the same `response.data` key, such as `externalHookId`, only the last id is kept. Detach then removes one subscription, and the others keep posting to a URL that no scenario listens to. `CK-WEBHOOK-IDENTITY` still passes, because detach reads a name that attach did save, so check the loop by hand.

* If the provider accepts a list of events, prefer one subscription that covers all the selected events.
* With a fixed `communication` array, give each request its own `response.data` key, and give detach one request per key.
* With `repeat`, collect every id in `temp`, save the whole list on each pass, and make detach loop over it. `repeat` checks its condition after each request, so the first request always runs: make the event list required. `limit` must be a literal number; set it higher than the number of events a user can select.
* If a later pass fails, attach fails, and the subscriptions it already created can stay at the provider, because a failed attach saves nothing for detach to use. In detach, a 404 for one id that is already gone fails the loop at that id and leaves the rest. Test both cases.

```json
{
  "attach": [
    { "temp": { "i": 1, "n": "{{length(parameters.events)}}", "ids": [] } },
    {
      "url": "/subscriptions",
      "method": "POST",
      "body": { "url": "{{webhook.url}}", "event": "{{get(parameters.events, temp.i)}}" },
      "response": {
        "temp": { "ids": "{{add(temp.ids, body.id)}}", "i": "{{temp.i + 1}}" },
        "data": { "externalHookIds": "{{temp.ids}}" }
      },
      "repeat": { "condition": "{{temp.i <= temp.n}}", "limit": 20 }
    }
  ],
  "detach": [
    { "temp": { "i": 1, "n": "{{length(webhook.externalHookIds)}}" } },
    {
      "condition": "{{temp.n > 0}}",
      "url": "/subscriptions/{{get(webhook.externalHookIds, temp.i)}}",
      "method": "DELETE",
      "response": { "temp": { "i": "{{temp.i + 1}}" } },
      "repeat": { "condition": "{{temp.i <= temp.n}}", "limit": 20 }
    }
  ]
}
```

### An empty detach: forgotten or deliberate

**Inferred implementation pattern** (documented detach purpose). Detach deletes from the provider what attach registered. Some exported detach files contain only comments, such as an unedited template, and no `url`. Such a detach makes no request, so the provider keeps posting to a Make URL that no longer exists. This is not a missing export, which stays `uncertain`: the file is there, and it is empty. When the provider documents a removal route, it is the missing-detach case in [Evidence and limits](#evidence-and-limits). In an app with several webhooks, open every detach file, because one forgotten template can sit next to correct ones.

When the provider documents no way to remove the registration, an empty detach is the honest implementation. Do not invent a removal call. Do not overwrite the registration with an empty or dummy callback either, unless the provider documents that as removal, because the overwrite can have side effects of its own. Make the limitation visible instead: give the reason in a detach comment, and tell users in a `warning` banner in the webhook's parameters that deleting the webhook in Make does not unregister it at the provider (see [Providers that keep only one registration](#providers-that-keep-only-one-registration)). A reviewer checks the claim against the provider documentation.

```jsonc
{
  // Intentionally empty: the provider documents no route to remove this registration.
  // The webhook parameters show a warning banner about this.
}
```

### Providers that keep only one registration

**Inferred implementation pattern** (documented `warning` banner). Some providers keep a single callback per account, resource or topic. Registering a new URL silently replaces the previous one, and the earlier scenario stops receiving events without any error. Tell users before they create the webhook: put a `warning` banner in the webhook's parameters that names the scope and the effect. Keep the text within the recommended 50 to 300 characters.

```json
[
  { "type": "banner", "theme": "warning", "title": "One webhook per workspace", "text": "Only one webhook per workspace is supported. Creating a new webhook replaces the previous one, which then stops receiving events." }
]
```

The same constraint affects detach. When a newer webhook has replaced the registration, the older webhook's detach can remove the registration that the newer one depends on. Clean up only the exact remote subscription that attach created ([webhooks and polling](../../../references/webhooks-and-polling.md#implement-attach-and-detach-together), step 6). Detach sees only what attach saved. So if the provider can report its current callback, save `webhook.url` in attach's `response.data` (for example as `hookUrl`), read the current callback first in detach, and remove it only when it equals `webhook.hookUrl`.

### A registration that did not happen must fail attach

**Documented behaviour** ([valid](https://developers.make.com/custom-apps-documentation/component-blocks/api/handling-responses/valid)). Without `valid`, a response with a status from 200 to 399 is valid. Some providers answer a failed registration with a 200 and an error envelope, for example GraphQL `errors` or `success: false`. Without `valid`, attach then succeeds anyway: the user sees a webhook that looks created but never receives an event, and detach later runs with an empty id.

**Inferred implementation pattern.** Make attach fail on the value that proves the registration, usually the id that `response.data` saves. The message below is a fallback; add the provider's documented error field to it ([errors and rate limits](errors-and-rate-limits.md)).

```json
{
  "response": {
    "valid": { "condition": "{{body.id}}", "message": "The provider did not register the webhook: no webhook id in the response." },
    "data": { "externalHookId": "{{body.id}}" }
  }
}
```

## Verification versus signatures

**Documented behaviour.** The webhook specification has a `verification` block with a `condition` and a `respond`. It exists for providers that send a challenge: when `condition` (an expression over `body`, `query`, `headers`, `method`) is true, Make sends the `respond` and does not run the trigger. Example: `"condition": "{{if(body.code, true, false)}}"` with `status: 202`.

**The public page documents no directive for verifying a provider's signature.** So a fixture, and this guide, say only what is demonstrated: the challenge reply. The checker's `CK-WEBHOOK-VERIFY` rule requires the condition to depend on the incoming request, the challenge reply to be 2xx, and the fixture to keep `verificationScope: "challenge-only"` and `signatureVerification: "not-demonstrated"`. If the provider requires signature checking, that is a provider requirement you must meet in a way you can show; do not claim Make verified it.

### What a challenge reply does not establish

A challenge reply proves that the endpoint answered a handshake. It is not request authentication. Report a webhook *security* finding only against a provider contract that actually requires something (a shared secret, a signature header, a source allow-list) and against what the runtime really exposes. Observations that support this:

* Reserialising parsed JSON can change the signed bytes, so a signature check needs a documented raw-payload mechanism. Do not invent a runtime variable for the raw body.
* A helper called `verifySignature` or a declared secret field proves nothing about security by itself.
* That a generic fixture cannot demonstrate a provider's signature scheme does not make provider verification optional. When a provider documents signing, the author still has to test it against the real provider (see [compatibility-evidence](compatibility-evidence.md)); the missing proof is a gap to close, not a reason to skip the check.

### Signature checks: traps to look for

**Inferred implementation pattern.** This guide still demonstrates no signature scheme, and the raw-bytes rule above still applies. When an app checks a provider's signature in the webhook's own communication, look for these traps. Each one fails silently.

* **HMAC arity.** `sha256` returns an HMAC only when a key is given, and the key is the third argument, after the output encoding: `sha256(message, 'hex', secret)` ([text functions](https://help.make.com/text-and-binary-functions)). `sha256(message, secret)` passes the secret as the encoding and returns a plain hash, so the comparison never matches. `sha1` and `sha512` take the key in the same place.
* **Hyphenated header names.** Read them with backticks, as in ``headers.`x-signature` `` ([IML](https://developers.make.com/custom-apps-documentation/block-elements/iml)). Without backticks, `headers.x-signature` is read as a subtraction.
* **The secret.** Attach saves a per-webhook signing secret in `response.data` and masks it, as in [Attach and detach identity](#attach-and-detach-identity). In a dedicated webhook, the receiver reads saved values through `parameters` or its alias `data`.
* **Rejecting a failed check.** Compute `respond.status` (an IML string) so that a failed check gets a 4xx, and let `output` yield no bundle in that case. A 4xx here answers a rejected delivery, so it is not the accepted-delivery pitfall below. Do not gate the check with a top-level `condition`: it can end processing before `respond`, and the provider then gets Make's default success answer. Some apps reject through `verification` with an inverted condition and a 4xx. That also rejects, but this guide keeps `verification` for challenges and `CK-WEBHOOK-VERIFY` expects a 2xx challenge reply, so new code uses `respond`.

```json
{
  "respond": { "type": "json", "status": "{{if(temp.accepted, 200, 401)}}", "body": { "accepted": "{{temp.accepted}}" } },
  "output": "{{if(temp.accepted, body, false)}}"
}
```

Here `temp.accepted` holds the result of the provider's check, computed in the receiver's `temp`. The public page does not state the order in which the receiver evaluates these directives, so prove the gate before you rely on it. Test a genuine, a tampered and, when the provider sends a timestamp, a stale delivery against the real provider (see [compatibility-evidence](compatibility-evidence.md)), and confirm that each rejected delivery gets the 4xx and produces no bundle. Never describe the check as verification that Make performs.

## Delivery and acknowledgement

**Documented behaviour.** The webhook's `respond` sets the HTTP answer to the provider (`type`, `status`, `headers`, `body`). Providers usually retry unless they receive a 2xx. `iterate` splits a payload into several bundles, `output` shapes each one, and an instant trigger yields exactly one bundle per webhook delivery. Instant-trigger parameters are static only, communication is optional, single request, with no iterate or pagination in the trigger's own communication.

**Inferred implementation pattern.** Delivery acknowledgement (`CK-WEBHOOK-DELIVERY`) and workspace/user intent are separate things: the 2xx tells the *provider* it can stop retrying, while `uid` or a webhook per connection decides *which Make user* gets the event. The receiver's `output` keys should match the trigger interface, so the bundle the user sees is the bundle the interface declares.

**Documented defaults** ([webhooks](https://developers.make.com/custom-apps-documentation/app-components/webhooks)). Receiver `output` is optional: when it is omitted, incoming items are forwarded unchanged. `respond` is optional too, so its absence alone is not a defect. Add `output` when the intended Make bundle contract needs mapping or reshaping; add `respond` for a provider-specific custom acknowledgement. Verification challenges and custom acknowledgements follow the actual provider protocol. Do not demand an explicit `output` or `respond` merely because the example below uses them.

```json
{
  "receiver": {
    "verification": { "condition": "{{if(body.challenge, true, false)}}", "respond": { "status": 200, "body": "{{body.challenge}}" } },
    "respond": { "status": 200, "body": "accepted" },
    "output": "{{body.event}}"
  }
}
```

## Authoring checklist in prose

Pick the delivery kind first (shared, attached dedicated, manual dedicated). For attached hooks, write the provider's registration and removal protocol, persist everything detach needs, and keep the user-facing output and interface consistent with the event that survives processing. Use webhook conditions to filter events and `verification` only for challenges. An instant trigger's own communication is limited to one optional enrichment request without iterate or pagination; webhook-level `iterate` can split batched events instead. A responder module has a different contract (it answers the caller) and no ordinary output interface. Shared webhooks need publication in addition to configuration, so a complete definition is not evidence that account routing or live delivery has been tested. Retries, duplicate delivery and lifecycle updates need their own tests against the provider. Manual dedicated and shared hooks legitimately have no attach/detach calls.

## Rationale

The platform hides most of the plumbing, so each part can silently fail: an attach that works but a detach that does not leaves hooks forever; a verification that never matches makes the provider's handshake fail; a delivery without 2xx makes the provider retry, producing duplicates.

## Pitfalls

* Detach reading `webhook.id` while attach only saved `externalHookId`.
* A verification `condition` of `{{true}}`: every delivery is treated as a challenge and no event is ever delivered.
* Calling the challenge reply "signature verification", or reporting a missing signature check without a provider contract that demands one.
* Shipping a not-attached webhook with no connection instructions (advisory; report it as a suggested fix). A banner is the recommended way, so a different clear place for the instructions is not the same gap as having none.
* Shared webhook without `uid` in both places.
* Responding 4xx/5xx in `respond` for a delivery that was accepted.
* Treating a missing connection as harmless on a shared webhook; it is mandatory.

## Exceptions and applicability

* Attach/detach apply to dedicated attached webhooks only.
* Shared webhooks normally do not need attach/detach.
* `verification` is needed only if the provider sends a handshake; if it does not, omit the block (the fixture models a provider that does).
* Whether a given provider retries, signs or rotates secrets is provider-side and outside this tree.
* **Approval impact** ([Approval gating](../../../references/review-and-qa.md#2a-approval-gating)). Missing signature or verification handling (class (b), fixed, never rejected) matters only when the provider documents a verification protocol; implement the documented verification when the documentation determines it (approve with adjustments), otherwise report an unverified advisory finding naming the missing fact; challenge handling, an authentication requirement and ingress proof are separate claims. Missing setup instructions for a manually registered webhook are advisory.

## Evidence and limits

* Attach/detach identity and the shared `uid`: **documented requirements**; a missing or wrong `uid` or attach/detach identity that breaks routing, or a missing or incorrect detach that leaves orphaned provider hooks, is class (c) in [Approval gating](../../../references/review-and-qa.md#2a-approval-gating). Connection or setup instructions for a manually registered webhook: documented by Make's app review, but advisory for approval (report as a suggested fix); the banner form: **documented recommendation**.
* Challenge-only verification: **documented behaviour**; signature checking: **not documented**, therefore never demonstrated here.
* Delivery/interface alignment: **inferred implementation pattern**. The checker never receives a real request and proves nothing about a provider.

## Fixtures

Static, synthetic teaching fixtures. None models a provider signature scheme, so none can be evidence for signature checking.

* Correct: [correct.json](../recipes/webhook-lifecycle-delivery/correct.json): attach saves the provider subscription identity and detach reads that same saved name, verification only answers a challenge, challenge and event deliveries respond with a 2xx status, the output matches the trigger interface, and secrets are masked.
* Incorrect, `CK-WEBHOOK-IDENTITY`: [detach-unsaved-identity.json](../recipes/webhook-lifecycle-delivery/incorrect/detach-unsaved-identity.json). Detach reads an identity that attach never saved.
* Incorrect, `CK-WEBHOOK-VERIFY`: [verification-constant.json](../recipes/webhook-lifecycle-delivery/incorrect/verification-constant.json). The verification condition is a constant such as `{{true}}`, so every delivery is treated as a challenge.
* Incorrect, `CK-WEBHOOK-VERIFY`: [signature-claimed.json](../recipes/webhook-lifecycle-delivery/incorrect/signature-claimed.json). A challenge reply is presented as signature verification, which the documentation does not describe.
* Incorrect, `CK-WEBHOOK-DELIVERY`: [delivery-server-error.json](../recipes/webhook-lifecycle-delivery/incorrect/delivery-server-error.json). An accepted delivery or challenge answers a non-2xx status. Any 2xx is acceptable; the rule is not tied to 200.
* Incorrect, `CK-SECRET-LOG`: [attach-secret-unmasked.json](../recipes/webhook-lifecycle-delivery/incorrect/attach-secret-unmasked.json). The attach request sends a secret that is not listed for log sanitization.

## Sources

* https://developers.make.com/custom-apps-documentation/app-components/base/sanitization
* https://developers.make.com/custom-apps-documentation/app-components/webhooks
* https://developers.make.com/custom-apps-documentation/app-components/webhooks/dedicated/attached
* https://developers.make.com/custom-apps-documentation/app-components/webhooks/dedicated/not-attached
* https://developers.make.com/custom-apps-documentation/app-components/webhooks/shared
* https://developers.make.com/custom-apps-documentation/app-components/modules/instant-trigger
* https://developers.make.com/custom-apps-documentation/app-components/rpcs
* https://developers.make.com/custom-apps-documentation/app-components/modules/responder
