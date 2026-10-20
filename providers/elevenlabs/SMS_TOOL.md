# Text-confirmation tool: draft (2026-10-20, not applied)

Closes KI-006: both bake-off agents say "You'll get a text with the details" and nothing is sent. Nothing here is live. Every step that touches ElevenLabs or n8n needs Abdullah's yes on that exact change.

## Recommended path: ElevenLabs webhook tool -> n8n webhook -> (stub now, Twilio later)
Why through n8n and not straight to Twilio: Twilio's Messages API takes form-encoded bodies with Basic auth, and it is unverified whether an ElevenLabs webhook tool can send form encoding. n8n also keeps one texting path for every provider (Retell can call the same webhook), and the stub-to-Twilio swap is one node with no agent change.

### 1. n8n workflow (new, built inactive): `11Labs | Send Confirmation Text (stub)`
- Webhook trigger, POST, header-auth credential (shared secret) so only the agent can call it.
- Validate: `to` is E.164 (+1 and 10 digits), `name`, `day_time`, `address` present.
- Stub phase: a Set node returns `{"status": "sent", "stub": true}` and the payload is kept in the execution log. No message goes out.
- Twilio phase (after KI-003 / task 1.3, or trial Twilio to Abdullah's and Quentin's verified numbers only): replace the Set node with the Twilio node (Send SMS) and return `{"status": "sent", "sid": ...}`; on error return `{"status": "failed"}`.
- Open question before building: which n8n instance. The audit (2026-10-20) found the VPS copy `tXJwNTkNgKGnp0Ab` inactive and the cloud copy `m2YJwZ1l8DTzyEkw` active on Oct 19. Abdullah to say which instance is canonical.

### 2. ElevenLabs tool (new, attached to both blitz agents): `send_confirmation_text`
Webhook tool, POST to the n8n webhook URL, auth header from a workspace secret (never in the repo).

| Field | Type | Description given to the model |
|---|---|---|
| to | string | The confirmed text number in E.164 (+15415550123). Use the number the lead confirmed; never a placeholder like {{lead_phone}}. |
| name | string | Lead's first name. |
| day_time | string | Booked day and time in Pacific, as said to the lead (for example "Tuesday, October 21 at 9:30 AM PT"). |
| address | string | Property address exactly as confirmed. |
| company_name | constant | `{{company_name}}` |

Tool description: "Sends the booking confirmation by text. Call once, only after calcom_create_booking returned success. If it fails, say the team will text or call to confirm; do not retry more than once."

### 3. Prompt change (both PROMPT.md and PROMPT_V2.md)
After a successful booking: call `send_confirmation_text`, then "You're all set. You'll get a text with the details." If the text tool fails: "You're all set. If the text doesn't come through, our team will reach out to confirm." Never say a text is coming when the tool was not called.

### 4. Text content (draft, needs Abdullah's approval as prospect-facing text)
"Hi {name}, this is {company_name}. Your free roof inspection is booked for {day_time} at {address}. Reply STOP to opt out."
Needs a reschedule/cancel link (Cal.com booking link) and the form's consent line must cover texts (D-007).

## Note on PATCHing the agents
Per HANDOFF.md, a PATCH of an agent prompt replaces built_in_tools, so re-send `end_call` and `voicemail_detection` in the same PATCH, then read back and diff against `snapshots/2026-10-19-blitz` before and after.
