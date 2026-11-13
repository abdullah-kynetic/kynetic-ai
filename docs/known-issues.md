# Known issues

> **Issue/evidence reference, not an active plan.** Current completion checklist: [COMPLETION-PLAN.md](codex/COMPLETION-PLAN.md). Dated issue states below have not been externally refreshed. In particular, duplicate KI-013 headings refer to different issues; use their titles/dates. Restored DEV session evidence does not certify production. No issues are silently closed here.


Mirror of open problems tracked in Twenty. Twenty is canonical; this file mirrors it. On a mismatch, flag it rather than silently picking one.

## Open
### KI-037: Only the leads list filters by custom fields (low)
Found 2026-11-13. Custom field values are now entered and shown on contacts, companies and deals, and the leads list can filter and export them. The companies list and the deals board have no custom field filter or column. Phase 1 acceptance P1-3 was met for filtering on contacts only.

### KI-036: A client import can record consent dated after an opt-out (medium)
Found 2026-11-13. The client import (P1-5) uses the staff import's consent rule: a row with a date, a channel and proof saves an express consent. The newest event wins, so a client-supplied date later than a person's opt-out or DNC would make them reachable again. Decision for Abdullah: should an import refuse to record consent for a contact who has opted out or is on the DNC list? Not changed in code; it matches the existing staff import.

### KI-035: Primary button hover falls below 4.5:1 for the brand blue #2563eb (low)
Found 2026-11-13 by the phase 1 accessibility scan: white text on the hover colour (primary mixed 8% with white) measures 4.41:1 on the synthetic tenant colour. The resting state passes. The scan moves the pointer away first. Not fixed. Also note the import and CSV export share a budget of 5 uploads an hour per tenant.

### KI-034: Portal database backups fail and do not reach R2 (high)
Found 2026-11-12. Every `backup_runs` row (21 of 21, 2026-11-10 to 2026-11-12) failed: the worker image's `pg_dump` was version 15 against Postgres 16 ("server version mismatch"). Nothing reached R2, and the worker's `STORAGE_BUCKET` is `kynetic-portal-test` while the production bucket is `kynetic-portal-files`. The backup alert is off. The Dockerfile now installs the version 16 client and fails the build otherwise. Phase 0 (2026-11-13) added the worker heartbeat to `/api/health`, so the next dead worker shows as 503 instead of silent. Still needed on the server: deploy the new worker image, set the bucket, turn on `BACKUP_ALERT_ENABLED`, then one manual backup and one restore test. The root cron job `/etc/cron.d/portal-backup` is unread.

### KI-020: Soft-deleted document files are not purged (low)
Found 2026-11-10. Admin delete and replace hide a PDF from the client and set `tenant_documents.deleted_at` or `superseded_by`. The storage object is kept. There is no job that removes those objects after a retention window.

### KI-021: Proposal PDF has no price (low)
Found 2026-11-10. The proposal PDF and preview say "Pricing to be confirmed". The price schedule is not in this repo, and a catalog or estimator is blocked. Do not invent a number.

### KI-022: Clients do not see usage or provider cost (open)
Found 2026-11-10. `/admin/usage` is staff-only. `calls.cost.read` stays limited to Kynetic admin and VA. A client usage page is blocked until someone decides whether clients should see provider cost. Do not add that page in the meantime.

### KI-023: Message provider cost is not stored (open)
Found 2026-11-10. `messages` has no cost column. The usage rollup counts SMS and email, stores message cost as 0, and marks the day "cost unknown" when a message was sent or a call has no cost. Do not invent a price to fill the gap. The recorded monthly fee still comes from `tenant_billing_modules` as stored.

### KI-024: Twenty summary push is not built (closed, won't build 2026-11-12)
Found 2026-11-10. Closed 2026-11-12: the portal became the source of truth and Twenty is a read-only safety copy, so there is nothing to push.

### KI-025: Offboarded clients are not deleted (open)
Found 2026-11-10. Offboarding sets `offboarded_at` and `deletion_due_on` (30 days later) and queues a record export. Nothing deletes the client, the rows, or the files. The date is a reminder. The manual steps are in `docs/runbooks/offboarding.md`. A deletion still needs an explicit yes.

### KI-026: Terms gate stays off until counsel approves the wording (medium)
Found 2026-11-10. The acceptance page and the dashboard redirect exist. `TERMS_GATE_ENABLED` defaults to false. The page still shows the placeholder copy and a visible "Draft wording" notice. Do not turn the flag on, and do not replace the placeholder, until counsel signs the Terms and Privacy text (KI-002).

### KI-027: Appointment calendar does not sync to an outside calendar (medium)
Found 2026-11-10. Month, week, and day views read the portal `appointments` table. Nothing creates or updates a Cal.com event or a client's own calendar. Blocked on which calendar the client uses.

### KI-028: Automation cadence and copy cannot be edited in the portal (medium)
Found 2026-11-10. The automations page can turn a template on or off and can show run history. It cannot change the wait, the message, or enroll a list of contacts. Blocked on whether sequences run in n8n or in the portal worker.

### KI-029: Support alerts do not send email (low)
Found 2026-11-10. A new client request notifies Kynetic in the portal, and a Kynetic reply notifies the requester in the portal. The email preference for `support_request` and `support_reply` defaults to off, and this batch does not queue an email even if someone turns that preference on. Blocked by the rule that this work must not add a real outbound send.

### KI-002: TCPA emergency branch opt-out gap (high)
Emergency calls and urgent notifications may reach someone who opted out.
Fix: counsel sign-off (task 1.4). Also feeds the agreement rewrite (task 4.7, 4.8).

### KI-003: Twilio A2P not registered, SMS filtered (high)
SMS from +16692660586 never arrived on Sep 22.
Fix: finish A2P 10DLC registration (task 1.3).
Update 2026-11-08 PST: `docs/progress.md` records campaign CJUDEQY as verified on 2026-10-28, and also says the text wording and SMS tool are not restored (D-025 item 4). This pass did not re-check Twilio, so both statements stay. A verified campaign is not permission for cold SMS. DNC, consent, and quiet hours still apply.

### KI-004: Emily workflow still has 13 Notion nodes (medium)
Fix: replace with Twenty nodes, needs approval (task 3.2).

### KI-005: n8n webhooks have no auth (medium)
The outbound post-call webhook has no header auth (Retell signs the request; the path is unguessable). The same gap covers the parked Vapi calendar webhook and Nora's 5 webhooks.
Fix: add a header-auth secret on the outbound workflow (task 3.6). Do not modify Nora's webhooks. Keep this repo private until the outbound webhook is authenticated.

### KI-006: Portal go-live gaps (high)
The client portal (portal.kyneticai.com) must not hold real client data until these are closed:
- ~~`RESEND_API_KEY` is unset~~ Closed 2026-10-17: the key is set on the VPS and a real reset email was delivered.
- The DB superuser and owner passwords sit in the app container environment.
- No off-server backups and no restore test (nightly 02:30 backup stays on the VPS).
- ~~The portal DNS A record is not set~~ Closed 2026-10-17: portal.kyneticai.com resolves to 40.160.150.91 and `/api/health` answers ok.
- The manual client A/B isolation test has not been run.

### KI-007: Portal low-severity items (low)
- 12h admin session cap.
- `trusted_proxies` not set.
- TOTP window.
- Log rotation.

### KI-008: Check the portal does not reuse the dev Postgres password (medium)
Confirm `/opt/portal/.env` does not reuse the dev Postgres password hard-coded in `portal/scripts/pg-embedded.mts`. Not yet checked; the VPS is out of scope for repo work.

### KI-011: Lead-engine records disagree or are missing (medium)
Found 2026-10-19 (read-only review of Twenty).
- D-002 here still says drop businesses with a receptionist or front desk. Twenty's Oct 13 notes ("Qualifying Checks", "Kynetic Prospecting Plan") say front-desk businesses are NOT dropped, and the Lane A note proposes rewording D-002 to "no dedicated instant-response call center". The reword is PENDING Abdullah's yes. Not changed here.
- `research/search-queries.csv` and the `wave*-raw.csv` / `rerun-raw.csv` / `maps-adcheck.csv` files described in the Twenty note "Search List + How Searches Ran" are not in this repo (no `research/` folder on main or this branch). Location unknown.
- The Lane A note asks to rotate the Treg token pasted in chat on Oct 10; not confirmed done.
- The "no people-search or data-broker sites" rule appears in Lane A notes with no recorded reason. Kept as is; a counsel question for 1.4 if it should be loosened.
Fix: Abdullah to say where the research files are, confirm the Treg rotation, and approve or reject the D-002 reword.

### KI-013: Portal has no sign-in (open mode) (high)
Update 2026-11-13 01:15 UTC (2026-11-12 PST): anonymous probe of portal.kyneticai.com: `/api/health` HTTP 200 (`{"status":"ok","checks":{"database":"ok","queue":"not_configured"}}`), `/admin` HTTP 401, `/dashboard` HTTP 307 to `/sign-in`. Sign-in is enforced on the live revision. The probe cannot show which commit is live: the live health response has no build commit field, which `main` adds (PR #166).
Update 2026-11-12: anonymous probe of portal.kyneticai.com showed `/admin` returns HTTP 401 and `/dashboard` redirects to `/sign-in`, so sign-in is enforced on the live revision. Treat this as closed once the first invites are confirmed.
Update 2026-11-08 PST: the 2026-11-08 ledger labels HTTP 200 on `/admin` as inference (a sign-in page can also return 200) and the deployed revision as partly memory-based. The docs pass on this date did not probe the portal and does not confirm production exposure or a deploy. The release risk stays open until a dated anonymous probe of the deployed revision shows a denial. The 2026-11-08 note follows.
Update 2026-11-08: main `49019b93` (merged 2026-11-05) restores invitation-only sign-in, staff TOTP and verified sessions, and persona switching only works outside production with DEV_PERSONA_SWITCHING (checked in code; typecheck and 468 unit tests pass). It is NOT deployed: live portal.kyneticai.com still runs `350bf67` and `/admin` returns HTTP 200 with no sign-in (checked 2026-11-08). Still open until main is deployed and the first invites are created. Original note follows.
Found 2026-11-02 (DC-TBD-15). Anyone who can reach an open-mode build acts as the Kynetic admin or any client. Fine for local use and synthetic data. Do NOT deploy it to a public address with real client data until network access control or sign-in is back. The live portal.kyneticai.com still runs the Oct 29 build with sign-in; deploying main replaces that with the open build. Fix: restore auth (git history before the open-mode commit has it) or add Cloudflare Access first.

### KI-012: Lead enrichment: phone certainty, rate limits, wrong-business matches (medium)
Found 2026-10-20.
- No tested stack shows which phone reaches the owner (Bert has several; Johnny Walker differs between Muse and the script). Sample hand-dials needed.
- Treg phone finder returns personal-looking numbers; compliance not cleared (task 1.4). Treat as off.
- Firecrawl returns HTTP 429 on bursts; `tools/lead_enrich.py` paces and retries. BBB/registry name matching can attach another business's owner; the script now needs the first two distinctive name words in the BBB URL, but audit every row.
- Apify account `kyneticai` is Free with a $5 monthly cap (cycle ends 2026-10-29), not $30.
Fix: hand-dial a sample, counsel answer, and keep the audit step in every run.

## Open (docs reconciliation leftovers, 2026-11-08 PST)
### KI-017: Production is still the pre-consolidation release (high)
Found 2026-11-09. portal.kyneticai.com is release `350bf673` (1 admin user, about 13 tenants). The portal line moving onto `main` is not deployed. Migrations `1007` through `1013` have not been applied to that database. The separate DEV environment is retired until after go-live, so there is no second portal to rehearse on. Do not deploy, migrate, or recreate DEV without an explicit yes.
Update 2026-11-13 01:15 UTC (2026-11-12 PST): the same anonymous probe (see KI-013) shows the live revision enforces sign-in. Live is `main` `58405247` (deployed 2026-11-12 per the operator); `main` is ahead of it (PR #162, #164, #166 merged, not deployed).
Update 2026-11-10 evening PST: production at portal.kyneticai.com is `main` `ac0192af` (PR #146 deployed), with migration `1015_schedules_retention_settings`. `PROVIDER_MODE=stub` and `OUTBOUND_ENABLED=false` unchanged. Migrations through `1015` are applied; `1016` is the systems/templates/guarantee migration on this branch.

## Gotchas
- Cloud sessions deny hosts not in the environment's allowed domains. Firecrawl returned 403 until `api.firecrawl.dev` was allowed (2026-10-19). A scrape of Facebook, BBB, the Texas Comptroller and similar sites needs those domains allowed too.
- Never modify Nora (agent_4c34644a04c74e27253e80167b, n8n 2PFWFqBM0wabADk6).
- Never add, remove, rename or change parameters of a Retell agent tool without approval of that specific change.
- tools/retell.py dry-runs every write unless --apply is passed.
- The Retell MCP runs through npx (`.mcp.json`) but its code tool needs Deno, and it is often unavailable. Use tools/retell.py.

- Twenty refuses the same website domain on two companies. The Kynetic Roofing (Demo) company has no website field set because AM-1 Roofing Inc already uses am1roofing.com; the website lives in the profile note.
- The n8n workflow "n8n Facebook Ad Form" (`KYQIVtxwDcXVKmk3`) is SOURCE TEMPLATE 05 imported as-is (Google Sheets, Vapi, Azure). Do not activate it and do not run it. Do not create Google Sheets. The Oct 17 read found the Retell workflow "Outbound Speed to Lead" (`m2YJwZ1l8DTzyEkw`) at 38 nodes and active, including a calling-hours gate and a fallback normalize step. That is a historical observation of the parked Retell path (KI-009). It is not an instruction to activate a workflow. Current Alex work is ElevenLabs through n8n on the VPS, and live agent `agent_8201m5afn2rbeb7v29xfkhh1pjef` must not be changed or invoked.
- `TWENTY_API_KEY` is a dead name (KI-016). Use `TWENTY_BASE_URL` and `TWENTY_SELFHOST_API_KEY`. Never REST DELETE on Twenty.
- `docs/codex/COMPLETION-PLAN.md` is not the roadmap (KI-015, resolved 2026-11-09). The portal line is `main`. The separate DEV environment is retired until after go-live (KI-017).
- Vapi is parked (D-018). Its workflows were renamed and deactivated. The builder prompt was removed from main (recoverable via tag `archive/pre-reorg-2026-10-17`) and is not a spec to run.
- The Retell post call webhook in n8n has no auth (unguessable path only) because Retell signs requests instead of sending a custom header. Part of KI-005.
- The Kynetic Roofing (Demo) company record carries the real AM-1 office phone (D-016 amended). Never dial it from the demo or any test.

## Resolved
### KI-016: Checker read the dead Twenty key name (low)
Approved Twenty env names are `TWENTY_BASE_URL` and `TWENTY_SELFHOST_API_KEY`. `TWENTY_API_KEY` is dead. Resolved 2026-11-09 in PR #141: `scripts/checks/checks.py` check 3.4 uses the supported names and skips when the key is unset. That fix is in the portal-line consolidation. Do not put the dead name back into `.env.example`.

### KI-015: Branch completion plan claimed to be the active checklist (medium)
Found 2026-11-08. `docs/codex/COMPLETION-PLAN.md` called itself the one active checklist. Resolved 2026-11-09: the file is marked historical evidence, `docs/STATUS.md` stays the entry point, and the portal code is consolidated onto `main`. The old checklist body remains under that banner. It is not the plan.

### KI-014: CRM portal M10-01 security gate had high findings (high)
Found 2026-10-29: authenticated API, search, and tenant import/export rate limits were declared but not enforced, and the exact Bun lock production audit was unavailable. Resolved 2026-10-29: `withApi` now enforces 120/min per authenticated user; contacts list and Cmd+K search enforce 30/min per user; import uploads and CSV export share 5/hour per tenant. Disposable PostgreSQL integration tests prove 429 responses at each limit. Supervisor ran `bun audit --prod` against `bun.lock` (366 packages, no production vulnerabilities); a moderate development-only esbuild advisory remains low. M10-01 is done; production edge/header/CI secret-scanner verification remains open. Evidence: `docs/security-review-M10-01.md`.

### KI-013: New CRM portal email provider not wired at process startup (was high)
Found 2026-10-29: the Resend adapter and Better Auth magic-link callback existed, but no Node startup path called `setEmailProvider()` or `setMagicLinkSender()`, so configured email sends failed as unconfigured.
Resolved 2026-10-29: added `wireEmail()` for app instrumentation and worker startup. Fake-fetch tests verify configured sends and no-key behavior. No real Resend request was made; live credentials and deliverability remain unverified.

### KI-009: Outbound workflow found active with Alex ID set; go-live approved 2026-10-18 (was medium)
Workflow `m2YJwZ1l8DTzyEkw` was found active on Oct 17 (read-only check, 38 nodes) with the Alex agent ID set and the Retell credential attached. Go-live not yet approved; Abdullah to confirm. Docs previously said inactive and never run. The public form and the post-call webhook are live while it is active. Do not change n8n without a yes on that specific change.
Resolved 2026-10-18: Abdullah approved the workflow staying live. No n8n change was made. The post-call webhook still has no header auth (KI-005).

### KI-010: Who and what can change the portal server (was medium)
Found read-only on 2026-10-17. Two keys have full administrator access to the VPS (which also holds Twenty and its backups): Abdullah's Mac, and one labelled `bob-box-ovh-vps` (believed to be Abdullah's Grok bot). A restricted `deploy` key (forced command, deploys only commits on `main`, rolls back on failure) was added the same evening. There are now two ways to deploy: the bot path (`portal-deploy`) and `portal/deploy/deploy.sh`; each overwrites `/opt/portal/src`, so use one. Decide whether the bot should keep full root, and which deploy path is the one.
Resolved 2026-10-18 (D-022): the `bob-box-ovh-vps` key keeps full root by Abdullah's choice, and `portal-deploy` is the single deploy path.

### Portal server deploys from Claude sessions (2026-11-03)
The "Kynetic VPS" session's auto-mode classifier blocks `portal-new-deploy deploy` as a production deploy unless an allow rule exists (`Bash(sudo /usr/local/sbin/portal-new-deploy *)` via `/permissions`) or Abdullah approves it in that session. Its repo clone lives in a /tmp scratchpad that may vanish; move it to a permanent path. Cloud sessions cannot SSH to the server (port 22 blocked).

### Contact merge copies consent grants (audit 2026-11-08)
Main's `mergeContacts` copied every consent row, grants included, onto the surviving contact and did not record consent state. Resolved 2026-11-10: grants stay on the merged-away contact, opt-outs and DNC carry, the earlier do-not-call mark carries, and the audit row records both contacts' consent state without the captured wording.

### KI-001: Leaked Cal.com key in git history (was high)
A key starting cal_live_f64 was committed Aug 23, carried in from the Inflate AI reference files. Confirmed Oct 4, 2026 it was a live key on Abdullah's own Cal.com account (abdullah@kyneticai.com). Deleted in Cal.com and replaced with a new key, entered into Emily's two Retell Cal tools (check_availability_cal, book_appointment_cal on llm_b520d8a6b9bf754f19285a8a6185), event type 7025524 (Water Damage Assessment). Confirmed both tools show the new key and validate. The old key value stays in git history; it is dead in Cal.com so that no longer matters.

### KI-018: Excel import is still refused (medium)
Found 2026-11-10. PRD decision 17 and F-90 call for `.csv` and `.xlsx`. No safe spreadsheet parser was a dependency, so the import screen refused `.xlsx`.
Resolved 2026-11-10 in PR #150: `.xlsx` is accepted with `read-excel-file` 9.3.14, which returns stored cell values and does not calculate formulas. A formula with no cached value fails that row in the dry run. Zip entry count and uncompressed size are capped before inflate. `.xlsm` and `.xls` stay refused, including a macro file renamed to `.xlsx`. `bun audit` reported no vulnerabilities for the dependency set.

### KI-022: Clients do not see usage or provider cost (open)

Found 2026-11-10. `/admin/usage` is staff-only. `calls.cost.read` stays limited to Kynetic admin and VA. A client usage page is blocked until someone decides whether clients should see provider cost. Do not add that page in the meantime.

### KI-023: Message provider cost is not stored (open)

Found 2026-11-10. `messages` has no cost column. The usage rollup counts SMS and email, stores message cost as 0, and marks the day "cost unknown" when a message was sent or a call has no cost. Do not invent a price to fill the gap. The recorded monthly fee still comes from `tenant_billing_modules` as stored.

### KI-024: Twenty summary push is not built (open)

Found 2026-11-10. Blueprint AU-29 would push a summary into Twenty. This batch did not build it. Twenty stays untouched.

### KI-025: Offboarded clients are not deleted (open)

Found 2026-11-10. Offboarding sets `offboarded_at` and `deletion_due_on` (30 days later) and queues a record export. Nothing deletes the client, the rows, or the files. The date is a reminder. The manual steps are in `docs/runbooks/offboarding.md`. A deletion still needs an explicit yes.

### KI-019: Audit-log archive destination is not defined (low)
Found 2026-11-10. PRD decision 9 keeps the audit log 24 months online, then archived. `audit_log` is append-only, and no archive store is named. The retention purge does not delete audit rows. Recordings, messages, revoked consents, import files, and webhook payloads follow the decided windows.

### KI-026: Terms gate stays off until counsel approves the wording (medium)
Found 2026-11-10. The acceptance page and the dashboard redirect exist. `TERMS_GATE_ENABLED` defaults to false. The page still shows the placeholder copy and a visible "Draft wording" notice. Do not turn the flag on, and do not replace the placeholder, until counsel signs the Terms and Privacy text (KI-002).

### KI-027: Appointment calendar does not sync to an outside calendar (medium)
Found 2026-11-10. Month, week, and day views read the portal `appointments` table. Nothing creates or updates a Cal.com event or a client's own calendar. Blocked on which calendar the client uses.

### KI-028: Automation cadence and copy cannot be edited in the portal (medium)
Found 2026-11-10. The automations page can turn a template on or off and can show run history. It cannot change the wait, the message, or enroll a list of contacts. Blocked on whether sequences run in n8n or in the portal worker.

### KI-029: Support alerts do not send email (low)
Found 2026-11-10. A new client request notifies Kynetic in the portal, and a Kynetic reply notifies the requester in the portal. The email preference for `support_request` and `support_reply` defaults to off, and this batch does not queue an email even if someone turns that preference on. Blocked by the rule that this work must not add a real outbound send.

### KI-030: Review requests are queued only, and review snapshots are entered by hand (medium)
Found 2026-11-11. "Request a review" on `/dashboard/reviews` writes a `queued` row after `canContact` allows it. Nothing sends it and nothing moves it to `sent` or `completed`, because sending waits on the n8n versus worker decision and A2P (P-A3). Rating snapshots come from `review_snapshots` rows added by staff, not from a live Google feed.

### KI-031: Referral rewards are tracked, not paid out (low)
Found 2026-11-11. `/dashboard/referrals` records a reward amount and a pending or paid status that only the owner can change. Nothing pays or invoices a reward. The reward policy itself is not decided.

### KI-032: Client usage page hides dollar cost (low)
Found 2026-11-11. SPEC 01 in Twenty lists the usage page as "minutes, cost, cap" and marks it blocked on "do clients see cost?". The page shows minutes, calls, texts, emails and a cap status chip only. Add cost only after Abdullah decides.

### KI-033: Staff email-code login removes the authenticator step (medium)
Found 2026-11-12. At Abdullah's request, `STAFF_EMAIL_LOGIN=true` lets a Kynetic admin or VA sign in with a 6-digit emailed code, with no authenticator app and a 30 day session. Anyone who controls that mailbox then has admin access, so the mailbox needs its own strong sign-in. It is off by default. Codes are sent through Resend, so `RESEND_API_KEY` must be set on the server or no code arrives. Google staff sign-in still works; with the setting on it also skips the authenticator. Turning the setting off restores Google plus authenticator and 7 day sessions.
