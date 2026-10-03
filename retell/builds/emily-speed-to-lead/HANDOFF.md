# Emily Restoration Speed to Lead — build handoff

_Last updated 2026-09-29. Resume here: "continue the Emily build"._

Emily is the build copy of the frozen Nora receptionist for Kynetic Restoration.
One agent handles both inbound (receptionist) and, later, outbound Speed to Lead calls.
Outbound was deliberately left out of the name. See `KYNETIC_CONTEXT.md` for rules.

## Picking this up (any agent)

Access needed:
- **GitHub**: this repo. The work lives on PR #2 until it's merged.
- **Retell API key**, as `RETELL_API_KEY` in the environment or in `.env`.
- **n8n**: `https://abdullah-kyneticai.app.n8n.cloud` (API or MCP).
- **Twenty CRM**: holds the handoff notes, and it's the CRM Emily's workflow is moving to.

Not needed for the next steps: the Cal.com key (it lives inside Emily's Retell tools), Notion, Tavily, Firecrawl, Apify.

Read `KYNETIC_CONTEXT.md` first. Rules: ask Abdullah before any change to n8n, Retell, Twenty or Notion; never change agent tools beyond what's approved; never touch Nora.

## Live state (verified 2026-09-29)

- Emily's name is correct.
- Her greeting still says "Nora".
- Her 4 tools and post-call webhook still point at **Nora's** workflow.
- Steps 1 and 2 below have NOT been applied yet.

## IDs

- Retell agent `agent_affef8dcb6880fd592cbe9432f`, LLM `llm_b520d8a6b9bf754f19285a8a6185` (v0, unpublished)
- n8n workflow `0PwP1tUf4478lNbf` "Emily Restoration Speed to Lead" (inactive, 40 nodes)
- Snapshot of agent + LLM before changes: `snapshot-2026-09-28/` (Cal key redacted)

### Emily's n8n webhooks (production)
Base: `https://abdullah-kyneticai.app.n8n.cloud/webhook/`

| Node | Path | Replaces Nora path |
|---|---|---|
| Log Emergency | `6941f9bb-2cd9-49f2-8997-b511c6c59e44` | `e5563a13-1323-4109-ae88-5e87b8d48d3c` |
| Log Inquiry | `32350ca2-fced-4c8f-b349-b19dba526986` | `56d89e8d-66c3-42bb-ae33-2c78e5d10caa` |
| Job Creation | `4094eacb-9182-45b1-9850-319903b20ac8` | `9dfc3c1d-9d99-4041-9cae-3a60cc86652d` |
| Job Query by Phone | `54634466-ae80-4a2d-b6e9-5026d4c52bdc` | `881e3b34-7867-473a-a819-bc56c662a3af` |
| Post-call Analysis | `ccde3752-2c71-487d-9dcb-ae4d71bf6193` | `596d4180-8295-497c-84f9-4481ed0ab8d3` |

## Done

1. Renamed copies to "Emily Restoration Speed to Lead" (Retell + n8n); original renamed
   "Nora Restoration AI Receptionist" (name only).
2. Added 9 Twenty fields — Client Job: Service Type, Location, Location Type, Preferred Time,
   Booking URL; Customer Interaction: Type (Job Booking / Inquiry / Emergency / Speed to Lead /
   Post-Call Fix), Retell Call ID; End Customer: Location, Last Contact.
3. Confirmed the Twenty n8n node supports create/find/update on custom objects.

## Next (in order)

1. **Repoint Emily's 4 tool URLs + post-call webhook** to her own workflow. APPROVED by
   Abdullah 2026-09-28 (URL only; names, params, Cal tools untouched). Blocked locally by the
   Claude Code permission checker, not by Retell. Run:
   ```bash
   python tools/retell.py repoint-tools llm_b520d8a6b9bf754f19285a8a6185 \
     e5563a13-1323-4109-ae88-5e87b8d48d3c=6941f9bb-2cd9-49f2-8997-b511c6c59e44 \
     56d89e8d-66c3-42bb-ae33-2c78e5d10caa=32350ca2-fced-4c8f-b349-b19dba526986 \
     9dfc3c1d-9d99-4041-9cae-3a60cc86652d=4094eacb-9182-45b1-9850-319903b20ac8 \
     881e3b34-7867-473a-a819-bc56c662a3af=54634466-ae80-4a2d-b6e9-5026d4c52bdc --apply
   python tools/retell.py set-agent-webhook agent_affef8dcb6880fd592cbe9432f \
     https://abdullah-kyneticai.app.n8n.cloud/webhook/ccde3752-2c71-487d-9dcb-ae4d71bf6193 --apply
   ```
2. **Greeting Nora → Emily.** APPROVED 2026-09-28. The prompt body has no name; only the begin message:
   ```bash
   python tools/retell.py set-begin-message llm_b520d8a6b9bf754f19285a8a6185 \
     "Hi, this is Emily from Kynetic Restoration, how can we help you today?" --apply
   ```
3. **Replace the 13 Notion nodes in `0PwP1tUf4478lNbf` with Twenty nodes** (needs approval of
   the node-by-node plan). Test with texts/emails paused before activating.
4. Speed to Lead branch: form → consent check → log lead in Twenty (timestamp) → start Retell
   outbound call → log call. Log form-submit → ring time per lead (the "<30s" case-study metric).
   Needs: Retell Header Auth credential in n8n; Twilio verification status + test phone number.
5. Later: archive the unused "Speed to Lead Outbound Demo" leftovers, with approval.

## Claude Code cloud environment (in progress, 2026-09-29)

- Environment "github" on claude.ai/code. Allowed domains include `api.retellai.com`; still to add: `abdullah-kyneticai.app.n8n.cloud`, `api.cal.com`.
- **Keys go in "API credentials", not "Environment variables".** The environment variables box is visible to anyone using the environment; API credentials let sessions call an API without seeing the key.
- **Open issue:** `tools/retell.py` exits if `RETELL_API_KEY` isn't set. Under API credentials the session never sees the key, so the script must send requests without its own auth header. Update it once the "Add credential" form shows how the key is injected.
- The Retell MCP needs Deno, which isn't installed on Abdullah's Mac; that's why `tools/retell.py` exists.

## Abdullah's to-dos

- Merge PR #2.
- Revoke the old Cal.com key starting `cal_live_f64` (in this repo's git history since Aug 23; the current key is a different one).
- Finish the cloud environment: add the Retell credential and the two domains.
- For Speed to Lead: a Retell Header Auth credential in n8n; Twilio verification status and a test phone number.
- Recommended, needs approval: a header-auth secret on the n8n webhooks. They have no auth today, so keep this repo private.

## Twenty handoff note

The Twenty note "READ FIRST — Session Handoff (Sep 28, 2026)" (`1ac34eca-ae05-4f47-ab6d-4e78d0799000`) is behind this file. The Sep 29 update couldn't be written because the Twenty connector failed that session (reads and writes both errored). Next session with a working Twenty connection: copy this file's status into that note.

## Claude Code permission checker

Claude Code's auto-mode permission checker blocked the Retell writes and the PR merge on Sep 28 and 29. Hand Abdullah the exact command instead of retrying.
