# Alex on ElevenLabs: n8n workflow build spec

> **Historical build spec (classified 2026-11-08 PST).** Not a status source and not the next execution checklist. Current direction: `docs/STATUS.md`. Do not activate or publish the workflow this spec describes. Do not change or invoke live Alex `agent_8201m5afn2rbeb7v29xfkhh1pjef`. Do not create Google Drive, Docs, or Sheets files. Gmail alert steps below are part of the old spec, not a new authorization. `ALEX-ELEVENLABS-GOLIVE.md` already has a superseded-as-status banner. `docs/codex/COMPLETION-PLAN.md` is historical evidence, not authority. Do not continue `dev/codex-setup`.

Status: spec only (2026-10-28). Nothing here is built or changed live. Every step that touches n8n, ElevenLabs, Twilio or Twenty needs Abdullah's yes on that exact change (KYNETIC_CONTEXT rules 1 and 2). Decisions: D-014, D-020, D-025. Go-live plan: `ALEX-ELEVENLABS-GOLIVE.md`.

## Goal
Port the 38-node Retell workflow "Outbound Speed to Lead" (repo copy `n8n/workflows/active/outbound-speed-to-lead__m2YJwZ1l8DTzyEkw.json`, VPS copy `tXJwNTkNgKGnp0Ab`) to ElevenLabs, keeping its behavior, and close the gaps found in the Oct 28 audit: an unauthenticated webhook, a raw-payload fallback, no guard against a redelivered webhook, and no handling of calls that never connect.

## Starting point (read-only check, 2026-10-28)
- VPS n8n (`https://n8n.kyneticai.com`, behind Caddy, `/healthz` ok) already holds a draft: **`11Labs | Outbound Speed to Lead` (`xlmyRd5jBBBu8LX7`)**, 35 nodes, inactive, never executed, last edited 2026-10-19. Build from this draft; do not start over.
- The draft already: places calls with `POST https://api.elevenlabs.io/v1/convai/twilio/outbound-call`, filters `post_call_transcription`, fetches the conversation back with `GET /v1/convai/conversations/{id}`, reads `analysis.data_collection_results`, and keeps the duplicate check, the calling window, the 90-second fast retry and the 5-minute sweeper.
- What the draft is missing:
  1. Agent ID and phone number ID are placeholders in `Call Settings`, `Retry Call Settings` and `Finished Call For Our Agent?`.
  2. No credentials are attached. The nodes name `Twenty account` and `Abdullah Kynetic account` (Gmail), which do not exist on the VPS. There is no ElevenLabs credential.
  3. The webhook has `authentication: none` and no signature check.
  4. `call_initiation_failure` (busy, no answer, failed) is not handled, so a lead whose phone never connects stays `CALLING` and is never retried.
  5. No call-ID dedupe before `Log Call Interaction`.
  6. Client values (`Kynetic Roofing`, `roof inspection`, client account `56b85831-d0fd-4f0a-a9b7-e96956278bb8`) are literals.
- VPS credentials today (names only): `Kynetic AI` (twilioApi), `Twenty Webhook account` (twentyWebhookApi), `Blitz` (openRouterApi), `Retell API (outbound) - abdullahblitz` (httpBearerAuth).
- Agent: `agent_8201m5afn2rbeb7v29xfkhh1pjef` (snapshot in `providers/elevenlabs/snapshots/2026-10-19-blitz/`). Data collection fields `outcome`, `callback_time`, `booked_slot`, `notes`. Declared dynamic variables: `first_name`, `company_name`, `agent_name`, `service_type`, `owns_property`, `issue_type`, `timeline`, `lead_phone`. Post-call webhook not set.

## Prerequisites (each needs Abdullah's yes)
1. ElevenLabs paid plan (free tier has 15 minutes and no phone numbers).
2. Import +16692660586 into ElevenLabs (Twilio import) and note its `phnum_...` ID. Importing repoints the number's voice handling to ElevenLabs; today it sits on a SIP trunk. It is not Nora's line (checked 2026-10-25).
3. VPS n8n credentials: Twenty API (self-hosted `crm.kyneticai.com`), Gmail OAuth for alerts (redirect `https://n8n.kyneticai.com/rest/oauth2-credential/callback`), ElevenLabs API (header `xi-api-key`).
4. Webhook HMAC secret available to a Code node without appearing in the workflow JSON: put it in the n8n container environment (for example `ELEVENLABS_WEBHOOK_SECRET`) and allow `crypto` in Code nodes (`NODE_FUNCTION_ALLOW_BUILTIN=crypto`). This is a compose change on the VPS. Never paste the secret into a node parameter: the backup tool commits workflow JSON to git.
5. ElevenLabs workspace webhook (auth type HMAC) pointing at the new webhook URL, bound to Alex only through the agent's webhook override, with events `transcript` and `call_initiation_failure`. Audio off.
6. Twenty: one new endCustomer field `lastCallId` (text). It is needed to match `call_initiation_failure` events, which carry no dynamic variables. Additive only.

## Configuration (one place)
A single Set node `Alex Config` at the top of each path. The other nodes read from it; no literal repeats anywhere else.
| Key | Value now | Later (per-client template, 3.7) |
|---|---|---|
| agentId | `agent_8201m5afn2rbeb7v29xfkhh1pjef` | client config record in Twenty |
| agentPhoneNumberId | `phnum_...` from step 2 | same |
| clientAccountId | `56b85831-d0fd-4f0a-a9b7-e96956278bb8` (Kynetic Roofing demo) | same |
| companyName, agentName, serviceType | Kynetic Roofing, Alex, roof inspection | same |
| windowStart, windowEnd | 08:00, 21:00 lead-local | client may narrow, never widen |
| maxAttempts | 3 | fixed by D-020 |

## Path 1: lead intake and first call
1. **Form trigger** (public by design, D-014). Same fields and consent text as today.
2. **Normalize Lead** (unchanged): 10-digit US number, `+1` E.164, consent flag, form answers mapped to enums and spoken text.
3. **Check Recent Duplicate**: endCustomer where `phones.primaryPhoneNumber` equals the 10 digits and `formSubmittedAt` is within 24 hours. Must be tested (the filter syntax has never run against a duplicate). Scheduled retries are not blocked by this check.
4. **Light Gate**: phone valid, consent given, no duplicate. A failure goes to `Log Submission Not Dialed`.
5. **Create Lead in Twenty**: as today (`leadStatus NEW`, `attemptCount 0`, `callOptOut false`, consent text and time, `clientAccountId` from config).
6. **Resolve Lead Timezone**: ZIP, then area code (unchanged).
7. **Inside Calling Hours?**: 08:00 to 21:00 lead-local. Outside the window: `Queue Lead for Morning Call` sets `leadStatus NO_ANSWER`, `attemptCount 0` and `nextAttemptAt` to the next local 08:00, so the sweeper places attempt 1.
8. **Place Call**: `POST /v1/convai/twilio/outbound-call` with `agent_id`, `agent_phone_number_id`, `to_number`, and `conversation_initiation_client_data.dynamic_variables`: the 8 declared variables plus `twenty_id`, `attempt` (1) and `form_submitted_at`. Verify in the first test that ElevenLabs accepts the 3 undeclared variables and returns them in the conversation. If it does not, declare them on the agent (agent change, needs a yes).
9. **Mark Lead Calling**: `leadStatus CALLING`, `attemptCount 1`, `lastCallId` = `conversation_id` from the response, `firstRingAt` now. If the response has `success: false` or no `conversation_id`: `Alert Call Failed`, then set `NO_ANSWER` with `nextAttemptAt` +10 minutes so the sweeper tries again.

## Path 2: post-call webhook
1. **Webhook node**: POST, new random path (not the Retell path), `Raw Body` on, response mode "Using Respond to Webhook node".
2. **Verify Signature** (Code node, first after the trigger). Header `ElevenLabs-Signature: t=<unix>,v0=<hex>`. Compute HMAC-SHA256 of `<t>.<raw body>` with the secret from the environment and compare in constant time. Reject if the header is missing or malformed, the timestamp is more than 300 seconds old (matches `crm/src/server/adapters/voice/elevenlabs.ts` and SECURITY 3.6), or the digest differs.
   - Fail: respond 401, stop, and count the failure (alert when there are more than 5 in an hour).
   - Pass: respond 200 at once, then continue. ElevenLabs retries failed deliveries and disables a webhook after 10 consecutive failures.
3. **Route by `type`**: `post_call_transcription` goes to step 4; `call_initiation_failure` goes to step 8; anything else is dropped.
4. **Agent check**: `data.agent_id` equals `agentId` from config, else stop.
5. **Fetch Conversation**: `GET /v1/convai/conversations/{conversation_id}`. **No raw-payload fallback**: if the fetch fails, retry twice with backoff, then `Alert` and stop. The webhook body is never written to Twenty.
6. **Normalize Call Result** (draft code, kept): `outcome`, `callback_time`, `booked_slot` and `notes` from `analysis.data_collection_results`; `twenty_id`, `attempt` and `form_submitted_at` from the conversation's dynamic variables; `secondsToFirstRing` on attempt 1 only. Empty outcome: voicemail if `metadata.termination_reason` mentions voicemail or machine, else no_answer. Require `status == done` and a non-empty lead ID.
7. Continue at **Dedupe guard** below.
8. **Call initiation failure**: agent check as step 4. Find the lead by `lastCallId == data.conversation_id` (fallback: fetch the conversation and read `twenty_id`; use it only if the fetch succeeds). Outcome = `no_answer` for `no-answer` and `busy`; for `unknown`, also send an alert. The attempt number comes from the lead's `attemptCount`. Continue at the dedupe guard.

### Dedupe guard (both events)
- Look up customerInteraction where `retellCallId == conversation_id`. The existing field is reused as the provider call ID to avoid a schema change; rename it later if wanted. If a row exists, stop: it is a redelivery.
- Stale event guard: if the event's attempt is lower than the lead's `attemptCount`, log the interaction but do not change `leadStatus` or schedule anything.

### Write results
- **Log Call Interaction**: `SPEED_TO_LEAD`, channel `VOICE`, outcome, call ID, summary plus notes, callback time, booked slot, client account from config.
- **Update Lead After Call**: outcome to `leadStatus` (booked, callback, not_interested, disqualified, no_answer, voicemail stored as NO_ANSWER for retry purposes, dnc). On `dnc`: `callOptOut true`, `callOptOutDate` now, no further attempts.

## Path 3: retries (D-020)
- After a no_answer or voicemail on **attempt 1**: set `nextAttemptAt` +10 minutes (the safety net), then `Wait 90 Seconds`, re-read the lead, and call attempt 2 only if it is still `NO_ANSWER`, `attemptCount < 3`, not opted out and inside the window. Mark `attemptCount 2`, `lastCallId`.
- After a no_answer or voicemail on **attempt 2**: `nextAttemptAt` +60 minutes.
- After **attempt 3**: no further attempts; `leadStatus` stays `NO_ANSWER` with no `nextAttemptAt`.
- **Sweeper every 5 minutes**: endCustomer where `leadStatus NO_ANSWER`, `nextAttemptAt <= now`, `callOptOut false`, `attemptCount < 3`, limit 20. Per lead: timezone, window check (defer to the local morning if outside), place the call with `attempt = attemptCount + 1`, mark retrying with the new `lastCallId`. Confirm that `callOptOut[eq]:false` matches leads where the field is null; if not, write `false` at creation (already done) and backfill.
- Busy counts as no_answer.

## Alerts
Gmail to abdullah@kyneticai.com on: call placement failed, retry placement failed, conversation fetch failed, an `unknown` initiation failure, a signature-failure burst. Add a shared error workflow and a sweeper heartbeat (alert if the sweeper has not run in 15 minutes).

## Test plan (to Abdullah's own phone only, with consent; never the AM-1 office number)
1. Signature: unsigned, wrong secret, and stale timestamp all get 401 with no Twenty write; a correct signature gets 200.
2. Happy path: submit the form, ring in under 60 seconds, book on the client Cal.com event, check the Twenty lead and interaction, cancel the test booking afterwards.
3. Redelivery: replay the same signed body inside 300 seconds; exactly one interaction exists.
4. No answer: let attempt 1 ring out. A `call_initiation_failure` event arrives, attempt 2 follows about 90 seconds later, attempt 3 about 60 minutes after that, then it stops.
5. Voicemail: send to voicemail; logged as voicemail and retried.
6. Busy: decline the call; treated as no_answer.
7. Duplicate: submit twice within 24 hours; the second is not dialed and is logged as not dialed.
8. Window: a lead with a ZIP where it is after 21:00 local is queued for 08:00 local and dialed by the sweeper.
9. Opt-out: say "stop calling"; `callOptOut` is set and no retry happens.
10. Fetch failure: point the conversation fetch at a bad ID in a test copy; an alert fires and nothing is written.

## Out of scope here
The SMS confirmation tool (`providers/elevenlabs/SMS_TOOL.md`, waits on a client-scoped A2P campaign), the per-client template (3.7, but the config node above is its seam), the Meta lead-form intake, and the CRM app's own call path (M4).

## Activation order (each a separate yes)
Prerequisites 1 to 6, then build the workflow inactive and run tests 1 to 10. Then activate, and set the agent webhook override last so no events arrive before the workflow is ready.
