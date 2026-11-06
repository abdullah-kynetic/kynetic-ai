# One configurable CRM deliverable

> Proposal-status document. Service family: **Revenue Infrastructure**. Source: handoff spec section 8.10 (`docs/systems/source-handoff-2026-11-06.md`). Evidence gathered read-only 2026-11-06. Nothing here activates or modifies a live system.

## 1. Evidence-backed current state

| Status | Evidence |
|---|---|
| EXISTING | Self-hosted Twenty v2.46.0 at crm.kyneticai.com (KYNETIC_CONTEXT.md); metadata read via MCP 2026-11-06: 47 objects. Custom: clientAccounts, clientJobs, endCustomers, customerInteractions, callLogs, invoices, expenses, plus campaign objects (messageCampaigns, messageLists, messageListMembers, campaignDeliveries, messageSuppressions, shortLinks). |
| EXISTING | Custom fields on native objects: `companies` (niche, market, ownerGate, leadStatus, engineStatus, metaPageId, liveAds, estAdSpend* etc., `state`), `opportunities` (stage, tier, mrr, services, leadSource, dialer, lostReason), `people.contactRole`. |
| EXISTING | n8n VPS credentials: "Twenty self-hosted (crm.kyneticai.com)" `VkjEQ40fTrOdTqxa` (twentyApi), "Twenty Webhook account" `99IZTRvHXaMAtTel`. Names only; no values read. |
| EXISTING | Active VPS workflow `WxIh0Hw4lQodY1Xa` "Website | Contact Form to Twenty" (active, 1 trigger). |
| EXISTING | Client portal app `crm/` (Next.js, Drizzle/Postgres) with its own contacts/deals/RLS; this is **a second contact store** vs Twenty (conflict with "sole system of record" — decision D-S02). |
| CONFLICT | `.env.example:18`, `AGENTS.md:24`, `scripts/checks/checks.py:136` use `TWENTY_API_KEY`; spec and standing rules say only `TWENTY_BASE_URL` / `TWENTY_SELFHOST_API_KEY`. Not changed (docs/known-issues rule: do not fix on own initiative); flagged. |

## 2. Requirements traceability matrix

Status of each row is **proposed** unless the evidence column says an implementation exists. Test IDs are planned, not yet written; none has run.

| Req | Requirement | Basis / existing artifact | Workflow(s) (proposed names) | Data fields | Test(s) |
|---|---|---|---|---|---|
| R-CRM-01 | Read-only metadata preflight before any field work; no custom fields before approved delta. | Spec 8.10 | `crm-metadata-validator` | get_object_metadata snapshot | T-CRM-01 snapshot diff |
| R-CRM-02 | Repeated source -> no duplicate; stale revision never regresses stage. | Proposed | `crm-normalize-dedupe`, `crm-sync-out` | external ID/version (new) | T-CRM-02, T-CRM-03 |
| R-CRM-03 | Opt-out survives all syncs (most restrictive wins). | Spec 6.3 | `crm-conflict` | callOptOut, smsOptOut | T-CRM-04 |
| R-CRM-04 | No REST DELETE emitted anywhere, incl. tests/rollback. | Standing rule | all | — | T-CRM-05 static scan + HTTP-sink assertion |
| R-CRM-05 | Forbidden sensitive fields not copied. | Spec 2.4 | `crm-source-ingress` | field allowlist | T-CRM-06 |
| R-CRM-06 | Synthetic import totals reconcile; export works. | Spec 8.10 | `crm-reconcile` | — | T-CRM-07 |
| R-CRM-07 | Tenant isolation. | Spec 4.4 | all | tenant_id | T-CRM-08 |

## 3. Sandbox / mock stance

- All external effects go through the sink adapters (decision D-S03): payloads captured, stable fake provider IDs, non-test recipients rejected at the transport layer.
- Fixtures use `invalid.example` emails and `+1555010xxxx` numbers only; fixtures live in `fixtures/fake-tenant-a/` and `fake-tenant-b/` (not yet created).
- Prohibited targets never used by tests or sandbox code: Nora (`agent_4c34644a…`, `2PFWFqBM0wabADk6`), Emily (`agent_affef8…`, `0PwP1tUf4478lNbf`), live Alex `agent_8201…`, Kynetic Restoration (Demo).
- No Twenty REST `DELETE`; rollback = inactive status / isolation.

## 4. Open gaps and unknowns

- Single-tenant Twenty today: how per-client data is separated in Twenty (clientAccount relation vs separate workspace) is unresolved (D-S02).
- Twenty API rate limit 100 req/60s must shape batch sync.

## 5. Definition of done

See spec section 13 for this system and section 5.4 shared gate. Boxes are unchecked until test evidence exists on this branch.

