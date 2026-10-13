# Kynetic AI — Working Context

Durable context for agent sessions. Twenty is the system of record. If this file disagrees with Twenty, Twenty wins.

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

Retell is the platform. Vapi is parked. Vapi workflows were renamed and deactivated. The old builder prompt is in `archive/vapi/`.

Two Retell workspaces:

| Workspace | What it holds |
|---|---|
| `abdullahblitz` | New builds, including the Alex outbound agent |
| `kyneticai` | The older workspace. Nora and Emily stay here |

| | Frozen original | Build copy, paused `[P2]` | Plan 1 outbound |
|---|---|---|---|
| Workspace | kyneticai | kyneticai | abdullahblitz |
| Name | Nora Restoration AI Receptionist | Emily Restoration Speed to Lead | Alex (Kynetic Roofing demo) |
| Retell agent | `agent_4c34644a04c74e27253e80167b` | `agent_affef8dcb6880fd592cbe9432f` | Not created yet |
| Retell LLM | `llm_d19efe92627f50e48657788b9ff5` | `llm_b520d8a6b9bf754f19285a8a6185` | — |
| n8n workflow | `2PFWFqBM0wabADk6` (live, Notion) | `0PwP1tUf4478lNbf` (inactive) | `m2YJwZ1l8DTzyEkw` |

Emily details: `retell/builds/emily-speed-to-lead/HANDOFF.md`.
Kynetic Restoration (Demo) build IDs: `retell/builds/kynetic-restoration/build-ids.md`. Do not edit that file.

## Outbound speed-to-lead (Plan 1, task 3.5)

- Demo: Kynetic Roofing, agent Alex (D-015, D-016). Build files: `retell/builds/outbound-speed-to-lead/`. Prompt style: `retell/PROMPTING_STYLE.md`.
- n8n workflow "Outbound Speed to Lead" `m2YJwZ1l8DTzyEkw` is **27 nodes**, inactive, never run. Oct 12 added a calling-hours gate and a fallback normalize step. It still needs the Retell agent ID, the caller ID, and the "Retell API (outbound)" credential before any test.
- The imported template `KYQIVtxwDcXVKmk3` is unchanged (Google Sheets / Vapi / Azure). Do not activate or run it.
- Create the Retell agent with `python tools/retell.py create-outbound` (dry run; `--apply` only with Abdullah's yes). Cal.com Roof Inspection event type `7404470`.
- Never dial the AM-1 office number on the demo company record.

## Business state

- No active clients. Kynetic runs on its own AI and is the case study.
- **Kynetic Restoration (Demo)** is the protected Plan 2 reference client (Austin water-damage demo). Never suggest deleting its records.

## Twenty

- n8n credential "Twenty account" `41C04qbmnbi0GI2P`, node `@blackswampai/n8n-nodes-twentycrm`.
- Custom objects: client_accounts, client_jobs, end_customers, customer_interactions, call_logs, scrape_runs. Opportunity stages: DISCOVERY → AUDIT_BOOKED → DEMO_DELIVERED → PROPOSAL_SENT → NEGOTIATING → CLOSED_WON/LOST.
- Dashboards: Sales `04de9b47-7a2a-44c1-9e70-9d29fe4b5882`, Business `914d3a2d-0fc1-40d6-ab87-50ea91e578e4`.
- Other workflows: Emily `0PwP1tUf4478lNbf` (paused), Client Config Lookup `05HI35dhaWXweO5i`. Lead Scrape `3orAiCNLOCJ7xglI` is legacy and stays off. Nora `2PFWFqBM0wabADk6` is frozen.

## Access

- Retell: `python tools/retell.py …` (needs `RETELL_API_KEY`). Writes are dry-run unless `--apply`.
- n8n (`https://abdullah-kyneticai.app.n8n.cloud`) and Twenty: connected accounts. Notion is legacy.
- Secrets: `.env` locally (gitignored), environment variables in cloud. See `.env.example`. Never commit them.
