# Known issues

Mirror of open problems tracked in Twenty. If this disagrees with Twenty, Twenty wins.

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

## Gotchas
- Never modify Nora (agent_4c34644a04c74e27253e80167b, n8n 2PFWFqBM0wabADk6).
- Never add, remove, rename or change parameters of a Retell agent tool without approval of that specific change.
- tools/retell.py dry-runs every write unless --apply is passed.
- The Retell MCP needs Deno and is often unavailable. Use tools/retell.py.

- Twenty refuses the same website domain on two companies. The Kynetic Roofing (Demo) company has no website field set because AM-1 Roofing Inc already uses am1roofing.com; the website lives in the profile note.
- The n8n workflow "n8n Facebook Ad Form" (`KYQIVtxwDcXVKmk3`) is SOURCE TEMPLATE 05 imported as-is (Google Sheets, Vapi, Azure). Do not activate it and do not run it. The real outbound workflow is "Outbound Speed to Lead" (`m2YJwZ1l8DTzyEkw`): 27 nodes as of Oct 12, including a calling-hours gate and a fallback normalize step. It is inactive and has never run. It still has two placeholders (Retell agent ID, caller ID) and needs the "Retell API (outbound)" credential before any test.
- Vapi is parked (D-018). Its workflows were renamed and deactivated. The builder prompt is in `archive/vapi/` and is not a spec to run.
- The Retell post call webhook in n8n has no auth (unguessable path only) because Retell signs requests instead of sending a custom header. Part of KI-005.
- The Kynetic Roofing (Demo) company record carries the real AM-1 office phone (D-016 amended). Never dial it from the demo or any test.

## Resolved
### KI-001: Leaked Cal.com key in git history (was high)
A key starting cal_live_f64 was committed Aug 23, carried in from the Inflate AI reference files. Confirmed Oct 4, 2026 it was a live key on Abdullah's own Cal.com account (abdullah@kyneticai.com). Deleted in Cal.com and replaced with a new key, entered into Emily's two Retell Cal tools (check_availability_cal, book_appointment_cal on llm_b520d8a6b9bf754f19285a8a6185), event type 7025524 (Water Damage Assessment). Confirmed both tools show the new key and validate. The old key value stays in git history; it is dead in Cal.com so that no longer matters.
