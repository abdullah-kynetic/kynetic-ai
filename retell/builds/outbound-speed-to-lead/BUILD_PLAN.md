# Outbound speed to lead: v1 build plan (task 3.5)

Status: PROPOSAL. Nothing below has been applied. Every item marked APPROVAL needs a yes from Abdullah before it is done (KYNETIC_CONTEXT.md rules 1 and 2). Decisions behind this plan: D-010, D-011, D-012, D-013, D-014.

## Architecture (two n8n endpoints)
1. **Intake form** (n8n Form Trigger, public by design). Fields: full name, phone, [niche qualifier fields], consent checkbox with the D-011 wording.
2. **Post call webhook** (n8n Webhook, header auth per KI-005). Retell sends it every call event; the workflow filters on `event == call_analyzed`.
Booking uses Retell's native `check_availability_cal` and `book_appointment_cal` tools, which call Cal.com directly. No tools endpoint in v1.
A **retry sweeper** is a scheduled n8n trigger, not a webhook.

This is a new workflow and a new Retell agent. It shares no nodes or logic with Emily (D-010). Emily and Nora are untouched.

## Flow
A. Form submit: normalize the phone to E.164 (Code node, pattern from Source Template 05), check consent, run the light gate (24 hour duplicate window, new submissions only).
B. Create or find the lead in Twenty, store consent text, timestamp, source, and `formSubmittedAt`.
C. If the gate passes: Retell create-phone-call (HTTP), with `retell_llm_dynamic_variables` (first_name, company_name, agent_name, service_type, lead_source) and metadata `{twenty_id}`. Store `firstRingAt` to track submit to ring time.
D. Post call webhook: filter `call_analyzed`, read the Retell post call analysis `outcome`, write a customer interaction and update the lead (status, attempts, last outcome, next attempt).
E. Sweeper (every few minutes): find leads with outcome in (no_answer, voicemail) and `nextAttemptAt <= now` and attempts < 4; call again at 5 minutes, 1 hour, next day (D-012). Respect allowed calling hours.
F. Failures (call create error, Twenty write error) send an alert email.

## Twenty data (DONE Oct 8, 2026)
The fields below were created in Twenty on Oct 8 (additive only). endCustomer: leadSource, consentText, consentAt, formSubmittedAt, firstRingAt, leadStatus, attemptCount, nextAttemptAt, lastOutcome, ownsProperty, issueType, timeline, callOptOut, callOptOutDate. customerInteraction: outcome, callbackTime (text), bookedSlot (text). Demo client account "Kynetic Roofing (Demo)" created (id 56b85831-d0fd-4f0a-a9b7-e96956278bb8). Original proposal text kept below for reference.

### Original proposal
Existing and reusable:
- `endCustomer` (phones, emails, smsOptOut, smsOptOutDate, lastContact, clientAccount relation) is the lead record.
- `customerInteraction` (interactionType includes Speed to Lead, retellCallId, summary, occurredAt, channel, endCustomer and clientAccount relations) logs each call.
- Do NOT use `callLog`. That object is for Kynetic's own sales dials.

Gaps to add (proposed fields):
- On endCustomer: `leadSource` (select), `consentText` (text), `consentAt` (date time), `formSubmittedAt` (date time), `firstRingAt` (date time), `leadStatus` (select: new, calling, booked, callback, not_interested, disqualified, no_answer, dnc), `attemptCount` (number), `nextAttemptAt` (date time), `lastOutcome` (select).
- On customerInteraction: `outcome` (select, same values), `callbackTime` (date time), `bookedSlot` (date time).
Also add the Retell select values the workflow writes (for example Interaction Type already has Speed to Lead).

## Retell agent (dry run ready; apply was blocked by the permission checker)
Run `python tools/retell.py create-outbound` to see the dry run (reads `agent.config.json` and `PROMPT.md`). To create it, Abdullah runs `python tools/retell.py create-outbound --apply` himself or adds a permission rule for it. It makes a NEW unpublished agent and LLM and attaches no phone number.

### Original proposal
- New agent and LLM named "Outbound Speed to Lead", created with `tools/retell.py` (dry run first, then `--apply` after approval).
- Prompt: `retell/builds/outbound-speed-to-lead/PROMPT.md`, per `retell/PROMPTING_STYLE.md`.
- Tools: native `check_availability_cal`, `book_appointment_cal` (event type for the demo niche, not Emily's 7025524 Water Damage Assessment) and `end_call`. Each add needs approval of that specific change. The Cal.com key must be entered by Abdullah or injected without being printed.
- Settings per PROMPT.md: gpt-4.1, 11labs-Cimo, voicemail hang up, post call analysis fields, webhook URL pointing at the post call endpoint.

## n8n (APPROVAL: create workflow)
- Create "Outbound Speed to Lead" as INACTIVE, validated with the n8n tools before it is ever activated.
- Needs a Retell Header Auth credential in n8n (see Prerequisites) and the existing "Twenty account" credential `41C04qbmnbi0GI2P`.
- No call is placed until Abdullah approves a test.

## Cal.com (done Oct 8)
Event type "Roof Inspection", ID 7404470, 30 minutes, location = attendee address, https://cal.com/abdullah-kyneticai/roof-inspection. Uses the account default schedule (America/Los_Angeles); confirm available hours. The new agent's Cal tools use event type 7404470 and timezone America/Chicago. The Cal API key lives in the cloud environment variable CAL_API_KEY (verified working, not the old leaked key); it is never printed or committed.

## Prerequisites from Abdullah
1. A Retell Header Auth credential in n8n (the Retell API key, entered by Abdullah).
2. The outbound caller ID number: a Retell or Twilio number that can place calls (+16692660586 has an A2P problem for SMS only; voice status to confirm).
3. A test phone number that belongs to Abdullah or Quentin. Test calls go only to numbers the tester owns, with consent.
4. A Cal.com event type for the demo niche, with the Cal.com key placed in the new agent's Cal tools.
5. The demo niche and company name for the first build (roofing is the first test niche).

## Order of work
1. Review `PROMPT.md` (no approval needed, repo only).
2. Approve the Twenty field list, then I add the fields.
3. Approve the new Retell agent, LLM and tools, then I create it (dry run first).
4. Approve the n8n workflow, then I create it inactive and validate.
5. Test with one call to a tester's own phone.
6. Compliance (3.6): opt out handling, webhook auth, consent wording review (4.8 attorney), then the launch gate.
