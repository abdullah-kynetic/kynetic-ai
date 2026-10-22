---
type: object
cluster: plan2
universe: live
status: verified
entity: n8n/workflows/active/nora-restoration-ai-receptionist__2PFWFqBM0wabADk6.json
verified_on: 2026-10-22
verified_at: 5888b13 (source unchanged since 67763e6)
---

# Nora = the Kynetic Restoration (Demo) build (NO-TOUCH)

`retell/builds/kynetic-restoration/build-ids.md` lists the Restoration demo's Retell agent `agent_4c34644a04c74e27253e80167b` and n8n workflow `2PFWFqBM0wabADk6`: the same ids KYNETIC_CONTEXT gives for "Nora". They are one build under two names.

## Shape
- Backup JSON: active, 40 nodes (agent, Gemini chat model, Notion, Twilio, Gmail, webhook).
- Frozen by D-005; webhooks have no auth (KI-005, not to be modified).

## If you change this
Don't. **Hits:** the live inbound demo, Twilio, Notion. **Outside the tree:** Retell workspace `kyneticai`. Importing `n8n/workflows/active/` to a new n8n would duplicate it.
