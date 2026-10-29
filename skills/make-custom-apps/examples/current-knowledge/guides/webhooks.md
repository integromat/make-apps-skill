# Webhooks: lifecycle, verification and delivery

Back to the [knowledge index](../README.md).

An instant trigger is more than a receiver. There is a lifecycle (how the provider learns the URL and forgets it), a handshake some providers require, and a delivery contract (how the receiver answers and what bundle comes out). Each part can be right or wrong independently, and they are easy to confuse.

## Three kinds of webhook

**Documented behaviour.**

* **Dedicated, attached.** Make registers the URL with the provider by running an *attach* RPC when the scenario is activated, and removes it by running *detach* when it is deactivated or deleted.
* **Dedicated, not attached.** The user copies the URL and pastes it into the provider by hand. For an app Make is to approve, instructions on how to connect the webhook are **required**; the documentation recommends delivering them as an `info` banner in the instant trigger's static parameters, so the banner is the recommended form and the instructions are the requirement. Usually no connection is linked, unless RPCs or extra requests need one.
* **Shared.** The provider sends all events for all users to one URL that the *developer* registers. The app must be published, the connection's `info` and the webhook must both define `uid`, and a connection is mandatory. A single URL registered under a user's account is a dedicated webhook even if the provider sends everything to it.

## Attach and detach identity

**Documented requirement.** The attach RPC receives `webhook.id` and `webhook.url`. Only values it stores in `response.data` (for example `externalHookId` and a `token`) are available as `webhook.*` in detach. A typical attach sends `"url": "{{webhook.url}}"` in its body; detach is `DELETE .../{{webhook.externalHookId}}`.

When attach or detach uses `connection.*` credentials, associate the intended connection with the webhook and verify that the lifecycle RPCs receive that auth context; do not assume the instant trigger's connection link supplies it.

If detach reads a name attach never saved, detach cannot find the provider-side webhook and orphans pile up on the provider. The checker's `CK-WEBHOOK-IDENTITY` rule tests that every `webhook.<name>` in detach is among attach's `response.data` keys. One-time secrets returned by attach must be persisted this way too, because the provider will not show them again; mask them in `log.sanitize` (`CK-SECRET-LOG`).

## Verification versus signatures

**Documented behaviour.** The webhook specification has a `verification` block with a `condition` and a `respond`. It exists for providers that send a challenge: when `condition` (an expression over `body`, `query`, `headers`, `method`) is true, Make sends the `respond` and does not run the trigger. Example: `"condition": "{{if(body.code, true, false)}}"` with `status: 202`.

**The public page documents no directive for verifying a provider's signature.** So a fixture, and this guide, say only what is demonstrated: the challenge reply. The checker's `CK-WEBHOOK-VERIFY` rule requires the condition to depend on the incoming request, the challenge reply to be 2xx, and the fixture to keep `verificationScope: "challenge-only"` and `signatureVerification: "not-demonstrated"`. If the provider requires signature checking, that is a provider requirement you must meet in a way you can show; do not claim Make verified it.

### What a challenge reply does not establish

A challenge reply proves that the endpoint answered a handshake. It is not request authentication. Report a webhook *security* finding only against a provider contract that actually requires something (a shared secret, a signature header, a source allow-list) and against what the runtime really exposes. Observations that support this:

* Reserialising parsed JSON can change the signed bytes, so a signature check needs a documented raw-payload mechanism. Do not invent a runtime variable for the raw body.
* A helper called `verifySignature` or a declared secret field proves nothing about security by itself.
* That a generic fixture cannot demonstrate a provider's signature scheme does not make provider verification optional. When a provider documents signing, the author still has to test it against the real provider (see [compatibility-evidence](compatibility-evidence.md)); the missing proof is a gap to close, not a reason to skip the check.

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
* Shipping a not-attached webhook with no connection instructions; approval requires them. A banner is the recommended way, so a different clear place for the instructions is not the same defect as having none.
* Shared webhook without `uid` in both places.
* Responding 4xx/5xx in `respond` for a delivery that was accepted.
* Treating a missing connection as harmless on a shared webhook; it is mandatory.

## Exceptions and applicability

* Attach/detach apply to dedicated attached webhooks only.
* Shared webhooks normally do not need attach/detach.
* `verification` is needed only if the provider sends a handshake; if it does not, omit the block (the fixture models a provider that does).
* Whether a given provider retries, signs or rotates secrets is provider-side and outside this tree.

## Evidence and limits

* Attach/detach identity, shared `uid`, connection instructions for approval of a not-attached webhook: **documented requirement**; the banner form: **documented recommendation**.
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
