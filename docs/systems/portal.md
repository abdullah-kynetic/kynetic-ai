# Standard portal integration

> Proposal-status document. Service family: **Platform & Engagement Services**. Source: handoff spec section 7, 10 (`docs/systems/source-handoff-2026-11-06.md`). Evidence gathered read-only 2026-11-06. Nothing here activates or modifies a live system.

## 1. Evidence-backed current state

| Status | Evidence |
|---|---|
| EXISTING | Portal in `crm/` with n8n contract `docs/portal-n8n-contract.md`: lead intake `POST /api/hooks/leads/{tenantId}` (HMAC `timestamp.rawBody`, ±300 s), portal->n8n events (`lead.created`, `deal.stage_changed`, `call.completed`) in `crm/src/server/integrations/n8n.ts`, service reads `GET /api/service/contacts/{id}`, provider hooks, availability/book. |
| PARTIAL | Most contracts in the table (contact-decisions, call-results, opt-outs, payments, ...) are "target"; `contact-decisions` and `contact-policy` have modules (`crm/src/server/contact-decisions`, `contact-policy`) with tests `contact-decisions-m12.test.ts`, `contact-policy-m12.test.ts`. |
| CONFLICT | Portal currently runs open mode with no sign-in on main (KI-013) vs commits 2026-11-04 restoring sign-in (`d9e2323`). Live portal state not verified here. |
| CONFLICT | Spec says Twenty is sole operational record; portal has its own Postgres contacts/deals. Needs decision D-S02. |

## 2. Requirements traceability matrix

Status of each row is **proposed** unless the evidence column says an implementation exists. Test IDs are planned, not yet written; none has run.

| Req | Requirement | Basis / existing artifact | Workflow(s) (proposed names) | Data fields | Test(s) |
|---|---|---|---|---|---|
| R-POR-01 | Automation works with portal down; projection failures retry independently. | Spec 3.2 | projection consumer | — | T-POR-01 (E2E #10) |
| R-POR-02 | Portal writes are controlled idempotent commands; tenant from session. | Spec 7.1 | command API | — | T-POR-02 |
| R-POR-03 | Server-side RBAC for object/field/action. | Spec 7.2 | — | — | T-POR-03 |
| R-POR-04 | Versioned JSON-schema contracts exposed before UI work. | Spec 10.2 | — | — | T-POR-04 schema validation |

## 3. Sandbox / mock stance

- All external effects go through the sink adapters (decision D-S03): payloads captured, stable fake provider IDs, non-test recipients rejected at the transport layer.
- Fixtures use `invalid.example` emails and `+1555010xxxx` numbers only; fixtures live in `fixtures/fake-tenant-a/` and `fake-tenant-b/` (not yet created).
- Prohibited targets never used by tests or sandbox code: Nora (`agent_4c34644a…`, `2PFWFqBM0wabADk6`), Emily (`agent_affef8…`, `0PwP1tUf4478lNbf`), live Alex `agent_8201…`, Kynetic Restoration (Demo).
- No Twenty REST `DELETE`; rollback = inactive status / isolation.

## 4. Open gaps and unknowns

- Bespoke portal is a separate scope (spec 10.3).

## 5. Definition of done

See spec section 13 for this system and section 5.4 shared gate. Boxes are unchecked until test evidence exists on this branch.

