# Retell Trade Receptionist (reference build)

Saved as inspiration/reference for Kynetic's Pillar 5 (AI Voice Receptionist) demo rebuild — not a spec to run as-is. Source: Inflate AI's trades-industry voice receptionist build (n8n + Retell + Twilio).

- `n8n-workflow.json` — the n8n workflow: webhooks for job creation, emergency logging, inquiry logging, job lookup, and post-call analysis, writing to Google Sheets and notifying via Twilio/Gmail.
- `retell-agent.json` — the Retell voice agent config: system prompt, example conversations, guardrails, and tool definitions (Cal.com booking, call transfer, and the n8n webhook tools above).

## Before reusing

- `retell-agent.json`'s `cal_api_key` fields are redacted (`REDACTED_SET_VIA_ENV_CAL_API_KEY`) — the original file had a live Cal.com key in plaintext. Supply your own key through Retell's dashboard or an env var, never commit one here.
- Credential IDs (Google Sheets, Twilio, Gmail) reference Inflate's own n8n instance and won't resolve in Kynetic's — reconnect credentials before importing.
- Webhook URLs point at `inflate.app.n8n.cloud` — replace with Kynetic's n8n instance URLs.
