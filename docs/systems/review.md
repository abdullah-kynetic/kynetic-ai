# Reputation / review automation

> Proposal-status document. Service family: **Customer Growth**. Source: handoff spec section 8.7 (`docs/systems/source-handoff-2026-11-06.md`). Evidence gathered read-only 2026-11-06. Nothing here activates or modifies a live system.

## 1. Evidence-backed current state

| Status | Evidence |
|---|---|
| EXISTING | Legacy chain (archive, inactive, 15 nodes): `n8n/workflows/archive/kynetic-review-request-response-referral-chain__477BKA79couMRF51.json`. |
| PARTIAL | Portal `crm/src/server/presence/index.ts` has `reviewSnapshots` table (review counts snapshot), tests `crm/tests/integration/presence.test.ts`. |
| MISSING | Review request job (automation-map B14, decided 2026-10-31: 2 hours after payment received; email until A2P). Completion trigger, eligibility, neutral template, reconcile. |
| EXISTING | Twenty `clientJobs.status`, `invoices.paidAt/status` as candidate completion/payment evidence. |

## 2. Requirements traceability matrix

Status of each row is **proposed** unless the evidence column says an implementation exists. Test IDs are planned, not yet written; none has run.

| Req | Requirement | Basis / existing artifact | Workflow(s) (proposed names) | Data fields | Test(s) |
|---|---|---|---|---|---|
| R-REV-01 | Request sent to all operationally eligible customers regardless of sentiment. | Spec 8.7 | `review-eligibility` | clientJobs.status | T-REV-01 equal eligibility fixtures |
| R-REV-02 | No gating, no incentive, no private-feedback diversion. | Spec 8.7 | `review-request` | — | T-REV-02 static check of branches |
| R-REV-03 | Missing profile link holds request; never invent URL. | Proposed | `review-request` | tenant_config.review_profile_urls | T-REV-03 |
| R-REV-04 | Duplicate completion -> one request; cancelled/reopened job excluded. | Proposed | `review-completion` | clientJobs | T-REV-04 |
| R-REV-05 | Click without observable review not counted as a posted review. | Proposed | `review-reconcile` | reviewSnapshots | T-REV-05 |
| R-REV-06 | Coverage-by-segment audit proves no sentiment selection. | Proposed | `review-reconcile` | — | T-REV-06 |

## 3. Sandbox / mock stance

- All external effects go through the sink adapters (decision D-S03): payloads captured, stable fake provider IDs, non-test recipients rejected at the transport layer.
- Fixtures use `invalid.example` emails and `+1555010xxxx` numbers only; fixtures live in `fixtures/fake-tenant-a/` and `fake-tenant-b/` (not yet created).
- Prohibited targets never used by tests or sandbox code: Nora (`agent_4c34644a…`, `2PFWFqBM0wabADk6`), Emily (`agent_affef8…`, `0PwP1tUf4478lNbf`), live Alex `agent_8201…`, Kynetic Restoration (Demo).
- No Twenty REST `DELETE`; rollback = inactive status / isolation.

## 4. Open gaps and unknowns

- Counsel/platform terms review for anti-gating (task 1.4 adjacent).

## 5. Definition of done

See spec section 13 for this system and section 5.4 shared gate. Boxes are unchecked until test evidence exists on this branch.

