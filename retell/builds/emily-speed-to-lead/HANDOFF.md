# Emily Restoration Speed to Lead — build handoff

_Last updated 2026-09-28. Resume here: "continue the Emily build"._

Emily is the build copy of the frozen Nora receptionist for Kynetic Restoration.
One agent handles both inbound (receptionist) and, later, outbound Speed to Lead calls.
Outbound was deliberately left out of the name. See `KYNETIC_CONTEXT.md` for rules.

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
