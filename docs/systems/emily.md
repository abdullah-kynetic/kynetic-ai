# Inbound receptionist Emily

> Proposal-status document. Service family: **Revenue Response**. Source: handoff spec section 8.2 (`docs/systems/source-handoff-2026-11-06.md`). Evidence gathered read-only 2026-11-06. Nothing here activates or modifies a live system.

## 1. Evidence-backed current state

| Status | Evidence |
|---|---|
| EXISTING | Legacy Retell-era workflow copy (archive only, 40 nodes incl. 8 Notion nodes): `n8n/workflows/archive/emily-restoration-speed-to-lead__0PwP1tUf4478lNbf.json`; VPS `hK3skYh0R06LLJvd` inactive. KI-004: 13 Notion nodes. Not to be edited. |
| EXISTING | Build handoff doc `retell/builds/emily-speed-to-lead/HANDOFF.md` and `snapshot-2026-09-28/` (read-only reference). |
| UNKNOWN | Live Emily agent `agent_affef8…` was **not inspected** (prohibited). Behavior beyond the repo snapshot is unknown. |
| MISSING | No net-new sandbox receptionist, FAQ schema, identity-verification policy, message/transfer fallback or simulated inbound harness. |
| EXISTING | Twenty has native `messages`, `messageThreads`, `tasks`, `callLogs`, `callRecordings` objects usable for message/callback records (`mcp Twenty get_object_metadata`, 2026-11-06). |

## 2. Requirements traceability matrix

Status of each row is **proposed** unless the evidence column says an implementation exists. Test IDs are planned, not yet written; none has run.

| Req | Requirement | Basis / existing artifact | Workflow(s) (proposed names) | Data fields | Test(s) |
|---|---|---|---|---|---|
| R-EMY-01 | Net-new sandbox receptionist only; live Emily untouched. | Spec 2.2, 8.2 | `reception-inbound` | — | T-EMY-01 static scan: no `agent_affef8` / `0PwP1tUf4478lNbf` in new code |
| R-EMY-02 | Existing-customer lookup requires verified identifiers, not caller ID alone. | Proposed | `reception-identity` | people.phones/emails; endCustomers | T-EMY-02 spoofed caller ID gets no private data |
| R-EMY-03 | Take structured message; transfer urgent calls; failed transfer -> one task + message. | Proposed | `reception-tools`, `reception-transfer-fallback` | tasks.*, messages.* | T-EMY-03 transfer timeout |
| R-EMY-04 | Two inbound calls from same caller do not merge appointments. | Proposed | `reception-identity` | Conversation (new) | T-EMY-04 |
| R-EMY-05 | Active Emily conversation denies Alex/nurture/text-back. | Proposed | `JourneyCoordinator` | Automation Lease (new) | T-EMY-05 (shared with T-ALX-06) |
| R-EMY-06 | Summaries separate caller statements from confirmed facts; no emergency claims. | Proposed | `reception-after-call` | customerInteractions.summary | T-EMY-06 summary-schema test |
| R-EMY-07 | Cancellation respects appointment revision. | Proposed | `reception-tools` + scheduling | Appointment revision (new) | T-EMY-07 |

## 3. Sandbox / mock stance

- All external effects go through the sink adapters (decision D-S03): payloads captured, stable fake provider IDs, non-test recipients rejected at the transport layer.
- Fixtures use `invalid.example` emails and `+1555010xxxx` numbers only; fixtures live in `fixtures/fake-tenant-a/` and `fake-tenant-b/` (not yet created).
- Prohibited targets never used by tests or sandbox code: Nora (`agent_4c34644a…`, `2PFWFqBM0wabADk6`), Emily (`agent_affef8…`, `0PwP1tUf4478lNbf`), live Alex `agent_8201…`, Kynetic Restoration (Demo).
- No Twenty REST `DELETE`; rollback = inactive status / isolation.

## 4. Open gaps and unknowns

- Legacy Emily behavior unknown; design is net-new only.
- Plan 2 is paused (D-013); Emily is [P2].

## 5. Definition of done

See spec section 13 for this system and section 5.4 shared gate. Boxes are unchecked until test evidence exists on this branch.

