# Retell Trade Receptionist (reference build)

Saved as inspiration/reference for Kynetic's Pillar 5 (AI Voice Receptionist) demo rebuild — not a spec to run as-is. Source: Inflate AI's trades-industry voice receptionist build (n8n + Retell + Twilio).

- `Retell Voice Agent - n8n.json` — original, unmodified n8n workflow export: webhooks for job creation, emergency logging, inquiry logging, job lookup, and post-call analysis, writing to Google Sheets and notifying via Twilio/Gmail.
- `Retell Voice Agent - retell.json` — original, unmodified Retell voice agent config: system prompt, example conversations, guardrails, and tool definitions (Cal.com booking, call transfer, and the n8n webhook tools above).

## ⚠️ Contains a live secret

`Retell Voice Agent - retell.json` includes a live Cal.com API key (`cal_live_...`) in plaintext, kept as-is at Abdullah's request to preserve the original file exactly. Treat this key as compromised for Kynetic's own use — do not use it against Kynetic's Cal.com account, and Inflate AI should be considered to have this key exposed in this repo's git history.

## Before reusing

- Credential IDs (Google Sheets, Twilio, Gmail) reference Inflate's own n8n instance and won't resolve in Kynetic's — reconnect credentials before importing.
- Webhook URLs point at `inflate.app.n8n.cloud` — replace with Kynetic's n8n instance URLs.
