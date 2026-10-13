# Retell Trade Receptionist (reference build)

Saved as inspiration/reference for Kynetic's Pillar 5 (AI Voice Receptionist) demo rebuild — not a spec to run as-is. Source: Inflate AI's trades-industry voice receptionist build (n8n + Retell + Twilio).

- `Retell Voice Agent - n8n.json` — original, unmodified n8n workflow export: webhooks for job creation, emergency logging, inquiry logging, job lookup, and post-call analysis, writing to Google Sheets and notifying via Twilio/Gmail.
- `Retell Voice Agent - retell.json` — original, unmodified Retell voice agent config: system prompt, example conversations, guardrails, and tool definitions (Cal.com booking, call transfer, and the n8n webhook tools above).

## Cal.com key

The export's Cal fields use the `${CAL_API_KEY}` placeholder. A `cal_live_` key from this line of work was committed in git history and rotated (KI-001). Do not treat anything in this folder as a live credential.

## Before reusing

- Credential IDs (Google Sheets, Twilio, Gmail) reference Inflate's own n8n instance and won't resolve in Kynetic's — reconnect credentials before importing.
- Webhook URLs point at `inflate.app.n8n.cloud` — replace with Kynetic's n8n instance URLs.
