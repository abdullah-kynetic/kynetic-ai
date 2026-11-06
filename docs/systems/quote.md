# Quote follow-up

> Proposal-status document. Service family: **Pipeline Conversion**. Source: handoff spec section 8.4 (`docs/systems/source-handoff-2026-11-06.md`). Evidence gathered read-only 2026-11-06. Nothing here activates or modifies a live system.

## 1. Evidence-backed current state

| Status | Evidence |
|---|---|
| PARTIAL | Twenty `opportunities.stage` includes PROPOSAL_SENT (KYNETIC_CONTEXT.md) with amount, closeDate; no quote revision/expiry fields found. |
| PARTIAL | Portal proposal drafts: `crm/src/server/proposals/index.ts`, test `crm/tests/integration/proposals-m17.test.ts` (agency-side proposals, not client quotes). |
| EXISTING | Legacy demo `n8n/workflows/archive/8-invoice-follow-up-summit-ridge-roofing-demo__W3dg1rJVsxDZ1154.json` (invoice, not quote). |
| MISSING | Quote intake/revision state machine, cadence scheduler, reply classifier, terminal-state cancellation. |

## 2. Requirements traceability matrix

Status of each row is **proposed** unless the evidence column says an implementation exists. Test IDs are planned, not yet written; none has run.

| Req | Requirement | Basis / existing artifact | Workflow(s) (proposed names) | Data fields | Test(s) |
|---|---|---|---|---|---|
| R-QUO-01 | Follow up only on a real active quote; revision invalidates older cadence. | Proposed | `quote-intake`, `quote-scheduler` | Quote revision/expiry (new) | T-QUO-01 revised quote cancels old cadence |
| R-QUO-02 | Accepted/declined between queue and send blocks message. | Proposed | `quote-send`, `quote-state-watcher` | opportunities.stage | T-QUO-02 |
| R-QUO-03 | No discount/scope fabrication; discount authority default none. | Proposed | `quote-reply` | tenant_config.discount_authority | T-QUO-03 |
| R-QUO-04 | Lost quote gets no nurture without valid basis. | Proposed | `quote-closeout` | opportunities.lostReason | T-QUO-04 |
| R-QUO-05 | Human takeover persists across scheduled jobs. | Proposed | `quote-state-watcher` | Automation Lease | T-QUO-05 |
| R-QUO-06 | Duplicate quote webhook -> one journey; two revisions cannot interleave. | Proposed | `quote-intake` | idempotency key | T-QUO-06 |

## 3. Sandbox / mock stance

- All external effects go through the sink adapters (decision D-S03): payloads captured, stable fake provider IDs, non-test recipients rejected at the transport layer.
- Fixtures use `invalid.example` emails and `+1555010xxxx` numbers only; fixtures live in `fixtures/fake-tenant-a/` and `fake-tenant-b/` (not yet created).
- Prohibited targets never used by tests or sandbox code: Nora (`agent_4c34644a…`, `2PFWFqBM0wabADk6`), Emily (`agent_affef8…`, `0PwP1tUf4478lNbf`), live Alex `agent_8201…`, Kynetic Restoration (Demo).
- No Twenty REST `DELETE`; rollback = inactive status / isolation.

## 4. Open gaps and unknowns

- Quote source (client estimate tool) unknown per tenant.

## 5. Definition of done

See spec section 13 for this system and section 5.4 shared gate. Boxes are unchecked until test evidence exists on this branch.

