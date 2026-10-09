# Context: Outbound Speed to Lead demo (Kynetic Roofing)

Build-specific rules and IDs. Global rules stay in `KYNETIC_CONTEXT.md`; Twenty wins if anything disagrees. No keys in this file, ever.

## What this build is
Plan 1 outbound speed-to-lead agent "Alex" for the demo client Kynetic Roofing (D-013, D-015, D-016). Retell is the main build (not yet created). A Vapi version of Alex is a side experiment for a side-by-side test (Oct 9, 2026). A platform change would be a new decision and is not made.

## Rules for this build
- Never dial the AM-1 office number. Any call to AM-1 needs the owner's OK. Test calls only to numbers the tester owns, with consent.
- Unverified items (Meta ads, free estimate, financing, Facebook page, exact rating, license status) are never stated as facts. "Inspection is free" is the demo offer, not an AM-1 claim.
- Tell Abdullah before any write to Vapi, Retell, n8n or Twenty and wait for a yes (one step at a time).
- Never print or commit API keys. Cal.com and Vapi keys are environment variables. Vapi tools hold the Cal.com key inside Vapi, so Vapi tool exports must be redacted before they go into git.

## Vapi IDs (not secrets)
- Assistant: `8e51e8d6-a34e-4443-ab1f-a004d72dd73d` "Outbound Speed to Lead - Kynetic Demo" (name limit is 40 characters)
- Tools: end_call `17baed78-841b-4003-9624-57cc443bc008`; voicemail hang-up `61bbb70b-6110-44d3-926e-4e2be6ea100b`; roofing_company_facts (KB query) `9f77aa02-d43f-452d-9ac5-0fce5414c9cf`; check_availability `2f9ca3ca-0ba1-40c4-8212-d10edcfbddf7`; book_appointment `83c896b2-4188-432d-a7f8-f369aefa4853`
- Structured output (after-call fields): `29a72eb1-f856-43df-b66e-0d25713417d0`
- KB file: `417035c4-7802-4b63-a859-791ddef5d76e` (`kynetic-roofing-kb.txt`; Vapi fails to process `.md`)
- Not ours, do not touch: "Dentist Receptionist (Knowlton)", "New Assistant", the Knowlton orthodontics KB file and its tools.

## Other IDs
- Cal.com event type 7404470 "Roof Inspection", 30 min, attendee address, America/Los_Angeles
- n8n workflow "Outbound Speed to Lead" `m2YJwZ1l8DTzyEkw` (inactive, never run); template `KYQIVtxwDcXVKmk3` untouched
- Twenty: client account Kynetic Roofing (Demo) `56b85831-d0fd-4f0a-a9b7-e96956278bb8`; profile note `2079cce2-1c48-44f1-b47e-934effff5034`; chat log note `d3baa138-53f9-4f30-a4a8-faff7f3a04e7`
- Retell agent for this build: not created yet (config in `retell/builds/outbound-speed-to-lead/agent.config.json`)

## Source of truth for the prompt
`retell/builds/outbound-speed-to-lead/PROMPT.md` (Retell) and `VAPI_BUILDER_PROMPT.md` (Vapi). The live Vapi prompt = PROMPT.md plus Vapi tool names, 6 example calls, no "Closed weekends", 7-day slot search, LA-time line, and one knowledge-base line.
