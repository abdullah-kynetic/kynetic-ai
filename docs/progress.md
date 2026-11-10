# Progress

> **Canonical plan (2026-11-08, precedence restated 2026-11-08 PST; portal line 2026-11-09 PST):** the business roadmap, progress baseline and scorecard live in Twenty: roadmap note `7bfdcb7e`, baseline v1 note `603fe300`, scorecard note `5c44b12e`. GitHub owns technical tracking only (code, PRs, CI, deploy evidence: `docs/audit/2026-11-08-code-evidence.md`). The operating summary, offer, pricing precedence, and the docs-reconciliation journal are in `docs/STATUS.md`. `docs/codex/COMPLETION-PLAN.md` is historical evidence, not a competing roadmap. Do not keep a second editable acceptance list in this repo.

## Portal line (2026-11-09 PST)

One portal line on `main`. The separate DEV environment is retired until after go-live. Production at portal.kyneticai.com is still release `350bf673`; this change does not deploy. Details: `docs/STATUS.md` and the 2026-11-09 decision note in `docs/decisions.md`.

This file is the dated log. On a mismatch with Twenty, flag both values. The GitHub docs pass did not read Twenty and did not change the frozen scorecard weights. The parallel Twenty cleanup is the parent-reported verification in `docs/STATUS.md`.

## Historical marker (2026-11-08 PST)

The headings below through Blockers record older operating orders: Plan 1 at the D-017 price, the five-client gate, Retell as the platform, an open bake-off, auth-last, and n8n-deferred. They are kept. The five-step order in `docs/STATUS.md` supersedes them. Do not execute those sections as the current plan.

## Portal implementation order (2026-11-01, historical)

N8n automations were deferred by Abdullah on this date. The instruction then was to continue portal features with synthetic fixtures and to leave login/auth work last. M16 agency workspace, source tracking, pipeline UI, human dialer/never-dial checks and campaigns were locally verified. M17-01 proposal drafts were also locally verified. The "next" line then was wave 38 won-deal onboarding and price-plan data. That sequencing is not current: portal access protection is part of step 2, and Alex-on-n8n is part of step 3. Activation of a workflow still needs a yes. Live systems were unchanged by that session.

## Audit 2026-11-08 (code and deployment evidence)

Evidence ledger: `docs/audit/2026-11-08-code-evidence.md` (levels: documented, branch, merged, tested, deployed, verified). Twenty remains the business source of truth; this repo holds technical evidence only. Corrections to the lines below:
- "Codex steps 3-6 not done" is true of main only. Branch `dev/codex-setup` (99 commits ahead, unmerged, no PR, no CI run) records steps 3-5 and agency steps 7-12 as done on DEV, plus its own `docs/codex/COMPLETION-PLAN.md` (a technical evidence index, not the business plan). Those are self-reported and not verified here.
- Live portal still returns 200 on `/admin` (checked 2026-11-08); main's sign-in work is merged and CI-green but not deployed.
- Closed as duplicate or superseded (branches kept): #36 (duplicate of #134), #34, #37, #38 (contained in #136), #39 (palette decision). Kept open: #136 (only PR path for the Astro site; live www was built from `feat/positioning-remodelers`, not main), #113 (see KI entry), #134.
- Flag, as written on 2026-11-08: pricing in D-017 conflicts with the live site's pricing (the site branch refers to a D-023 that does not exist in `docs/decisions.md`); the unified-CRM decision of 2026-11-08 is not implemented (module gate and plan fields still model Lite/Full). 2026-11-08 PST reading: do not choose again between D-017 and D-023. Twenty D-023 (2026-10-24) is the pricing authority. The Nov 5 guarantee is separate. Lite/Full stays an internal code flag. See `docs/STATUS.md`.

## Status check 2026-11-08 (read-only review; superseded the October blocker list, and is itself a dated snapshot)

Checked directly: GitHub, repo code (typecheck clean, 468/468 unit tests on main `49019b93`), live HTTP, n8n workflow list, Twenty.
- Not launch-ready. Twenty has 0 opportunities; no Alex workflow is active in n8n (all Retell, 11Labs and DEV Alex workflows are inactive); only the website contact form workflow `WxIh0Hw4lQodY1Xa` is active and it has not been tested.
- Portal access, as written that day: live portal treated as open (KI-013); main's sign-in restore (2026-11-05) treated as not deployed. 2026-11-08 PST reading: the ledger labels HTTP 200 on `/admin` as inference. This docs pass did not probe production and does not confirm a deploy or an exposed admin page.
- Codex build steps 0 to 2 done (dev setup, foundation, Alex on ElevenLabs DEV). Steps 3 to 6 not done: lead-to-booking chain, texts and alerts, onboarding, go-live. "Done" in BUILD_PLAN means built and locally verified, not working end to end.
- A DEV Twilio voice number was bought and assigned to a DEV ElevenLabs agent (2026-11-04); dev portal runs at dev.kyneticai.com on an older revision.
- Website: www.kyneticai.com serves the positioning build (from `feat/positioning-remodelers`, not on main); /remodelers still has red TODO boxes (guarantee wording, video, add-ons, testimonials).
- Twilio A2P campaign CJUDEQY was recorded as verified 2026-10-28; text wording and SMS tool not restored yet (D-025 item 4). That record is not permission for cold SMS, and this pass did not re-check Twilio.
- Open PRs: #136 (brand revamp, likely stale vs. the live site), #134 (lead pipeline, supersedes #36), #113 (M1-08, stacked on a closed base), #34/#37/#38/#39 (old site stack), #36. Abdullah decides closures.
- Full report: project file handoff/launch-readiness-2026-11-08.md. Twenty tasks were refreshed the same day (1.3 and 3.10 marked done; four launch-blocker tasks added).

## Historical plan (superseded 2026-11-08 PST)
Plan 1 only: the outbound speed-to-lead agent at the D-017 price (first 3 clients $4,675, clients 4 and up $8,500, three Stripe invoices at 50/25/25). Gate of 5 paying clients before Plan 2 (D-013). Task titles in Twenty carried [P1]/[P2]; Emily inbound and all upsell systems were [P2]. Do not quote this price. Twenty D-023 (2026-10-24) is the later pricing authority. The five-client gate is not the operating order.

## Historical phase (superseded 2026-11-08 PST)
Phase 3, outbound speed-to-lead build only (D-010). Lane B, the build lane. This section's "Retell is the platform" line is historical. D-025 moved Alex to ElevenLabs. Vapi stays parked (D-018). Files in `retell/builds/outbound-speed-to-lead/` are the parked spec. The CRM portal is technical work in this repo and is not a second business roadmap.

## Done
- 2026-11-03: replaced the 13 pitch-client workspaces on the live portal (portal.kyneticai.com) with the agreed set from PR #127 (5 Houston-area roofers, 3 pool builders, 2 window/door, 3 remodelers). The wrong 10 roofers and the 3 earlier remodeler rows were removed with `db:remove:tenants` (PRs #130, #132); the 4 `audit_log` rows for them were kept on purpose. Live is on `350bf67`. Backups in `/var/backups` (`portal-new-pre-replace2-20261103T060432Z.dump` is the pre-swap one). No calls, leads, reviews or revenue were loaded.
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
- CRM portal M10-01 local security gate completed 2026-10-29 with no open high findings. Evidence and medium production-verification items are in `docs/security-review-M10-01.md`; this does not claim production sign-off.

## In progress (historical)
- 3.5 outbound build. Prep is in the repo. On 2026-10-17 a read-only check found `m2YJwZ1l8DTzyEkw` active with the Alex agent ID (`agent_71e3cfc8384aa38a910a506b53`) set in Call Settings and Retry Call Settings and the "Retell API (outbound)" credential attached. Go-live approved by Abdullah on 2026-10-18 (KI-009). Alex prompt v1.2.3 is on branch `claude/alex-demo-live-test`, not merged or published. Blocked on Abdullah; see Blockers.
- Voice provider bake-off (Retell vs Bland vs ElevenLabs) for Alex. **Testing, no decision: Retell stays (D-018) unless a challenger clearly wins on the shared scorecard.** Control is Retell Alex Lab. ElevenLabs is furthest along; Bland has a test track and no results yet. Both live on unmerged branches (`claude/provider-test-elevenlabs`, `claude/provider-test-bland`), not on main. Current state, agent IDs and rules: the "Voice provider bake-off" section of KYNETIC_CONTEXT.md; running log: `providers/elevenlabs/RESULTS.md` on the branch and the Twenty note "VOICE PROVIDER BAKE-OFF". Twenty has no task for it yet.

- Lead engine (Lane A, tasks 2.1/2.2/2.4/2.5): Run B, the Apify DFW pilot, a Treg test and a Firecrawl-only script are done and audited; nothing is built in Modal/n8n. Full state, results and a start prompt for a new session: `docs/lead-engine-handoff.md` (branch `claude/modest-thompson-h9atoy`; Twenty note "LEAD ENGINE: Run B + pilots handoff (Oct 19-20, 2026)"). Next: add a geography filter and AI-receptionist detector to `tools/lead_enrich.py`, run the remaining ~17 roofers, scale the Treg test. Dialing is planned for Tue Oct 20 and needs about 3,000 owner-gated numbers; the lead pool is not there yet (7.1 launch gate).

## Paused (historical; D-010, Oct 6, 2026 — inbound is near-done, left alone until a client demo needs it)
- 3.1 Repoint Emily's 4 tool webhooks and post-call webhook, greeting says Emily. Approved, URL only.
- 3.2 Swap Emily's 13 Notion nodes for Twenty nodes. Needs approval of the node-by-node plan.
- 3.3 Publish the Retell agent (Emily build copy). Was blocked on voice; no longer blocked, but not current work.
- 3.4 Test 3 call paths. Blocked on 3.3 and 1.3.

## Next (historical; not the active focus)
- 3.5 Finish the outbound agent. Decisions 2 and 3 are resolved in D-014 (n8n form, two endpoints, light pre-call gate). Nothing left to confirm there. The n8n workflow exists (38 nodes, active as of the Oct 17 read; see KI-009). What is left is confirming go-live, the KYC check, and a test. See Blockers.
- 3.6 Compliance for the outbound workflow: SMS opt-out, Contact relation, webhook auth (KI-005).
- 1.3 Twilio A2P registration for +16692660586 (manual). Voice goes first (D-004).
- 1.4 TCPA emergency branch opt-out gap, counsel sign-off (manual). Counsel email is drafted in docs/counsel-email.md.
- Outreach target, once the launch gate is actually met: 75 manual owner dials a day (Q4 plan). Start moved to Tuesday Oct 20, and it could be moved up to Monday Oct 19 (Twenty updated Oct 17). With 24 working days to Nov 20, 75 a day only just covers the base case for 5 clients (about 90 a day for 6); the plan and the checkpoint (now about Oct 28) were recomputed in the Twenty note "Q4 Revenue Plan". Task 7.1 still has open prerequisites.

- 3.10 Self-hosting n8n on the VPS: planning only (Twenty task 3.10; see the 2026-10-18 log entry). Step 1 is a read-only export and size check of the cloud workflows; step 2 is a written plan. No n8n change without Abdullah's yes on that specific change.

## Blockers (historical, as of 2026-10-18)
Updated 2026-10-18 (go-live approved); earlier read-only check of n8n 2026-10-17. Confirm against Twenty task 3.5. The Oct 15 end-to-end call (see Done) suggests items 2 and 3 below are already cleared; Abdullah to confirm.
All on Abdullah, for 3.5:
1. ~~Confirm the go-live state of `m2YJwZ1l8DTzyEkw`~~ Approved live by Abdullah on 2026-10-18 (KI-009 resolved). Nothing changed in n8n.
2. Check Retell identity verification for outbound (KYC via Persona). Blocks the real phone test only.
3. Confirm the caller ID (+16692660586 must not be Nora's live line).
Then: confirm the post-call webhook URL is set on the agent, web-call test Alex, phone test last.
Also open: counsel reply (1.4); post-call webhook has no header auth (KI-005 / 3.6); Twenty filter syntax in the duplicate check and sweeper is unverified until a test run.

## Log
### 2026-11-10 — portal schedules, tokens, billing drafts, merge consent, retention

Code only. No deploy, no production migration, no live send or charge. `docs/STATUS.md` still records production as `350bf673`; the task said portal.kyneticai.com runs `d7f4c07`. This pass did not probe the live site.

- Daily metrics and the monthly report are enqueued for onboarding and active tenants. Suspended and offboarded tenants are skipped. The report day is 1–28 in the tenant timezone, default 1, edited from the admin client reports page and shown on the client reports page.
- Admins can issue, list, and revoke per-tenant service tokens. The token is shown once. The hash is what is stored. Each action is audited.
- The n8n push URL is an admin form. The signing secret is encrypted with `APP_ENCRYPTION_KEY` and is not rendered back. Plaintext in module config is stripped and is not used to sign.
- Agency deal terms, invoice drafts, reminder drafts, and gate checks save when `PROVIDER_MODE` is live. A live-mode Stripe event is refused with an explicit message. Nothing on those screens charges or sends.
- Contact merge no longer copies consent grants. Opt-outs, DNC rows, and the earlier do-not-call mark carry. The audit row records both contacts' consent state.
- Excel import stays refused (KI-018). CSV remains the upload path.
- A daily retention purge clears call recordings and transcripts after `purge_after`, messages after 24 months, revoked consents after 5 years, raw import files 30 days after commit, and webhook payloads after 30 days. Audit rows are not deleted (KI-019).

### 2026-11-09 — portal sign-in: email codes, QR authenticator, separate sign-up

Abdullah asked for four auth changes on `crm/`. Built on `cursor/portal-auth-otp-qr-2f76`. After PR #143, `main` (`5efc6c0f`) holds the portal line and this branch was merged onto that `main`. Not deployed.

1. Staff TOTP enrolment shows a QR code. Backup codes are not returned, stored as an empty list, or accepted. "Can't scan the code?" reveals the key.
2. Clients type a one-time email code. It is sent only for an active membership or a live invitation, and not for staff. Other addresses get the same message and no email. Codes expire in 10 minutes, lock after five misses, and are rate limited. Audit rows store an address hash, not the code. Outbound email stays off unless Resend is configured; tests capture the sender.
3. `/sign-up` is invite activation (code, then name). `/sign-in` is log-in. Uninvited sign-up creates no account.
4. `/sign-in/help` resends a client code and explains staff recovery. An admin resets another staff authenticator from Users (audited). The sole admin uses `crm/scripts/emergency-reset-staff-totp.ts`. No passwords.

The earlier schema-list, schema-drift, and isolation failures were fixed on `main` in the consolidation (agency tables declared in the Drizzle schema). They pass on this branch. The duplicate open KI-015 for that drift was dropped; KI-015 on `main` is the resolved completion-plan note.

Anonymous browser visits to `/admin` and its pages redirect to `/sign-in` with a `next` return path. API requests still get 401. A staff session that still needs TOTP is sent to `/staff/2fa` with the same return path. Signed-in clients stay forbidden.

### 2026-11-09 (single portal line)
- Abdullah decided to stop the second portal line. The portal code from `dev/codex-setup` is consolidated onto a branch for merge into `main` (merge commit, history kept). `main` becomes the production build for portal.kyneticai.com. The separate DEV environment is retired until after go-live. `scripts/deploy-dev.sh`, `scripts/deploy-dev-server.sh`, `scripts/fix-dev-runtime.sh`, and `scripts/checks/mac-dev-runtime.sh` now refuse to run. No GitHub workflow was deploying that branch on push. No VPS, DNS, or live service was touched. Production remains release `350bf673`.
- The first CI check on that pull request failed because migrations `1008`–`1013` created agency tables that were not in the Drizzle schema or the integration allow-lists. Those tables were declared and excluded from the two-tenant seed, same as the earlier agency tables. Auth code was not changed. The end-to-end job then failed because the synthetic browser server left `PROVIDER_MODE` at its live default, so the agency compose preview refused to run. That server now forces stub mode and outbound off.

### 2026-10-29 (CRM portal M10-01 security review)
- Fixed the contacts phone-fragment GIN index to lead with `tenant_id` (`b7b8e57`) and wired shared PostgreSQL auth IP/email limits (`8256212`). Focused auth/rate-limit tests (19), baseline CRM test (13), header tests (3), and webhook/service-token test suites passed. Typecheck passed.
- Initial M10-01 review state: authenticated API/search/export-import rate limits were not wired, exact Bun-lock audit and restore evidence were pending, and CI secret scanning/log-redaction plus production edge configuration were open. Details and subsequent resolution are recorded in `docs/security-review-M10-01.md`.
- Post-fix verification: affected search/export/import/rate-limit integration suites passed 34 tests, `withApi` unit tests passed 5, and M10 accessibility/security plus M9 search/export browser suites passed 10/10 without rate-limit errors. Typecheck passed.

### 2026-10-29 (CRM portal M10-04 accessibility review)
- Expanded the axe matrix to 24 synthetic routes across light/dark and desktop/390px mobile, covering sign-in, pending terms, owner and admin pages. WCAG 2.0/2.1/2.2 A and AA tags were enabled; all 96 page-state scans are clean after fixes.
- Initial valid findings: two low-contrast audit summaries, two non-focusable mobile table scroll regions, and an invalid Kanban `aria-orientation`; fixed in `d25d682` and `720b81f`. Updated the branding preview to use active-theme-derived text in `246d35d`.
- `m10-a11y-security.spec.ts` plus `shell.spec.ts`: 21/21 passed, including keyboard/focus checks; typecheck and build passed; branding color unit suite 17/17 passed. Test coverage/fixture changes are `d96feeb`.
- Manual screen-reader review: not verified, needs a human screen-reader pass. M10-04 remains blocked until completed.

### 2026-10-29 (CRM portal M10-01 gate update)
- Closed the high rate-limit findings in `430da61` with integration coverage in `4ffce62`. Per supervisor evidence, production dependency audit is clean (366 checked), one moderate dev-only esbuild advisory remains low, and M8b restore passes 5/5 against matching PostgreSQL 17.10 tools. M10-01 is done; production edge/header/secret-scanner verification remains open and is not represented as production sign-off.

### 2026-10-29 (portal Resend startup wiring)
- Added idempotent Node app/worker boot wiring for the existing Resend adapter and Better Auth magic-link callback. Missing `RESEND_API_KEY` leaves both registries unset; configured mode logs only the provider name. The magic-link URL is HTML-escaped, excluded from logs and hashed for the Resend idempotency key.
- Verified by fake-fetch unit tests only; no real Resend network call or email send was made. Focused tests and typecheck passed; implementation and test commits are on local `work` only (not pushed).

### 2026-10-25 (Alex go-live thread: ElevenLabs chosen; D-025)
- Verdict: ElevenLabs wins, v1 strict `agent_8201m5afn2rbeb7v29xfkhh1pjef` goes live (D-025). Free tier, demos only until the first client signs; Abdullah declined a paid plan for now. Retell go-live parked, nothing was activated.
- 2026-10-22: edited the live v1 prompt (ElevenLabs API, prompt only; model and both Cal.com tools unchanged) to drop the "you'll get a text" promise. Before/after in `providers/elevenlabs/golive/`. Restore the text wording when the Twilio A2P campaign is approved (pre-approved by Abdullah).
- Read-only findings: n8n workflow `xlmyRd5jBBBu8LX7` is not on the VPS (only the Retell one `tXJwNTkNgKGnp0Ab` is); VPS lacks the Twenty and Gmail credentials; Twilio +16692660586 is not Nora's line. Plan: `docs/plans/ALEX-ELEVENLABS-GOLIVE.md`.
- Twenty: task 3.9 and the decision notes updated to match; mismatch between Twenty D-023 (offer) and repo D-023 (site) / D-024 (offer) flagged in D-025.

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

### 2026-10-31 — M12–M20 audit, local wave 30

On `work`, fast-forwarded the stale checkout to merged main `3ff1685` (PR #122); no main change. Drafted `docs/portal-n8n-contract.md`, audited all waves in `docs/audit-M12-M20.md`, and fixed F-33 booking stage lookup to Estimate Booked with a tenant/replay regression. Typecheck and 392 unit tests pass. Focused integration could not start without TEST_DATABASE_ADMIN_URL/PostgreSQL; baseline lint and format remain failing. M12-01 awaits review, M13-06 awaits database verification, M18-05 is blocked on explicit deletion approval and M10-07 legacy ingest fate. Next: regression verification/review, then eligible wave 31 tasks. No real provider calls, secrets, n8n activation, deploy, push or main merge. No new business decision or live issue was established; docs/decisions.md and docs/known-issues.md are unchanged.

### 2026-11-01 — login/auth sequencing

Abdullah requested login/auth last. Updated BUILD_PLAN and DECISIONS: remaining user-facing login/auth work follows feature implementation and precedes go-live. Existing access controls stay enforced; feature tests use synthetic authenticated fixtures. Documentation-only change; no runtime changes or tests run.

### 2026-11-01 — wave 31 local implementation

Completed the pending M13-06 regression against disposable PostgreSQL 16 (6/6). Technically reviewed M12-01 for local build; locked-decision supersedes and go-live remain separate gates. Built M12-03 evidence-only contact-decision API (atomic tenant-isolated immutable ledger + timeline), M12-05 admin webhook status/one-time secret issue/rotate screen with role/view-as protection, and M13-02 explicit ElevenLabs live opt-in defaulting off. Only synthetic encryption keys/tokens/records were used. Login/auth feature work remains last; existing controls are reused.

Verification: typecheck passed; full unit suite 401/401, then final provider/alert guard tests 8/8; six integration suites 45/45. Targeted lint has no errors (three fixture warnings), formatting passes. CI/build/browser/live behavior not run; baseline whole-repo lint/format failures remain. M15-04 safe alert formatter/fake delivery tests are drafted, but n8n SDK reference/node schemas return internal errors, so the importable workflow is blocked. M12-02 supersede confirmation remains pending; no decision IDs guessed. Next: resolve those two gates, then wave 32's policy/kill-state/result relay work. Test database removed at session end. No real secret access/issuance, provider calls, workflow writes/activation, deploy, push or main merge.

### 2026-11-01 — wave 32 portal readers and result relay

On work, added tenant-scoped send-state/contact-policy readers and the normalized call-result relay. Policy snapshots expose minimal status/rule/count inputs, fail closed on bad platform config and explicitly report migrationGatePassed=false. The relay checks scoped auth/module/contact/agent ownership, accepts only tenant recording keys, stores immutable receipt migration 1002 and reuses native disclosure/DNC/retention/timeline/completion persistence with concurrency locks. Unexpected relay failures omit transcript-bearing database error objects.

Verified: typecheck; 402 unit tests; 107 integration tests across nine suites. Final relay failure-log regression passed 10/10 afterward. Scoped lint has no errors; scoped formatting passes. No CI/build/browser/n8n/live verification. M12-04, M12-06 and M13-03 remain in-progress where acceptance requires actual n8n graphs/parity or recording ingestion. M12-02 supersede confirmations remain pending. The n8n reference tool retry still fails; official npm SDK 0.38.4 reference/license inspected in temporary storage as a possible offline fallback, with no repo dependency added. FL/OK block-vs-window parity difference is documented for review. Next: construct/validate inactive n8n graphs using verified node schemas, test the shared contact rules/parity, and establish recording ingestion before advancing dependent flows. Local test database removed. No real secrets/provider calls, workflow writes/activation, deploy, push or main merge; login/auth work stays last.

### 2026-11-01 — portal-first M16 agency workspace

Abdullah directed us to skip n8n automations and continue the rest of the portal. Updated the synthetic-only dependency order and built M16-01/02/05: isolated registry/setup (migration 1003), admin agency workspace UI, manual source-classified leads, source filters/counts, seven agency stages, stage renaming and logged deal moves. Existing contact/deal/stage services and auth guards are reused. Setup leaves outbound disabled, Alex paused and no invites/memberships/credentials; no real agency tenant was created. Real data migration remains separate. Existing client pipelines and demo seeds are preserved.

Verified: production build, typecheck, 406 unit tests, 27 integration tests and one browser flow including mobile axe with zero violations. A seed regression was fixed before the final passing run. Scoped lint has no errors (one axe import warning); scoped formatting passes. CI/deployed behavior not verified. No n8n/connector work, login/auth feature work, provider calls, real secrets, deploy, push or main merge. Local test database removed. Next: M16 human dialer together with never-dial/DNC safeguards, then campaigns and proposal drafts.

### 2026-11-01 — M16 manual dialer and campaigns

Built M16-03/04/06 on work. New pages /admin/agency/dialer and /admin/agency/campaigns expose a guarded first-pass synthetic queue, reviewed draft script, manual outcome/history, separate DNC marking, campaign creation/assignment, queue filters and member outcome summaries. Migration 1004 owns the tenant-scoped campaign/membership/immutable manual-history tables. Existing contact entry now optionally accepts fictional 555-01xx phones and known state codes. One rule guards both selection and logging: AM-1 identity/known protected number, FL/OK, unknown/conflicting state, DNC/phone opt-outs, unsafe numbers, closed/already-logged leads are excluded. No provider/call job or AI calls record is created. Callback is a recorded outcome with no schedule. All existing admin/view-as and module controls remain; login/auth feature work stays last.

Verified: production build/typecheck, 425 unit tests, 63 integration tests and two browser flows with zero mobile axe violations. Scoped lint has no errors and scoped formatting passes. CI/live behavior not verified. No n8n/connector work, VPS access, actual call/message, real secrets, deploy, push or main merge. Local test database removed. Next: M17 proposal draft builder; n8n work remains parked.

### 2026-11-01 — M17 proposal drafts

Built M17-01 on work: migration 1005, one internal draft per agency deal, four editable sections, persisted preview, partial drafts and revision conflict protection. Controlled editor fields retain unsaved text after a conflict. Existing admin/module/view-as checks remain enforced. No send/public link, stage move, price calculation or invoice is created.

Verified: production build with TypeScript, 430 unit tests, 9 focused PostgreSQL integration tests and one Chromium browser flow, including mobile editor/preview axe scans with zero violations after navigation finishes. Browser harness corrections wait for lead creation, target the conflict alert specifically and wait for the existing transient navigation indicator to disappear before axe. Scoped lint/format pass. CI, deployed/VPS and live integrations remain unverified; earlier global lint/format baseline issues remain. Test database removed at session end. No n8n, provider calls, real secrets, deploy, push or main merge. Next: wave 38 won-deal onboarding; price-plan work must respect the pending pricing decision gate. Login/auth stays last. No new business decision or live issue established; lowercase decisions/known-issues unchanged.

### 2026-11-01 — preview deployment approved; access pending

Abdullah approved deployment of the separate synthetic work preview for visual review, superseding the earlier no-deploy restriction for this scope. Corrected preview auth database configuration and explicit stub provider selection. Shell syntax and YAML/config checks pass. Actual deployment has not run: current managed environment reports no credentials/identities/VPS capabilities, no TCP access grants, and GitHub CLI reports invalid authentication. Need a configured preview VPS connection (or working GitHub Actions access with the existing PREVIEW_SSH_* setup). Production, n8n and providers unchanged. No URL is claimed live.

### 2026-11-02 — M20-06 client support requests

Merged PR #123 to main first (CI green after fixing lint, formatting, integration, compose-check and e2e setup issues). Then built M20-06 on `claude/project-thread-qyeivs`: migration 1006 `support_requests` (tenant RLS, app role insert/select only), staff rollup functions `admin_list_support_requests` and `admin_set_support_request_status` (admin and VA, refused in view-as/read-only, audited), service `src/server/support`, client page `/dashboard/support`, staff queue `/admin/support`, `support.manage` permission. Nothing is sent or queued; Abdullah sees requests in the queue (email alerts would be an n8n task later).

Verified: typecheck, lint, format, build, 431 unit tests, 6 new integration tests plus the existing suites (isolation, schema list). The browser pages were compiled but not exercised in a browser here. Not verified: CI on this branch.

### 2026-11-02 — authentication and sign-in removed (open mode)

Abdullah asked to delete all authentication and sign-in until the end (DC-TBD-15). Done on `claude/project-thread-qyeivs`: `getSessionUser` and `requireUser` now return an existing user chosen by the `kynetic_open_as` cookie (admin by default; `/open/<persona>` and the account menu switch it); no sessions, magic links, Google sign-in, TOTP or terms gate. Deleted the sign-in, accept-terms and staff 2FA pages, the Better-Auth route and client, create-auth, two-factor, gate, lifetimes and the auth rate limiter, the magic-link email wiring, the `better-auth` package, and the tests for them. The database tables (sessions, accounts, terms) are untouched. RLS, the permissions matrix, view-as and audit still apply. `bun run demo` now just starts the synthetic server on port 3000.

Verified locally: typecheck, 431 unit tests, all integration tests pass except the p95 speed test, which also fails on current main on this machine (CI limit is 5000 ms), 38 browser tests pass. Not verified: CI on this branch. Not deployed. Live portal.kyneticai.com still runs the Oct 29 build; see KI-013 before deploying this one. `BETTER_AUTH_SECRET` is still a required env var; harmless, to be dropped when auth is rebuilt.

### 2026-11-08 PST — documentation authority reconciliation

Docs only, on `cursor/docs-authority-reconcile-1883`. No application code, schema, workflow, Twenty write, deploy, or live probe. Journal and readiness table: `docs/STATUS.md`.

Entry instructions now start at that file. Historical operating orders (Retell as Alex's platform, the open bake-off, D-017 as the price to quote, the five-client gate, build-everything-first, auth-last, n8n-deferred, the AI commit trailer, `TWENTY_API_KEY`, and the lowest-unchecked Codex step) are marked historical. Their original text stays. Twenty D-023 remains the pricing authority over D-017. The Nov 5 remodeler guarantee is recorded separately. The Nov 6 price proposal is recorded as not approved. No new D-number was assigned, because Twenty's sequence already diverges from this file.

`dev/codex-setup` `docs/codex/COMPLETION-PLAN.md` (`81496f99`) still calls itself the one active checklist. This pass did not edit that branch. Frozen scorecard weights and the 23/53/24 snapshot were not changed. `scripts/checks/checks.py` still reads the dead Twenty key name.

Follow-up the same evening, still docs only: the parent verified a parallel Twenty cleanup (11 notes and 23 tasks updated, readback of all 34, all 63 tasks mapped, missing Step 2 tag fixed, baseline `603fe300` unchanged, 88 notes and 63 tasks at 52 TODO / 4 IN_PROGRESS / 7 DONE). Direction, provider, one CRM, and the guarantee were reconciled there, with history kept. Stale due dates, schema, customer records, live systems, and Claude-only files were left untouched. This repo pass did not read Twenty. The counts are the parent's verification.

