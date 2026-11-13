# Alex lead to booking: n8n draft (P6-S8)

Built inactive, in the repo only. **Nothing here was imported into n8n, no credential was created, nothing was activated, and no provider was called.** The n8n connector was also unreachable when this was written, so the graph has not been opened in n8n. Treat the JSON as a draft to import and check, not a tested export.

## Files

- `alex-lead-to-booking.json`: one workflow, two entry points.
  - `POST /webhook/alex-book` (ElevenLabs server tool, mid-call): Header Auth on the webhook, then Cal.com slots, Cal.com booking, then the portal `POST /api/appointments/book` with `externalEventId = calcom:<uid>`, then the answer to the agent.
  - `POST /webhook/alex-call-ended` (ElevenLabs post-call): raw body, HMAC check (`verify-post-call-signature.js`, same scheme as the portal's own check), a 401 for a bad or missing signature, then `map-call-result.js` and the portal `POST /api/service/call-results`.
- `alex-error-alert.json`: Error Trigger, the existing safe formatter (`../m15-error-alert.js`), an email. Set as the booking workflow's error workflow.
- The portal still owns consent, quiet hours and DNC. This workflow never decides who may be contacted and never sends a text.

## Credentials to create (names only, values never in git). Each needs its own yes.

| Name in the JSON | Type | Holds |
|---|---|---|
| Alex tool secret (header) | Header Auth | the shared header ElevenLabs sends on the tool call |
| Cal.com API | Header Auth (`Authorization: Bearer ...`) | the Cal.com key |
| Portal service token (booking) | Bearer | token with scopes `appointments:write`, `calls:write` (the onboarding action `provisionClientAutomations` mints it, shown once) |
| Alert email (SMTP) | SMTP | sender account for the alert |

Environment on the n8n instance: `PORTAL_BASE_URL`, `CAL_EVENT_TYPE_ID`, `ELEVENLABS_POST_CALL_SECRET`, `NODE_FUNCTION_ALLOW_BUILTIN=crypto`.

## Placeholders to fill (need Abdullah's yes)

- `REPLACE_WITH_APPROVED_RECIPIENT` and `REPLACE_WITH_APPROVED_SENDER` in the alert workflow. Proposed recipient: the owner's work address. Not set.
- `REPLACE_WITH_ERROR_ALERT_WORKFLOW_ID`: the id n8n gives the alert workflow after import.

## Before activation (all need a yes)

1. Import both files inactive on the self-hosted n8n. Open them and fix any node-version differences.
2. Create the credentials above.
3. Test with pinned data and the portal in stub mode (`PROVIDER_MODE=stub`, `OUTBOUND_ENABLED=false`).
4. Confirm the booking length: Cal.com decides it from the event type, not from the portal.
5. Only then ask for activation. The one live test goes to Abdullah's own phone (P6-7), then outbound is switched off.
