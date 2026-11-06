# Alex on ElevenLabs: go-live plan (2026-10-25)

> **HISTORICAL — planning snapshot, not current instructions.** The active completion checklist is [COMPLETION-PLAN.md](../codex/COMPLETION-PLAN.md). Requirements and unresolved decisions are carried forward there. Old live-agent IDs, prices, dates, workflow activation or deployment instructions do not grant permission; all current safety and action-specific approval gates remain.


Decision: D-025. Every live step needs Abdullah's exact yes. Mode now: **demos only on the free tier** until the first client signs.

## Current state
- Agent: ElevenLabs blitz account (`abdullahblitz24`), v1 strict `agent_8201m5afn2rbeb7v29xfkhh1pjef`. Free tier, no phone number imported, no post-call webhook (`post_call_webhook_id` null).
- Prompt: text promise removed on 2026-10-22. Before/after in `providers/elevenlabs/golive/`.
- Booking: Cal.com native tools on the test event 7520336 (phone required). Production event 7404470 is untouched.
- n8n (VPS): only the Retell workflow `tXJwNTkNgKGnp0Ab` (38 nodes, inactive). The ElevenLabs copy `xlmyRd5jBBBu8LX7` is not on the VPS. The VPS has no Twenty API, Gmail or ElevenLabs credential.
- Twilio +16692660586: the only number in the Twilio account, on a SIP trunk, not Nora's line. No A2P campaign, so no SMS.

## Demo now (free tier, no live system changes)
Run Alex from the ElevenLabs dashboard with test variables (first_name, company_name, owns_property, issue_type, timeline). Say a phone number when asked, since dashboard tests have no dialed number. Cancel test bookings afterwards in Cal.com.

## When the first client signs
1. Upgrade the ElevenLabs plan (free tier is 15 minutes and has no phone numbers).
2. Create the Twenty API, Gmail and ElevenLabs header credentials on the VPS n8n.
3. Import +16692660586 into ElevenLabs and bind it to the agent.
4. Build the n8n workflow inactive on the VPS from the Retell copy: place call via `POST /v1/convai/twilio/outbound-call`, parse `data_collection_results`, verify the post-call webhook signature on a new random path.
5. Set the post-call webhook in ElevenLabs. Point the Cal.com tools at the client's event (phone required, email optional, America/Los_Angeles).
6. Test to Abdullah's phone: booking, no-answer plus retry, duplicate. Check the Twenty rows. Then activate.

## Pending restore (pre-approved by Abdullah)
When the Twilio A2P campaign is approved: put the "text the confirmation" wording back in the v1 prompt (use `providers/elevenlabs/golive/v1-prompt-before-2026-10-22.txt`) and add the SMS tool from `providers/elevenlabs/SMS_TOOL.md`. The Twilio account check thread will message the go-live thread when the campaign is approved.

## Out of scope
SMS itself (n8n plus Twilio workflow, Twilio account check thread).
