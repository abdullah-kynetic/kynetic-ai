# Progress

Mirror of the Twenty roadmap ("Roadmap: all phases"). Twenty is canonical; this file mirrors it. On a mismatch, flag it rather than silently picking one.

## Current plan
Plan 1 only: the outbound speed-to-lead agent at the D-017 price (first 3 clients $4,675, clients 4 and up $8,500, three Stripe invoices at 50/25/25). Gate of 5 paying clients before Plan 2 (D-013). Task titles in Twenty carry [P1]/[P2]; Emily inbound and all upsell systems are [P2].

## Current phase
Phase 3, outbound speed-to-lead build only (D-010). Lane B, the build lane. Retell is the platform and Vapi is parked (D-018). Active files: `retell/builds/outbound-speed-to-lead/`.

## Done
- PR #2 merged: Emily handoff, tools/retell.py, KYNETIC_CONTEXT.md.
- PRs #3-#7 merged: docs memory files, Retell permission rule, repo cleanup (two rounds), build-log docs step.
- PR #11 merged: outbound speed-to-lead prep (prompt, config, specs, Kynetic Roofing demo).
- 1.1 Cal.com key rotated and confirmed on Emily's two Cal tools (event type 7025524). See docs/known-issues.md KI-001.
- 1.2 Emily's voice kept as 11labs-Cimo. See docs/decisions.md D-008.
- Decisions D-009 through D-018 are in docs/decisions.md. D-017 is the signed-off price. D-018 parks Vapi and records the two Retell workspaces.
- Twenty fields for the outbound lead flow added (14 on endCustomer, 3 on customerInteraction). Cal.com Roof Inspection event type 7404470 created.
- n8n workflow "Outbound Speed to Lead" (`m2YJwZ1l8DTzyEkw`) built. Read-only check on 2026-10-17: it is active and has 38 nodes (3 sticky notes and 2 disabled draft-SMS nodes included). See KI-009.
- 2026-10-15 end-to-end smoke test of "Outbound Speed to Lead" (found in Twenty on 2026-10-17): one test lead (Abdullah) submitted the form at 19:36 UTC, the Alex call was placed (`secondsToFirstRing` 13.8), the lead ended `BOOKED`, and the call was logged as a `SPEED_TO_LEAD` interaction. It is the only lead on record.
- PR #14 merged: documented the move to self-hosted Twenty at https://crm.kyneticai.com.
- PR #15 merged: client portal at https://portal.kyneticai.com (code in `portal/`, deployed on the OVH VPS). DNS A record was not set at the time (set since, see KI-006); no real client data until the must-fixes are done. See the Portal section of KYNETIC_CONTEXT.md and KI-006 to KI-008.
- PR #16 merged: Claude sessions commit as `abdullah-kynetic` (`.claude/settings.json`, CLAUDE.md).

## In progress
- 3.5 outbound build. Prep is in the repo. On 2026-10-17 a read-only check found `m2YJwZ1l8DTzyEkw` active with the Alex agent ID (`agent_71e3cfc8384aa38a910a506b53`) set in Call Settings and Retry Call Settings and the "Retell API (outbound)" credential attached. Go-live approved by Abdullah on 2026-10-18 (KI-009). Alex prompt v1.2.3 is on branch `claude/alex-demo-live-test`, not merged or published. Blocked on Abdullah; see Blockers.
- Voice provider bake-off (Retell vs Bland vs ElevenLabs) for Alex. **Testing, no decision: Retell stays (D-018) unless a challenger clearly wins on the shared scorecard.** Control is Retell Alex Lab. ElevenLabs is furthest along; Bland has a test track and no results yet. Both live on unmerged branches (`claude/provider-test-elevenlabs`, `claude/provider-test-bland`), not on main. Current state, agent IDs and rules: the "Voice provider bake-off" section of KYNETIC_CONTEXT.md; running log: `providers/elevenlabs/RESULTS.md` on the branch and the Twenty note "VOICE PROVIDER BAKE-OFF". Twenty has no task for it yet.

- Lead engine (Lane A, tasks 2.1/2.2/2.4/2.5): Run B, the Apify DFW pilot, a Treg test and a Firecrawl-only script are done and audited; nothing is built in Modal/n8n. Full state, results and a start prompt for a new session: `docs/lead-engine-handoff.md` (branch `claude/modest-thompson-h9atoy`; Twenty note "LEAD ENGINE: Run B + pilots handoff (Oct 19-20, 2026)"). Next: add a geography filter and AI-receptionist detector to `tools/lead_enrich.py`, run the remaining ~17 roofers, scale the Treg test. Dialing is planned for Tue Oct 20 and needs about 3,000 owner-gated numbers; the lead pool is not there yet (7.1 launch gate).

## Paused (D-010, Oct 6, 2026 — inbound is near-done, left alone until a client demo needs it)
- 3.1 Repoint Emily's 4 tool webhooks and post-call webhook, greeting says Emily. Approved, URL only.
- 3.2 Swap Emily's 13 Notion nodes for Twenty nodes. Needs approval of the node-by-node plan.
- 3.3 Publish the Retell agent (Emily build copy). Was blocked on voice; no longer blocked, but not current work.
- 3.4 Test 3 call paths. Blocked on 3.3 and 1.3.

## Next (active focus)
- 3.5 Finish the outbound agent. Decisions 2 and 3 are resolved in D-014 (n8n form, two endpoints, light pre-call gate). Nothing left to confirm there. The n8n workflow exists (38 nodes, active as of the Oct 17 read; see KI-009). What is left is confirming go-live, the KYC check, and a test. See Blockers.
- 3.6 Compliance for the outbound workflow: SMS opt-out, Contact relation, webhook auth (KI-005).
- 1.3 Twilio A2P registration for +16692660586 (manual). Voice goes first (D-004).
- 1.4 TCPA emergency branch opt-out gap, counsel sign-off (manual). Counsel email is drafted in docs/counsel-email.md.
- Outreach target, once the launch gate is actually met: 75 manual owner dials a day (Q4 plan). Start moved to Tuesday Oct 20, and it could be moved up to Monday Oct 19 (Twenty updated Oct 17). With 24 working days to Nov 20, 75 a day only just covers the base case for 5 clients (about 90 a day for 6); the plan and the checkpoint (now about Oct 28) were recomputed in the Twenty note "Q4 Revenue Plan". Task 7.1 still has open prerequisites.

- 3.10 Self-hosting n8n on the VPS: planning only (Twenty task 3.10; see the 2026-10-18 log entry). Step 1 is a read-only export and size check of the cloud workflows; step 2 is a written plan. No n8n change without Abdullah's yes on that specific change.

## Blockers
Updated 2026-10-18 (go-live approved); earlier read-only check of n8n 2026-10-17. Confirm against Twenty task 3.5. The Oct 15 end-to-end call (see Done) suggests items 2 and 3 below are already cleared; Abdullah to confirm.
All on Abdullah, for 3.5:
1. ~~Confirm the go-live state of `m2YJwZ1l8DTzyEkw`~~ Approved live by Abdullah on 2026-10-18 (KI-009 resolved). Nothing changed in n8n.
2. Check Retell identity verification for outbound (KYC via Persona). Blocks the real phone test only.
3. Confirm the caller ID (+16692660586 must not be Nora's live line).
Then: confirm the post-call webhook URL is set on the agent, web-call test Alex, phone test last.
Also open: counsel reply (1.4); post-call webhook has no header auth (KI-005 / 3.6); Twenty filter syntax in the duplicate check and sweeper is unverified until a test run.

## Log
### 2026-10-22 (lead pipeline: audit, Twenty import, sync, refill)
- New `tools/lead_pipeline.py` + offline tests and `docs/lead-pipeline.md`. Audit gate passes 10 of the 18 remaining roofers on the mechanical checks; it does not prove right-business matches (KI-012). Twenty has 4 companies, none from the engine, so nothing is loaded yet. Import/sync/refill are dry runs; the Twenty REST filter and response shapes are unverified until the first `--apply` (no `TWENTY_API_KEY` in env). Treg balance still $0. No live changes made.
### 2026-10-22 (Twenty fields for the lead engine; Abdullah approved on the decision card)
- Created on Twenty `companies` (self-hosted, crm.kyneticai.com): Engine status (select DIAL_READY/HOLD), Meta Page ID (text), Facebook Page (links), Live ads, Oldest ad (days), New ads (30d), Est. ad spend/mo low and high (numbers, a rough proxy not real spend), Engine reason (text), State (text). That is 10 fields; the card said 9 but listed 10, all 10 were created.
- Added niche options Bath Remodel, Kitchen Remodel, Windows & Doors, Siding, Fence, Concrete to the existing Niche field (all existing options kept with their ids).
- No records were created or changed, and no views were changed. `lead_engine.py twenty-payload` still only writes a dry-run JSON; the import (and list-view column order) need a separate yes.

### 2026-10-21 (Treg-only pipeline test)
- Treg balance is spent: the $1 is gone ($0.54 for the US roofing census, the rest on endpoint tests). Treg now refuses calls (`insufficient_balance`), so nothing past this point was run. Top up at https://treg.to/app#billing.
- US roofing census through Treg (`lead_engine.py`, 252 searches, 40 states, FL/OK excluded): 5,735 ads, 2,032 advertisers, 958 with 2+ active ads, $0.54. The same period on Apify cost about $0.93 for 520 ads (about 17x more per ad). One Apify run (GA) failed with HTTP 400, cause not investigated.
- Treg-only enrichment pilot on 10 known DFW roofers, $0.16 total: Google Maps match and phone 9 of 10, LinkedIn company page 6 of 10, an owner-titled person 6 of 10, but only about 3 of those 6 were the right business (wrong-company and non-owner matches filtered by a title check added in `enrich_treg`). Owner direct-dial lookup returned a number for 1 of 2 tries at $0.0005 and $0 on a miss. The `enrich_treg` path inside the script has not completed a clean run because the balance ran out.
- Docs and a user decision still needed: owner direct-dial use depends on the counsel answer (task 1.4); Abdullah said Treg is cleared, Twenty not yet updated.

### 2026-10-21 (national lead database)
- New `tools/lead_engine.py`: one entry point for census (Treg Meta Ad Library keyword search, about $0.0011 per ~30 ads, roughly 20x cheaper per ad than the Apify actor), a SQLite store (`leads.db`, resumable, dedupes by Page ID), enrichment through `tools/lead_enrich.py`, CSV export, a "called" flag, and a Modal wrapper (untested, not deployed). Apify is an optional second census source (`--source apify|both`).
- `docs/lead-engine-niche-audit.md`: Meta-ad density for 20 niches (Dallas, Houston, $0.044). Recommends adding kitchen to the main list, testing fence and concrete, holding HVAC, generators, solar and pools, and treating restoration as a non-Meta source. Needs Abdullah's decision.
- Treg phone finder: Abdullah said Treg is "cleared and confirmed fine" on 2026-10-21; counsel task 1.4 status in Twenty not yet updated. Flagged, not assumed.
- No Twenty, n8n, Retell or Modal changes made.

### 2026-10-21 (lead engine: remaining roofers run)
- Apify (`APIFY_API_TOKEN`) and Firecrawl keys work in the new environment. Re-pulled dataset `odgk84u6wM8rrsd73` (343 ads, no new Apify spend) and added `tools/lead_census.py` (free filter: 2+ ads, Texas signal, non-roofers dropped). 18 roofers remained after excluding the 12 already done.
- `tools/lead_enrich.py` on the 18: 103 Firecrawl credits, about 9 minutes. 10 DIAL_READY, 8 HOLD, 1 AI answering flagged (Fort Tex, Alivo). Output in `docs/lead-engine-code-run/remaining-18-2026-10-21/`. Statuses are unaudited.
- Treg not used. No live-system changes.

### 2026-10-20 (lead engine pilots: Apify census, Treg test, Firecrawl-only script)
- Research and tooling only. Nothing changed in n8n or Retell. Twenty updated with Abdullah's yes (see below).
- Run B (Arlington roofing) audited: Claude+Firecrawl and Muse agree on the same 2 dial-ready businesses and phones; Muse reaches form-gated records (Comptroller, permit portal), Firecrawl is cheaper and leaves direct ad links. Muse's "no ads found" DROPs are unreliable. `docs/lead-engine-run-b-audit.md`.
- Apify actor `solidcode/meta-ads-library-scraper`: 343 DFW roofing ads for $0.31 -> 93 advertisers -> about 27 real roofers. Apify account is Free with a $5 cap, not $30. Muse enriched the top 10; audited statuses in `docs/lead-engine-pilot-apify.md`.
- Treg tested on 3 owners (email find, verify, phone find): about $0.049 of the $1; works but sample too small; phone finder not cleared for use (counsel 1.4).
- Added `tools/lead_enrich.py`: Firecrawl-only owner/phone enrichment (Texas open data, Comptroller page, BBB, site). On the same 10 businesses: 53 credits, 4 minutes, owner names matched Muse on 7 of 7, phone conflicts flagged not guessed. Results in `docs/lead-engine-code-run/`.
- Proposed (not approved or built): Modal job called from n8n, results logged to Twenty. Described in the handoff.
- Handoff doc for a new session: `docs/lead-engine-handoff.md`.
- Twenty updated (Abdullah said to mark all updates): new handoff note, dated lines on tasks 2.1, 2.2, 2.5, and a mismatch line on the Lane A note.

### 2026-10-19 (lead engine research: owner/phone sourcing, Firecrawl unblocked, Run B prompt)
- Research and docs only. Nothing changed in n8n, Retell or Twenty.
- Firecrawl returned HTTP 403 in the cloud session. Cause: the environment's network policy denied `api.firecrawl.dev:443` (proxy log), not the Firecrawl account. After Abdullah added allowed domains it worked: a search call (2 credits) and a scrape of the live Meta Ad Library page (`q=roof replacement`, US, active) returned 29 ads, about 25 roofing, with Library ID, start date, ad copy, advertiser name and Page link. Some ad copy names the owner. One page load gives about 30 ads, so more needs scrolling (untested through Firecrawl). The official Ad Library API does not cover US commercial ads, so the web page is the source.
- Read-only review of Twenty for the existing lead-engine work: notes "Search List + How Searches Ran" (5,539-query list across 15 metros, 191 cities), "MUSE PROMPT: Wave 1 North DFW census", "Lead Engine: research, ICP and method (Lane A)", "Qualifying Checks + Oct 13 Scraping (Superseded Demo)" and "Kynetic Prospecting Plan"; tasks 2.1, 2.2, 2.4, 2.5. The Oct 13 runs produced 54 dial-ready rows (31 Meta-ads tier 1, 23 quote-form tier 2); searching has been paused since Oct 13. Lane A notes say no people-search or data-broker sites but record no reason; Apollo and ownerphones.com are allowed for gaps after a quote.
- Added `docs/lead-engine-run-b-prompt.md`: one prompt for Claude (Firecrawl) and Muse, run separately and audited against each other. Sample is one city and one trade (Arlington TX roofing), caps 25 advertisers censused and 10 enriched (first 4 are a calibration set that runs every source), owner-name and phone source ladders (Texas Comptroller, county DBA, BBB, city permit portals and others), source scorecard and blocked log. Not yet run.
- Next: Abdullah runs the prompt in a separate Claude chat (Firecrawl) and in Muse, brings both outputs back, and Claude audits them (links, fabrication, owner and phone hit rates, cost and time). Allow the listed domains in that environment first.

### 2026-10-18 (portal login changes, Google on, VPS cleanup, n8n self-hosting decision)
- PRs #21-#25 merged as merge commits. #21 fixed the stale DNS/Resend statements (KI-006, context). #22 recorded D-022 (single deploy path is server-side `portal-deploy`; the `bob-box-ovh-vps` key keeps full root; KI-010 closed). #23 recorded Abdullah's approval of "Outbound Speed to Lead" staying live (KI-009 closed; no n8n change). #24 added the two-step admin login and "Remember this device for 30 days" (admin only, signed cookie, skips only the authenticator code; revoked by a password change or authenticator re-enrolment). #25 signs a new user straight in after accepting an invite; password resets still end at the sign-in page; a new admin must set up an authenticator before any admin page.
- Deployed with `portal-deploy`: `7cd69cc` (#24) and `bdc4afe` (#25), both "deploy OK", `/api/health` ok.
- Google sign-in is ON for invited clients (OAuth client created by Abdullah; the id and secret were set on the VPS through `/opt/portal/set-secrets.sh`, whose server copy was out of date and was replaced from main). Admins stay on password + authenticator by design (D-021).
- VPS cleanup (Abdullah approved): Bookstack and Docmost (two earlier portal trials) removed with their data, plus the 6.6 GB build cache. Disk went from 19 GB to 9.8 GB used of 72 GB (14%); memory about 4.7 GB available; load near zero. Portal, portal DB and the four Twenty containers stayed healthy. Unused leftovers not removed: `postgres:18`, `redis:8`, `hello-world`.
- Decision in progress: Abdullah wants to start self-hosting n8n on the OVH VPS to avoid n8n cloud execution limits and cost. Planning only. No migration has been done and no n8n change is approved. Rough sizing: about 1.5-2 GB at first, 2-3 GB after months (execution history is the only thing that grows; prune it); about 0.3-1 GB of memory. Risks to plan for: off-server backups, the lead-form and Retell post-call webhook URLs, credentials, HTTPS, and everything sitting on one server.
- Abdullah's to-do: generate admin recovery codes, run the invite, forgot-password and Google tests with the two test addresses, and the client A/B isolation test (KI-006).
- Twenty updated to match (with Abdullah's approval): note "Portal status: 2026-10-18" (`9b9ff979-88a2-4908-a445-eee3a33252f6`), note "READ FIRST — Session Handoff (2026-10-18, portal + n8n self-hosting)" (`c19135dc-464b-4635-82f6-7868f1c9f3e0`), and new task "[P1] 3.10 Plan self-hosted n8n on the OVH VPS (planning only)" (`074ff440-8eb3-40d2-9b3d-78858f0afc5f`, TODO, phase 3, lane B). Also logged: PR #26 (`653f9e0`) merged the docs for this day.

### 2026-10-17 (portal: invite-only sign-in hardening, Google sign-in, admin user tools)
- Branch `portal-auth-phase1` (separate worktree; opened as a PR, not deployed). Built: breached-password screen on invite/reset/change; admin one-time recovery codes (new `recovery_codes` table with RLS, migration 0002); security notice emails (password changed, MFA on, recovery code used, email changed); Users tab actions (cancel invite, send reset link, change email, remove user) plus invite-expiry display; invite-only Google sign-in for clients, off until `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` are set (D-021).
- Portal tests: `vitest run` is 13 files / 84 tests, all passing; lint and typecheck clean; `npm audit --omit=dev` 0 findings.
- Read-only facts checked on 2026-10-17: `portal.kyneticai.com` resolves to 40.160.150.91 and `/api/health` answers ok (so the DNS A record IS set); Resend and R2 keys are set on the VPS and a live upload and a real reset email both worked; `/usr/local/sbin/portal-deploy` and `portal-deploy-entry` are installed (identical to PR #19), a `deploy` user exists with a forced-command key labelled `github-actions-portal-deploy`, and the ubuntu account also has a `bob-box-ovh-vps` key (see KI-010).
- MISMATCH TO FIX (not changed here): KYNETIC_CONTEXT.md Portal section and KI-006 still say the DNS record is not set and Resend is unset. Both are wrong today. Waiting on Abdullah's yes (handoff Part C).
- Admin email on the live portal changed to abdullah@kyneticai.com (database update, same password and authenticator).

### 2026-10-17 (status check across n8n, Twenty and GitHub)
- Read-only check. n8n `m2YJwZ1l8DTzyEkw`: active, 561 executions, the latest 20 all successful on the 5-minute retry sweeper. Twenty: exactly one lead and one interaction on record, from the Oct 15 smoke test (now in Done). That closes the "smoke test still open" line in the 2026-10-15 entry.
- The voice provider bake-off was tracked only in a Twenty note (last edited Oct 16) and on the unmerged provider branches. Added it to In progress here and to KYNETIC_CONTEXT.md so a session that reads only the four context files knows it exists.
- Twenty updated to match: the bake-off note rewritten, a new task 3.9 for the bake-off, task 3.5 status refreshed (the Oct 8 text kept as history), and the dialing task moved to Tuesday Oct 20 with a note that it could move up to Monday Oct 19.
- Decided (D-020): the retry cadence and calling window stay as built. The Twenty D-012 note is annotated and a Twenty D-020 note was added.
- Dialing start moved to Tue Oct 20 across Twenty: the Start dialing task, the checkpoint (now Oct 28), the Quentin confirmation (now Oct 19), the 7.1/4.5/4.6 task notes, START HERE, READ FIRST, D-003 and D-017 update lines, and the Q4 Revenue Plan (math recomputed).
- `retell/builds/outbound-speed-to-lead/BUILD_PLAN.md` brought up to date (Current state rewritten; the original plan kept and marked historical).
- From Abdullah's Oct 17 summary (not yet logged on the branch): the ElevenLabs agent now runs the real Alex prompt; a Cal.com test event 7520336 (phone required) exists but the tools still point at 7404470; a text-confirmation change is planned and depends on A2P (KI-003).

### 2026-10-17 (repo reorganized around the four context files)
- Branch `chore/repo-reorg`. Legacy material removed from main (`archive/`, the duplicate `Claude Skills/brand-profile-generator`, generic `deep-research` and `frontend-design`); recoverable via tag `archive/pre-reorg-2026-10-17` (97bb382). No separate archive repo (D-019).
- `Claude Skills/` folded into `.claude/skills/`. `CLAUDE.md` now opens with the four-file session protocol. `portal/REPORT.md` became `portal/docs/build-report-2026-10-16.md`.
- Read-only n8n check: `m2YJwZ1l8DTzyEkw` is active with 38 nodes and the Alex agent ID set. The earlier 37 and 27 counts were stale. Nothing in n8n was changed. See KI-009.
- Alex prompt v1.2.3 is on `claude/alex-demo-live-test` (a247264), not merged or published.
- Portal open gaps and the dev-password check recorded as KI-006 to KI-008.
- Portal tests: `vitest run` passes 8 files / 56 tests (expected 51; the suite has grown since). Run from a copy of `portal/` as a non-root user because embedded Postgres refuses to start as root.
- `.env.example`: removed the Notion and Apify names, added `TWENTY_API_KEY` and `TWENTY_BASE_URL` (names inferred, not read from n8n or the connector).

### 2026-10-15 (Twenty moved to self-hosted)
- Twenty moved from Twenty Cloud to self-hosted v2.46.0 at https://crm.kyneticai.com. All 171 records (original ids), the custom schema, the Plan 1 dashboard and 20 saved views were copied and checked field by field.
- n8n credential "Twenty account" (`41C04qbmnbi0GI2P`) and the claude.ai Twenty connector now point at the self-hosted instance. Retell never called Twenty directly.
- Twenty Cloud stays untouched as the rollback copy until about 2026-10-29. Then: revoke its 3 API keys and decide whether to keep or cancel the workspace.
- KYNETIC_CONTEXT.md updated: self-hosted host, dashboard id and tabs, current custom objects (scrape_runs gone; invoices and expenses listed), current opportunity stages.
- Smoke test still open: the first real lead through "Outbound Speed to Lead" (`m2YJwZ1l8DTzyEkw`) should create the endCustomer record in self-hosted Twenty.

### 2026-10-13 (repo cleanup, docs caught up with Twenty)
- Removed the dead `platform/crm` mock (SeldonFrame / Vercel era; Twenty is the CRM, D-006). Moved `BUILD_LOG.md`, `automations/lead-scrape`, and `automations/retell-trade-receptionist` to `archive/`. Removed empty skill folders and the duplicate `Claude Skills/_kynetic` copy. Skills that stay live are in `.claude/skills/`.
- Parked Vapi (D-018): `VAPI_BUILDER_PROMPT.md` moved to `archive/vapi/`. Vapi workflows were renamed and deactivated.
- Folded the still-valid part of PR #12: D-014 is two endpoints and one secret, and progress no longer says "None active" or that Decisions 2 and 3 are open.
- Docs now run through D-018. D-017 is the price Quentin signed off: first 3 clients $4,675, clients 4 and up $8,500, three Stripe invoices at 50/25/25. `m2YJwZ1l8DTzyEkw` is 27 nodes (calling-hours gate and a fallback normalize step). Two Retell workspaces: abdullahblitz (new builds, Alex) and kyneticai (Nora and Emily).
- Context files consolidated to `KYNETIC_CONTEXT.md` plus `CLAUDE.md`. `AGENTS.md` points at `CLAUDE.md`. Kynetic Restoration (Demo) and Nora's files were not edited.

### 2026-10-12 (docs catch-up that PR #12 had started)
- Read-only check had found Twenty task 3.5 IN_PROGRESS, `m2YJwZ1l8DTzyEkw` built and inactive, and no outbound Retell agent. PR #11 later landed the Oct 7-9 prep on main. The Oct 12 doc sync (two-endpoint correction, progress, context) is included in the Oct 13 cleanup because PR #12 conflicted after the squash merge.

### 2026-10-09 (session 3b: walkthrough, Vapi side experiment, knowledge base)
- Wrote docs/plan1-walkthrough.md (also a Twenty note): we are in stage 1; first signature is several stages away; slow parts are counsel, the owner list and the sales kit.
- Retell outbound identity verification = KYC via Persona; still unchecked by Abdullah; blocks real outbound calls only.
- Vapi side experiment, later parked by D-018: VAPI_BUILDER_PROMPT.md written (now `archive/vapi/`). Abdullah pasted it into Vapi's AI builder. The workflows from that experiment were renamed and deactivated. Retell is the platform.
- Merged two research runs into demo-business/knowledge-base/kynetic-roofing-kb.md + MERGE_REPORT.md (license 108796 listed as "the website lists", not state-board verified; "inspection is free" is the demo offer, not an AM-1 claim).
- At the time, the next session was a Vapi review. That experiment was later parked (D-018). The Retell track still waits on Abdullah (KYC, create-outbound --apply, n8n credential).

### 2026-10-08 (session 3: confirmations and demo data)
- Spoken name confirmed: "Kynetic Roofing". Retell identity verification for outbound: Abdullah has NOT checked it yet (blocker for the phone test only). Retell agent and n8n workflow still not created; nothing dialed. n8n checked read-only: only the imported template `KYQIVtxwDcXVKmk3` exists, unchanged (still Google Sheets/Vapi/Azure); the new Twenty/Retell workflow is not built.
- Twenty audit: one demo roofing business (Kynetic Roofing (Demo) as company plus client account), AM-1 Roofing Inc as a separate prospect record, no stray "KyneticAI Roofing" or "Summit Ridge" records or text. Kept both the company and the client account (the workflow links leads to the client account).
- D-016 amended: copy everything from AM-1 onto the demo, only the name changes (close friend's business). Company record now has phone, address, rating 4.6 from 88; new Twenty note "BUSINESS PROFILE: Kynetic Roofing (Demo)" (id 2079cce2-1c48-44f1-b47e-934effff5034) attached to the company and client account. Website field left empty (Twenty blocks a duplicate domain). D-016 and DEMO BRIEFING rewritten in Twenty; repo PROFILE.md, BUILD_PLAN.md, N8N_MAPPING.md and decisions.md updated.
- n8n: built the new workflow "Outbound Speed to Lead" (`m2YJwZ1l8DTzyEkw`), then 25 nodes, validated, INACTIVE, never executed. Template `KYQIVtxwDcXVKmk3` left untouched. Needs the Retell credential and two placeholders (agent ID, caller ID) before any test. Oct 12 brought it to 27 nodes (calling-hours gate and a fallback normalize step); see the 2026-10-13 log.
- Next: Abdullah checks Retell verification, runs `create-outbound --apply`, creates the n8n credential "Retell API (outbound)". Then Claude builds the n8n workflow inactive and web-call tests Alex.

### 2026-10-03
- Read the Oct 1 plan notes and roadmap. Merged PR #2. Added the Retell permission rule. Started docs setup.

### 2026-10-04
- Repo cleanup finished (two rounds): removed unused skill folders, claude-mem, empty placeholders; trimmed CLAUDE.md and skills-breakdown.md.
- build-log skill updated to also refresh the docs/ files at session end.
- Resolved KI-001: confirmed the leaked Cal.com key was live on Abdullah's own account, rotated it, updated Emily's two Cal tools (check_availability_cal, book_appointment_cal), confirmed both validate against event type 7025524.

### 2026-10-05
- 1.2 closed: checked retell/builds/_inflate-original/agent.json, confirmed Emily's current voice (11labs-Cimo) is the same one Inflate's original build used, not an unexamined default. Decided to keep it rather than spend time picking a new one. See D-008.
- D-009: full voice-agent build declared redone from scratch after reviewing 9 YouTube transcripts and 6 build artifacts. Saved all 15 as SOURCE TRANSCRIPT/SOURCE TEMPLATE notes in Twenty and wrote the synthesis into "ACTIVE BUILD PLAN: Emily Rebuild + Speed-to-Lead Outbound."

### 2026-10-08 (later: D-016)
- Chose option B: Kynetic Roofing is built on AM-1 Roofing Inc's (Bend, OR) real profile. Merged two external LLM research runs into demo-business/PROFILE.md (confidence levels, conflicts). PROMPT.md facts, Cal timezone (America/Los_Angeles) and BUILD_PLAN updated. Twenty: new prospect record "AM-1 Roofing Inc" (contact data lives only there), demo company updated, D-016 note, DEMO BRIEFING rewritten. Open: confirm spoken name ("Kynetic Roofing" vs "KyneticAI Roofing"); AM-1 owner gate unchecked, no calls to AM-1; rating, Facebook, Meta ads, free estimate unverified. Retell and n8n still on hold.

### 2026-10-08
- Demo business renamed to **Kynetic Roofing** everywhere (was Summit Ridge Roofing; D-015 amended). Repo prompt/config/specs, Cal.com event description, and in Twenty the company, client account, D-015, demo briefing note and task 3.5 all updated. Created the demo company in `companies` (it had only been in client_accounts) and linked the briefing note to both. Retell agent creation is ON HOLD until Abdullah checks Retell; n8n workflow not built.
- Demo build prep: model business research (retell/builds/outbound-speed-to-lead/demo-business/PROFILE.md, AM-1 Roofing as the model, Kynetic Roofing stays the fictional skin), FORM_SPEC.md, N8N_MAPPING.md (Template 05 -> Twenty/Retell/OpenRouter abdublitz), prompt v1.1 (business facts, property address, form answers), agent.config.json, and `tools/retell.py create-outbound` (dry run works). Retell create was BLOCKED by the permission checker; Abdullah must run it. Twenty: 14 endCustomer fields, 3 customerInteraction fields, client account Kynetic Roofing (Demo). n8n workflow not built yet (needs agent ID and Retell credential).
- Cal.com Roof Inspection event type created through the API: ID 7404470, 30 min, attendee address. CAL_API_KEY in the cloud environment verified working (HTTP 200, not the old leaked key). Remaining Step 2: Retell identity verification check.
- Wrote the counsel outreach email (docs/counsel-email.md) and marked it done. Task 1.4 set to IN_PROGRESS, not done: it needs counsel's sign-off. Reordered Step 2: Twilio trunk, n8n Retell credential and test phone moved to the end because dialogue testing needs no phone number. Still open: Cal.com Roof Inspection event type ID and Retell identity verification check.

### 2026-10-07
- Decided D-014 (n8n form, two endpoints, light gate), corrected after finding Emily's Cal tools are native Retell tools. Labeled the last 9 tasks [P1]. Drafted retell/PROMPTING_STYLE.md, retell/builds/outbound-speed-to-lead/PROMPT.md and BUILD_PLAN.md.

### 2026-10-06 (audit session)
- Read-only audit of Twenty (50 tasks, 66 notes, 0 opportunities). Synced D-011 and D-012 into docs/decisions.md. Found Twenty task statuses stale: 1.1 and 1.2 still TODO though done, 3.5 not marked IN_PROGRESS. Then recorded D-013 (two plans) in Twenty: new BUSINESS MODEL: Two Plans and D-013 notes, banners on Package Menu, Offer Definition, MASTER PLAN and Lane B handoff, [P1]/[P2] prefixes on 41 of 50 tasks, 1.1 and 1.2 marked DONE. Left unlabeled pending Abdullah: 1.3, 3.7, 5.5 to 5.8, standard pricing, prospect follow up automation, remaining Claude skills.

### 2026-10-06
- D-010: resolved the one-agent-vs-two-agents question from the ACTIVE BUILD PLAN note as two separate Retell agents. Inbound (Emily) paused — near-done, left alone until a client demo needs it. Outbound speed-to-lead is now the sole active build target. Updated the ACTIVE BUILD PLAN note and docs/progress.md, docs/decisions.md to match.
