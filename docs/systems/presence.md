# Online presence

> Proposal-status document. Service family: **Acquisition & Visibility**. Source: handoff spec section 8.12 (`docs/systems/source-handoff-2026-11-06.md`). Evidence gathered read-only 2026-11-06. Nothing here activates or modifies a live system.

## 1. Evidence-backed current state

| Status | Evidence |
|---|---|
| PARTIAL | Portal `crm/src/server/presence/index.ts`: presence items (profile, review_site, directory, social_post; status planned..needs_attention) and review snapshots; test `crm/tests/integration/presence.test.ts`. Task-list style, no canonical-fact/discrepancy model. |
| EXISTING | Marketing site is live on www.kyneticai.com via Cloudflare Pages `kyneticai-preview` (memory 2026-11-05). DNS changes need approval. |
| MISSING | Canonical business facts, profile inventory, discrepancy detection, change-approval queue, UTM capture convention. |

## 2. Requirements traceability matrix

Status of each row is **proposed** unless the evidence column says an implementation exists. Test IDs are planned, not yet written; none has run.

| Req | Requirement | Basis / existing artifact | Workflow(s) (proposed names) | Data fields | Test(s) |
|---|---|---|---|---|---|
| R-PRS-01 | Hours change creates a proposal only; approval gates enforced. | Spec 8.12 | `presence-change-request` | Canonical fact version (new) | T-PRS-01 |
| R-PRS-02 | Unsupported scraping/posting prohibited; missing API -> manual task. | Spec 8.12 | `presence-monitor` | — | T-PRS-02 |
| R-PRS-03 | Location A facts cannot affect B. | Proposed | all | location_id, tenant_id | T-PRS-03 |
| R-PRS-04 | UTM capture deterministic; DNS/site production op impossible in sandbox. | Spec 8.12 | `presence-verify` | — | T-PRS-04, T-PRS-05 |

## 3. Sandbox / mock stance

- All external effects go through the sink adapters (decision D-S03): payloads captured, stable fake provider IDs, non-test recipients rejected at the transport layer.
- Fixtures use `invalid.example` emails and `+1555010xxxx` numbers only; fixtures live in `fixtures/fake-tenant-a/` and `fake-tenant-b/` (not yet created).
- Prohibited targets never used by tests or sandbox code: Nora (`agent_4c34644a…`, `2PFWFqBM0wabADk6`), Emily (`agent_affef8…`, `0PwP1tUf4478lNbf`), live Alex `agent_8201…`, Kynetic Restoration (Demo).
- No Twenty REST `DELETE`; rollback = inactive status / isolation.

## 4. Open gaps and unknowns

- Provider/vendor API capabilities unverified (Google Business Profile etc.).

## 5. Definition of done

See spec section 13 for this system and section 5.4 shared gate. Boxes are unchecked until test evidence exists on this branch.

