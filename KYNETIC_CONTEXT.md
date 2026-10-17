# Kynetic AI — Working Context

Durable context for agent sessions. Twenty is canonical; this file mirrors it. On a mismatch, flag it rather than silently picking one.

## Rules (non-negotiable)

1. **Tell Abdullah before any change to n8n, Retell, or Twenty.** Describe the specific change and wait for a yes. Read-only investigation is fine. Notion is legacy: do not design new CRM logging there.
2. **Retell agent tools are core product features.** Never add, remove, rename, disable, or change parameters of an agent tool without explicit approval of that specific change. A tool that looks wrong gets a recommendation, not a fix.
3. **Nora is frozen.** Do not modify Nora's Retell agent, LLM, or n8n workflow. Doc references are fine.
4. **Kynetic Restoration (Demo) stays.** Do not delete or edit that build or its Twenty records.
5. **Hard rules (D-007).** No AI-placed cold calls, no cold SMS at scale, no ringless voicemail drops. Consent wording on any form that triggers a callback.
6. **Never dial the AM-1 Roofing office number** on the demo company record.

## Pricing (D-017)

Quentin signed off on 2026-10-13. Plan 1, the outbound speed-to-lead agent only:

- First 3 clients: **$4,675**
- Clients 4 and up: **$8,500**
- Billed as **three Stripe invoices** per client: 50% at the start, 25% when the system is built and sent for testing, 25% at completion. Not a subscription.

This replaces $1,500 setup + $997/mo (D-001).

## Two plans (D-013)

- **Plan 1, now:** only the outbound speed-to-lead agent, sold to owners already running Meta ads, at the D-017 price.
- **Gate:** 5 paying Plan 1 clients before Plan 2. Quentin's partnership terms still finalize at 5.
- **Plan 2, paused:** Revenue Recovery System — Reputation Engine, Inbound AI Receptionist (Emily), Lead Recovery and Nurture. Pricing undecided. Twenty task titles carry `[P1]` / `[P2]`.
- "Speed to lead" means the outbound agent. Full detail: Twenty note "BUSINESS MODEL: Two Plans".

## Voice platform (D-018)

Retell is the platform. Vapi is parked. Vapi workflows were renamed and deactivated. The old builder prompt was removed from main (recoverable via tag `archive/pre-reorg-2026-10-17`, D-019).

Two Retell workspaces:

| Workspace | What it holds |
|---|---|
| `abdullahblitz` | New builds, including the Alex outbound agent |
| `kyneticai` | The older workspace. Nora and Emily stay here |

| | Frozen original | Build copy, paused `[P2]` | Plan 1 outbound |
|---|---|---|---|
| Workspace | kyneticai | kyneticai | abdullahblitz |
| Name | Nora Restoration AI Receptionist | Emily Restoration Speed to Lead | Alex (Kynetic Roofing demo) |
| Retell agent | `agent_4c34644a04c74e27253e80167b` | `agent_affef8dcb6880fd592cbe9432f` | `agent_71e3cfc8384aa38a910a506b53` (ID set in the live n8n workflow, read 2026-10-17) |
| Retell LLM | `llm_d19efe92627f50e48657788b9ff5` | `llm_b520d8a6b9bf754f19285a8a6185` | — |
| n8n workflow | `2PFWFqBM0wabADk6` (live, Notion) | `0PwP1tUf4478lNbf` (inactive) | `m2YJwZ1l8DTzyEkw` |

Emily details: `retell/builds/emily-speed-to-lead/HANDOFF.md`.
Kynetic Restoration (Demo) build IDs: `retell/builds/kynetic-restoration/build-ids.md`. Do not edit that file.

## Outbound speed-to-lead (Plan 1, task 3.5)

- Demo: Kynetic Roofing, agent Alex (D-015, D-016). Build files: `retell/builds/outbound-speed-to-lead/`. Prompt style: `retell/PROMPTING_STYLE.md`.
- n8n workflow "Outbound Speed to Lead" `m2YJwZ1l8DTzyEkw` is **38 nodes** (3 sticky notes and 2 disabled draft-SMS nodes included) and was found **active** on 2026-10-17 with the Alex agent ID set and the "Retell API (outbound)" credential attached. Go-live is not yet approved; Abdullah to confirm (KI-009). Alex prompt v1.2.3 is on branch `claude/alex-demo-live-test`, not merged or published.
- The imported template `KYQIVtxwDcXVKmk3` is unchanged (Google Sheets / Vapi / Azure). Do not activate or run it.
- Create the Retell agent with `python tools/retell.py create-outbound` (dry run; `--apply` only with Abdullah's yes). Cal.com Roof Inspection event type `7404470`.
- Never dial the AM-1 office number on the demo company record.

## Business state

- No active clients. Kynetic runs on its own AI and is the case study.
- **Kynetic Restoration (Demo)** is the protected Plan 2 reference client (Austin water-damage demo). Never suggest deleting its records.

## Twenty

- **Self-hosted since 2026-10-15:** Twenty v2.46.0 at https://crm.kyneticai.com (OVH VPS, Docker in `/opt/twenty`, systemd unit `twenty.service`). MCP connector: https://crm.kyneticai.com/mcp. Nightly backup at 2:00 AM to `/var/backups/twenty` (14 days), plus age-encrypted copies in R2 bucket `kynetic-twenty-backups` (30 days).
- Twenty Cloud is the untouched rollback copy until about 2026-10-29. Do not write to it.
- API keys are rate-limited to 100 requests per 60 seconds. Never use REST DELETE on either instance; soft-delete in the UI only.
- n8n credential "Twenty account" `41C04qbmnbi0GI2P`, node `@blackswampai/n8n-nodes-twentycrm`.
- Custom objects: client_accounts, client_jobs, end_customers, customer_interactions, call_logs, invoices, expenses. Opportunity stages: DEMO_BOOKED → DEMO_HELD / NO_SHOW → PROPOSAL_SENT → CLOSED_WON/LOST.
- Dashboard: "Plan 1: $30K by Dec 31" `acda0613-2565-47f6-bb4c-9072b45a6d4c`, with tabs "Sales funnel" and "Clients & Cash".
- Other workflows: Emily `0PwP1tUf4478lNbf` (paused), Client Config Lookup `05HI35dhaWXweO5i`. Lead Scrape `3orAiCNLOCJ7xglI` is legacy and stays off. Nora `2PFWFqBM0wabADk6` is frozen.

## Portal

- Client portal: https://portal.kyneticai.com (Next.js app in `portal/`). The DNS A record is not set yet.
- Runs on the OVH VPS in `/opt/portal`; the app listens on `127.0.0.1:3020` behind Caddy. Nightly backup at 02:30.
- Ops docs: `portal/ADMIN.md` (admin and server) and `portal/N8N.md` (ingest API). Build report: `portal/docs/build-report-2026-10-16.md` (point-in-time).
- No real client data until the must-fixes are done (KI-006, KI-008).

## Access

- Retell: `python tools/retell.py …` (needs `RETELL_API_KEY`). Writes are dry-run unless `--apply`.
- n8n (`https://abdullah-kyneticai.app.n8n.cloud`) and Twenty (self-hosted, `https://crm.kyneticai.com`): connected accounts. Notion is legacy.
- Secrets: `.env` locally (gitignored), environment variables in cloud. See `.env.example`. Never commit them.
