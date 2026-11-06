# Old-lead / database reactivation

> Proposal-status document. Service family: **Pipeline Conversion**. Source: handoff spec section 8.5 (`docs/systems/source-handoff-2026-11-06.md`). Evidence gathered read-only 2026-11-06. Nothing here activates or modifies a live system.

## 1. Evidence-backed current state

| Status | Evidence |
|---|---|
| EXISTING | Legacy Notion-based senders (archive, inactive): `kynetic-reactivation-sender__El2ku9XRVIwrbMBQ.json` (7 nodes), `kynetic-reactivation-reply-handler__qMB6WUFHf5y7HPel.json` (7 nodes, AI agent + Twilio). |
| EXISTING | Portal: `crm/src/server/automations/reactivation.ts`; CSV import `crm/src/server/imports/`, tests `import-workflow-m9.test.ts`, `unit/import-dry-run.test.ts`. |
| PARTIAL | Twenty native `messageLists`, `messageListMembers`, `messageCampaigns`, `campaignDeliveries`, `messageSuppressions` (email campaign model; no SMS cohort decision record). |
| MISSING | Cohort decision record, eligibility reason codes, reconciliation report builder, holdout. |

## 2. Requirements traceability matrix

Status of each row is **proposed** unless the evidence column says an implementation exists. Test IDs are planned, not yet written; none has run.

| Req | Requirement | Basis / existing artifact | Workflow(s) (proposed names) | Data fields | Test(s) |
|---|---|---|---|---|---|
| R-REA-01 | Cohort reconciliation: raw = unique + malformed/duplicates; unique = eligible + excluded, with reason codes. | Proposed | `reactivation-cohort`, `reactivation-audit` | Campaign cohort decision (new) | T-REA-01 |
| R-REA-02 | Global AM-1 suppression holds (rule/fixture label only). | Spec 2.4 | `reactivation-audit` | Suppression (global scope) | T-REA-02 |
| R-REA-03 | FL/OK owner eligibility separate from service address. | Spec 2.4 | `reactivation-audit` | companies.state / ownerGate | T-REA-03 |
| R-REA-04 | Historical opt-out/wrong number never reactivated; active quote excluded. | Proposed | `reactivation-cohort` | Suppression, Quote | T-REA-04 |
| R-REA-05 | New intent transfers atomically to Alex; pause stops next sends; each send rechecks state. | Proposed | `reactivation-dispatch` | Lease | T-REA-05, T-REA-06 |
| R-REA-06 | No real outreach in build; production launch needs separate yes. | Spec 8.5 | all | — | T-REA-07 transport sink only |

## 3. Sandbox / mock stance

- All external effects go through the sink adapters (decision D-S03): payloads captured, stable fake provider IDs, non-test recipients rejected at the transport layer.
- Fixtures use `invalid.example` emails and `+1555010xxxx` numbers only; fixtures live in `fixtures/fake-tenant-a/` and `fake-tenant-b/` (not yet created).
- Prohibited targets never used by tests or sandbox code: Nora (`agent_4c34644a…`, `2PFWFqBM0wabADk6`), Emily (`agent_affef8…`, `0PwP1tUf4478lNbf`), live Alex `agent_8201…`, Kynetic Restoration (Demo).
- No Twenty REST `DELETE`; rollback = inactive status / isolation.

## 4. Open gaps and unknowns

- Consent evidence for dormant leads varies by tenant; default exclude.

## 5. Definition of done

See spec section 13 for this system and section 5.4 shared gate. Boxes are unchecked until test evidence exists on this branch.

