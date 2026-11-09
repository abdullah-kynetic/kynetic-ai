# Known issues

Mirror of open problems tracked in Twenty. Twenty is canonical; this file mirrors it. On a mismatch, flag it rather than silently picking one.

## Open
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
### KI-015: Branch completion plan still claims to be the active checklist (medium)
`dev/codex-setup` at `81496f99b2dd20a88e6cbc080b33e0a73e76a2aa` (2026-11-06) contains `docs/codex/COMPLETION-PLAN.md`, which calls itself the one active completion checklist. Main's `docs/STATUS.md` warns that the file is not authority. The 2026-11-08 PST docs pass did not edit that branch. Do not merge the branch in order to install that file as the plan. A later edit on that branch can add the same warning. Until then the branch copy remains wrong if read alone.

### KI-016: Checker read the dead Twenty key name (low) — RESOLVED 2026-11-09 (branch fix/twenty-key-crm-tier-labels, PR pending merge)
Approved Twenty env names are `TWENTY_BASE_URL` and `TWENTY_SELFHOST_API_KEY`. `TWENTY_API_KEY` is dead. `scripts/checks/checks.py` check 3.4 used to send `TWENTY_API_KEY`; it now uses the supported names and skips when the key is unset, with offline tests. Do not put the dead name back into `.env.example`.

## Gotchas
- Cloud sessions deny hosts not in the environment's allowed domains. Firecrawl returned 403 until `api.firecrawl.dev` was allowed (2026-10-19). A scrape of Facebook, BBB, the Texas Comptroller and similar sites needs those domains allowed too.
- Never modify Nora (agent_4c34644a04c74e27253e80167b, n8n 2PFWFqBM0wabADk6).
- Never add, remove, rename or change parameters of a Retell agent tool without approval of that specific change.
- tools/retell.py dry-runs every write unless --apply is passed.
- The Retell MCP runs through npx (`.mcp.json`) but its code tool needs Deno, and it is often unavailable. Use tools/retell.py.

- Twenty refuses the same website domain on two companies. The Kynetic Roofing (Demo) company has no website field set because AM-1 Roofing Inc already uses am1roofing.com; the website lives in the profile note.
- The n8n workflow "n8n Facebook Ad Form" (`KYQIVtxwDcXVKmk3`) is SOURCE TEMPLATE 05 imported as-is (Google Sheets, Vapi, Azure). Do not activate it and do not run it. Do not create Google Sheets. The Oct 17 read found the Retell workflow "Outbound Speed to Lead" (`m2YJwZ1l8DTzyEkw`) at 38 nodes and active, including a calling-hours gate and a fallback normalize step. That is a historical observation of the parked Retell path (KI-009). It is not an instruction to activate a workflow. Current Alex work is ElevenLabs through n8n on the VPS, and live agent `agent_8201m5afn2rbeb7v29xfkhh1pjef` must not be changed or invoked.
- `TWENTY_API_KEY` is a dead name (KI-016). Use `TWENTY_BASE_URL` and `TWENTY_SELFHOST_API_KEY`. Never REST DELETE on Twenty.
- `dev/codex-setup:docs/codex/COMPLETION-PLAN.md` is not the roadmap (KI-015).
- Vapi is parked (D-018). Its workflows were renamed and deactivated. The builder prompt was removed from main (recoverable via tag `archive/pre-reorg-2026-10-17`) and is not a spec to run.
- The Retell post call webhook in n8n has no auth (unguessable path only) because Retell signs requests instead of sending a custom header. Part of KI-005.
- The Kynetic Roofing (Demo) company record carries the real AM-1 office phone (D-016 amended). Never dial it from the demo or any test.

## Resolved
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

### KI-001: Leaked Cal.com key in git history (was high)
A key starting cal_live_f64 was committed Aug 23, carried in from the Inflate AI reference files. Confirmed Oct 4, 2026 it was a live key on Abdullah's own Cal.com account (abdullah@kyneticai.com). Deleted in Cal.com and replaced with a new key, entered into Emily's two Retell Cal tools (check_availability_cal, book_appointment_cal on llm_b520d8a6b9bf754f19285a8a6185), event type 7025524 (Water Damage Assessment). Confirmed both tools show the new key and validate. The old key value stays in git history; it is dead in Cal.com so that no longer matters.

### Contact merge copies consent grants (number to be assigned) (audit 2026-11-08)
Main's `mergeContacts` (`crm/src/server/contacts/service.ts`, consent copy block) copies all consent rows, grants included, to the surviving contact and writes no consent-state audit entry. The 2026-10-26 decision for M1-08 is that grants never carry, opt-outs and DNC always carry, and the audit entry records both contacts' consent and opt-out state. That behavior is on PR #113 (DC-112 row), which is still open and stacked on a closed base; DC-112 is not in main's `docs/DECISIONS.md`. Not fixed here.
