---
type: process
status: verified
consumes: [twenty-lead-objects, alex-agent]
produces: [twenty-lead-objects]
verified_on: 2026-10-22
verified_at: 5888b13
---

# lead-to-call

A form submission becomes a Twenty lead and, inside the lead's calling window, an Alex call whose outcome is written back.

## Input -> Movement -> Output
Input: form fields. Movement: normalize, 24 h duplicate check, light gate (valid phone, consent, not duplicate), create lead, resolve time zone (ZIP, then area code, then Pacific), 8:00-21:00 local window, place Retell call, then a post-call webhook fetches the call back from Retell and logs it. Output: `endCustomer` + `customerInteraction` records and, on no-answer, a retry.

## Why this shape
The webhook body is not trusted: the call is re-fetched from Retell and only Alex's agent id is processed, so a forged post cannot create a real call result (sticky note in the workflow). The path itself is still the only auth (AUDIT.md #2).

## Steps (cloud copy JSON, node names)
1. Roof Inspection Request Form -> Normalize Lead -> Check Recent Duplicate -> Light Gate Passes?
2. Create Lead in Twenty -> Resolve Lead Timezone -> Inside Calling Hours (First Call)? -> Call Settings -> Place Retell Call -> Mark Lead Calling (else Queue Lead for Morning Call).
3. Retell Post Call Webhook -> Is Analyzed Event? -> Fetch Call From Retell -> Normalize Call Result -> Final Analyzed Event? -> Log Call Interaction -> Update Lead After Call.
4. No answer or voicemail on attempt 1: Wait 90 Seconds -> recheck lead -> retry. Otherwise a sweeper every 5 minutes retries leads due (max 3 attempts; +10 min then +60 min).

## If you change this
- **Hits:** [[outbound-speed-to-lead-workflow]], [[twenty-lead-objects]], [[alex-form-spec]], the Retell agent's webhook URL.
- **Does not hit:** the portal (nothing posts results to it).
