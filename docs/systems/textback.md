# Missed-call text-back

> Proposal-status document. Service family: **Revenue Response**. Source: handoff spec section 8.3 (`docs/systems/source-handoff-2026-11-06.md`). Evidence gathered read-only 2026-11-06. Nothing here activates or modifies a live system.

## 1. Evidence-backed current state

| Status | Evidence |
|---|---|
| EXISTING | Legacy Notion-based workflow (13 nodes, inactive archive): `n8n/workflows/archive/kynetic-missed-call-text-back__9hFHRndsWStlqVYm.json`. |
| EXISTING | Portal code: `crm/src/server/automations/missed-call-textback.ts`, `rules.ts`, `after-hours.ts`; tests `crm/tests/integration/automation-retries-m7.test.ts`, `m7-module-acceptance.test.ts`. automation-map B13 = partial, cannot send until SMS works. |
| EXISTING | VPS DEV workflow `p9gPYyRPtd00Wt0h` "DEV - missed-call" (inactive, created 2026-11-05). Its repo source was **not found** in `n8n/workflows/dev/` (only setup-safety-check and elevenlabs-speed-to-lead are there). |
| EXISTING | Twilio A2P campaign CJUDEQY verified 2026-10-28 (memory, Abdullah). `docs/known-issues.md` KI-003 still says "not registered": **conflict, flagged**. |
| EXISTING | `n8n/workflows/archive/kynetic-restoration-inbound-sms-opt-out-handler__DaOVUpSChkjaNg3B.json` (5 nodes, inactive) and portal `/api/hooks/twilio/inbound` (`messaging/twilio-hooks.ts`). |

## 2. Requirements traceability matrix

Status of each row is **proposed** unless the evidence column says an implementation exists. Test IDs are planned, not yet written; none has run.

| Req | Requirement | Basis / existing artifact | Workflow(s) (proposed names) | Data fields | Test(s) |
|---|---|---|---|---|---|
| R-MCT-01 | Send only for provider-confirmed missed calls; exclude hangups, spam, internal numbers, receptionist-handled calls. | Proposed | `textback-event-filter` | Outreach Attempt (new), callLogs.outcome | T-MCT-01 filters |
| R-MCT-02 | Repeated provider webhooks send once; cooldown per number. | Proposed | `textback-policy` | idempotency key | T-MCT-02 |
| R-MCT-03 | Answered-later cancels queued text. | Proposed | `textback-send` | callLogs | T-MCT-03 |
| R-MCT-04 | Consent posture is counsel-approved per tenant; call is not promo SMS consent. | Proposed | `textback-policy` | Consent Grant (new) | T-MCT-04 |
| R-MCT-05 | STOP mid-flow suppresses all systems immediately. | Existing portal hook; shared n8n `suppression-ingest` proposed | `suppression-ingest` | endCustomers.smsOptOut(+Date), messageSuppressions (email-only today) | T-MCT-05 |
| R-MCT-06 | Replies go to a human task unless approved narrow automation; segment count metered. | Proposed | `textback-reply` | tasks.*, Usage Ledger (new) | T-MCT-06, T-MCT-07 metering |

## 3. Sandbox / mock stance

- All external effects go through the sink adapters (decision D-S03): payloads captured, stable fake provider IDs, non-test recipients rejected at the transport layer.
- Fixtures use `invalid.example` emails and `+1555010xxxx` numbers only; fixtures live in `fixtures/fake-tenant-a/` and `fake-tenant-b/` (not yet created).
- Prohibited targets never used by tests or sandbox code: Nora (`agent_4c34644a…`, `2PFWFqBM0wabADk6`), Emily (`agent_affef8…`, `0PwP1tUf4478lNbf`), live Alex `agent_8201…`, Kynetic Restoration (Demo).
- No Twenty REST `DELETE`; rollback = inactive status / isolation.

## 4. Open gaps and unknowns

- `messageSuppressions` in Twenty has only `emailAddress` (no phone), so SMS suppression needs a new object or field (decision D-S04).
- Verify Twilio missed-call semantics (voice status callback values) against current docs.

## 5. Definition of done

See spec section 13 for this system and section 5.4 shared gate. Boxes are unchecked until test evidence exists on this branch.

