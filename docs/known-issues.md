# Known issues

Mirror of open problems tracked in Twenty. If this disagrees with Twenty, Twenty wins.

## Open
### KI-001: Leaked Cal.com key in git history (high)
A key starting cal_live_f64 was committed Aug 23. It came from the Inflate AI reference files. The current file on main no longer holds it, but history does.
Fix: revoke it in Cal.com (task 1.1).

### KI-002: TCPA emergency branch opt-out gap (high)
Emergency calls and urgent notifications may reach someone who opted out.
Fix: counsel sign-off (task 1.4). Also feeds the agreement rewrite (task 4.7, 4.8).

### KI-003: Twilio A2P not registered, SMS filtered (high)
SMS from +16692660586 never arrived on Sep 22.
Fix: finish A2P 10DLC registration (task 1.3).

### KI-004: Emily workflow still has 13 Notion nodes (medium)
Fix: replace with Twenty nodes, needs approval (task 3.2).

### KI-005: n8n webhooks have no auth (medium)
Fix: add a header-auth secret (task 3.6). Keep this repo private until then.

## Gotchas
- Never modify Nora (agent_4c34644a04c74e27253e80167b, n8n 2PFWFqBM0wabADk6).
- Never add, remove, rename or change parameters of a Retell agent tool without approval of that specific change.
- tools/retell.py dry-runs every write unless --apply is passed.
- The Retell MCP needs Deno and is often unavailable. Use tools/retell.py.

## Resolved
