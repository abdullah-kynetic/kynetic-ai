# Scheduling

> Proposal-status document. Service family: **Revenue Infrastructure**. Source: handoff spec section 8.11 (`docs/systems/source-handoff-2026-11-06.md`). Evidence gathered read-only 2026-11-06. Nothing here activates or modifies a live system.

## 1. Evidence-backed current state

| Status | Evidence |
|---|---|
| EXISTING | Cal.com is calendar authority (free plan). Event types: Roof Inspection `7404470` (Retell), ElevenLabs test `7520336`, Emily Water Damage `7025524` (KYNETIC_CONTEXT.md, memory). |
| EXISTING | Portal availability/booking: `crm/src/server/appointments/{availability,events,service}.ts`; tests `crm/tests/unit/appointments-availability.test.ts`, `crm/tests/integration` (deal stage rule M13-06). automation-map B6 = partial; Cal.com sync mapping not confirmed. |
| EXISTING | VPS `3RdmNRxd17POGzlB` "Cal.com | Booking SMS (Twilio)" inactive (built inactive 2026-10-22). |
| MISSING | Resource lock, ETag/hold, reconcile-by-external-id, revision history, concurrent-booking test. |

## 2. Requirements traceability matrix

Status of each row is **proposed** unless the evidence column says an implementation exists. Test IDs are planned, not yet written; none has run.

| Req | Requirement | Basis / existing artifact | Workflow(s) (proposed names) | Data fields | Test(s) |
|---|---|---|---|---|---|
| R-SCH-01 | Offer only backend-returned slots; revalidate free/busy at confirm. | Proposed | `schedule-availability`, `schedule-book` | Appointment (new): external id, revision, tz | T-SCH-01 stale offer revalidates |
| R-SCH-02 | Two simultaneous same selections -> one confirmation. | Proposed | `schedule-book` | resource lock | T-SCH-02 concurrency |
| R-SCH-03 | Provider timeout reconciles before retry; no duplicate. | Proposed | `schedule-reconcile` | command idempotency key | T-SCH-03 |
| R-SCH-04 | Reschedule keeps one appointment ID with history; cancel stops reminders. | Proposed | `schedule-event-ingest`, `schedule-reminders` | revision | T-SCH-04, T-SCH-05 |
| R-SCH-05 | Full timestamp + IANA zone; DST/leap day correct. | Proposed | all | start/end/timezone | T-SCH-06 |
| R-SCH-06 | `allow_external_write=false` rejects writes at the adapter. | Spec 3.6 | CalendarAdapter | policy.allow_external_write | T-SCH-07 |
| R-SCH-07 | Tenant A cannot touch B calendar. | Spec 4.4 | all | tenant_id | T-SCH-08 |

## 3. Sandbox / mock stance

- All external effects go through the sink adapters (decision D-S03): payloads captured, stable fake provider IDs, non-test recipients rejected at the transport layer.
- Fixtures use `invalid.example` emails and `+1555010xxxx` numbers only; fixtures live in `fixtures/fake-tenant-a/` and `fake-tenant-b/` (not yet created).
- Prohibited targets never used by tests or sandbox code: Nora (`agent_4c34644a…`, `2PFWFqBM0wabADk6`), Emily (`agent_affef8…`, `0PwP1tUf4478lNbf`), live Alex `agent_8201…`, Kynetic Restoration (Demo).
- No Twenty REST `DELETE`; rollback = inactive status / isolation.

## 4. Open gaps and unknowns

- Cal.com free plan limits (webhooks, workflows) to verify; Cal.com ETag/hold support unverified.

## 5. Definition of done

See spec section 13 for this system and section 5.4 shared gate. Boxes are unchecked until test evidence exists on this branch.

