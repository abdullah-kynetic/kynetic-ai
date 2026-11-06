# Long-term nurture

> Proposal-status document. Service family: **Pipeline Conversion**. Source: handoff spec section 8.6 (`docs/systems/source-handoff-2026-11-06.md`). Evidence gathered read-only 2026-11-06. Nothing here activates or modifies a live system.

## 1. Evidence-backed current state

| Status | Evidence |
|---|---|
| PARTIAL | Twenty native campaign objects (`messageCampaigns` with status/counts, `messageLists`, `campaignDeliveries` with bounce/complaint timestamps, `messageSuppressions`, `blocklists`) — email-oriented; metadata read 2026-11-06. |
| PARTIAL | Portal `crm/src/server/outbound/sequences.ts` (call/SMS step sequences) and `email/` module; no nurture track/content-version model. |
| MISSING | Track/subscription, content version/expiry, scheduler, engagement ingest. listmonk not evaluated or installed. |

## 2. Requirements traceability matrix

Status of each row is **proposed** unless the evidence column says an implementation exists. Test IDs are planned, not yet written; none has run.

| Req | Requirement | Basis / existing artifact | Workflow(s) (proposed names) | Data fields | Test(s) |
|---|---|---|---|---|---|
| R-NUR-01 | Explicit entry basis; approved content versions only; drafts cannot send. | Proposed | `nurture-entry`, `nurture-content` | Subscription/content version (new) | T-NUR-01 |
| R-NUR-02 | STOP/unsubscribe blocks queue immediately; re-entry obeys permission. | Proposed | `nurture-exit` | messageSuppressions, preference | T-NUR-02 |
| R-NUR-03 | Active quote/Alex/Emily conversation cancels send. | Proposed | `nurture-dispatch` | Lease | T-NUR-03 |
| R-NUR-04 | Duplicate scheduler runs -> one attempt; bounce mapped. | Proposed | `nurture-scheduler` | campaignDeliveries.state/bouncedAt | T-NUR-04, T-NUR-05 |
| R-NUR-05 | Intent handoff creates no duplicate lead/opportunity. | Proposed | `nurture-engagement` | — | T-NUR-06 |

## 3. Sandbox / mock stance

- All external effects go through the sink adapters (decision D-S03): payloads captured, stable fake provider IDs, non-test recipients rejected at the transport layer.
- Fixtures use `invalid.example` emails and `+1555010xxxx` numbers only; fixtures live in `fixtures/fake-tenant-a/` and `fake-tenant-b/` (not yet created).
- Prohibited targets never used by tests or sandbox code: Nora (`agent_4c34644a…`, `2PFWFqBM0wabADk6`), Emily (`agent_affef8…`, `0PwP1tUf4478lNbf`), live Alex `agent_8201…`, Kynetic Restoration (Demo).
- No Twenty REST `DELETE`; rollback = inactive status / isolation.

## 4. Open gaps and unknowns

- Whether to reuse Twenty `messageCampaigns` or a separate nurture object (decision D-S05).

## 5. Definition of done

See spec section 13 for this system and section 5.4 shared gate. Boxes are unchecked until test evidence exists on this branch.

