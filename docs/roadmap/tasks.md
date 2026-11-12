# Twenty tasks (exported 2026-11-12)

Snapshot of the 63 planning tasks that lived in Twenty. Read-only history; the portal and GitHub now track work.

## DONE (7)

### [P1] [DONE, history] 1.1 Revoke the leaked Cal.com key (cal_live_f64..., committed Aug 23)

_`027c20f4`, created 2026-10-02, due none_

Phase 1 of MASTER PLAN. Free and a security issue. Create a new key and put it only in env vars.

### [P1] [DONE, history] 1.2 Pick the agent's voice (blocks publish)

_`7ee96775`, created 2026-09-24, due none_

Phase A #7. Currently a generic 11labs-Cimo default that was never chosen on purpose. Your decision.

### [P1] [DONE, history] 1.3 Twilio A2P 10DLC registration for the demo number: campaign CJUDEQY verified Oct 28 (text wiring still open, see Step 4 tasks)

_`3209fef0`, created 2026-09-24, due none_

Oct 25, 2026 update: Alex's text confirmation is switched off in the live ElevenLabs prompt (D-025) until this campaign is approved. When it is approved, Claude restores the text wording in the v1 prompt and adds the SMS tool (pre-approved by Abdullah; the Twilio account check thread messages the go-live thread). Oct 22 Twilio read-only check: account active, balance $12.35, brand approved, NO A2P campaign registered, Sep 22 send failed with error 30034.

---
Sep 22 live test: Twilio accepted the SMS from +16692660586 but it never arrived. Carrier filtering because A2P registration is incomplete in the Twilio console. Blocks real SMS delivery in end to end testing.

### [P1] [DONE, history] 3.10 Self-hosted n8n on the OVH VPS: live and in use (checked 2026-11-08)

_`074ff440`, created 2026-10-18, due none_

Planning only. No migration and no n8n change without Abdullah's yes on each step.

**Why.** Avoid n8n cloud execution limits and cost.

**Step 1 (read-only).** Export the workflows from n8n cloud and measure them, including "Outbound Speed to Lead" (`m2YJwZ1l8DTzyEkw`). Check the cloud plan and execution counts.

**Step 2.** Written plan covering: Docker setup next to the portal and Twenty, the HTTPS address and Caddy rule, off-server backups with a restore test, credentials to recreate (Retell, Twenty, Cal.com), moving the lead-form and Retell post-call webhook URLs, execution-history pruning, and a rollback path.

**Sizing so far.** About 1.5-2 GB disk at first, about 0.3-1 GB memory. VPS is at 14% disk with about 4.7 GB memory available (2026-10-18).

See docs/progress.md, 2026-10-18 entry.

### [P1] [DONE, history] 3.9 Voice provider bake-off: ElevenLabs wins, v1 strict locked (D-025)

_`7c350f17`, created 2026-10-17, due none_

Closed Oct 25, 2026. Verdict (Abdullah, Oct 22): ElevenLabs wins; v1 strict `agent_8201m5afn2rbeb7v29xfkhh1pjef` (blitz account abdullahblitz24) is Alex. Recorded as D-025, which replaces D-018 for Alex's voice platform. Retell is parked, not deleted.

Evidence: v1 booked cleanly Oct 21 (conv_7001m5dzwydyeqabsy0zeepnm1rc, Cal.com test event 7520336, 0 stacked questions in 19 turns, median delay 0.14 s). Not run: 13-point scorecard, v2 re-run, edge scripts 3/4/6. v2 never booked cleanly and is unused.

Text promise removed (Oct 22): the live prompt no longer says a text will be sent, because Twilio has no A2P campaign (KI-003). Before/after prompts in repo `providers/elevenlabs/golive/`. When A2P is approved, the wording is restored and the SMS tool added (Abdullah pre-approved; the Twilio account check thread messages the go-live thread).

Mode now: demos on the free tier only until the first client signs. Go-live plan: repo `docs/plans/ALEX-ELEVENLABS-GOLIVE.md` (upgrade plan, VPS n8n credentials, import Twilio number, build the ElevenLabs workflow inactive on the VPS, webhook, test calls, activate). The n8n workflow xlmyRd5jBBBu8LX7 is NOT on the VPS n8n (only the Retell copy tXJwNTkNgKGnp0Ab).

Open: Twenty and repo number decisions differently after Oct 24 (Twenty D-023 = offer; repo branches D-023 site / D-024 offer); reconcile when those merge.

### [P1] [DONE, history] Decide standard (non founding) pricing — answered by D-017 ($8,500 for clients 4+) (pricing superseded by D-023)

_`07d77353`, created 2026-09-24, due none_

**Superseded Oct 24, 2026 by new pricing — see D-023: Current offer, pricing, niches and upsells.** Any old pricing or niches below ($4,675 first 3 / $8,500 after, $800 / $2,000 / $3,500 tiers, 1,200 minutes then 25¢/min, remodelers + foundation repair niche list, $30K goal) are no longer valid. Current: founding (first 3) $6,500 setup + 3 months (50% signing / 50% go-live), then $1,500/mo or $4,000 prepaid months 4–6; standard $10,000 (50/25/25: signing / go-live / day 45; month 4 free if paid in full), then $2,000/mo or $5,000 prepaid months 4–6. Software included, no per-minute charges (fair-use clause). Niches: remodelers (any), solar + battery, custom pools, windows + doors, decks + outdoor living; must be running Meta ads. Upsells: reactivation $3,000 or $1,000/mo; quote follow-up $2,500 + $500/mo; after-hours $1,500 + $500/mo. Goal: $100K signed contracts by Dec 31, 2026.

Oct 13, 2026: Abdullah proposed new pricing, recorded as D-017. 3-month packages at 15% off: $4,675 for the first 3 clients, $8,500 after (list $4,000 setup + $2,000/mo), billed 50/25/25. Waiting on Quentin's sign-off and confirmation that "completion" means build go-live. Mark DONE once confirmed.

Older note: Open per the Offer Definition. Intro is $2,500/mo, setup $3,000 for first 3 clients / $4,500 standard.

Oct 13, 2026: Quentin signed off on D-017 (final). Standard price = $8,500 3-month package for clients 4 and on. The open question on what "completion" means moved to the "Confirm with Quentin" task.

### [P2] [DONE, history] 3.8 System 2 Phase A setup on Retell + n8n (done Sep 22)

_`4aa33c05`, created 2026-09-24, due none_

Phase A items 1 to 6, 8, 13, 15 done and verified live on Sep 22, 2026. See the System 2 Build Tracker note for detail.

## IN_PROGRESS (4)

### [P1] [Step 2] 1.4 TCPA emergency branch opt out gap needs counsel sign off (start now, external lead time)

_`033b61d5`, created 2026-09-24, due none_

**Status (Oct 8, 2026):** In progress. Counsel outreach email and 10 questions written (repo docs/counsel-email.md and docs/counsel-questions.md) and marked done by Abdullah on Oct 8. Waiting on the lawyer's reply: written answers, approved consent wording for the form, and agreement review (links to 4.7 and 4.8). This task is only done when counsel signs off.

### [P1] [Step 2] 4.1 Finalize cold call opener (I just saw your ad) + build Revenue Calculator for demo calls

_`e110fb03`, created 2026-09-24, due none_

Carried from the Notion build tracker (in progress since Aug 11). Calculator: missed calls per day x close rate x average ticket = monthly revenue gap, shown live on the audit call.

### [P1] [Step 3] 5.5 Client results view v1: client portal at portal.kyneticai.com (built, live, not wired to real data)

_`29135903`, created 2026-10-02, due none_

# CURRENT RECONCILIATION — November 8, 2026 (PST)

Current planning authority: roadmap 7bfdcb7e-4f49-4c1c-94b9-7ffc46d50747; acceptance baseline 603fe300-c5df-49e9-9f04-b0582acd7816; evidence scorecard 5c44b12e-44b4-4e60-a29b-c8c51ea589c0. This update changes documentation only, not completion status, owner, dueAt, relationships, providers or delivery behavior.

Current business authority: canonical five-step roadmap 7bfdcb7e-4f49-4c1c-94b9-7ffc46d50747; frozen baseline v1 603fe300-c5df-49e9-9f04-b0582acd7816; scorecard 5c44b12e-44b4-4e60-a29b-c8c51ea589c0. Twenty owns business planning; GitHub owns technical evidence. Historical bodies below are retained for provenance, not executable current instructions.
Sequence: (1) consolidate; (2) sales-ready foundation and (3) reusable first delivery package run in parallel; (4) human cold-call remodelers and sign the FIRST THREE clients; (5) deliver, measure, refine templates and earn case studies, then expand channels/multi-location work. Do not require all later systems before selling.
First delivery package: Alex + ONE unified CRM deliverable + scheduling + essential follow-up. Standard portal integration, bespoke portal work and background automations are distinct scopes. Other system templates remain a preserved LATER backlog, not a prerequisite to selling.
Alex platform: ElevenLabs, with n8n on the Kynetic VPS orchestrating backend automation. Retell Alex is parked. Portal surfaces results/status/actions, not an automation editor. This planning correction is not a vendor configuration change or proof of live integrations.
Safety: never invoke or modify Nora, live Emily, live Alex agent_8201m5afn2rbeb7v29xfkhh1pjef, or Kynetic Restoration (Demo) under this cleanup. Use separate approved DEV/demo resources for future tests. No production deployment, calls, texts, messages, workflow activation, paid-plan change, schema change, or commercial-term invention is authorized here. Human cold outreach only; preserve consent, quiet-hours, kill-switch and counsel gates; no FL/OK, no HIPAA, AM-1 do-not-call, no Google Drive/Docs/Sheets. Use only TWENTY_BASE_URL + TWENTY_SELFHOST_API_KEY; never TWENTY_API_KEY or REST DELETE.

Existing portal implementation is not proof of protected production access or wired real results. Retain the current task status until attributable tenant/auth/results acceptance evidence is supplied.

---

## Historical pre-reconciliation body — retained verbatim; current guidance above takes precedence. Historical claims are not current proof or permission.

Oct 13, 2026: retitled. platform/crm (Kynetic Dispatch / SeldonFrame era) is dead code. Twenty is the system of record (D-006). v1 = a Twenty dashboard or emailed summary showing agent status, calls, bookings and documents. Format not confirmed.

**Oct 16, 2026: format decided by what was built. v1 is the client portal.**
- Live at https://portal.kyneticai.com on the OVH VPS (Docker in /opt/portal, own Postgres container, app on 127.0.0.1:3020 behind Caddy). DNS and TLS are working. Nightly backup runs at 02:30 on the same box.
- Code: branch `portal` in abdullah-kynetic/kynetic-ai, folder /portal. Not merged, no PR. Docs: portal/README.md, REPORT.md, ADMIN.md, N8N.md, PLAN.md.
- Clients see their profile, contacts, Plan 1 scope, timeline, documents (upload and download) and results (speed-to-lead, calls, bookings, minutes vs 1,200). Admins get every client, users, ingest keys and required TOTP MFA. 56 tests pass, including client A vs B isolation and RLS.
- Status: Abdullah's admin login and MFA work. Only the fake Test Client A/B exist.

**Left to do:**
1. Resend: verify kyneticai.com in Resend, then set RESEND_API_KEY in /opt/portal/.env. Until then invite, magic-link and reset emails only go to the container log.
2. Cloudflare R2: create a portal bucket and keys, then set the 4 R2_* vars. Until then files sit on the VPS disk.
3. Off-box backup: copy the nightly dump to R2, the same way Twenty's backup does.
4. Create Quentin's admin account (needs his email).
5. Create a Kynetic Roofing (Demo) client, generate an ingest key, and add a daily n8n push to POST /api/ingest/results. This needs 3.5 running first, and the n8n change needs approval.
6. Open a PR for the portal branch and merge it.
7. Later: Playwright smoke test, a backup restore drill, an optional read-only Twenty sync.

Not a blocker for dialing. Useful as a demo asset on sales calls once it shows demo data.

### [P1] [Step 3] Build and verify ElevenLabs Alex callback via n8n: intake, consent, lead, booking and timed writeback

_`457c9a87`, created 2026-10-02, due none_

# CURRENT RECONCILIATION — November 8, 2026 (PST)

Current planning authority: roadmap 7bfdcb7e-4f49-4c1c-94b9-7ffc46d50747; acceptance baseline 603fe300-c5df-49e9-9f04-b0582acd7816; evidence scorecard 5c44b12e-44b4-4e60-a29b-c8c51ea589c0. This update changes documentation only, not completion status, owner, dueAt, relationships, providers or delivery behavior.

Current business authority: canonical five-step roadmap 7bfdcb7e-4f49-4c1c-94b9-7ffc46d50747; frozen baseline v1 603fe300-c5df-49e9-9f04-b0582acd7816; scorecard 5c44b12e-44b4-4e60-a29b-c8c51ea589c0. Twenty owns business planning; GitHub owns technical evidence. Historical bodies below are retained for provenance, not executable current instructions.
Sequence: (1) consolidate; (2) sales-ready foundation and (3) reusable first delivery package run in parallel; (4) human cold-call remodelers and sign the FIRST THREE clients; (5) deliver, measure, refine templates and earn case studies, then expand channels/multi-location work. Do not require all later systems before selling.
First delivery package: Alex + ONE unified CRM deliverable + scheduling + essential follow-up. Standard portal integration, bespoke portal work and background automations are distinct scopes. Other system templates remain a preserved LATER backlog, not a prerequisite to selling.
Alex platform: ElevenLabs, with n8n on the Kynetic VPS orchestrating backend automation. Retell Alex is parked. Portal surfaces results/status/actions, not an automation editor. This planning correction is not a vendor configuration change or proof of live integrations.
Safety: never invoke or modify Nora, live Emily, live Alex agent_8201m5afn2rbeb7v29xfkhh1pjef, or Kynetic Restoration (Demo) under this cleanup. Use separate approved DEV/demo resources for future tests. No production deployment, calls, texts, messages, workflow activation, paid-plan change, schema change, or commercial-term invention is authorized here. Human cold outreach only; preserve consent, quiet-hours, kill-switch and counsel gates; no FL/OK, no HIPAA, AM-1 do-not-call, no Google Drive/Docs/Sheets. Use only TWENTY_BASE_URL + TWENTY_SELFHOST_API_KEY; never TWENTY_API_KEY or REST DELETE.

Preserved prior title: [P1] [Step 3] 3.5 Build the outbound callback: form, consent, Twenty lead, Retell call within 60 seconds, log, track submit to ring time

---

## Historical pre-reconciliation body — retained verbatim; current guidance above takes precedence. Historical claims are not current proof or permission.

UPDATE Oct 25, 2026 (D-025): Alex's voice platform is now ElevenLabs (v1 strict agent_8201m5afn2rbeb7v29xfkhh1pjef), replacing Retell for the Alex call. Demos only on the free tier until the first client signs; the ElevenLABS outbound path (paid plan, number import, VPS n8n workflow, webhook, test calls) is planned in repo docs/plans/ALEX-ELEVENLABS-GOLIVE.md and nothing is built yet. The VPS n8n (n8n.kyneticai.com) has only the inactive Retell copy tXJwNTkNgKGnp0Ab, which lacks Twenty, Gmail and Retell credentials and was not activated. Read-only Oct 22: +16692660586 is not Nora's line (only number on the Twilio account; Nora and Emily are not in the Alex Retell workspace).

---
STATUS (Oct 17, 2026, read-only check of n8n, Twenty and the repo; supersedes the Oct 8 status below):
- n8n "Outbound Speed to Lead" (m2YJwZ1l8DTzyEkw) is ACTIVE with 38 nodes (3 sticky notes and 2 disabled draft-SMS nodes included). The Alex agent ID and the "Retell API (outbound)" credential are set. 561 executions so far, the latest 20 all successful on the 5-minute retry sweeper. Go-live has NOT been approved; Abdullah to confirm (repo KI-009). The workflow's own description and sticky notes still say INACTIVE; that text is stale.
- Retell: Alex is agent_71e3cfc8384aa38a910a506b53, LLM llm_5cbc32e5872bbd9afb452c692071, voice 11labs-Cimo, version 0, not published. Its post-call webhook is the n8n post-call path. Alex prompt v1.2.3 is on branch claude/alex-demo-live-test (unmerged).
- END-TO-END TEST PASSED Oct 15: one test lead (Abdullah) submitted the form at 19:36 UTC, the call was placed (secondsToFirstRing 13.8), the lead ended BOOKED and the call was logged as a SPEED_TO_LEAD interaction in self-hosted Twenty. It is the only lead on record.
- Retry and calling-hours behavior as built is the INTENDED behavior (decided Oct 17, D-020, superseding D-012 item 2): calling window 8:00-21:00 in the lead's local time (ZIP, then area code); a 90 second fast retry after a no-answer on attempt 1 (sweeper fallback at +10 minutes), then about +60 minutes after attempt 2; maximum 3 attempts.
- The voice provider bake-off (Retell vs Bland vs ElevenLabs) is tracked separately: task 3.9 (closed Oct 25, ElevenLabs wins).
- Dialing start is now Tue Oct 20 (could move up to Mon Oct 19); see the Start dialing task.
- Still open: counsel reply (1.4); post-call webhook has no header auth (KI-005 / 3.6). Untested: the Twenty filter syntax in the duplicate check and the sweeper (the Oct 15 lead passed through the duplicate check, but no duplicate submission was made to prove the filter matches), and the retry path (the only lead booked on the first call, so no retry has run).

---
HISTORY: Oct 8, 2026 status (superseded by the Oct 17 status above; kept for the record):
STATUS (Oct 8, 2026, session 3, later): n8n workflow BUILT (inactive, never run); Retell agent NOT created. Demo = Kynetic Roofing, a full copy of AM-1 Roofing Inc's (Bend, OR) real profile with only the name changed (D-016 amended). Spoken name "Kynetic Roofing" CONFIRMED. Repo: retell/builds/outbound-speed-to-lead/ (branch claude/inspiring-wozniak-95ayri). Twenty: Kynetic Roofing (Demo) company and client account, BUSINESS PROFILE note, AM-1 Roofing Inc prospect record, DEMO BRIEFING.

n8n: "Outbound Speed to Lead" id m2YJwZ1l8DTzyEkw, 25 nodes, validated, INACTIVE, https://abdullah-kyneticai.app.n8n.cloud/workflow/m2YJwZ1l8DTzyEkw. Twenty + Retell + Gmail only (no Google Sheets, Vapi or Azure). Three paths: form -> lead -> Retell call; Retell post-call webhook -> Twenty interaction + lead update; retry sweeper every 5 min (9:00-20:00 Pacific). The old template KYQIVtxwDcXVKmk3 is untouched.

OPEN (as of Oct 8): (1) Abdullah checks Retell identity verification for outbound (NOT checked yet; blocks the phone test only). (2) Abdullah runs `python tools/retell.py create-outbound --apply` and gives Claude the agent ID. (3) Abdullah creates the n8n Header Auth credential "Retell API (outbound)" and attaches it to the two Retell HTTP nodes (Place Retell Call, Place Retry Call). (4) Fill two placeholders in Call Settings and Retry Call Settings: Retell agent ID and caller ID (confirm +16692660586 is not Nora's live line). (5) Set the workflow's webhook URL on the Retell agent. (6) Unverified until a test run: Twenty REST filter syntax in the duplicate check and sweeper, and the id field returned by the Twenty create node. (7) Web-call test of Alex, phone test last. (8) Never dial the AM-1 office number (now on the demo company record); any call to AM-1 needs the owner's OK. (9) Counsel reply (1.4). (10) Post call webhook has no auth, only an unguessable path (KI-005 / 3.6). Nothing has been dialed.

## TODO (52)

### [P1] [Step 2] 4.7 Rewrite the client agreement for the single speed to lead offer, then send to Quentin's lawyer contacts (pricing superseded by D-023)

_`6a7922dc`, created 2026-10-02, due none_

# CURRENT RECONCILIATION — November 8, 2026 (PST)

Current planning authority: roadmap 7bfdcb7e-4f49-4c1c-94b9-7ffc46d50747; acceptance baseline 603fe300-c5df-49e9-9f04-b0582acd7816; evidence scorecard 5c44b12e-44b4-4e60-a29b-c8c51ea589c0. This update changes documentation only, not completion status, owner, dueAt, relationships, providers or delivery behavior.

Current business authority: canonical five-step roadmap 7bfdcb7e-4f49-4c1c-94b9-7ffc46d50747; frozen baseline v1 603fe300-c5df-49e9-9f04-b0582acd7816; scorecard 5c44b12e-44b4-4e60-a29b-c8c51ea589c0. Twenty owns business planning; GitHub owns technical evidence. Historical bodies below are retained for provenance, not executable current instructions.
Sequence: (1) consolidate; (2) sales-ready foundation and (3) reusable first delivery package run in parallel; (4) human cold-call remodelers and sign the FIRST THREE clients; (5) deliver, measure, refine templates and earn case studies, then expand channels/multi-location work. Do not require all later systems before selling.
First delivery package: Alex + ONE unified CRM deliverable + scheduling + essential follow-up. Standard portal integration, bespoke portal work and background automations are distinct scopes. Other system templates remain a preserved LATER backlog, not a prerequisite to selling.
Alex platform: ElevenLabs, with n8n on the Kynetic VPS orchestrating backend automation. Retell Alex is parked. Portal surfaces results/status/actions, not an automation editor. This planning correction is not a vendor configuration change or proof of live integrations.
Safety: never invoke or modify Nora, live Emily, live Alex agent_8201m5afn2rbeb7v29xfkhh1pjef, or Kynetic Restoration (Demo) under this cleanup. Use separate approved DEV/demo resources for future tests. No production deployment, calls, texts, messages, workflow activation, paid-plan change, schema change, or commercial-term invention is authorized here. Human cold outreach only; preserve consent, quiet-hours, kill-switch and counsel gates; no FL/OK, no HIPAA, AM-1 do-not-call, no Google Drive/Docs/Sheets. Use only TWENTY_BASE_URL + TWENTY_SELFHOST_API_KEY; never TWENTY_API_KEY or REST DELETE.

Commercial authority reconciliation: D-023 (93db3245-96ee-4fb8-8afd-73ae66985d95) is the dated approved October 24 pricing decision and expressly supersedes D-017. Do not ask Abdullah to choose again between those two historical decisions. Reconcile stale text against the approved record; later November 6 founding/standard/transformation figures are proposals unless a separate approval is evidenced. This cleanup does not approve those proposals, change financial terms, alter opportunity tier schema, or certify today's entire commercial package final.
Current remodeler guarantee, locked November 5 in Growth Playbook 21fba68a-226b-4693-834f-7408366adf11: “We book remodelers 20% more appointments than last month in 30 days, or we work free until we do.” Baseline is last month's booked appointments; client maintains last month's ads level and takes the appointments set. This is booked appointments, not guaranteed jobs/revenue. This replaces the older 14-day/month-fee-waiver guarantee only; it does not itself change the dated approved prices. Earlier 14-day operational plans may remain historical estimates, not this guarantee.

---

## Historical pre-reconciliation body — retained verbatim; current guidance above takes precedence. Historical claims are not current proof or permission.

**Audit cross-link (2026-11-08):** pricing is an UNRESOLVED conflict between D-017 and D-023 (see D-023 note 93db3245-96ee-4fb8-8afd-73ae66985d95 and the roadmap note 7bfdcb7e-4f49-4c1c-94b9-7ffc46d50747). Treated as unknown in the scorecard. Step 2 checks S2.7 and S2.8. Draft agreement note: 1fbd47cf-db25-41f8-b2ec-7cc6078b23fd (draft, NOT send-ready).

**Superseded Oct 24, 2026 by new pricing — see D-023: Current offer, pricing, niches and upsells.** Any old pricing or niches below ($4,675 first 3 / $8,500 after, $800 / $2,000 / $3,500 tiers, 1,200 minutes then 25¢/min, remodelers + foundation repair niche list, $30K goal) are no longer valid. Current: founding (first 3) $6,500 setup + 3 months (50% signing / 50% go-live), then $1,500/mo or $4,000 prepaid months 4–6; standard $10,000 (50/25/25: signing / go-live / day 45; month 4 free if paid in full), then $2,000/mo or $5,000 prepaid months 4–6. Software included, no per-minute charges (fair-use clause). Niches: remodelers (any), solar + battery, custom pools, windows + doors, decks + outdoor living; must be running Meta ads. Upsells: reactivation $3,000 or $1,000/mo; quote follow-up $2,500 + $500/mo; after-hours $1,500 + $500/mo. Goal: $100K signed contracts by Dec 31, 2026.

Add AI and TCPA terms. The GDJ one page agreement is a model for layout only. Related: the two TIER 1 attorney tasks.

Oct 13, 2026 (D-017): the agreement must cover the 3-month package, the three milestone invoices, and a definition of "built and sent for testing" and "completion". Status of the lawyer review unknown.

### [P1] [Step 2] 4.8 Attorney review: MSA/SOW + TCPA language (AI liability section, emergency opt out gap)

_`1c62e130`, created 2026-09-24, due none_



### [P1] [Step 2] 7.1 Launch gate check before any dialing starts

_`836ed6d1`, created 2026-10-02, due none_

# CURRENT RECONCILIATION — November 8, 2026 (PST)

Current planning authority: roadmap 7bfdcb7e-4f49-4c1c-94b9-7ffc46d50747; acceptance baseline 603fe300-c5df-49e9-9f04-b0582acd7816; evidence scorecard 5c44b12e-44b4-4e60-a29b-c8c51ea589c0. This update changes documentation only, not completion status, owner, dueAt, relationships, providers or delivery behavior.

Current business authority: canonical five-step roadmap 7bfdcb7e-4f49-4c1c-94b9-7ffc46d50747; frozen baseline v1 603fe300-c5df-49e9-9f04-b0582acd7816; scorecard 5c44b12e-44b4-4e60-a29b-c8c51ea589c0. Twenty owns business planning; GitHub owns technical evidence. Historical bodies below are retained for provenance, not executable current instructions.
Sequence: (1) consolidate; (2) sales-ready foundation and (3) reusable first delivery package run in parallel; (4) human cold-call remodelers and sign the FIRST THREE clients; (5) deliver, measure, refine templates and earn case studies, then expand channels/multi-location work. Do not require all later systems before selling.
First delivery package: Alex + ONE unified CRM deliverable + scheduling + essential follow-up. Standard portal integration, bespoke portal work and background automations are distinct scopes. Other system templates remain a preserved LATER backlog, not a prerequisite to selling.
Alex platform: ElevenLabs, with n8n on the Kynetic VPS orchestrating backend automation. Retell Alex is parked. Portal surfaces results/status/actions, not an automation editor. This planning correction is not a vendor configuration change or proof of live integrations.
Safety: never invoke or modify Nora, live Emily, live Alex agent_8201m5afn2rbeb7v29xfkhh1pjef, or Kynetic Restoration (Demo) under this cleanup. Use separate approved DEV/demo resources for future tests. No production deployment, calls, texts, messages, workflow activation, paid-plan change, schema change, or commercial-term invention is authorized here. Human cold outreach only; preserve consent, quiet-hours, kill-switch and counsel gates; no FL/OK, no HIPAA, AM-1 do-not-call, no Google Drive/Docs/Sheets. Use only TWENTY_BASE_URL + TWENTY_SELFHOST_API_KEY; never TWENTY_API_KEY or REST DELETE.

Launch gate must distinguish sales-readiness minimum from production activation. It must not require every later automation or all five historical clients before remodeler calling. Security, compliant human outreach, approved offer/pitch and demonstrable delivery capacity remain necessary.

---

## Historical pre-reconciliation body — retained verbatim; current guidance above takes precedence. Historical claims are not current proof or permission.

See MASTER PLAN phase 7. Demo works end to end, list refills without Abdullah, proposal and Stripe and agreement can go out same day, dry run time known, scripts final and practiced.

Oct 13, 2026: Abdullah says every item will be done by Oct 14 and dialing starts Oct 15 (D-017). Verify each item before the first dial. Record the dry run time, because it sets how many clients can be signed per week.

UPDATE (Oct 17, 2026): the Oct 14 and Oct 15 dates did not hold. Dialing now starts Tue Oct 20 (could move up to Mon Oct 19). The gate still has to be verified item by item before the first dial.

### [P1] [Step 2] Build unit economics from real costs and dated approved pricing; distinguish later unapproved proposals

_`c0018349`, created 2026-09-24, due none_

# CURRENT RECONCILIATION — November 8, 2026 (PST)

Current planning authority: roadmap 7bfdcb7e-4f49-4c1c-94b9-7ffc46d50747; acceptance baseline 603fe300-c5df-49e9-9f04-b0582acd7816; evidence scorecard 5c44b12e-44b4-4e60-a29b-c8c51ea589c0. This update changes documentation only, not completion status, owner, dueAt, relationships, providers or delivery behavior.

Current business authority: canonical five-step roadmap 7bfdcb7e-4f49-4c1c-94b9-7ffc46d50747; frozen baseline v1 603fe300-c5df-49e9-9f04-b0582acd7816; scorecard 5c44b12e-44b4-4e60-a29b-c8c51ea589c0. Twenty owns business planning; GitHub owns technical evidence. Historical bodies below are retained for provenance, not executable current instructions.
Sequence: (1) consolidate; (2) sales-ready foundation and (3) reusable first delivery package run in parallel; (4) human cold-call remodelers and sign the FIRST THREE clients; (5) deliver, measure, refine templates and earn case studies, then expand channels/multi-location work. Do not require all later systems before selling.
First delivery package: Alex + ONE unified CRM deliverable + scheduling + essential follow-up. Standard portal integration, bespoke portal work and background automations are distinct scopes. Other system templates remain a preserved LATER backlog, not a prerequisite to selling.
Alex platform: ElevenLabs, with n8n on the Kynetic VPS orchestrating backend automation. Retell Alex is parked. Portal surfaces results/status/actions, not an automation editor. This planning correction is not a vendor configuration change or proof of live integrations.
Safety: never invoke or modify Nora, live Emily, live Alex agent_8201m5afn2rbeb7v29xfkhh1pjef, or Kynetic Restoration (Demo) under this cleanup. Use separate approved DEV/demo resources for future tests. No production deployment, calls, texts, messages, workflow activation, paid-plan change, schema change, or commercial-term invention is authorized here. Human cold outreach only; preserve consent, quiet-hours, kill-switch and counsel gates; no FL/OK, no HIPAA, AM-1 do-not-call, no Google Drive/Docs/Sheets. Use only TWENTY_BASE_URL + TWENTY_SELFHOST_API_KEY; never TWENTY_API_KEY or REST DELETE.

Commercial authority reconciliation: D-023 (93db3245-96ee-4fb8-8afd-73ae66985d95) is the dated approved October 24 pricing decision and expressly supersedes D-017. Do not ask Abdullah to choose again between those two historical decisions. Reconcile stale text against the approved record; later November 6 founding/standard/transformation figures are proposals unless a separate approval is evidenced. This cleanup does not approve those proposals, change financial terms, alter opportunity tier schema, or certify today's entire commercial package final.
Current remodeler guarantee, locked November 5 in Growth Playbook 21fba68a-226b-4693-834f-7408366adf11: “We book remodelers 20% more appointments than last month in 30 days, or we work free until we do.” Baseline is last month's booked appointments; client maintains last month's ads level and takes the appointments set. This is booked appointments, not guaranteed jobs/revenue. This replaces the older 14-day/month-fee-waiver guarantee only; it does not itself change the dated approved prices. Earlier 14-day operational plans may remain historical estimates, not this guarantee.

Preserved prior title: [P1] [Step 2] 4.3 Build unit economics model (real cost per client vs $4,675 / $8,500 3-month package, D-017) (pricing superseded by D-023)

---

## Historical pre-reconciliation body — retained verbatim; current guidance above takes precedence. Historical claims are not current proof or permission.

**Audit cross-link (2026-11-08):** pricing is an UNRESOLVED conflict between D-017 and D-023 (see D-023 note 93db3245-96ee-4fb8-8afd-73ae66985d95 and the roadmap note 7bfdcb7e-4f49-4c1c-94b9-7ffc46d50747). Treated as unknown in the scorecard. Step 2 check S2.4.

**Superseded Oct 24, 2026 by new pricing — see D-023: Current offer, pricing, niches and upsells.** Any old pricing or niches below ($4,675 first 3 / $8,500 after, $800 / $2,000 / $3,500 tiers, 1,200 minutes then 25¢/min, remodelers + foundation repair niche list, $30K goal) are no longer valid. Current: founding (first 3) $6,500 setup + 3 months (50% signing / 50% go-live), then $1,500/mo or $4,000 prepaid months 4–6; standard $10,000 (50/25/25: signing / go-live / day 45; month 4 free if paid in full), then $2,000/mo or $5,000 prepaid months 4–6. Software included, no per-minute charges (fair-use clause). Niches: remodelers (any), solar + battery, custom pools, windows + doors, decks + outdoor living; must be running Meta ads. Upsells: reactivation $3,000 or $1,000/mo; quote follow-up $2,500 + $500/mo; after-hours $1,500 + $500/mo. Goal: $100K signed contracts by Dec 31, 2026.

Oct 13, 2026: retitled from "$997/mo + $1,500 setup" (superseded by D-017).

### [P1] [Step 2] Confirm sales/delivery responsibilities and completion acceptance with Quentin (old Oct 19 date historical)

_`481c4373`, created 2026-10-13, due none_

# CURRENT RECONCILIATION — November 8, 2026 (PST)

Current planning authority: roadmap 7bfdcb7e-4f49-4c1c-94b9-7ffc46d50747; acceptance baseline 603fe300-c5df-49e9-9f04-b0582acd7816; evidence scorecard 5c44b12e-44b4-4e60-a29b-c8c51ea589c0. This update changes documentation only, not completion status, owner, dueAt, relationships, providers or delivery behavior.

Current business authority: canonical five-step roadmap 7bfdcb7e-4f49-4c1c-94b9-7ffc46d50747; frozen baseline v1 603fe300-c5df-49e9-9f04-b0582acd7816; scorecard 5c44b12e-44b4-4e60-a29b-c8c51ea589c0. Twenty owns business planning; GitHub owns technical evidence. Historical bodies below are retained for provenance, not executable current instructions.
Sequence: (1) consolidate; (2) sales-ready foundation and (3) reusable first delivery package run in parallel; (4) human cold-call remodelers and sign the FIRST THREE clients; (5) deliver, measure, refine templates and earn case studies, then expand channels/multi-location work. Do not require all later systems before selling.
First delivery package: Alex + ONE unified CRM deliverable + scheduling + essential follow-up. Standard portal integration, bespoke portal work and background automations are distinct scopes. Other system templates remain a preserved LATER backlog, not a prerequisite to selling.
Alex platform: ElevenLabs, with n8n on the Kynetic VPS orchestrating backend automation. Retell Alex is parked. Portal surfaces results/status/actions, not an automation editor. This planning correction is not a vendor configuration change or proof of live integrations.
Safety: never invoke or modify Nora, live Emily, live Alex agent_8201m5afn2rbeb7v29xfkhh1pjef, or Kynetic Restoration (Demo) under this cleanup. Use separate approved DEV/demo resources for future tests. No production deployment, calls, texts, messages, workflow activation, paid-plan change, schema change, or commercial-term invention is authorized here. Human cold outreach only; preserve consent, quiet-hours, kill-switch and counsel gates; no FL/OK, no HIPAA, AM-1 do-not-call, no Google Drive/Docs/Sheets. Use only TWENTY_BASE_URL + TWENTY_SELFHOST_API_KEY; never TWENTY_API_KEY or REST DELETE.

Commercial authority reconciliation: D-023 (93db3245-96ee-4fb8-8afd-73ae66985d95) is the dated approved October 24 pricing decision and expressly supersedes D-017. Do not ask Abdullah to choose again between those two historical decisions. Reconcile stale text against the approved record; later November 6 founding/standard/transformation figures are proposals unless a separate approval is evidenced. This cleanup does not approve those proposals, change financial terms, alter opportunity tier schema, or certify today's entire commercial package final.
Current remodeler guarantee, locked November 5 in Growth Playbook 21fba68a-226b-4693-834f-7408366adf11: “We book remodelers 20% more appointments than last month in 30 days, or we work free until we do.” Baseline is last month's booked appointments; client maintains last month's ads level and takes the appointments set. This is booked appointments, not guaranteed jobs/revenue. This replaces the older 14-day/month-fee-waiver guarantee only; it does not itself change the dated approved prices. Earlier 14-day operational plans may remain historical estimates, not this guarantee.

Due date cleared 2026-11-09: the superseded planning date was 2026-10-19T17:00:00.000Z. It was not a current promised deadline. Original value preserved in the change journal (project file audit-2026-11-08/change-journal-twenty.md). No reschedule is invented.

Preserved prior title: [P1] [Step 2] Confirm with Quentin: meaning of "completion", who dials (D-017 signed off Oct 13) (pricing superseded by D-023)

---

## Historical pre-reconciliation body — retained verbatim; current guidance above takes precedence. Historical claims are not current proof or permission.

**Superseded Oct 24, 2026 by new pricing — see D-023: Current offer, pricing, niches and upsells.** Any old pricing or niches below ($4,675 first 3 / $8,500 after, $800 / $2,000 / $3,500 tiers, 1,200 minutes then 25¢/min, remodelers + foundation repair niche list, $30K goal) are no longer valid. Current: founding (first 3) $6,500 setup + 3 months (50% signing / 50% go-live), then $1,500/mo or $4,000 prepaid months 4–6; standard $10,000 (50/25/25: signing / go-live / day 45; month 4 free if paid in full), then $2,000/mo or $5,000 prepaid months 4–6. Software included, no per-minute charges (fair-use clause). Niches: remodelers (any), solar + battery, custom pools, windows + doors, decks + outdoor living; must be running Meta ads. Upsells: reactivation $3,000 or $1,000/mo; quote follow-up $2,500 + $500/mo; after-hours $1,500 + $500/mo. Goal: $100K signed contracts by Dec 31, 2026.

UPDATE (Oct 17, 2026): due date moved from Oct 14 to Mon Oct 19, the day before the Tue Oct 20 dialing start. Who dials has to be settled before the first dial.

Open items from the Q4 Revenue Plan: (1) DONE Oct 13: Quentin signed off on $4,675 / $8,500 and the 50/25/25 invoices (D-017 final). (2) "Completion" assumed to mean build go-live. (3) Who dials and how the 75 dials a day are split between Abdullah and Quentin. Also unknown: lead pool size (need about 3,000 owner-gated numbers) and build time per client.

### [P1] [Step 2] Define invoice mechanics against dated approved D-023 terms; later proposed rates require separate approval

_`8239af7f`, created 2026-10-02, due none_

# CURRENT RECONCILIATION — November 8, 2026 (PST)

Current planning authority: roadmap 7bfdcb7e-4f49-4c1c-94b9-7ffc46d50747; acceptance baseline 603fe300-c5df-49e9-9f04-b0582acd7816; evidence scorecard 5c44b12e-44b4-4e60-a29b-c8c51ea589c0. This update changes documentation only, not completion status, owner, dueAt, relationships, providers or delivery behavior.

Current business authority: canonical five-step roadmap 7bfdcb7e-4f49-4c1c-94b9-7ffc46d50747; frozen baseline v1 603fe300-c5df-49e9-9f04-b0582acd7816; scorecard 5c44b12e-44b4-4e60-a29b-c8c51ea589c0. Twenty owns business planning; GitHub owns technical evidence. Historical bodies below are retained for provenance, not executable current instructions.
Sequence: (1) consolidate; (2) sales-ready foundation and (3) reusable first delivery package run in parallel; (4) human cold-call remodelers and sign the FIRST THREE clients; (5) deliver, measure, refine templates and earn case studies, then expand channels/multi-location work. Do not require all later systems before selling.
First delivery package: Alex + ONE unified CRM deliverable + scheduling + essential follow-up. Standard portal integration, bespoke portal work and background automations are distinct scopes. Other system templates remain a preserved LATER backlog, not a prerequisite to selling.
Alex platform: ElevenLabs, with n8n on the Kynetic VPS orchestrating backend automation. Retell Alex is parked. Portal surfaces results/status/actions, not an automation editor. This planning correction is not a vendor configuration change or proof of live integrations.
Safety: never invoke or modify Nora, live Emily, live Alex agent_8201m5afn2rbeb7v29xfkhh1pjef, or Kynetic Restoration (Demo) under this cleanup. Use separate approved DEV/demo resources for future tests. No production deployment, calls, texts, messages, workflow activation, paid-plan change, schema change, or commercial-term invention is authorized here. Human cold outreach only; preserve consent, quiet-hours, kill-switch and counsel gates; no FL/OK, no HIPAA, AM-1 do-not-call, no Google Drive/Docs/Sheets. Use only TWENTY_BASE_URL + TWENTY_SELFHOST_API_KEY; never TWENTY_API_KEY or REST DELETE.

Commercial authority reconciliation: D-023 (93db3245-96ee-4fb8-8afd-73ae66985d95) is the dated approved October 24 pricing decision and expressly supersedes D-017. Do not ask Abdullah to choose again between those two historical decisions. Reconcile stale text against the approved record; later November 6 founding/standard/transformation figures are proposals unless a separate approval is evidenced. This cleanup does not approve those proposals, change financial terms, alter opportunity tier schema, or certify today's entire commercial package final.
Current remodeler guarantee, locked November 5 in Growth Playbook 21fba68a-226b-4693-834f-7408366adf11: “We book remodelers 20% more appointments than last month in 30 days, or we work free until we do.” Baseline is last month's booked appointments; client maintains last month's ads level and takes the appointments set. This is booked appointments, not guaranteed jobs/revenue. This replaces the older 14-day/month-fee-waiver guarantee only; it does not itself change the dated approved prices. Earlier 14-day operational plans may remain historical estimates, not this guarantee.

Preserved prior title: [P1] [Step 2] 4.6 Set up Stripe milestone invoices: 3 per client (50% start, 25% built and sent for testing, 25% completion)

---

## Historical pre-reconciliation body — retained verbatim; current guidance above takes precedence. Historical claims are not current proof or permission.

**Audit cross-link (2026-11-08):** this task still describes D-017 amounts. Pricing is an UNRESOLVED conflict between D-017 and D-023 (see D-023 note 93db3245-96ee-4fb8-8afd-73ae66985d95 and the roadmap note 7bfdcb7e-4f49-4c1c-94b9-7ffc46d50747). D-023 schedule: founding 50/50 on $6,500, standard 50/25/25 on $10,000. Not changed here. Step 2 check S2.7. Stripe state unverified (connector sign-in expired; sales audit 2026-11-08).

Updated Oct 13, 2026 (D-017). Replaces the $1,500 setup + $997/mo subscription link. Multiple invoices, not a subscription. Amounts: first 3 clients $2,337.50 / $1,168.75 / $1,168.75; clients 4+ $4,250 / $2,125 / $2,125. Abdullah says it will be done by Oct 14. No Stripe links were live as of the last note. See Payment Terms & Processor Setup.

UPDATE (Oct 17, 2026): not done yet (status TODO). Now needed before the Tue Oct 20 dialing start.

### [P1] [Step 2] Document the free AI audit process (steps, inputs, sample output) for the pitch

_`1df59a3b`, created 2026-11-08, due none_

# CURRENT RECONCILIATION — November 8, 2026 (PST)

Current planning authority: roadmap 7bfdcb7e-4f49-4c1c-94b9-7ffc46d50747; acceptance baseline 603fe300-c5df-49e9-9f04-b0582acd7816; evidence scorecard 5c44b12e-44b4-4e60-a29b-c8c51ea589c0. This update changes documentation only, not completion status, owner, dueAt, relationships, providers or delivery behavior.

Current business authority: canonical five-step roadmap 7bfdcb7e-4f49-4c1c-94b9-7ffc46d50747; frozen baseline v1 603fe300-c5df-49e9-9f04-b0582acd7816; scorecard 5c44b12e-44b4-4e60-a29b-c8c51ea589c0. Twenty owns business planning; GitHub owns technical evidence. Historical bodies below are retained for provenance, not executable current instructions.
Sequence: (1) consolidate; (2) sales-ready foundation and (3) reusable first delivery package run in parallel; (4) human cold-call remodelers and sign the FIRST THREE clients; (5) deliver, measure, refine templates and earn case studies, then expand channels/multi-location work. Do not require all later systems before selling.
First delivery package: Alex + ONE unified CRM deliverable + scheduling + essential follow-up. Standard portal integration, bespoke portal work and background automations are distinct scopes. Other system templates remain a preserved LATER backlog, not a prerequisite to selling.
Alex platform: ElevenLabs, with n8n on the Kynetic VPS orchestrating backend automation. Retell Alex is parked. Portal surfaces results/status/actions, not an automation editor. This planning correction is not a vendor configuration change or proof of live integrations.
Safety: never invoke or modify Nora, live Emily, live Alex agent_8201m5afn2rbeb7v29xfkhh1pjef, or Kynetic Restoration (Demo) under this cleanup. Use separate approved DEV/demo resources for future tests. No production deployment, calls, texts, messages, workflow activation, paid-plan change, schema change, or commercial-term invention is authorized here. Human cold outreach only; preserve consent, quiet-hours, kill-switch and counsel gates; no FL/OK, no HIPAA, AM-1 do-not-call, no Google Drive/Docs/Sheets. Use only TWENTY_BASE_URL + TWENTY_SELFHOST_API_KEY; never TWENTY_API_KEY or REST DELETE.

---

## Historical pre-reconciliation body — retained verbatim; current guidance above takes precedence. Historical claims are not current proof or permission.

Check S2.5 in SCORECARD BASELINE v1. Created 2026-11-08 by the audit. Owner not assigned (proposal: Abdullah).

### [P1] [Step 2] Draft proposal using dated approved pricing and current Nov 5 guarantee; no invented financial terms

_`fb66b7c0`, created 2026-10-02, due none_

# CURRENT RECONCILIATION — November 8, 2026 (PST)

Current planning authority: roadmap 7bfdcb7e-4f49-4c1c-94b9-7ffc46d50747; acceptance baseline 603fe300-c5df-49e9-9f04-b0582acd7816; evidence scorecard 5c44b12e-44b4-4e60-a29b-c8c51ea589c0. This update changes documentation only, not completion status, owner, dueAt, relationships, providers or delivery behavior.

Current business authority: canonical five-step roadmap 7bfdcb7e-4f49-4c1c-94b9-7ffc46d50747; frozen baseline v1 603fe300-c5df-49e9-9f04-b0582acd7816; scorecard 5c44b12e-44b4-4e60-a29b-c8c51ea589c0. Twenty owns business planning; GitHub owns technical evidence. Historical bodies below are retained for provenance, not executable current instructions.
Sequence: (1) consolidate; (2) sales-ready foundation and (3) reusable first delivery package run in parallel; (4) human cold-call remodelers and sign the FIRST THREE clients; (5) deliver, measure, refine templates and earn case studies, then expand channels/multi-location work. Do not require all later systems before selling.
First delivery package: Alex + ONE unified CRM deliverable + scheduling + essential follow-up. Standard portal integration, bespoke portal work and background automations are distinct scopes. Other system templates remain a preserved LATER backlog, not a prerequisite to selling.
Alex platform: ElevenLabs, with n8n on the Kynetic VPS orchestrating backend automation. Retell Alex is parked. Portal surfaces results/status/actions, not an automation editor. This planning correction is not a vendor configuration change or proof of live integrations.
Safety: never invoke or modify Nora, live Emily, live Alex agent_8201m5afn2rbeb7v29xfkhh1pjef, or Kynetic Restoration (Demo) under this cleanup. Use separate approved DEV/demo resources for future tests. No production deployment, calls, texts, messages, workflow activation, paid-plan change, schema change, or commercial-term invention is authorized here. Human cold outreach only; preserve consent, quiet-hours, kill-switch and counsel gates; no FL/OK, no HIPAA, AM-1 do-not-call, no Google Drive/Docs/Sheets. Use only TWENTY_BASE_URL + TWENTY_SELFHOST_API_KEY; never TWENTY_API_KEY or REST DELETE.

Commercial authority reconciliation: D-023 (93db3245-96ee-4fb8-8afd-73ae66985d95) is the dated approved October 24 pricing decision and expressly supersedes D-017. Do not ask Abdullah to choose again between those two historical decisions. Reconcile stale text against the approved record; later November 6 founding/standard/transformation figures are proposals unless a separate approval is evidenced. This cleanup does not approve those proposals, change financial terms, alter opportunity tier schema, or certify today's entire commercial package final.
Current remodeler guarantee, locked November 5 in Growth Playbook 21fba68a-226b-4693-834f-7408366adf11: “We book remodelers 20% more appointments than last month in 30 days, or we work free until we do.” Baseline is last month's booked appointments; client maintains last month's ads level and takes the appointments set. This is booked appointments, not guaranteed jobs/revenue. This replaces the older 14-day/month-fee-waiver guarantee only; it does not itself change the dated approved prices. Earlier 14-day operational plans may remain historical estimates, not this guarantee.

Preserved prior title: [P1] [Step 2] 4.5 One page proposal template: 3-month package, $4,675 (first 3) / $8,500, 50/25/25 invoices (pricing superseded by D-023)

---

## Historical pre-reconciliation body — retained verbatim; current guidance above takes precedence. Historical claims are not current proof or permission.

**Audit cross-link (2026-11-08):** pricing is an UNRESOLVED conflict between D-017 and D-023 (see D-023 note 93db3245-96ee-4fb8-8afd-73ae66985d95 and the roadmap note 7bfdcb7e-4f49-4c1c-94b9-7ffc46d50747). Treated as unknown in the scorecard. Step 2 checks S2.4 and S2.7. No sendable proposal exists today.

**Superseded Oct 24, 2026 by new pricing — see D-023: Current offer, pricing, niches and upsells.** Any old pricing or niches below ($4,675 first 3 / $8,500 after, $800 / $2,000 / $3,500 tiers, 1,200 minutes then 25¢/min, remodelers + foundation repair niche list, $30K goal) are no longer valid. Current: founding (first 3) $6,500 setup + 3 months (50% signing / 50% go-live), then $1,500/mo or $4,000 prepaid months 4–6; standard $10,000 (50/25/25: signing / go-live / day 45; month 4 free if paid in full), then $2,000/mo or $5,000 prepaid months 4–6. Software included, no per-minute charges (fair-use clause). Niches: remodelers (any), solar + battery, custom pools, windows + doors, decks + outdoor living; must be running Meta ads. Upsells: reactivation $3,000 or $1,000/mo; quote follow-up $2,500 + $500/mo; after-hours $1,500 + $500/mo. Goal: $100K signed contracts by Dec 31, 2026.

Updated Oct 13, 2026 (D-017). Replaces the $1,500 + $997/mo figures. Abdullah says it will be done by Oct 14.

UPDATE (Oct 17, 2026): not done yet (status TODO). Now needed before the Tue Oct 20 dialing start, since a yes has to be signable the same day.

### [P1] [Step 2] Finalize demo call script, objection answers and voicemail; rehearse the approved remodeler pitch

_`dda6a16c`, created 2026-10-02, due none_

# CURRENT RECONCILIATION — November 8, 2026 (PST)

Current planning authority: roadmap 7bfdcb7e-4f49-4c1c-94b9-7ffc46d50747; acceptance baseline 603fe300-c5df-49e9-9f04-b0582acd7816; evidence scorecard 5c44b12e-44b4-4e60-a29b-c8c51ea589c0. This update changes documentation only, not completion status, owner, dueAt, relationships, providers or delivery behavior.

Current business authority: canonical five-step roadmap 7bfdcb7e-4f49-4c1c-94b9-7ffc46d50747; frozen baseline v1 603fe300-c5df-49e9-9f04-b0582acd7816; scorecard 5c44b12e-44b4-4e60-a29b-c8c51ea589c0. Twenty owns business planning; GitHub owns technical evidence. Historical bodies below are retained for provenance, not executable current instructions.
Sequence: (1) consolidate; (2) sales-ready foundation and (3) reusable first delivery package run in parallel; (4) human cold-call remodelers and sign the FIRST THREE clients; (5) deliver, measure, refine templates and earn case studies, then expand channels/multi-location work. Do not require all later systems before selling.
First delivery package: Alex + ONE unified CRM deliverable + scheduling + essential follow-up. Standard portal integration, bespoke portal work and background automations are distinct scopes. Other system templates remain a preserved LATER backlog, not a prerequisite to selling.
Alex platform: ElevenLabs, with n8n on the Kynetic VPS orchestrating backend automation. Retell Alex is parked. Portal surfaces results/status/actions, not an automation editor. This planning correction is not a vendor configuration change or proof of live integrations.
Safety: never invoke or modify Nora, live Emily, live Alex agent_8201m5afn2rbeb7v29xfkhh1pjef, or Kynetic Restoration (Demo) under this cleanup. Use separate approved DEV/demo resources for future tests. No production deployment, calls, texts, messages, workflow activation, paid-plan change, schema change, or commercial-term invention is authorized here. Human cold outreach only; preserve consent, quiet-hours, kill-switch and counsel gates; no FL/OK, no HIPAA, AM-1 do-not-call, no Google Drive/Docs/Sheets. Use only TWENTY_BASE_URL + TWENTY_SELFHOST_API_KEY; never TWENTY_API_KEY or REST DELETE.

Preserved prior title: [P1] 4.2 Demo call script, objection answers, voicemail script, Google Voice line (drop the old audit opener)

---

## Historical pre-reconciliation body — retained verbatim; current guidance above takes precedence. Historical claims are not current proof or permission.

Opener: Hey, I just saw your ad, how fast are you responding to these people? Calls go only to business owners.

### [P1] [Step 2] LAUNCH BLOCKER: lock portal.kyneticai.com (live /admin open as of 2026-11-08). Deploy main 49019b93 via Kynetic VPS session, invite Abdullah and Quentin, confirm /admin redirects

_`98c8471c`, created 2026-11-08, due none_



### [P1] [Step 2] Propagate locked Nov 5 remodeler appointment guarantee and its conditions into sales assets

_`7264fdee`, created 2026-10-02, due none_

# CURRENT RECONCILIATION — November 8, 2026 (PST)

Current planning authority: roadmap 7bfdcb7e-4f49-4c1c-94b9-7ffc46d50747; acceptance baseline 603fe300-c5df-49e9-9f04-b0582acd7816; evidence scorecard 5c44b12e-44b4-4e60-a29b-c8c51ea589c0. This update changes documentation only, not completion status, owner, dueAt, relationships, providers or delivery behavior.

Current business authority: canonical five-step roadmap 7bfdcb7e-4f49-4c1c-94b9-7ffc46d50747; frozen baseline v1 603fe300-c5df-49e9-9f04-b0582acd7816; scorecard 5c44b12e-44b4-4e60-a29b-c8c51ea589c0. Twenty owns business planning; GitHub owns technical evidence. Historical bodies below are retained for provenance, not executable current instructions.
Sequence: (1) consolidate; (2) sales-ready foundation and (3) reusable first delivery package run in parallel; (4) human cold-call remodelers and sign the FIRST THREE clients; (5) deliver, measure, refine templates and earn case studies, then expand channels/multi-location work. Do not require all later systems before selling.
First delivery package: Alex + ONE unified CRM deliverable + scheduling + essential follow-up. Standard portal integration, bespoke portal work and background automations are distinct scopes. Other system templates remain a preserved LATER backlog, not a prerequisite to selling.
Alex platform: ElevenLabs, with n8n on the Kynetic VPS orchestrating backend automation. Retell Alex is parked. Portal surfaces results/status/actions, not an automation editor. This planning correction is not a vendor configuration change or proof of live integrations.
Safety: never invoke or modify Nora, live Emily, live Alex agent_8201m5afn2rbeb7v29xfkhh1pjef, or Kynetic Restoration (Demo) under this cleanup. Use separate approved DEV/demo resources for future tests. No production deployment, calls, texts, messages, workflow activation, paid-plan change, schema change, or commercial-term invention is authorized here. Human cold outreach only; preserve consent, quiet-hours, kill-switch and counsel gates; no FL/OK, no HIPAA, AM-1 do-not-call, no Google Drive/Docs/Sheets. Use only TWENTY_BASE_URL + TWENTY_SELFHOST_API_KEY; never TWENTY_API_KEY or REST DELETE.

Commercial authority reconciliation: D-023 (93db3245-96ee-4fb8-8afd-73ae66985d95) is the dated approved October 24 pricing decision and expressly supersedes D-017. Do not ask Abdullah to choose again between those two historical decisions. Reconcile stale text against the approved record; later November 6 founding/standard/transformation figures are proposals unless a separate approval is evidenced. This cleanup does not approve those proposals, change financial terms, alter opportunity tier schema, or certify today's entire commercial package final.
Current remodeler guarantee, locked November 5 in Growth Playbook 21fba68a-226b-4693-834f-7408366adf11: “We book remodelers 20% more appointments than last month in 30 days, or we work free until we do.” Baseline is last month's booked appointments; client maintains last month's ads level and takes the appointments set. This is booked appointments, not guaranteed jobs/revenue. This replaces the older 14-day/month-fee-waiver guarantee only; it does not itself change the dated approved prices. Earlier 14-day operational plans may remain historical estimates, not this guarantee.

Preserved prior title: [P1] [Step 2] 4.4 Decide the results guarantee terms (pricing superseded by D-023)

---

## Historical pre-reconciliation body — retained verbatim; current guidance above takes precedence. Historical claims are not current proof or permission.

**Audit cross-link (2026-11-08):** pricing is an UNRESOLVED conflict between D-017 and D-023 (see D-023 note 93db3245-96ee-4fb8-8afd-73ae66985d95 and the roadmap note 7bfdcb7e-4f49-4c1c-94b9-7ffc46d50747). Treated as unknown in the scorecard. Step 2 checks S2.2 and S2.4. Guarantee wording is also open: the home page states the D-023 guarantee as final, /remodelers shows [DRAFT WORDING].

**Superseded Oct 24, 2026 by new pricing — see D-023: Current offer, pricing, niches and upsells.** Any old pricing or niches below ($4,675 first 3 / $8,500 after, $800 / $2,000 / $3,500 tiers, 1,200 minutes then 25¢/min, remodelers + foundation repair niche list, $30K goal) are no longer valid. Current: founding (first 3) $6,500 setup + 3 months (50% signing / 50% go-live), then $1,500/mo or $4,000 prepaid months 4–6; standard $10,000 (50/25/25: signing / go-live / day 45; month 4 free if paid in full), then $2,000/mo or $5,000 prepaid months 4–6. Software included, no per-minute charges (fair-use clause). Niches: remodelers (any), solar + battery, custom pools, windows + doors, decks + outdoor living; must be running Meta ads. Upsells: reactivation $3,000 or $1,000/mo; quote follow-up $2,500 + $500/mo; after-hours $1,500 + $500/mo. Goal: $100K signed contracts by Dec 31, 2026.

Needed before the proposal and the agreement rewrite. Terms not set as of Oct 1, 2026. Status as of Oct 13, 2026: no information on whether terms are set. Pricing is now D-017 (3-month packages, 50/25/25 invoices). Prospects paying $4,675 to $8,500 mostly up front are likely to ask about a guarantee.

### [P1] [Step 2] Reconcile approved D-023 pricing with stale artifacts; distinguish later unapproved proposals (schema change excluded)

_`17289c41`, created 2026-11-08, due none_

# CURRENT RECONCILIATION — November 8, 2026 (PST)

Current planning authority: roadmap 7bfdcb7e-4f49-4c1c-94b9-7ffc46d50747; acceptance baseline 603fe300-c5df-49e9-9f04-b0582acd7816; evidence scorecard 5c44b12e-44b4-4e60-a29b-c8c51ea589c0. This update changes documentation only, not completion status, owner, dueAt, relationships, providers or delivery behavior.

Current business authority: canonical five-step roadmap 7bfdcb7e-4f49-4c1c-94b9-7ffc46d50747; frozen baseline v1 603fe300-c5df-49e9-9f04-b0582acd7816; scorecard 5c44b12e-44b4-4e60-a29b-c8c51ea589c0. Twenty owns business planning; GitHub owns technical evidence. Historical bodies below are retained for provenance, not executable current instructions.
Sequence: (1) consolidate; (2) sales-ready foundation and (3) reusable first delivery package run in parallel; (4) human cold-call remodelers and sign the FIRST THREE clients; (5) deliver, measure, refine templates and earn case studies, then expand channels/multi-location work. Do not require all later systems before selling.
First delivery package: Alex + ONE unified CRM deliverable + scheduling + essential follow-up. Standard portal integration, bespoke portal work and background automations are distinct scopes. Other system templates remain a preserved LATER backlog, not a prerequisite to selling.
Alex platform: ElevenLabs, with n8n on the Kynetic VPS orchestrating backend automation. Retell Alex is parked. Portal surfaces results/status/actions, not an automation editor. This planning correction is not a vendor configuration change or proof of live integrations.
Safety: never invoke or modify Nora, live Emily, live Alex agent_8201m5afn2rbeb7v29xfkhh1pjef, or Kynetic Restoration (Demo) under this cleanup. Use separate approved DEV/demo resources for future tests. No production deployment, calls, texts, messages, workflow activation, paid-plan change, schema change, or commercial-term invention is authorized here. Human cold outreach only; preserve consent, quiet-hours, kill-switch and counsel gates; no FL/OK, no HIPAA, AM-1 do-not-call, no Google Drive/Docs/Sheets. Use only TWENTY_BASE_URL + TWENTY_SELFHOST_API_KEY; never TWENTY_API_KEY or REST DELETE.

Commercial authority reconciliation: D-023 (93db3245-96ee-4fb8-8afd-73ae66985d95) is the dated approved October 24 pricing decision and expressly supersedes D-017. Do not ask Abdullah to choose again between those two historical decisions. Reconcile stale text against the approved record; later November 6 founding/standard/transformation figures are proposals unless a separate approval is evidenced. This cleanup does not approve those proposals, change financial terms, alter opportunity tier schema, or certify today's entire commercial package final.
Current remodeler guarantee, locked November 5 in Growth Playbook 21fba68a-226b-4693-834f-7408366adf11: “We book remodelers 20% more appointments than last month in 30 days, or we work free until we do.” Baseline is last month's booked appointments; client maintains last month's ads level and takes the appointments set. This is booked appointments, not guaranteed jobs/revenue. This replaces the older 14-day/month-fee-waiver guarantee only; it does not itself change the dated approved prices. Earlier 14-day operational plans may remain historical estimates, not this guarantee.

Acceptance: inventory stale pricing references; align authorized planning text to dated approved decisions; explicitly separate later unapproved proposals; record schema tier mismatch for a separate scoped schema decision/change. Do not reopen D017 versus D023 as an undecided historic price. This task remains open: repo reconciliation/schema/latest-commercial-scope verification is not completed by editing this note.

Preserved prior title: [P1] [Step 2] DECISION NEEDED (Abdullah): unresolved pricing conflict. D-023 ($6,500 / $10,000, approved Oct 24, on the live site) vs D-017 ($4,675 / $8,500) still in repo decisions, KYNETIC_CONTEXT, Twenty opportunity tier options and tasks 4.3-4.7

---

## Historical pre-reconciliation body — retained verbatim; current guidance above takes precedence. Historical claims are not current proof or permission.

Check S2.4 in SCORECARD BASELINE v1. Recorded by the audit 2026-11-08 under the coordinator's ruling: commercial terms are out of audit scope. NOT changed by the audit: the opportunity tier options (FOUNDING_4675 / STANDARD_8500), any price, any decision. D-023 note: 93db3245-96ee-4fb8-8afd-73ae66985d95. Tasks 4.3 to 4.7 now cross-link it. Repo docs/decisions.md has no D-023 or D-024 (jumps D-022 to D-025). Pricing-dependent checks are scored unknown or incomplete until Abdullah confirms which values stand and which artifacts to reconcile.

### [P1] [Step 2] Website: test the contact form once (n8n WxIh0Hw4lQodY1Xa active, never tested) and resolve /remodelers TODO boxes (guarantee wording, founder video, add-ons, testimonials)

_`4f367405`, created 2026-11-08, due none_



### [P1] [Step 3] 3.6 Compliance before any client goes live: SMS opt out handler, Contact relation, webhook auth, consent wording

_`f0661f9b`, created 2026-09-24, due none_

Required before any paying client goes live.
- Turn on the Inbound SMS Opt-Out Handler workflow in n8n.
- Create Emergency Call / Create Inquiry Call have no Contact relation. Add a Contact lookup/create tool to AI Agent4.
- Decide on the 8am to 9pm SMS send window (left out of scope, never signed off).

### [P1] [Step 3] 3.7 Extract into [CLIENT] bracket template (chosen niche) + write Add a Client guide

_`88672eb5`, created 2026-09-24, due none_

Once Phase A clears testing. Whole-file find/replace on the n8n JSON and Retell agent, per the locked architecture.

### [P1] [Step 3] 5.1 Intake form and client setup checklist as a Twenty template, cloned per client

_`aa204451`, created 2026-10-02, due none_

Intake: hours, services, calendar, phone number, escalation rules, who to transfer to. Goal: agent live on their business name within 24 hours of payment.

### [P1] [Step 3] 5.2 Onboarding automation: agreement auto sent, Stripe payment, welcome message, Cal.com kickoff booking

_`714a7a42`, created 2026-10-02, due none_

Model: GDJ Marketing client system (agreement, invoice, welcome, portal, kickoff, instant momentum).

### [P1] [Step 3] 5.4 Write day of close instant activation SOP

_`e7b8726f`, created 2026-09-24, due none_

# CURRENT RECONCILIATION — November 8, 2026 (PST)

Current planning authority: roadmap 7bfdcb7e-4f49-4c1c-94b9-7ffc46d50747; acceptance baseline 603fe300-c5df-49e9-9f04-b0582acd7816; evidence scorecard 5c44b12e-44b4-4e60-a29b-c8c51ea589c0. This update changes documentation only, not completion status, owner, dueAt, relationships, providers or delivery behavior.

Current business authority: canonical five-step roadmap 7bfdcb7e-4f49-4c1c-94b9-7ffc46d50747; frozen baseline v1 603fe300-c5df-49e9-9f04-b0582acd7816; scorecard 5c44b12e-44b4-4e60-a29b-c8c51ea589c0. Twenty owns business planning; GitHub owns technical evidence. Historical bodies below are retained for provenance, not executable current instructions.
Sequence: (1) consolidate; (2) sales-ready foundation and (3) reusable first delivery package run in parallel; (4) human cold-call remodelers and sign the FIRST THREE clients; (5) deliver, measure, refine templates and earn case studies, then expand channels/multi-location work. Do not require all later systems before selling.
First delivery package: Alex + ONE unified CRM deliverable + scheduling + essential follow-up. Standard portal integration, bespoke portal work and background automations are distinct scopes. Other system templates remain a preserved LATER backlog, not a prerequisite to selling.
Alex platform: ElevenLabs, with n8n on the Kynetic VPS orchestrating backend automation. Retell Alex is parked. Portal surfaces results/status/actions, not an automation editor. This planning correction is not a vendor configuration change or proof of live integrations.
Safety: never invoke or modify Nora, live Emily, live Alex agent_8201m5afn2rbeb7v29xfkhh1pjef, or Kynetic Restoration (Demo) under this cleanup. Use separate approved DEV/demo resources for future tests. No production deployment, calls, texts, messages, workflow activation, paid-plan change, schema change, or commercial-term invention is authorized here. Human cold outreach only; preserve consent, quiet-hours, kill-switch and counsel gates; no FL/OK, no HIPAA, AM-1 do-not-call, no Google Drive/Docs/Sheets. Use only TWENTY_BASE_URL + TWENTY_SELFHOST_API_KEY; never TWENTY_API_KEY or REST DELETE.

---

## Historical pre-reconciliation body — retained verbatim; current guidance above takes precedence. Historical claims are not current proof or permission.

When a prospect says yes: link GBP on the call, start the intake form live, book a kickoff within 24 hours. Welcome Packet, Project Brief, and Delivery Guide templates already exist as notes.

### [P1] [Step 3] 5.6 Weekly summary and error alerts

_`63890ecf`, created 2026-10-02, due none_



### [P1] [Step 3] 6.1 Dry run with Quentin as a fake client, time every step (the demo-client gate)

_`8c405633`, created 2026-10-02, due none_

Phase 6. Run proposal, agreement, payment, welcome, intake, setup, go live, first report. Fix whatever is manual or slow. The dry run time is the limit on how fast clients can be signed.

### [P1] [Step 3] Define the ONE unified CRM deliverable (replaces Lite/Full): scope, what the client sees, standard integration vs bespoke portal vs backend automation

_`a3688260`, created 2026-11-08, due none_

# CURRENT RECONCILIATION — November 8, 2026 (PST)

Current planning authority: roadmap 7bfdcb7e-4f49-4c1c-94b9-7ffc46d50747; acceptance baseline 603fe300-c5df-49e9-9f04-b0582acd7816; evidence scorecard 5c44b12e-44b4-4e60-a29b-c8c51ea589c0. This update changes documentation only, not completion status, owner, dueAt, relationships, providers or delivery behavior.

Current business authority: canonical five-step roadmap 7bfdcb7e-4f49-4c1c-94b9-7ffc46d50747; frozen baseline v1 603fe300-c5df-49e9-9f04-b0582acd7816; scorecard 5c44b12e-44b4-4e60-a29b-c8c51ea589c0. Twenty owns business planning; GitHub owns technical evidence. Historical bodies below are retained for provenance, not executable current instructions.
Sequence: (1) consolidate; (2) sales-ready foundation and (3) reusable first delivery package run in parallel; (4) human cold-call remodelers and sign the FIRST THREE clients; (5) deliver, measure, refine templates and earn case studies, then expand channels/multi-location work. Do not require all later systems before selling.
First delivery package: Alex + ONE unified CRM deliverable + scheduling + essential follow-up. Standard portal integration, bespoke portal work and background automations are distinct scopes. Other system templates remain a preserved LATER backlog, not a prerequisite to selling.
Alex platform: ElevenLabs, with n8n on the Kynetic VPS orchestrating backend automation. Retell Alex is parked. Portal surfaces results/status/actions, not an automation editor. This planning correction is not a vendor configuration change or proof of live integrations.
Safety: never invoke or modify Nora, live Emily, live Alex agent_8201m5afn2rbeb7v29xfkhh1pjef, or Kynetic Restoration (Demo) under this cleanup. Use separate approved DEV/demo resources for future tests. No production deployment, calls, texts, messages, workflow activation, paid-plan change, schema change, or commercial-term invention is authorized here. Human cold outreach only; preserve consent, quiet-hours, kill-switch and counsel gates; no FL/OK, no HIPAA, AM-1 do-not-call, no Google Drive/Docs/Sheets. Use only TWENTY_BASE_URL + TWENTY_SELFHOST_API_KEY; never TWENTY_API_KEY or REST DELETE.

---

## Historical pre-reconciliation body — retained verbatim; current guidance above takes precedence. Historical claims are not current proof or permission.

Check S3.3 in SCORECARD BASELINE v1. Created 2026-11-08 by the audit. Decision source: Abdullah assignment 2026-11-08. Proposed pricing or architecture docs are not approved scope. Owner not assigned.

### [P1] [Step 3] Document gated voice-first onboarding; SMS only after approved A2P and tested wiring

_`07fd5b4a`, created 2026-10-02, due none_

# CURRENT RECONCILIATION — November 8, 2026 (PST)

Current planning authority: roadmap 7bfdcb7e-4f49-4c1c-94b9-7ffc46d50747; acceptance baseline 603fe300-c5df-49e9-9f04-b0582acd7816; evidence scorecard 5c44b12e-44b4-4e60-a29b-c8c51ea589c0. This update changes documentation only, not completion status, owner, dueAt, relationships, providers or delivery behavior.

Current business authority: canonical five-step roadmap 7bfdcb7e-4f49-4c1c-94b9-7ffc46d50747; frozen baseline v1 603fe300-c5df-49e9-9f04-b0582acd7816; scorecard 5c44b12e-44b4-4e60-a29b-c8c51ea589c0. Twenty owns business planning; GitHub owns technical evidence. Historical bodies below are retained for provenance, not executable current instructions.
Sequence: (1) consolidate; (2) sales-ready foundation and (3) reusable first delivery package run in parallel; (4) human cold-call remodelers and sign the FIRST THREE clients; (5) deliver, measure, refine templates and earn case studies, then expand channels/multi-location work. Do not require all later systems before selling.
First delivery package: Alex + ONE unified CRM deliverable + scheduling + essential follow-up. Standard portal integration, bespoke portal work and background automations are distinct scopes. Other system templates remain a preserved LATER backlog, not a prerequisite to selling.
Alex platform: ElevenLabs, with n8n on the Kynetic VPS orchestrating backend automation. Retell Alex is parked. Portal surfaces results/status/actions, not an automation editor. This planning correction is not a vendor configuration change or proof of live integrations.
Safety: never invoke or modify Nora, live Emily, live Alex agent_8201m5afn2rbeb7v29xfkhh1pjef, or Kynetic Restoration (Demo) under this cleanup. Use separate approved DEV/demo resources for future tests. No production deployment, calls, texts, messages, workflow activation, paid-plan change, schema change, or commercial-term invention is authorized here. Human cold outreach only; preserve consent, quiet-hours, kill-switch and counsel gates; no FL/OK, no HIPAA, AM-1 do-not-call, no Google Drive/Docs/Sheets. Use only TWENTY_BASE_URL + TWENTY_SELFHOST_API_KEY; never TWENTY_API_KEY or REST DELETE.

Preserved prior title: [P1] [Step 3] 5.3 Voice first onboarding process (voice live day 1, SMS when client A2P registration approves)

---

## Historical pre-reconciliation body — retained verbatim; current guidance above takes precedence. Historical claims are not current proof or permission.

Per notes, client A2P registration takes 2 to 3 weeks and should not be shared across clients.

### [P1] [Step 3] LAUNCH BLOCKER: live Alex path on ElevenLabs. Paid plan, phone import and caller ID, activate one workflow, test with own phone (no Alex workflow is active as of 2026-11-08)

_`ea3a2c80`, created 2026-11-08, due none_



### [P1] [Step 3] Prospect follow-up: manual follow-up drafts for "call me back / send info" (no cold SMS; SMS only with consent after A2P)

_`c14b99bc`, created 2026-09-24, due none_

One of the 2 Phase 1 automations decided Aug 12.

Oct 13, 2026: retitled to follow D-007 (no cold SMS at scale) and D-004 (SMS only after A2P).

### [P1] [Step 3] Reconcile Codex main versus unmerged DEV evidence for chain, alerts, onboarding and go-live

_`7055dd70`, created 2026-11-08, due none_

# CURRENT RECONCILIATION — November 8, 2026 (PST)

Current planning authority: roadmap 7bfdcb7e-4f49-4c1c-94b9-7ffc46d50747; acceptance baseline 603fe300-c5df-49e9-9f04-b0582acd7816; evidence scorecard 5c44b12e-44b4-4e60-a29b-c8c51ea589c0. This update changes documentation only, not completion status, owner, dueAt, relationships, providers or delivery behavior.

Current business authority: canonical five-step roadmap 7bfdcb7e-4f49-4c1c-94b9-7ffc46d50747; frozen baseline v1 603fe300-c5df-49e9-9f04-b0582acd7816; scorecard 5c44b12e-44b4-4e60-a29b-c8c51ea589c0. Twenty owns business planning; GitHub owns technical evidence. Historical bodies below are retained for provenance, not executable current instructions.
Sequence: (1) consolidate; (2) sales-ready foundation and (3) reusable first delivery package run in parallel; (4) human cold-call remodelers and sign the FIRST THREE clients; (5) deliver, measure, refine templates and earn case studies, then expand channels/multi-location work. Do not require all later systems before selling.
First delivery package: Alex + ONE unified CRM deliverable + scheduling + essential follow-up. Standard portal integration, bespoke portal work and background automations are distinct scopes. Other system templates remain a preserved LATER backlog, not a prerequisite to selling.
Alex platform: ElevenLabs, with n8n on the Kynetic VPS orchestrating backend automation. Retell Alex is parked. Portal surfaces results/status/actions, not an automation editor. This planning correction is not a vendor configuration change or proof of live integrations.
Safety: never invoke or modify Nora, live Emily, live Alex agent_8201m5afn2rbeb7v29xfkhh1pjef, or Kynetic Restoration (Demo) under this cleanup. Use separate approved DEV/demo resources for future tests. No production deployment, calls, texts, messages, workflow activation, paid-plan change, schema change, or commercial-term invention is authorized here. Human cold outreach only; preserve consent, quiet-hours, kill-switch and counsel gates; no FL/OK, no HIPAA, AM-1 do-not-call, no Google Drive/Docs/Sheets. Use only TWENTY_BASE_URL + TWENTY_SELFHOST_API_KEY; never TWENTY_API_KEY or REST DELETE.

Main docs/codex/PROGRESS stops at Step2; unmerged dev/codex-setup records additional self-reported work. Branch implementation is not merged/deployed/accepted merely because ticked. Reconcile source/CI/runtime evidence; do not rebuild solely from a stale main checklist.

Preserved prior title: [P1] [Step 3] Codex build steps 3 to 6 not done: lead-to-booking chain, texts and alerts, onboarding, go-live (steps 0 to 2 done, see docs/codex/PROGRESS.md)

---

## Historical pre-reconciliation body — retained verbatim; current guidance above takes precedence. Historical claims are not current proof or permission.

### [P1] [Step 3] Write the reusable-template roadmap and the demo-client end-to-end acceptance gate (Alex, CRM, scheduling, essential follow-up)

_`29bac571`, created 2026-11-08, due none_

# CURRENT RECONCILIATION — November 8, 2026 (PST)

Current planning authority: roadmap 7bfdcb7e-4f49-4c1c-94b9-7ffc46d50747; acceptance baseline 603fe300-c5df-49e9-9f04-b0582acd7816; evidence scorecard 5c44b12e-44b4-4e60-a29b-c8c51ea589c0. This update changes documentation only, not completion status, owner, dueAt, relationships, providers or delivery behavior.

Current business authority: canonical five-step roadmap 7bfdcb7e-4f49-4c1c-94b9-7ffc46d50747; frozen baseline v1 603fe300-c5df-49e9-9f04-b0582acd7816; scorecard 5c44b12e-44b4-4e60-a29b-c8c51ea589c0. Twenty owns business planning; GitHub owns technical evidence. Historical bodies below are retained for provenance, not executable current instructions.
Sequence: (1) consolidate; (2) sales-ready foundation and (3) reusable first delivery package run in parallel; (4) human cold-call remodelers and sign the FIRST THREE clients; (5) deliver, measure, refine templates and earn case studies, then expand channels/multi-location work. Do not require all later systems before selling.
First delivery package: Alex + ONE unified CRM deliverable + scheduling + essential follow-up. Standard portal integration, bespoke portal work and background automations are distinct scopes. Other system templates remain a preserved LATER backlog, not a prerequisite to selling.
Alex platform: ElevenLabs, with n8n on the Kynetic VPS orchestrating backend automation. Retell Alex is parked. Portal surfaces results/status/actions, not an automation editor. This planning correction is not a vendor configuration change or proof of live integrations.
Safety: never invoke or modify Nora, live Emily, live Alex agent_8201m5afn2rbeb7v29xfkhh1pjef, or Kynetic Restoration (Demo) under this cleanup. Use separate approved DEV/demo resources for future tests. No production deployment, calls, texts, messages, workflow activation, paid-plan change, schema change, or commercial-term invention is authorized here. Human cold outreach only; preserve consent, quiet-hours, kill-switch and counsel gates; no FL/OK, no HIPAA, AM-1 do-not-call, no Google Drive/Docs/Sheets. Use only TWENTY_BASE_URL + TWENTY_SELFHOST_API_KEY; never TWENTY_API_KEY or REST DELETE.

---

## Historical pre-reconciliation body — retained verbatim; current guidance above takes precedence. Historical claims are not current proof or permission.

Checks S3.8 and S3.9a in SCORECARD BASELINE v1. Task 6.1 (dry run with Quentin) is the run of this gate. Created 2026-11-08 by the audit. Owner not assigned.

### [P1] [Step 4, STALE DATE] Checkpoint after ~500 dials: expect 10 booked calls; re-run revenue plan with real rates (Oct 28 date passed; 5-client plan superseded, no new date set)

_`4f9a9d51`, created 2026-10-13, due none_

# CURRENT RECONCILIATION — November 8, 2026 (PST)

Current planning authority: roadmap 7bfdcb7e-4f49-4c1c-94b9-7ffc46d50747; acceptance baseline 603fe300-c5df-49e9-9f04-b0582acd7816; evidence scorecard 5c44b12e-44b4-4e60-a29b-c8c51ea589c0. This update changes documentation only, not completion status, owner, dueAt, relationships, providers or delivery behavior.

Current business authority: canonical five-step roadmap 7bfdcb7e-4f49-4c1c-94b9-7ffc46d50747; frozen baseline v1 603fe300-c5df-49e9-9f04-b0582acd7816; scorecard 5c44b12e-44b4-4e60-a29b-c8c51ea589c0. Twenty owns business planning; GitHub owns technical evidence. Historical bodies below are retained for provenance, not executable current instructions.
Sequence: (1) consolidate; (2) sales-ready foundation and (3) reusable first delivery package run in parallel; (4) human cold-call remodelers and sign the FIRST THREE clients; (5) deliver, measure, refine templates and earn case studies, then expand channels/multi-location work. Do not require all later systems before selling.
First delivery package: Alex + ONE unified CRM deliverable + scheduling + essential follow-up. Standard portal integration, bespoke portal work and background automations are distinct scopes. Other system templates remain a preserved LATER backlog, not a prerequisite to selling.
Alex platform: ElevenLabs, with n8n on the Kynetic VPS orchestrating backend automation. Retell Alex is parked. Portal surfaces results/status/actions, not an automation editor. This planning correction is not a vendor configuration change or proof of live integrations.
Safety: never invoke or modify Nora, live Emily, live Alex agent_8201m5afn2rbeb7v29xfkhh1pjef, or Kynetic Restoration (Demo) under this cleanup. Use separate approved DEV/demo resources for future tests. No production deployment, calls, texts, messages, workflow activation, paid-plan change, schema change, or commercial-term invention is authorized here. Human cold outreach only; preserve consent, quiet-hours, kill-switch and counsel gates; no FL/OK, no HIPAA, AM-1 do-not-call, no Google Drive/Docs/Sheets. Use only TWENTY_BASE_URL + TWENTY_SELFHOST_API_KEY; never TWENTY_API_KEY or REST DELETE.

Due date cleared 2026-11-09: the superseded planning date was 2026-10-28T17:00:00.000Z. It was not a current promised deadline. Original value preserved in the change journal (project file audit-2026-11-08/change-journal-twenty.md). No reschedule is invented.

---

## Historical pre-reconciliation body — retained verbatim; current guidance above takes precedence. Historical claims are not current proof or permission.

UPDATE (Oct 17, 2026): moved from Oct 23 to about Oct 28 because dialing now starts Tue Oct 20. At 75 dials a day, 500 dials is reached on the 7th dialing day (Oct 28); Oct 27 if dialing starts Mon Oct 19.

See note "Q4 Revenue Plan: $30K by Dec 31, 2026". Under 6 booked calls on 500 dials means the conservative case. Replace the 2% book rate, 70% show rate and 20% close rate with real numbers and recompute the daily dial target.

### [P1] [Step 4, STALE DATE] Sign the first 3 clients (old Dec 1 / 5-client deadline superseded by the five-step roadmap; no new deadline set)

_`4ee10dc0`, created 2026-10-13, due none_

# CURRENT RECONCILIATION — November 8, 2026 (PST)

Current planning authority: roadmap 7bfdcb7e-4f49-4c1c-94b9-7ffc46d50747; acceptance baseline 603fe300-c5df-49e9-9f04-b0582acd7816; evidence scorecard 5c44b12e-44b4-4e60-a29b-c8c51ea589c0. This update changes documentation only, not completion status, owner, dueAt, relationships, providers or delivery behavior.

Current business authority: canonical five-step roadmap 7bfdcb7e-4f49-4c1c-94b9-7ffc46d50747; frozen baseline v1 603fe300-c5df-49e9-9f04-b0582acd7816; scorecard 5c44b12e-44b4-4e60-a29b-c8c51ea589c0. Twenty owns business planning; GitHub owns technical evidence. Historical bodies below are retained for provenance, not executable current instructions.
Sequence: (1) consolidate; (2) sales-ready foundation and (3) reusable first delivery package run in parallel; (4) human cold-call remodelers and sign the FIRST THREE clients; (5) deliver, measure, refine templates and earn case studies, then expand channels/multi-location work. Do not require all later systems before selling.
First delivery package: Alex + ONE unified CRM deliverable + scheduling + essential follow-up. Standard portal integration, bespoke portal work and background automations are distinct scopes. Other system templates remain a preserved LATER backlog, not a prerequisite to selling.
Alex platform: ElevenLabs, with n8n on the Kynetic VPS orchestrating backend automation. Retell Alex is parked. Portal surfaces results/status/actions, not an automation editor. This planning correction is not a vendor configuration change or proof of live integrations.
Safety: never invoke or modify Nora, live Emily, live Alex agent_8201m5afn2rbeb7v29xfkhh1pjef, or Kynetic Restoration (Demo) under this cleanup. Use separate approved DEV/demo resources for future tests. No production deployment, calls, texts, messages, workflow activation, paid-plan change, schema change, or commercial-term invention is authorized here. Human cold outreach only; preserve consent, quiet-hours, kill-switch and counsel gates; no FL/OK, no HIPAA, AM-1 do-not-call, no Google Drive/Docs/Sheets. Use only TWENTY_BASE_URL + TWENTY_SELFHOST_API_KEY; never TWENTY_API_KEY or REST DELETE.

Due date cleared 2026-11-09: the superseded planning date was 2026-12-01T17:00:00.000Z. It was not a current promised deadline. Original value preserved in the change journal (project file audit-2026-11-08/change-journal-twenty.md). No reschedule is invented.

---

## Historical pre-reconciliation body — retained verbatim; current guidance above takes precedence. Historical claims are not current proof or permission.

See note "Q4 Revenue Plan: $30K by Dec 31, 2026". Assumes a 2 to 3 week build. Thanksgiving week is the 5th close in the base case, so start builds while still closing.

### [P1] [Step 4, STALE DATE] Start dialing: 75 dials a day by hand, owners only, log in Twenty (Oct 20 date passed; dialing not verified started; no new date set)

_`e55aaa8e`, created 2026-10-13, due none_

# CURRENT RECONCILIATION — November 8, 2026 (PST)

Current planning authority: roadmap 7bfdcb7e-4f49-4c1c-94b9-7ffc46d50747; acceptance baseline 603fe300-c5df-49e9-9f04-b0582acd7816; evidence scorecard 5c44b12e-44b4-4e60-a29b-c8c51ea589c0. This update changes documentation only, not completion status, owner, dueAt, relationships, providers or delivery behavior.

Current business authority: canonical five-step roadmap 7bfdcb7e-4f49-4c1c-94b9-7ffc46d50747; frozen baseline v1 603fe300-c5df-49e9-9f04-b0582acd7816; scorecard 5c44b12e-44b4-4e60-a29b-c8c51ea589c0. Twenty owns business planning; GitHub owns technical evidence. Historical bodies below are retained for provenance, not executable current instructions.
Sequence: (1) consolidate; (2) sales-ready foundation and (3) reusable first delivery package run in parallel; (4) human cold-call remodelers and sign the FIRST THREE clients; (5) deliver, measure, refine templates and earn case studies, then expand channels/multi-location work. Do not require all later systems before selling.
First delivery package: Alex + ONE unified CRM deliverable + scheduling + essential follow-up. Standard portal integration, bespoke portal work and background automations are distinct scopes. Other system templates remain a preserved LATER backlog, not a prerequisite to selling.
Alex platform: ElevenLabs, with n8n on the Kynetic VPS orchestrating backend automation. Retell Alex is parked. Portal surfaces results/status/actions, not an automation editor. This planning correction is not a vendor configuration change or proof of live integrations.
Safety: never invoke or modify Nora, live Emily, live Alex agent_8201m5afn2rbeb7v29xfkhh1pjef, or Kynetic Restoration (Demo) under this cleanup. Use separate approved DEV/demo resources for future tests. No production deployment, calls, texts, messages, workflow activation, paid-plan change, schema change, or commercial-term invention is authorized here. Human cold outreach only; preserve consent, quiet-hours, kill-switch and counsel gates; no FL/OK, no HIPAA, AM-1 do-not-call, no Google Drive/Docs/Sheets. Use only TWENTY_BASE_URL + TWENTY_SELFHOST_API_KEY; never TWENTY_API_KEY or REST DELETE.

Due date cleared 2026-11-09: the superseded planning date was 2026-10-20T14:00:00.000Z. It was not a current promised deadline. Original value preserved in the change journal (project file audit-2026-11-08/change-journal-twenty.md). No reschedule is invented.

---

## Historical pre-reconciliation body — retained verbatim; current guidance above takes precedence. Historical claims are not current proof or permission.

UPDATE (Oct 17, 2026): start moved from Oct 15 to Tuesday Oct 20. It could potentially be moved up to Monday Oct 19. Window Oct 20 to Nov 20 is 24 working days (25 if Monday Oct 19), so 75 a day now covers the base case for 5 clients with no buffer; 6 clients need about 90 a day. Math recomputed in the Q4 Revenue Plan note. The Oct 23 checkpoint moved to about Oct 28.

Original text (Oct 15 start, superseded): D-017 and the Q4 Revenue Plan. Window Oct 15 to Nov 20. Base case 67 a day, target 75 for buffer. Depends on 7.1 launch gate being verified. Checkpoint task: about 500 dials.

### [P1] [Step 4] 2.4 Load owner gated rows into Twenty as Companies with the source of every fact

_`d25002bc`, created 2026-10-02, due none_

Dedupe by Facebook Page, domain and phone. Only rows that pass the owner gate.

### [P1] [Step 4] 2.5 Automate the loop: scrape to leads.db to Claude audit to Twenty, refilling on its own (no Google Sheet; tools/lead_pipeline.py in PR #134, unmerged)

_`e5a07483`, created 2026-10-02, due none_

Update Oct 20, 2026: first automation piece exists as tools/lead_enrich.py (Firecrawl: Texas open data, Comptroller, BBB, site), 53 credits / 4 min for 10 businesses. Apify actor handles the census ($0.31 per 343 ads). Proposed but NOT approved or built: n8n trigger -> Modal job -> results to Twenty. See note 'LEAD ENGINE: Run B + pilots handoff (Oct 19-20, 2026)' and repo docs/lead-engine-handoff.md.

### [P1] [Step 4] Build owner-verified remodeler prospect list; old Dallas roofing sample is historical research only

_`2448acec`, created 2026-10-02, due none_

# CURRENT RECONCILIATION — November 8, 2026 (PST)

Current planning authority: roadmap 7bfdcb7e-4f49-4c1c-94b9-7ffc46d50747; acceptance baseline 603fe300-c5df-49e9-9f04-b0582acd7816; evidence scorecard 5c44b12e-44b4-4e60-a29b-c8c51ea589c0. This update changes documentation only, not completion status, owner, dueAt, relationships, providers or delivery behavior.

Current business authority: canonical five-step roadmap 7bfdcb7e-4f49-4c1c-94b9-7ffc46d50747; frozen baseline v1 603fe300-c5df-49e9-9f04-b0582acd7816; scorecard 5c44b12e-44b4-4e60-a29b-c8c51ea589c0. Twenty owns business planning; GitHub owns technical evidence. Historical bodies below are retained for provenance, not executable current instructions.
Sequence: (1) consolidate; (2) sales-ready foundation and (3) reusable first delivery package run in parallel; (4) human cold-call remodelers and sign the FIRST THREE clients; (5) deliver, measure, refine templates and earn case studies, then expand channels/multi-location work. Do not require all later systems before selling.
First delivery package: Alex + ONE unified CRM deliverable + scheduling + essential follow-up. Standard portal integration, bespoke portal work and background automations are distinct scopes. Other system templates remain a preserved LATER backlog, not a prerequisite to selling.
Alex platform: ElevenLabs, with n8n on the Kynetic VPS orchestrating backend automation. Retell Alex is parked. Portal surfaces results/status/actions, not an automation editor. This planning correction is not a vendor configuration change or proof of live integrations.
Safety: never invoke or modify Nora, live Emily, live Alex agent_8201m5afn2rbeb7v29xfkhh1pjef, or Kynetic Restoration (Demo) under this cleanup. Use separate approved DEV/demo resources for future tests. No production deployment, calls, texts, messages, workflow activation, paid-plan change, schema change, or commercial-term invention is authorized here. Human cold outreach only; preserve consent, quiet-hours, kill-switch and counsel gates; no FL/OK, no HIPAA, AM-1 do-not-call, no Google Drive/Docs/Sheets. Use only TWENTY_BASE_URL + TWENTY_SELFHOST_API_KEY; never TWENTY_API_KEY or REST DELETE.

Preserved prior title: [P1] [Step 4] 2.2 Owner pass on groups A and B of the Muse roofing Dallas list (14 businesses), with links in the CSV

---

## Historical pre-reconciliation body — retained verbatim; current guidance above takes precedence. Historical claims are not current proof or permission.

Owner name with source link, owner operated vs front desk with evidence, staff or location count, direct vs main line. Public business sources only. See HANDOFF LANE A.

Update Oct 20, 2026: owner passes were run on other samples (Arlington roofing, 10 DFW roofers) with Muse and a Firecrawl script, not on this Dallas groups A/B list. Owner names agreed across methods; phone certainty is the open problem. See note 'LEAD ENGINE: Run B + pilots handoff (Oct 19-20, 2026)'.

### [P1] [Step 4] Evaluate repeatable sourcing for remodeler prospects; historical multi-niche tests are reference only

_`0c963ff9`, created 2026-10-02, due none_

# CURRENT RECONCILIATION — November 8, 2026 (PST)

Current planning authority: roadmap 7bfdcb7e-4f49-4c1c-94b9-7ffc46d50747; acceptance baseline 603fe300-c5df-49e9-9f04-b0582acd7816; evidence scorecard 5c44b12e-44b4-4e60-a29b-c8c51ea589c0. This update changes documentation only, not completion status, owner, dueAt, relationships, providers or delivery behavior.

Current business authority: canonical five-step roadmap 7bfdcb7e-4f49-4c1c-94b9-7ffc46d50747; frozen baseline v1 603fe300-c5df-49e9-9f04-b0582acd7816; scorecard 5c44b12e-44b4-4e60-a29b-c8c51ea589c0. Twenty owns business planning; GitHub owns technical evidence. Historical bodies below are retained for provenance, not executable current instructions.
Sequence: (1) consolidate; (2) sales-ready foundation and (3) reusable first delivery package run in parallel; (4) human cold-call remodelers and sign the FIRST THREE clients; (5) deliver, measure, refine templates and earn case studies, then expand channels/multi-location work. Do not require all later systems before selling.
First delivery package: Alex + ONE unified CRM deliverable + scheduling + essential follow-up. Standard portal integration, bespoke portal work and background automations are distinct scopes. Other system templates remain a preserved LATER backlog, not a prerequisite to selling.
Alex platform: ElevenLabs, with n8n on the Kynetic VPS orchestrating backend automation. Retell Alex is parked. Portal surfaces results/status/actions, not an automation editor. This planning correction is not a vendor configuration change or proof of live integrations.
Safety: never invoke or modify Nora, live Emily, live Alex agent_8201m5afn2rbeb7v29xfkhh1pjef, or Kynetic Restoration (Demo) under this cleanup. Use separate approved DEV/demo resources for future tests. No production deployment, calls, texts, messages, workflow activation, paid-plan change, schema change, or commercial-term invention is authorized here. Human cold outreach only; preserve consent, quiet-hours, kill-switch and counsel gates; no FL/OK, no HIPAA, AM-1 do-not-call, no Google Drive/Docs/Sheets. Use only TWENTY_BASE_URL + TWENTY_SELFHOST_API_KEY; never TWENTY_API_KEY or REST DELETE.

Preserved prior title: [P1] [Step 4] 2.3 Test Muse on repeatability, a second niche and a second metro, then decide Muse vs own agent vs mix

---

## Historical pre-reconciliation body — retained verbatim; current guidance above takes precedence. Historical claims are not current proof or permission.

Score each run on unique independent advertisers, owner gate pass rate, share of fields with a clickable source, time, cost and breakage. Do not give Muse a personal Facebook login.

### [P1] [Step 4] Prepare Meta-ad-active owner-gated remodeler lead list for first three signed clients

_`d8f2f1ae`, created 2026-09-24, due none_

# CURRENT RECONCILIATION — November 8, 2026 (PST)

Current planning authority: roadmap 7bfdcb7e-4f49-4c1c-94b9-7ffc46d50747; acceptance baseline 603fe300-c5df-49e9-9f04-b0582acd7816; evidence scorecard 5c44b12e-44b4-4e60-a29b-c8c51ea589c0. This update changes documentation only, not completion status, owner, dueAt, relationships, providers or delivery behavior.

Current business authority: canonical five-step roadmap 7bfdcb7e-4f49-4c1c-94b9-7ffc46d50747; frozen baseline v1 603fe300-c5df-49e9-9f04-b0582acd7816; scorecard 5c44b12e-44b4-4e60-a29b-c8c51ea589c0. Twenty owns business planning; GitHub owns technical evidence. Historical bodies below are retained for provenance, not executable current instructions.
Sequence: (1) consolidate; (2) sales-ready foundation and (3) reusable first delivery package run in parallel; (4) human cold-call remodelers and sign the FIRST THREE clients; (5) deliver, measure, refine templates and earn case studies, then expand channels/multi-location work. Do not require all later systems before selling.
First delivery package: Alex + ONE unified CRM deliverable + scheduling + essential follow-up. Standard portal integration, bespoke portal work and background automations are distinct scopes. Other system templates remain a preserved LATER backlog, not a prerequisite to selling.
Alex platform: ElevenLabs, with n8n on the Kynetic VPS orchestrating backend automation. Retell Alex is parked. Portal surfaces results/status/actions, not an automation editor. This planning correction is not a vendor configuration change or proof of live integrations.
Safety: never invoke or modify Nora, live Emily, live Alex agent_8201m5afn2rbeb7v29xfkhh1pjef, or Kynetic Restoration (Demo) under this cleanup. Use separate approved DEV/demo resources for future tests. No production deployment, calls, texts, messages, workflow activation, paid-plan change, schema change, or commercial-term invention is authorized here. Human cold outreach only; preserve consent, quiet-hours, kill-switch and counsel gates; no FL/OK, no HIPAA, AM-1 do-not-call, no Google Drive/Docs/Sheets. Use only TWENTY_BASE_URL + TWENTY_SELFHOST_API_KEY; never TWENTY_API_KEY or REST DELETE.

Preserved prior title: [P1] [Step 4] 2.1 Meta Ad Library niche count and owner gated lead list (replaces the plumbing + restoration scrape)

---

## Historical pre-reconciliation body — retained verbatim; current guidance above takes precedence. Historical claims are not current proof or permission.

Replaced Oct 1, 2026. Plan: count unique independent advertisers per niche in the Meta Ad Library (roofing first; test done in Dallas), pick the niche with the most, scrape to a Google Sheet with clickable links, apply the owner gate, load passing rows into Twenty. See HANDOFF LANE A.

Update Oct 20, 2026: Run B (Arlington) and an Apify DFW census are done and audited. Apify gave 343 ads / 93 advertisers / about 27 real roofers for $0.31. Owner gate run on 10 of them (4 DIAL_READY after audit). Details: note 'LEAD ENGINE: Run B + pilots handoff (Oct 19-20, 2026)' and repo docs/lead-engine-handoff.md. Not loaded into Twenty yet.

### [P1] [Step 5] 5.7 Build Monthly Report automation for clients (lead with Plan 1 outbound speed-to-lead numbers)

_`5da2b06b`, created 2026-09-24, due none_

Pulls metrics, Claude writes the narrative, email delivers it. Needed before the first client's first monthly billing cycle. Pairs with skill S8.

Oct 13, 2026: retitled; "System 2" is the Plan 2 inbound receptionist, so the report leads with Plan 1 numbers (leads called, time to first ring, contact rate, inspections booked).

### [P1] [Step 5] 5.8 Build Referral Ask + 30 day check in automation

_`7034bf8e`, created 2026-09-24, due none_

Phase 1 automation from the Aug 12 roadmap. Referral incentive already decided: 30% of setup fee, paid on signing.

### [P2] [LATER UPSELL] System 1 · Build GBP content posts on the demo

_`9d5ce759`, created 2026-09-24, due none_

Monthly GBP posts for Kynetic Restoration. Pairs with the GBP Content Suite skill (S6).

### [P2] [LATER UPSELL] System 1 · Build review request + review response flow on the demo

_`1d36eae5`, created 2026-09-24, due none_

An older August n8n workflow exists (Kynetic — Review Request + Review Response + Referral Chain) but was flagged for a split and full rebuild. Build fresh as a hardcoded demo, same pattern as System 2.

### [P2] [LATER UPSELL] System 1 · Extract into [CLIENT] bracket template

_`7ef52c9a`, created 2026-09-24, due none_



### [P2] [LATER UPSELL] System 1 · Scope the Reputation Engine for Kynetic Restoration

_`e72c4abc`, created 2026-09-24, due none_

Fully unbuilt as of Sep 2026. Decide the exact pieces for the demo: review request, review response, referral ask, GBP posts.

### [P2] [LATER UPSELL] System 3 · Build new lead nurture sequence on the demo

_`33741f5a`, created 2026-09-24, due none_

Follow up sequence (SMS + email) for new leads that go quiet. Event driven, no polling.

### [P2] [LATER UPSELL] System 3 · Build reactivation sender + reply handler on the demo

_`e083c16d`, created 2026-09-24, due none_

Older August versions exist in n8n but were flagged for rebuild as a demo + template pair. Sender needs real new work; reply handler is a small footprint.

### [P2] [LATER UPSELL] System 3 · Extract into [CLIENT] bracket template

_`f77d6828`, created 2026-09-24, due none_



### [P2] [LATER UPSELL] System 3 · Scope Lead Recovery & Nurture for Kynetic Restoration

_`cab4a21d`, created 2026-09-24, due none_

Fully unbuilt as of Sep 2026. Two parts per the Offer Definition: reactivate dormant leads, and nurture new leads that go quiet.

### [P2] [LATER] 3.1 Repoint Emily's 4 tool webhooks and post call webhook to her own workflow, greeting says Emily

_`9c95a20e`, created 2026-10-02, due none_

Approved in the Sep 28 handoff (URL only). Emily: Retell agent_affef8dcb6880fd592cbe9432f, n8n 0PwP1tUf4478lNbf. Nora is frozen, never modify.

### [P2] [LATER] 3.2 Swap Emily's Notion nodes for Twenty (needs approval) and verify post call logging

_`c0a4b873`, created 2026-09-24, due none_

Phase A #11 and #12. Blocked on the end to end test. Then archive the 11 old test rows in Notion Contacts/Jobs/Calls (Phase A #14).

### [P2] [LATER] 3.3 Publish the Retell agent (Emily build copy, agent_affef8dcb6880fd592cbe9432f)

_`6c326b56`, created 2026-09-24, due none_

Phase A #9. Blocked on picking the voice. Agent agent_4c34644a04c74e27253e80167b is still is_published: false.

### [P2] [LATER] 3.4 Test all 3 call paths end to end (booking, emergency, inquiry)

_`cd743717`, created 2026-09-24, due none_

Phase A #10. Blocked on publish and A2P. Also confirm book_appointment_cal still books correctly with location_type removed.

### [P2] [LATER] Demo · Package the demo asset library (voice, SMS threads, review flow, GBP posts)

_`9d60f321`, created 2026-09-24, due none_

One shareable set of assets to show on audit calls once all 3 systems run on Kynetic Restoration.

### [P2] [LATER] System 2 · Phase B Insurance Claim Documentation & Submission

_`ef4415d1`, created 2026-09-24, due none_

Not started, restoration specific. Scope: job photos/notes, scope of work, claim paperwork, adjuster back and forth. Own n8n workflow triggered after job completion.

### [P2] [LATER] System 2 · Phase B Quoting & Estimate Automation

_`022ddfc1`, created 2026-09-24, due none_

Not started. Scope what triggers a quote, what data feeds it, output format. Build in n8n right after job qualification.

### [P2] [LATER] System 2 · Phase B text channel (chat widget + ad form workflows); the outbound form callback is a separate new task

_`2701af38`, created 2026-09-24, due none_

Not started.
- n8n workflow for website chat widget (webhook, AI Agent node, state)
- n8n workflow for ad form submissions
- Build and embed the chat widget
- Pick model tier for text agents and test

