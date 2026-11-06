# Ads management and tooling

> Proposal-status document. Service family: **Acquisition & Visibility**. Source: handoff spec section 8.13 (`docs/systems/source-handoff-2026-11-06.md`). Evidence gathered read-only 2026-11-06. Nothing here activates or modifies a live system.

## 1. Evidence-backed current state

| Status | Evidence |
|---|---|
| PARTIAL | Lead-sourcing from Meta Ad Library only: `tools/lead_engine.py`, `tools/lead_census.py` (Treg census). This is prospecting, not client-ad reporting. |
| MISSING | No ad-platform read connector, normalization, anomaly or attribution workflow. No client ad account access recorded. |
| EXISTING | Twenty `opportunities.leadSource`, `endCustomers.leadSource`, `companies.metaAdsActive/liveAds/newAds30d` as lead-source fields. |

## 2. Requirements traceability matrix

Status of each row is **proposed** unless the evidence column says an implementation exists. Test IDs are planned, not yet written; none has run.

| Req | Requirement | Basis / existing artifact | Workflow(s) (proposed names) | Data fields | Test(s) |
|---|---|---|---|---|---|
| R-ADS-01 | Read-only credential cannot mutate; UI-injected action denied. | Spec 8.13 | `ads-read-connector` | — | T-ADS-01 |
| R-ADS-02 | Duplicate daily metrics not summed; timezone/currency mismatch quarantines. | Proposed | `ads-normalize` | observed metric/date range/currency | T-ADS-02, T-ADS-03 |
| R-ADS-03 | Unknown outcomes stay unknown, not zero; media spend separate from usage credits. | Spec 5.3 | `ads-attribution` | — | T-ADS-04, T-ADS-05 |
| R-ADS-04 | Proposed change cannot run in MVP. | Spec 8.13 | `ads-approval` | — | T-ADS-06 |

## 3. Sandbox / mock stance

- All external effects go through the sink adapters (decision D-S03): payloads captured, stable fake provider IDs, non-test recipients rejected at the transport layer.
- Fixtures use `invalid.example` emails and `+1555010xxxx` numbers only; fixtures live in `fixtures/fake-tenant-a/` and `fake-tenant-b/` (not yet created).
- Prohibited targets never used by tests or sandbox code: Nora (`agent_4c34644a…`, `2PFWFqBM0wabADk6`), Emily (`agent_affef8…`, `0PwP1tUf4478lNbf`), live Alex `agent_8201…`, Kynetic Restoration (Demo).
- No Twenty REST `DELETE`; rollback = inactive status / isolation.

## 4. Open gaps and unknowns

- Client ad account access and API tier unknown.

## 5. Definition of done

See spec section 13 for this system and section 5.4 shared gate. Boxes are unchecked until test evidence exists on this branch.

