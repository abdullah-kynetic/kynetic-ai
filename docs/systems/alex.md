# Speed-to-lead Alex

> Proposal-status document. Service family: **Revenue Response**. Source: handoff spec section 8.1 (`docs/systems/source-handoff-2026-11-06.md`). Evidence gathered read-only 2026-11-06. Nothing here activates or modifies a live system.

## 1. Evidence-backed current state

| Status | Evidence |
|---|---|
| PARTIAL | Repo copy of the cloud n8n workflow "Outbound Speed to Lead" (38 nodes, 11 Twenty nodes): `n8n/workflows/active/outbound-speed-to-lead__m2YJwZ1l8DTzyEkw.json`. That ID is the n8n Cloud copy; on the VPS the equivalents are `tXJwNTkNgKGnp0Ab` (Retell, inactive), `xlmyRd5jBBBu8LX7` (11Labs, inactive), `fJjshZWiUN0xPcCE` (Retell test, inactive). Live activation of the Cloud copy is **unknown** (last recorded active 2026-10-17, `docs/progress.md`). |
| EXISTING | Inactive synthetic ElevenLabs dev workflow: `n8n/workflows/dev/elevenlabs-speed-to-lead.json` + `elevenlabs-prepare.js`; VPS `hwjiTYVg91i5vIFS` "DEV - ElevenLabs Speed to Lead" (inactive, HTTP node disabled). Unit test `crm/tests/unit/elevenlabs-dev-workflow.test.ts`. |
| EXISTING | Portal-side gate and sequences: `crm/src/server/outbound/gate.ts`, `sequences.ts`, `crm/src/server/consent/can-contact.ts`, `quiet-hours.ts`, `compliance/state-rules.ts`, `compliance/disclosure.ts`; voice adapters `crm/src/server/adapters/voice/`; tests `crm/tests/integration/outbound-gate.test.ts`, `outbound-call.test.ts`, `call-results-m13.test.ts`, `alex-configs.test.ts`, `crm/tests/unit/quiet-hours.test.ts`, `compliance.test.ts`. |
| EXISTING | Twenty `endCustomers` fields: leadSource, consentText, consentAt, formSubmittedAt, firstRingAt, leadStatus, attemptCount, nextAttemptAt, lastOutcome, callOptOut(+Date), smsOptOut(+Date), phones, emails, secondsToFirstRing, lastCallId, clientAccount; `customerInteractions`: outcome, interactionType, bookedSlot, retellCallId, summary, occurredAt, channel, callbackTime; `callLogs`; `clientAccounts.retellAgentId`. |
| MISSING | No lease/lock, no canonical event envelope, no ElevenLabs result-ingest workflow, no n8n retry chain (automation-map B7), no text-first Pack A. |
| UNKNOWN | Live ElevenLabs agent state is intentionally **not inspected** (live Alex `agent_8201…` is prohibited). Sandbox agents recorded in `docs/codex/dev-resources.json` ("DEV-Alex Codex Setup", step2 agent) were not re-read; whether they still exist is unknown. |

## 2. Requirements traceability matrix

Status of each row is **proposed** unless the evidence column says an implementation exists. Test IDs are planned, not yet written; none has run.

| Req | Requirement | Basis / existing artifact | Workflow(s) (proposed names) | Data fields | Test(s) |
|---|---|---|---|---|---|
| R-ALX-01 | Dedupe source event; one journey per (tenant, source, externalId). | Portal `leads/intake.ts` dedupe key `lead_webhook:tenant:source:externalId` (existing); n8n side proposed | `alex-intake` | source.external_id, event_id, endCustomers.leadSource | T-ALX-01 duplicate form events -> one journey |
| R-ALX-02 | Suppress DNC/opt-out/ineligible owner (FL/OK owner state, not service address) before any attempt. | Portal gate exists; decision to move to n8n (automation-map B3) | `alex-policy`, shared `policy-decide` | endCustomers.callOptOut/smsOptOut, companies.state, companies.ownerGate | T-ALX-02 opted-out never called; T-ALX-03 FL/OK owner fixture vs address |
| R-ALX-03 | STOP between queue and transport blocks SMS; every send rechecks suppression and lease. | Proposed | `alex-dispatch` | Suppression, Automation Lease (both **proposed new**) | T-ALX-04 |
| R-ALX-04 | Quiet hours in contact timezone; unknown tz = no automated send. | `quiet-hours.ts` exists in portal; n8n proposed | `alex-policy` | subject.timezone (no Twenty field confirmed) | T-ALX-05 DST + unknown tz |
| R-ALX-05 | Acquire lease keyed (tenant, person, channel); active Emily call or Nurture denies. | Proposed | `alex-dispatch`, `JourneyCoordinator` | Automation Lease (new) | T-ALX-06 cross-system lease |
| R-ALX-06 | Tools cannot bypass policy; LLM prose never writes stage/booking. | Proposed | `alex-tool-gateway` | — | T-ALX-07 tool gateway rejects out-of-policy args; T-ALX-08 prompt-injection |
| R-ALX-07 | No blind redial; unknown call outcome reconciled before retry; attempt caps. | D-020 cadence (as built); n8n retry chain missing | `alex-retry`, `alex-reconcile` | endCustomers.attemptCount, nextAttemptAt | T-ALX-09 late busy receipt; T-ALX-10 timeout-then-reconcile |
| R-ALX-08 | Result ingest: outcome, transcript ref, summary distinguishes facts; transcript failure does not erase call fact. | Portal `/api/hooks/voice/[provider]` (existing, provider-signed) | `alex-result-ingest` | customerInteractions.*, callLogs.* | T-ALX-11 |
| R-ALX-09 | Won/lost cancels retries; transferred call pauses outreach; human handoff ends AI ownership. | Proposed | `alex-retry` | Task / Human Handoff (new) | T-ALX-12, T-ALX-13 |
| R-ALX-10 | Tenant A cannot invoke tenant B tools. | Portal RLS tests exist (`isolation.test.ts`); n8n side proposed | all | tenant_id on every record | T-ALX-14 |

## 3. Sandbox / mock stance

- All external effects go through the sink adapters (decision D-S03): payloads captured, stable fake provider IDs, non-test recipients rejected at the transport layer.
- Fixtures use `invalid.example` emails and `+1555010xxxx` numbers only; fixtures live in `fixtures/fake-tenant-a/` and `fake-tenant-b/` (not yet created).
- Prohibited targets never used by tests or sandbox code: Nora (`agent_4c34644a…`, `2PFWFqBM0wabADk6`), Emily (`agent_affef8…`, `0PwP1tUf4478lNbf`), live Alex `agent_8201…`, Kynetic Restoration (Demo).
- No Twenty REST `DELETE`; rollback = inactive status / isolation.

## 4. Open gaps and unknowns

- Which sender is authoritative (portal subscriber vs n8n) — `docs/portal-n8n-contract.md` says one sender must be chosen before n8n dispatch.
- Disclosure/recording wording is counsel-pending (KI-002, task 1.4); recording stays off in sandbox.
- Voice states diagram in spec has no existing implementation to compare.

## 5. Definition of done

See spec section 13 for this system and section 5.4 shared gate. Boxes are unchecked until test evidence exists on this branch.

