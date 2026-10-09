# Progress: Outbound Speed to Lead demo

Build log for this project only. Global status stays in `docs/progress.md`; Twenty wins.

## Status (2026-10-09)
Vapi side experiment in progress, one approved step at a time. Retell remains the main build. Nothing has been dialed.

## Done on the Vapi assistant (all verified by re-reading it afterward)
1. Read-only review: matched spec on first message, system prompt, gpt-4.1, silence 60s, max 10 min, denoising, recording, voicemail hang-up, 4 after-call fields.
2. Removed the failed research-report file from Vapi Files (and detached it from Alex first). Knowlton KB was never attached to Alex.
3. Uploaded the roofing KB as `.txt` (the `.md` upload failed in Vapi); created query tool `roofing_company_facts`; attached it to Alex with one prompt line.
4. Created `check_availability` and `book_appointment` (Cal.com event 7404470, America/Los_Angeles) and attached both. Cal.com key and event checked first (HTTP 200, slots returned).
5. Prompt edit: added the 6 example calls, cut "Closed weekends", 7-day slot search, LA-time line, voicemail tool line.
6. Voice speed 1.1, backchannel on. Voice kept as ElevenLabs "sarah" (Cimo is Retell-hosted and has no known ElevenLabs ID).
7. Renamed to "Outbound Speed to Lead - Kynetic Demo".

## Next
- Step 6: find where Vapi takes test values for first_name, company_name, agent_name, service_type, lead_source, owns_property, issue_type, timeline.
- Phase B: Abdullah runs 8 web-call scenarios (books, not interested, callback, robot, renter, wrong number, silence, company question). Then cancel the test booking (needs a yes).
- Phase C: grade transcripts, tool calls and after-call fields; side-by-side with a Retell web test once that agent exists (needs approval).
- Phase D only if Vapi wins: n8n call body and webhook, Vapi server URL, phone number, compliance.

## Waiting on Abdullah
Retell KYC check, `create-outbound --apply`, n8n credential "Retell API (outbound)", the web-call tests, and any platform decision.
