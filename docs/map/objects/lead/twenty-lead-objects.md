---
type: object
cluster: lead
universe: live
status: verified
entity: Twenty (external); fields as used in the workflow JSON
verified_on: 2026-10-22
verified_at: 5888b13 (source unchanged since 67763e6)
---

# Twenty lead objects

`endCustomer` is the lead; `customerInteraction` is each call; `client_accounts` ties them to the demo client (id literal in the workflow JSON). Twenty is canonical; this card lists only what the workflow reads and writes.

## Shape (from the workflow JSON)
- endCustomer writes: name, fullName, phones.primaryPhoneNumber, location (ZIP), leadSource, consentText, consentAt, formSubmittedAt, leadStatus (NEW, CALLING, NO_ANSWER, BOOKED, CALLBACK, NOT_INTERESTED, DISQUALIFIED, DNC), attemptCount, nextAttemptAt, firstRingAt, lastContact, lastOutcome, secondsToFirstRing, callOptOut, ownsProperty, issueType, timeline, clientAccountId.
- customerInteraction writes: name, interactionType SPEED_TO_LEAD, channel VOICE, outcome, `retellCallId` (also stores an 11Labs id in the bake-off variant), summary, callbackTime, bookedSlot, occurredAt, endCustomerId.

## If you change this
- **Hits:** every Twenty node in [[outbound-speed-to-lead-workflow]] (JSON bodies are strings, so a renamed field breaks silently), `KYNETIC_CONTEXT.md`, the portal results feed, the dashboard.
- Rules: API GET only unless approved, never REST DELETE, 100 requests per 60 s.
- Not verified here: the live schema (no Twenty call made for this card).
