# Customer maintenance / service reminders

> Proposal-status document. Service family: **Customer Growth**. Source: handoff spec section 8.9 (`docs/systems/source-handoff-2026-11-06.md`). Evidence gathered read-only 2026-11-06. Nothing here activates or modifies a live system.

## 1. Evidence-backed current state

| Status | Evidence |
|---|---|
| MISSING | No customer-facing maintenance/warranty workflow found in repo, n8n VPS list, or Twenty objects. |
| PARTIAL | VPS `mMBRyfd3NiWLLLQI` "DEV - reminder" is an inactive appointment-reminder dev workflow (source not in repo); not a maintenance plan engine. |
| UNKNOWN | Original intent of "maintenance" is unrecoverable (spec 1.2); default = customer service/warranty reminders, internal maintenance in doc 14. |

## 2. Requirements traceability matrix

Status of each row is **proposed** unless the evidence column says an implementation exists. Test IDs are planned, not yet written; none has run.

| Req | Requirement | Basis / existing artifact | Workflow(s) (proposed names) | Data fields | Test(s) |
|---|---|---|---|---|---|
| R-MNT-01 | First onboarding decision: recurring service, warranty check-in, or disabled. | Spec 15 default | `maintenance-policy` | tenant_config.maintenance_mode | T-MNT-01 |
| R-MNT-02 | Recurrence correct across month-end, leap year, DST; scanner run twice -> one reminder. | Proposed | `maintenance-due-scanner` | Plan/asset (new), local tz | T-MNT-02, T-MNT-03 |
| R-MNT-03 | Completion cancels queued reminder; unknown history -> review, not overdue. | Proposed | `maintenance-completion-reconcile` | clientJobs.status | T-MNT-04, T-MNT-05 |
| R-MNT-04 | Service notice vs marketing classification respected; snooze honored. | Proposed | `maintenance-reminder` | preference | T-MNT-06 |

## 3. Sandbox / mock stance

- All external effects go through the sink adapters (decision D-S03): payloads captured, stable fake provider IDs, non-test recipients rejected at the transport layer.
- Fixtures use `invalid.example` emails and `+1555010xxxx` numbers only; fixtures live in `fixtures/fake-tenant-a/` and `fake-tenant-b/` (not yet created).
- Prohibited targets never used by tests or sandbox code: Nora (`agent_4c34644a…`, `2PFWFqBM0wabADk6`), Emily (`agent_affef8…`, `0PwP1tUf4478lNbf`), live Alex `agent_8201…`, Kynetic Restoration (Demo).
- No Twenty REST `DELETE`; rollback = inactive status / isolation.

## 4. Open gaps and unknowns

- Niche interpretation must be confirmed before template approval.

## 5. Definition of done

See spec section 13 for this system and section 5.4 shared gate. Boxes are unchecked until test evidence exists on this branch.

