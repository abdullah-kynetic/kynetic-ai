# Known issues

Mirror of open problems tracked in Twenty. Twenty is canonical; this file mirrors it. On a mismatch, flag it rather than silently picking one.

## Open
### KI-002: TCPA emergency branch opt-out gap (high)
Emergency calls and urgent notifications may reach someone who opted out.
Fix: counsel sign-off (task 1.4). Also feeds the agreement rewrite (task 4.7, 4.8).

### KI-003: Twilio A2P not registered, SMS filtered (high)
SMS from +16692660586 never arrived on Sep 22.
Fix: finish A2P 10DLC registration (task 1.3).

### KI-004: Emily workflow still has 13 Notion nodes (medium)
Fix: replace with Twenty nodes, needs approval (task 3.2).

### KI-005: n8n webhooks have no auth (medium)
The outbound post-call webhook has no header auth (Retell signs the request; the path is unguessable). The same gap covers the parked Vapi calendar webhook and Nora's 5 webhooks.
Fix: add a header-auth secret on the outbound workflow (task 3.6). Do not modify Nora's webhooks. Keep this repo private until the outbound webhook is authenticated.

### KI-006: Portal go-live gaps (high)
The client portal (portal.kyneticai.com) must not hold real client data until these are closed:
- `RESEND_API_KEY` is unset, so login tokens go to the logs instead of email.
- The DB superuser and owner passwords sit in the app container environment.
- No off-server backups and no restore test (nightly 02:30 backup stays on the VPS).
- The portal DNS A record is not set.
- The manual client A/B isolation test has not been run.

### KI-007: Portal low-severity items (low)
- 12h admin session cap.
- `trusted_proxies` not set.
- TOTP window.
- Log rotation.

### KI-008: Check the portal does not reuse the dev Postgres password (medium)
Confirm `/opt/portal/.env` does not reuse the dev Postgres password hard-coded in `portal/scripts/pg-embedded.mts`. Not yet checked; the VPS is out of scope for repo work.

### KI-009: Outbound workflow found active with Alex ID set; go-live not approved (medium)
Workflow `m2YJwZ1l8DTzyEkw` was found active on Oct 17 (read-only check, 38 nodes) with the Alex agent ID set and the Retell credential attached. Go-live not yet approved; Abdullah to confirm. Docs previously said inactive and never run. The public form and the post-call webhook are live while it is active. Do not change n8n without a yes on that specific change.

## Gotchas
- Never modify Nora (agent_4c34644a04c74e27253e80167b, n8n 2PFWFqBM0wabADk6).
- Never add, remove, rename or change parameters of a Retell agent tool without approval of that specific change.
- tools/retell.py dry-runs every write unless --apply is passed.
- The Retell MCP runs through npx (`.mcp.json`) but its code tool needs Deno, and it is often unavailable. Use tools/retell.py.

- Twenty refuses the same website domain on two companies. The Kynetic Roofing (Demo) company has no website field set because AM-1 Roofing Inc already uses am1roofing.com; the website lives in the profile note.
- The n8n workflow "n8n Facebook Ad Form" (`KYQIVtxwDcXVKmk3`) is SOURCE TEMPLATE 05 imported as-is (Google Sheets, Vapi, Azure). Do not activate it and do not run it. The real outbound workflow is "Outbound Speed to Lead" (`m2YJwZ1l8DTzyEkw`): 38 nodes and active as of the Oct 17 read-only check, including a calling-hours gate and a fallback normalize step. See KI-009 for the go-live question.
- Vapi is parked (D-018). Its workflows were renamed and deactivated. The builder prompt was removed from main (recoverable via tag `archive/pre-reorg-2026-10-17`) and is not a spec to run.
- The Retell post call webhook in n8n has no auth (unguessable path only) because Retell signs requests instead of sending a custom header. Part of KI-005.
- The Kynetic Roofing (Demo) company record carries the real AM-1 office phone (D-016 amended). Never dial it from the demo or any test.

## Resolved
### KI-001: Leaked Cal.com key in git history (was high)
A key starting cal_live_f64 was committed Aug 23, carried in from the Inflate AI reference files. Confirmed Oct 4, 2026 it was a live key on Abdullah's own Cal.com account (abdullah@kyneticai.com). Deleted in Cal.com and replaced with a new key, entered into Emily's two Retell Cal tools (check_availability_cal, book_appointment_cal on llm_b520d8a6b9bf754f19285a8a6185), event type 7025524 (Water Damage Assessment). Confirmed both tools show the new key and validate. The old key value stays in git history; it is dead in Cal.com so that no longer matters.
