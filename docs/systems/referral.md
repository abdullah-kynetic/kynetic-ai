# Referral automation

> Proposal-status document. Service family: **Customer Growth**. Source: handoff spec section 8.8 (`docs/systems/source-handoff-2026-11-06.md`). Evidence gathered read-only 2026-11-06. Nothing here activates or modifies a live system.

## 1. Evidence-backed current state

| Status | Evidence |
|---|---|
| PARTIAL | Referral step lives inside the legacy review chain `477BKA79couMRF51` (archive, inactive). |
| MISSING | Share token, self-serve form, dedupe/attribution, reward review. Twenty has `leadSource` selects only; no referral object. |

## 2. Requirements traceability matrix

Status of each row is **proposed** unless the evidence column says an implementation exists. Test IDs are planned, not yet written; none has run.

| Req | Requirement | Basis / existing artifact | Workflow(s) (proposed names) | Data fields | Test(s) |
|---|---|---|---|---|---|
| R-REF-01 | Eligibility independent of review sentiment; any service-recovery hold applied uniformly. | Spec 8.8 | `referral-eligibility` | — | T-REF-01 |
| R-REF-02 | Referee self-submits with consent; no outreach from third-party-uploaded contacts. | Spec 8.8 | `referral-self-serve-intake` | Consent Grant | T-REF-02 |
| R-REF-03 | Tokens scoped, unguessable, tenant-bound. | Proposed | `referral-invite` | Referral token (new) | T-REF-03 tamper/cross-tenant |
| R-REF-04 | Self/duplicate referrals and existing active leads go to review; original source preserved. | Proposed | `referral-dedupe` | leadSource, source touches | T-REF-04, T-REF-05 |
| R-REF-05 | Reward cannot auto-settle. | Spec 8.8 | `referral-reward-review` | — | T-REF-06 |

## 3. Sandbox / mock stance

- All external effects go through the sink adapters (decision D-S03): payloads captured, stable fake provider IDs, non-test recipients rejected at the transport layer.
- Fixtures use `invalid.example` emails and `+1555010xxxx` numbers only; fixtures live in `fixtures/fake-tenant-a/` and `fake-tenant-b/` (not yet created).
- Prohibited targets never used by tests or sandbox code: Nora (`agent_4c34644a…`, `2PFWFqBM0wabADk6`), Emily (`agent_affef8…`, `0PwP1tUf4478lNbf`), live Alex `agent_8201…`, Kynetic Restoration (Demo).
- No Twenty REST `DELETE`; rollback = inactive status / isolation.

## 4. Open gaps and unknowns

- First niche remodelers: referral/maintenance enablement decision pending (spec 15).

## 5. Definition of done

See spec section 13 for this system and section 5.4 shared gate. Boxes are unchecked until test evidence exists on this branch.

