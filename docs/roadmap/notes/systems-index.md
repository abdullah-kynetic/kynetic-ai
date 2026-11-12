# SYSTEMS INDEX

_Twenty note `4dd9833f`, created 2026-11-09, updated 2026-11-10. Exported 2026-11-12._

# SYSTEMS INDEX
*Main file for all Kynetic systems. Linked from "STATUS: start here". Updated 2026-11-09. Source: spec kynetic-systems-build-handoff (2026-11-06), repo branch claude/project-thread-kj2v2h (docs/systems/). Everything is a PROPOSAL until verified; nothing here is approved scope or pricing (pricing authority: D-023).*

**How to use (for the building LLM, which reads only Twenty and n8n):** each system has its own note titled "BUILD PLAN NN: ..." (section AUTOMATIONS_BUILD) that is a complete build plan: current state, outcome, states, onboarding, data/events, n8n workflows, failure handling, metrics, requirements-to-tests matrix and open gaps. Read "N8N ORGANIZATION GUIDE" first: it says which n8n folders to use, naming, tags and the do-not-touch list. Build only inactive, DEV-tagged, net-new workflows in the Sandbox (DEV) folder.

## Priority (from STATUS note)
First delivery package = Alex + ONE unified CRM deliverable + scheduling + essential follow-up. Everything else is a LATER backlog. Do not build backlog systems before the first package unless asked.

## Systems (note titles; search Twenty notes by title)
| # | System | Family / n8n folder | Package | Note |
|---|---|---|---|---|
| 01 | Speed-to-lead Alex (voice + text-first) | Revenue Response | FIRST | BUILD PLAN 01: Speed-to-lead Alex (id b48bc873-e9bf-4ece-b485-0ee02f480925) |
| 02 | Emily (inbound receptionist) | Revenue Response | later | BUILD PLAN 02 (id 3421534f-3753-4bb7-8983-bba9314ebd45) |
| 03 | Missed-call text-back | Revenue Response | essential follow-up | BUILD PLAN 03 (id 3258a05e-11cd-4d38-b1df-a96656c16c47) |
| 04 | Quote follow-up | Pipeline Conversion | essential follow-up | BUILD PLAN 04 (id 60dfac37-ae5f-4988-94bb-72217d5ecbc7) |
| 05 | Reactivation | Pipeline Conversion | later | BUILD PLAN 05 (id f542dd7b-ae8e-4c55-97cc-b1f25ae97310) |
| 06 | Nurture | Customer Growth | later | BUILD PLAN 06 (id 64248a90-31df-472f-97d5-3835e8505758) |
| 07 | Reputation / review | Customer Growth | later | BUILD PLAN 07 (id d787e4b1-1386-4038-8417-dbb6f510709c) |
| 08 | Referral | Customer Growth | later | BUILD PLAN 08 (id d751793c-0f17-475d-87b6-9de148f2b44e) |
| 09 | Maintenance / service reminders | Customer Growth | later | BUILD PLAN 09 (id 2f47e907-566b-4535-9e3b-d3cfa1256887) |
| 10 | One configurable CRM | Revenue Infrastructure | FIRST | BUILD PLAN 10 (id 2a7bd034-ea99-4c9c-9884-5cbc35085c97) |
| 11 | Scheduling | Revenue Infrastructure | FIRST | BUILD PLAN 11 (id 25036c8b-ad4d-494b-a251-29d18aa539f8) |
| 12 | Online presence | Acquisition & Visibility | later | BUILD PLAN 12 (id 3857356f-f8c1-41ad-b0f8-e6c451ca58a7) |
| 13 | Ads management and tooling | Acquisition & Visibility | later | BUILD PLAN 13 (id 6dc0249c-63d5-4f28-899b-8577315f5da7) |
| 14 | Platform: portal integration, internal maintenance, custom services | Platform Ops | supporting | BUILD PLAN 14 (id e24420db-9eb0-49ed-a6fd-0d351c20664c) |
| -- | n8n folders, naming, rules | all | read first | N8N ORGANIZATION GUIDE (id 19cd5846-babc-4df9-8b46-2c2917ff66b6) |

## Shared foundation already built (sandbox only)
- n8n (updated 2026-11-10): the shared policy and sink is "Template - Remodeling - Shared - Message Safety Check and Send (Callable)" (id YOEnu9pkfg4TEZBI, Templates / Remodeling, tag TEMPLATE, inactive): When Executed by Another Workflow or Manual trigger -> policy decision (allow / defer / suppress / human_review) -> sink send (fake provider id, test recipients only), code copied unchanged from the original MOqT97N0ItVyKIno (formerly DEV - sys-sandbox-dispatch, Manual trigger only, so not callable; left untouched for Abdullah). Reuse it; do not duplicate policy logic.
- n8n (2026-11-10): each system is ONE template workflow named Template - Remodeling - <Full System Name>, with one section per job (14 system workflows plus shared tools, 22 workflows in Templates / Remodeling); the 79 old one-job workflows are in Archive / Remodeling Template Pieces (Replaced by Merged Workflows, 2026-11-10). Ids and sections: N8N ORGANIZATION GUIDE section 6 and each BUILD PLAN note's Built so far. Locally tested, unproven in n8n.
- Repo (branch claude/project-thread-kj2v2h): shared policy and sink code, canonical event and policy-decision schemas (version 1.0-proposed), 16 unit tests passing; docs/build-inventory.md and docs/architecture-decisions.md.

## Architecture in one paragraph
Sources -> ingress (verified webhooks) -> canonical event envelope -> policy and lease coordinator (one active owner per person and channel) -> n8n orchestration -> adapters (voice, messaging, calendar, CRM) -> Twenty record -> metering -> portal projection. Twenty is the Kynetic operational record; the portal displays and sends controlled commands. LLM prose never writes stage or booking directly; tools return structured results and backend code decides.

## Proposed decisions (D-S01..D-S11; real D numbers are Abdullah's)
D-S01 test runner reuse Vitest; D-S02 Twenty is Kynetic operational record, portal Postgres stays client-facing store (adopted default); D-S03 dry run enforced by sink adapters at transport; D-S04 no new Twenty objects without approved metadata delta; D-S05 nurture reuses Twenty email campaign objects for email (adopted default); D-S06 lease/idempotency store decided by test, data tables first (adopted default); D-S07 n8n decides consent, portal gate stays authoritative until parity; D-S08 env names TWENTY_BASE_URL and TWENTY_SELFHOST_API_KEY only; D-S09 maintenance means customer service reminders, internal maintenance is plan 14; D-S10 build order foundation, text-back, Alex text intake, scheduling, Emily; D-S11 voice recording off until counsel review.

## Open flags (unresolved, not blockers for sandbox work)
- Which sender is authoritative for outreach (portal subscriber vs n8n) must be chosen before n8n dispatch.
- Disclosure/recording wording is counsel-pending (KI-002).
- Six existing DEV workflows need MCP access enabled in n8n before they can be moved to Sandbox (DEV).
- Portal sign-in state live is unverified (open mode vs restored); portal vs Twenty record conflict per D-S02.
- A2P: older docs say no campaign; Twilio campaign CJUDEQY verified Oct 28 (treat as verified; docs need update).
- Live ElevenLabs agent state intentionally not inspected.

## Hard limits (all notes)
Never Nora, live Emily, live Alex agent_8201m5afn2rbeb7v29xfkhh1pjef, Kynetic Restoration (Demo). No Twenty REST DELETE. No activation, real outreach, calls or secrets. Env names only TWENTY_BASE_URL and TWENTY_SELFHOST_API_KEY. No Google Drive/Docs/Sheets.

