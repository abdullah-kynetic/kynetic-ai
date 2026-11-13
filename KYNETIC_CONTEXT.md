# Kynetic AI — Working Context

Durable context for agent sessions. Twenty is the business source of truth. GitHub is the technical execution record. On a mismatch, flag both values. Current operating order, offer, and pricing precedence: `docs/STATUS.md`. Sections below marked historical keep their original text so the ids stay findable.

## Current direction (2026-11-08 PST)

- Five steps, one roadmap (Twenty note `7bfdcb7e`): consolidate the plan; sales-ready foundation in parallel with productizing Alex, one CRM, scheduling, essential follow-up, and demo templates; cold-call remodelers until the first three clients are signed; then deliver, measure, and expand. Broader systems stay later.
- Alex runs on ElevenLabs through n8n on the VPS. Retell is parked for Alex. The live agent `agent_8201m5afn2rbeb7v29xfkhh1pjef` is protected: do not change it and do not invoke it.
- The CRM is one configurable deliverable. `lite` / `full` in the portal code are internal capability flags from 2026-10-25, not commercial tiers.
- Offer in force (2026-11-05): "We book remodelers 20% more appointments than last month in 30 days, or we work free until we do." Baseline is last month's booked appointments. The client keeps ads running and takes the appointments. Booking the jobs is the client's job.
- Twenty D-023 (approved 2026-10-24) is the pricing authority and supersedes D-017. Dollar amounts from D-023 are not copied here. A 2026-11-06 price proposal is not approved. Do not choose again between D-017 and D-023 from this file.
- Twenty keys: `TWENTY_BASE_URL` and `TWENTY_SELFHOST_API_KEY` only. `TWENTY_API_KEY` is dead. No REST DELETE.
- No Google Drive, Google Docs, or Google Sheets. No Florida or Oklahoma owners. No HIPAA work. AM-1 Roofing is do-not-call. DNC scrub, consent, and quiet hours are required. A2P approval is not permission for cold SMS.
- Portal code is on `main` (2026-11-09 PST). Production at portal.kyneticai.com deploys that build only after an explicit yes. The separate DEV environment is retired until after go-live. Do not continue `dev/codex-setup`. `archive/dev-retired/docs-codex/COMPLETION-PLAN.md` is historical evidence, not this roadmap.

## Rules (non-negotiable)

1. **Tell Abdullah before any change to n8n, ElevenLabs, Retell, or Twenty.** Describe the specific change and wait for a yes. Read-only investigation is fine. Notion is legacy: do not design new CRM logging there. Do not activate or publish a workflow.
2. **Retell agent tools stay untouched without a yes on that exact change.** Never add, remove, rename, disable, or change parameters of an agent tool. A tool that looks wrong gets a recommendation, not a fix. Alex's current platform is ElevenLabs. Nora and Emily stay untouched.
3. **Nora is frozen.** Do not modify Nora's Retell agent, LLM, or n8n workflow. Doc references are fine.
4. **Kynetic Restoration (Demo) stays.** Do not delete or edit that build or its Twenty records.
5. **Hard rules (D-007).** No AI-placed cold calls, no cold SMS at scale, no ringless voicemail drops. Consent wording on any form that triggers a callback. DNC scrub and quiet hours are required with consent. A2P approval does not allow cold SMS.
6. **Never dial the AM-1 Roofing office number** on the demo company record. No Florida or Oklahoma owners. No HIPAA work. No Google Drive, Docs, or Sheets.
7. **Twenty.** `TWENTY_BASE_URL` and `TWENTY_SELFHOST_API_KEY` only. Never REST DELETE. `TWENTY_API_KEY` is a dead name.
8. **Live Alex.** Do not change or invoke ElevenLabs `agent_8201m5afn2rbeb7v29xfkhh1pjef`. Do not activate or publish workflows.

## Pricing (D-017, historical)

Do not quote the amounts below. Twenty D-023 (approved 2026-10-24) supersedes this entry. See `docs/STATUS.md`. The original text follows.

Quentin signed off on 2026-10-13. Plan 1, the outbound speed-to-lead agent only:

- First 3 clients: **$4,675**
- Clients 4 and up: **$8,500**
- Billed as **three Stripe invoices** per client: 50% at the start, 25% when the system is built and sent for testing, 25% at completion. Not a subscription.

This replaces $1,500 setup + $997/mo (D-001).

## Two plans (D-013, historical)

The five-client gate and "build everything first" (D-003) are not the operating order. The five steps in `docs/STATUS.md` superseded them on 2026-11-08 PST. Original text follows.

- **Plan 1, now:** only the outbound speed-to-lead agent, sold to owners already running Meta ads, at the D-017 price.
- **Gate:** 5 paying Plan 1 clients before Plan 2. Quentin's partnership terms still finalize at 5.
- **Plan 2, paused:** Revenue Recovery System — Reputation Engine, Inbound AI Receptionist (Emily), Lead Recovery and Nurture. Pricing undecided. Twenty task titles carry `[P1]` / `[P2]`.
- "Speed to lead" means the outbound agent. Full detail: Twenty note "BUSINESS MODEL: Two Plans".

## Voice platform ids (D-018 historical for Alex)

Alex's platform is ElevenLabs (D-025), through n8n on the VPS. The Retell row in the table is the parked Alex build. Vapi is parked. Vapi workflows were renamed and deactivated. The old builder prompt was removed from main (recoverable via tag `archive/pre-reorg-2026-10-17`, D-019). Nora and Emily stay on Retell workspace `kyneticai` and stay protected. Do not change or invoke live Alex `agent_8201m5afn2rbeb7v29xfkhh1pjef`.

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
| Retell LLM | `llm_d19efe92627f50e48657788b9ff5` | `llm_b520d8a6b9bf754f19285a8a6185` | `llm_5cbc32e5872bbd9afb452c692071` |
| n8n workflow | `2PFWFqBM0wabADk6` (live, Notion) | `0PwP1tUf4478lNbf` (inactive) | `m2YJwZ1l8DTzyEkw` |

Emily details: `retell/builds/emily-speed-to-lead/HANDOFF.md`.
Kynetic Restoration (Demo) build IDs: `retell/builds/kynetic-restoration/build-ids.md`. Do not edit that file.

## Outbound speed-to-lead (Plan 1, task 3.5, historical Retell record)

The bullets below are the Oct 2026 Retell record. They are not an instruction to build or activate Retell Alex. Current Alex work is ElevenLabs through n8n on the VPS, and the live agent stays protected (`docs/STATUS.md`).

- Demo: Kynetic Roofing, agent Alex (D-015, D-016). Parked build files: `retell/builds/outbound-speed-to-lead/`. Prompt style: `retell/PROMPTING_STYLE.md`.
- n8n workflow "Outbound Speed to Lead" `m2YJwZ1l8DTzyEkw` is **38 nodes** (3 sticky notes and 2 disabled draft-SMS nodes included) and was found **active** on 2026-10-17 with the Retell Alex agent ID set and the "Retell API (outbound)" credential attached. Go-live of that Retell workflow was approved by Abdullah on 2026-10-18 (KI-009 resolved). That approval is not approval to activate anything now. Alex prompt v1.2.3 is on branch `claude/alex-demo-live-test`, not merged or published.
- The imported template `KYQIVtxwDcXVKmk3` is unchanged (Google Sheets / Vapi / Azure). Do not activate or run it. Do not create Google Sheets.
- The Retell create command `python tools/retell.py create-outbound` is the parked path (dry run; `--apply` only with Abdullah's yes). Cal.com Roof Inspection event type `7404470`.
- Never dial the AM-1 office number on the demo company record.
- A test ran on 2026-10-15 (one test lead, called, booked, logged in Twenty) on the Retell path. It is not proof of a current ElevenLabs lead-to-booking path. Details in docs/progress.md.

## Voice provider bake-off (closed 2026-10-25, D-025)

ElevenLabs won. Retell does not stay the Alex platform. The notes below are the test record. Do not reopen the bake-off from this section. No changes to live Alex (`agent_8201m5afn2rbeb7v29xfkhh1pjef`), n8n, Twenty, Nora, Emily, or Kynetic Restoration (Demo). The parked Retell Alex id is `agent_71e3cfc8384aa38a910a506b53`.

| Provider | Agent | Branch | State (Oct 17) |
|---|---|---|---|
| Retell Alex Lab (control) | `agent_423ae0cb2803cba2891b376d44` | `claude/alex-demo-live-test` (config: `retell/builds/outbound-speed-to-lead/agent.lab.config.json`) | Control for the scorecard |
| ElevenLabs | `agent_9301m52zy185e609f8vyws4r1r7q` ("Roofing Assistant") | `claude/provider-test-elevenlabs` | Agent runs the real Alex prompt; Cal.com tools attached; slots call verified; no booking made yet |
| Bland | not recorded here | `claude/provider-test-bland` | Test track set up, no results |

- Historical scorecard and persona: `providers/TEST_PLAN.md` (on the branches, not on main). The test rule at the time was that the challenger had to beat Alex Lab on one-question-per-turn, waiting for answers, email accuracy, false success and booking success without losing more than 25 percent on cost or delay, and a tie would have kept Retell. D-025 closed the test before that full scorecard was run.
- Cal.com: production event type `7404470` (Retell, Bland). ElevenLabs test event type `7520336` (same availability, phone required, email optional). The ElevenLabs Cal.com tools (`calcom_get_available_slots`, `calcom_create_booking`) point at 7520336. Test bookings are real; cancel them only after Abdullah says so.
- Historical plan from Oct 17, not a current task: confirm by text instead of email, with a stub `send_confirmation_sms` tool. Real delivery waited on A2P registration (KI-003). It is not approval to edit the live agent or to send cold SMS.
- Historical open question, left as found during the test: the ElevenLabs agent's LLM was `deepseek-v41-flash`, while Retell Alex ran gpt-4.1 (D-012). Do not change either agent from this note.
- Where the detail lives: `providers/elevenlabs/RESULTS.md` and `HANDOFF.md` on the ElevenLabs branch, and the Twenty note "VOICE PROVIDER BAKE-OFF: Retell vs Bland vs ElevenLabs". Twenty is canonical; flag any mismatch.

## Business state

- No active clients. Kynetic runs on its own AI and is the case study.
- **Kynetic Restoration (Demo)** is the protected Plan 2 reference client (Austin water-damage demo). Never suggest deleting its records.

## Twenty

- **Self-hosted since 2026-10-15:** Twenty v2.46.0 at https://crm.kyneticai.com (OVH VPS, Docker in `/opt/twenty`, systemd unit `twenty.service`). MCP connector: https://crm.kyneticai.com/mcp. Nightly backup at 2:00 AM to `/var/backups/twenty` (14 days), plus age-encrypted copies in R2 bucket `kynetic-twenty-backups` (30 days).
- Twenty Cloud was the untouched rollback copy until about 2026-10-29. Whether its keys were revoked after that date was not checked in the 2026-11-08 PST docs pass. Do not write to it.
- API keys are rate-limited to 100 requests per 60 seconds. Never use REST DELETE on either instance; soft-delete in the UI only. Env names: `TWENTY_BASE_URL` and `TWENTY_SELFHOST_API_KEY`. `TWENTY_API_KEY` is dead.
- n8n credential "Twenty account" `41C04qbmnbi0GI2P`, node `@blackswampai/n8n-nodes-twentycrm`.
- Custom objects: client_accounts, client_jobs, end_customers, customer_interactions, call_logs, invoices, expenses. Opportunity stages: DEMO_BOOKED → DEMO_HELD / NO_SHOW → PROPOSAL_SENT → CLOSED_WON/LOST.
- Dashboard: "Plan 1: $30K by Dec 31" `acda0613-2565-47f6-bb4c-9072b45a6d4c`, with tabs "Sales funnel" and "Clients & Cash".
- Other workflows: Emily `0PwP1tUf4478lNbf` (paused), Client Config Lookup `05HI35dhaWXweO5i`. Lead Scrape `3orAiCNLOCJ7xglI` is legacy and stays off. Nora `2PFWFqBM0wabADk6` is frozen.

## Portal

- Client portal: https://portal.kyneticai.com (Next.js app in `crm/`; the old `portal/` app was deleted 2026-11-02, recoverable from commit `7eea4129` (run `git show 7eea4129:portal/`)). The DNS A record is set (resolves to 40.160.150.91, `/api/health` ok as of 2026-10-17) and Resend email works. Remaining go-live gaps are in KI-006.
- Runs on the OVH VPS in `/opt/portal`; the app listens on `127.0.0.1:3020` behind Caddy. Nightly backup at 02:30.
- Sign-in record as of 2026-10-18: invite-only. Clients use password, an emailed link, or Google (invited clients only). Admins use password + authenticator code, with an optional "Remember this device for 30 days" (skips only the code). New invites sign the user straight in; password resets end at the sign-in page. Deploys go through server-side `portal-deploy` (D-022). Later sessions removed sign-in and then restored it on main. Production access protection is an unresolved release risk (KI-013 and `docs/audit/2026-11-08-code-evidence.md`). An HTTP 200 is not proof the admin UI is exposed, and this pass did not probe the live portal.
- VPS (OVH, 72 GB disk, about 14% used as of 2026-10-18, 4 cores, 7.6 GB memory) runs the portal, its database and Twenty. Bookstack and Docmost trials were removed 2026-10-18. n8n on this VPS (`https://n8n.kyneticai.com`) is the instance later work uses. The 2026-10-18 "self-hosting not started" line is historical. Do not activate workflows from this paragraph.
- Old portal ops docs (`ADMIN.md`, `N8N.md`, build report) are only in commit `7eea4129`. The new portal's docs are `crm/README.md`, `crm/deploy/prod/README.md` and `docs/`.
- No real client data until the must-fixes are done (KI-006, KI-008).

## Access

- Retell: `python tools/retell.py …` (needs `RETELL_API_KEY`). Writes are dry-run unless `--apply`. Parked for Alex. Do not use it on Nora, Emily, or Kynetic Restoration (Demo).
- n8n VPS: `https://n8n.kyneticai.com`. The cloud instance `https://abdullah-kyneticai.app.n8n.cloud` is the older copy. Do not activate or publish workflows on either.
- Twenty (self-hosted, `https://crm.kyneticai.com`): `TWENTY_BASE_URL` and `TWENTY_SELFHOST_API_KEY` only. Notion is legacy. No Google Drive, Docs, or Sheets.
- Secrets: `.env` locally (gitignored), environment variables in cloud. See `.env.example`. Never commit them.
