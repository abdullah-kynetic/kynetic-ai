# Custom AI, back-office and full transformation / on-site

> Proposal-status document. Service family: **Platform & Engagement Services**. Source: handoff spec section 11 (`docs/systems/source-handoff-2026-11-06.md`). Evidence gathered read-only 2026-11-06. Nothing here activates or modifies a live system.

## 1. Evidence-backed current state

| Status | Evidence |
|---|---|
| MISSING | Scoping category only; no artifacts. Existing related: `docs/plan1-walkthrough.md`, `docs/PRD.md`. |
| EXISTING | Back-office candidates observed in the repo: Porchlight card payment workflows (`n8n/workflows/active/porchlight-card-*.json`, other client; not Kynetic template). |

## 2. Requirements traceability matrix

Status of each row is **proposed** unless the evidence column says an implementation exists. Test IDs are planned, not yet written; none has run.

| Req | Requirement | Basis / existing artifact | Workflow(s) (proposed names) | Data fields | Test(s) |
|---|---|---|---|---|---|
| R-CUS-01 | Each custom AI recipe names owner, corpus, tools, evals, caps. | Spec 11.1 | — | — | T-CUS-01 recipe checklist lint |
| R-CUS-02 | No autonomous contract/discount/legal/financial representation; HITL on high-risk. | Spec 11.1, project guardrail | — | — | T-CUS-02 |
| R-CUS-03 | Transformation as bounded workstreams with SOW boundaries. | Spec 11.3 | — | — | T-CUS-03 |

## 3. Sandbox / mock stance

- All external effects go through the sink adapters (decision D-S03): payloads captured, stable fake provider IDs, non-test recipients rejected at the transport layer.
- Fixtures use `invalid.example` emails and `+1555010xxxx` numbers only; fixtures live in `fixtures/fake-tenant-a/` and `fake-tenant-b/` (not yet created).
- Prohibited targets never used by tests or sandbox code: Nora (`agent_4c34644a…`, `2PFWFqBM0wabADk6`), Emily (`agent_affef8…`, `0PwP1tUf4478lNbf`), live Alex `agent_8201…`, Kynetic Restoration (Demo).
- No Twenty REST `DELETE`; rollback = inactive status / isolation.

## 4. Open gaps and unknowns

- Priced scope intentionally absent.

## 5. Definition of done

See spec section 13 for this system and section 5.4 shared gate. Boxes are unchecked until test evidence exists on this branch.

