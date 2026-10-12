# Kynetic AI — Working Context & Rules

Durable context for Claude sessions (local or cloud). Local Claude memory does not
travel to cloud sessions, so the rules that matter live here. Keep this current.

## Rules (non-negotiable)

1. **Tell Abdullah before any change to n8n, Retell, Twenty or Notion.** Describe the
   specific change and wait for a yes. Read-only investigation is fine.
2. **Retell agent tools are core product features.** Never add, remove, rename, disable
   or change parameters of an agent tool (get_jobs, create_job_details, log_emergency,
   collect_inquiry_details, transfer_call, Cal.com tools…) without explicit approval of
   that specific change. A tool that looks wrong gets a recommendation, not a fix.
3. **Twenty is the CRM.** Notion is legacy and being phased out; never design new CRM
   logging in Notion. Old Notion leads (Outreach DB) are stale; don't migrate them.
4. **The frozen original is never modified** (see below). All new work goes on the copies.

## Two plans (D-013, 2026-10-06)

- **Plan 1, foot in the door:** only the outbound speed to lead agent, sold to owners already
  running Meta ads, $1,500 setup + $997/mo. This is the only thing built and sold for now.
- **Gate:** 5 paying Plan 1 clients (setup paid, on the monthly plan).
- **Plan 2, Revenue Recovery System:** Reputation Engine, Inbound AI Receptionist (Emily),
  Lead Recovery and Nurture. After the gate: sell as upsells to Plan 1 clients if Plan 1 is
  scaling, otherwise reassess and pitch it as its own package. Pricing undecided.
- "Speed to lead" always means the outbound agent. Twenty task titles carry [P1] / [P2].
  Full detail: Twenty note "BUSINESS MODEL: Two Plans".

## Business state (2026-09-28)

- No active clients. Kynetic runs on its own AI and is the case study; prefer builds
  with measurable before/after numbers (response time, calls booked, hours saved).
- **Kynetic Restoration (Demo)** — fake water-damage restoration client (Austin TX
  rebrand of a template) — is the reference client build. Every system demo lives
  under it. Never suggest deleting its demo records.

## Voice agents

| | Frozen original | Build copy |
|---|---|---|
| Name (Retell + n8n) | Nora Restoration AI Receptionist | Emily Restoration Speed to Lead |
| Retell agent | `agent_4c34644a04c74e27253e80167b` | `agent_affef8dcb6880fd592cbe9432f` |
| Retell LLM | `llm_d19efe92627f50e48657788b9ff5` | `llm_b520d8a6b9bf754f19285a8a6185` |
| n8n workflow | `2PFWFqBM0wabADk6` (live, Notion) | `0PwP1tUf4478lNbf` (inactive, moving to Twenty) |

Details and next steps: `retell/builds/emily-speed-to-lead/HANDOFF.md`.
Original build IDs (Cal event, Twilio/Notion creds, config): `retell/builds/kynetic-restoration/build-ids.md`.

## Outbound speed-to-lead (Plan 1 build, task 3.5)

- Demo: Kynetic Roofing, agent Alex (D-015, D-016). Build files: `retell/builds/outbound-speed-to-lead/`.
- n8n workflow "Outbound Speed to Lead" `m2YJwZ1l8DTzyEkw` (inactive, never run). The imported
  template `KYQIVtxwDcXVKmk3` is unchanged: do not activate or run it.
- Retell outbound agent: NOT created yet. Create with `python tools/retell.py create-outbound`
  (dry run; `--apply` only with Abdullah's yes). Cal.com Roof Inspection event type 7404470.
- Never dial the AM-1 office number on the demo company record.

## Twenty

- n8n credential "Twenty account" `41C04qbmnbi0GI2P`, node `@blackswampai/n8n-nodes-twentycrm`.
- Custom objects: client_accounts, client_jobs, end_customers, customer_interactions,
  call_logs, scrape_runs; opportunities stages DISCOVERY → AUDIT_BOOKED → DEMO_DELIVERED
  → PROPOSAL_SENT → NEGOTIATING → CLOSED_WON/LOST.
- Dashboards: Sales `04de9b47-7a2a-44c1-9e70-9d29fe4b5882`, Business `914d3a2d-0fc1-40d6-ab87-50ea91e578e4`.
- Workflows still on Notion, to migrate: receptionist `2PFWFqBM0wabADk6` (frozen — leave),
  Emily `0PwP1tUf4478lNbf`, Lead Scrape `3orAiCNLOCJ7xglI`, Client Config Lookup `05HI35dhaWXweO5i`.

## Access

- Retell: `python tools/retell.py …` (needs `RETELL_API_KEY`). Writes are dry-run unless `--apply`.
- n8n (`https://abdullah-kyneticai.app.n8n.cloud`), Twenty, Notion: claude.ai connectors.
- Secrets: `.env` locally (gitignored), environment variables in cloud. See `.env.example`.
