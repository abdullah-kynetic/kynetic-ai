# Outbound speed to lead: v1 build plan (task 3.5)

> **HISTORICAL — legacy Retell build/approval record.** The sole active project checklist is [COMPLETION-PLAN.md](../../../docs/codex/COMPLETION-PLAN.md). The dated current-state and approval instructions below are preserved as history; they do not authorize provider calls, existing agent/workflow edits, protected resources or renewed activation. Current DEV callback work uses the designated DEV ElevenLabs resources, not this legacy plan.

Status: BUILT and running (updated Oct 17, 2026). This file began as the Oct 8 proposal and still carries that plan for reference; the sections marked APPROVAL were the approval gates for the original build and are historical. Only "Current state" is kept current. Live-system changes still need Abdullah's yes (KYNETIC_CONTEXT.md rules 1 and 2). Decisions behind this plan: D-010, D-011, D-012, D-013, D-014.

## Current state (Oct 17, 2026)
Read-only check of Retell, n8n and Twenty on Oct 17. The Oct 8 to Oct 12 text this replaces is in git history.
- **Retell agent: created.** Alex is `agent_71e3cfc8384aa38a910a506b53`, LLM `llm_5cbc32e5872bbd9afb452c692071`, voice `11labs-Cimo`, version 0, not published. Its post-call webhook is the n8n post-call path. Alex prompt v1.2.3 is on branch `claude/alex-demo-live-test` and is not merged or published. An outbound call was placed on Oct 15.
- **n8n: built and ACTIVE.** "Outbound Speed to Lead" (`m2YJwZ1l8DTzyEkw`) has 38 nodes (3 sticky notes and 2 disabled draft-SMS nodes included). The "Retell API (outbound)" credential is attached, and the agent ID and caller ID (+16692660586) are set in "Call Settings" and "Retry Call Settings". It had 561 executions on Oct 17, the latest 20 all successful on the 5-minute sweeper. **Go-live is not yet approved (KI-009); Abdullah to confirm.** The workflow's own description and sticky notes still say INACTIVE and "fill the placeholders"; that text is stale.
- **Paths as built:**
  1. Form, normalize, 24-hour duplicate check, light gate, create the Twenty lead, resolve the lead's time zone (ZIP, then area code), calling-hours gate **8:00 to 21:00 in the lead's local time**, Retell call, mark calling. Outside the window the lead is queued for the local morning.
  2. Retell post-call webhook (`call_analyzed` only): the call is fetched back from Retell, normalized, logged as a `SPEED_TO_LEAD` interaction, and the lead is updated. After a no-answer or voicemail on attempt 1 there is a 90 second fast retry (attempt 2).
  3. Sweeper every 5 minutes: leads with `NO_ANSWER`, `nextAttemptAt` due and fewer than 3 attempts, inside the lead's calling window. If the fast retry does not run, the sweeper retries attempt 2 at +10 minutes. A no-answer on attempt 2 schedules attempt 3 at +60 minutes.
- **Retry cadence and calling window: decided as built (D-020, Oct 17).** This replaces D-012 item 2 (5 minutes, 1 hour, next day, max 4 attempts) and the 9:00 to 20:00 Pacific window in the Flow section below.
- **Tested:** one end-to-end run on Oct 15 (one test lead, called 13.8 seconds after submit, booked, logged in Twenty). **Not yet tested:** the retry path (the only lead booked on the first call) and the duplicate-check filter (no duplicate submission was made).
- **Still open:** the post-call webhook has no header auth (KI-005, task 3.6); counsel sign-off (1.4); confirming +16692660586 is not Nora's live line is not recorded as done.
- Demo data: the demo carries the real business's details (D-016 amended); see demo-business/PROFILE.md.
- The voice provider bake-off (Retell vs Bland vs ElevenLabs) is separate and does not change this build. See KYNETIC_CONTEXT.md.

## Architecture (two n8n endpoints)
1. **Intake form** (n8n Form Trigger, public by design). Fields: full name, phone, [niche qualifier fields], consent checkbox with the D-011 wording.
2. **Post call webhook** (n8n Webhook, header auth per KI-005). Retell sends it every call event; the workflow filters on `event == call_analyzed`.
Booking uses Retell's native `check_availability_cal` and `book_appointment_cal` tools, which call Cal.com directly. No tools endpoint in v1.
A **retry sweeper** is a scheduled n8n trigger, not a webhook.

This is a new workflow and a new Retell agent. It shares no nodes or logic with Emily (D-010). Emily and Nora are untouched.

## Flow
Original plan. The retry cadence, attempt limit and calling window as built replace step E and the window below (D-020); see Current state.
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

## Retell agent (created; original plan below)
The agent exists (see Current state). `python tools/retell.py create-outbound` is a dry run unless `--apply` is passed. Do not run it with `--apply` against the live account without Abdullah's yes, because it creates a second agent and LLM rather than editing the existing one.

### Original proposal
- New agent and LLM named "Outbound Speed to Lead", created with `tools/retell.py` (dry run first, then `--apply` after approval).
- Prompt: `retell/builds/outbound-speed-to-lead/PROMPT.md`, per `retell/PROMPTING_STYLE.md`.
- Tools: native `check_availability_cal`, `book_appointment_cal` (event type for the demo niche, not Emily's 7025524 Water Damage Assessment) and `end_call`. Each add needs approval of that specific change. The Cal.com key must be entered by Abdullah or injected without being printed.
- Settings per PROMPT.md: gpt-4.1, 11labs-Cimo, voicemail hang up, post call analysis fields, webhook URL pointing at the post call endpoint.

## n8n (APPROVAL: create workflow; done)
- Create "Outbound Speed to Lead" as INACTIVE, validated with the n8n tools before it is ever activated.
- Needs a Retell Header Auth credential in n8n (see Prerequisites) and the existing "Twenty account" credential `41C04qbmnbi0GI2P`.
- No call is placed until Abdullah approves a test.

## Cal.com (done Oct 8)
Event type "Roof Inspection", ID 7404470, 30 minutes, location = attendee address, https://cal.com/abdullah-kyneticai/roof-inspection. Uses the account default schedule (America/Los_Angeles), which now matches the Bend, Oregon demo (D-016); confirm available hours. The new agent's Cal tools use event type 7404470 and timezone America/Los_Angeles. The Cal API key lives in the cloud environment variable CAL_API_KEY (verified working, not the old leaked key); it is never printed or committed.

## Prerequisites from Abdullah
As of Oct 17 all five are in place: the credential is attached, the caller ID is set, the Oct 15 test call went to Abdullah's own number, the event type is 7404470, and roofing is the demo niche. The only item not recorded as done is confirming the caller ID is not Nora's live line.
1. A Retell Header Auth credential in n8n (the Retell API key, entered by Abdullah).
2. The outbound caller ID number: a Retell or Twilio number that can place calls (+16692660586 has an A2P problem for SMS only; voice status to confirm).
3. A test phone number that belongs to Abdullah or Quentin. Test calls go only to numbers the tester owns, with consent.
4. A Cal.com event type for the demo niche, with the Cal.com key placed in the new agent's Cal tools.
5. The demo niche and company name for the first build (roofing is the first test niche).

## Order of work
Original order. Steps 1 to 5 are done (the test was Oct 15); step 6 is open.
1. Review `PROMPT.md` (no approval needed, repo only).
2. Approve the Twenty field list, then I add the fields.
3. Approve the new Retell agent, LLM and tools, then I create it (dry run first).
4. Approve the n8n workflow, then I create it inactive and validate.
5. Test with one call to a tester's own phone.
6. Compliance (3.6): opt out handling, webhook auth, consent wording review (4.8 attorney), then the launch gate.
