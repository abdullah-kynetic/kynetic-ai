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

## Step 6 result (variables)
Vapi takes call variables only per call (`assistantOverrides.variableValues`); assistants cannot store defaults. Whether the dashboard Talk button has a variables box is unknown. A Claude-app test page is not possible (the page sandbox blocks the microphone and live-call connections). Options: (1) Abdullah checks the Talk screen for a Variables box; (2) temporary test values written into the first message and prompt, reverted after testing (pre-edit prompt must be saved first); (3) a small page on Abdullah's Vercel account with the Vapi web SDK (needs his public Vapi key). The Liquid date format in the prompt is valid per Vapi's spec.

Resolved Oct 9 (session 3d): option 1. The dashboard Talk dropdown has a Variables panel (per-call values). Abdullah entered first_name, agent_name=Alex, company_name=Kynetic Roofing, issue_type=roof leak, owns_property=yes, timeline=as soon as possible. No Vapi change. The prompt only uses those six; service_type and lead_source are not referenced anywhere in the prompt or first message.

## Phase B test 1 (Oct 9, web call 01a121eb, books)
- FAIL: Alex never ran check_availability and invented "Monday 10 AM or Tuesday 1 PM" (Tuesday 1 PM is outside free hours). Monday 10 AM happened to be free, so book_appointment succeeded. Likely cause: Example 1 in the prompt showed slots offered with no tool step.
- Booking 26679066 went to abdullah@gmail.com (likely not Abdullah's). Cancelled with approval, verified cancelled in Cal.com.
- OK: date math (Mon Oct 12, -07:00), address reached Cal.com (as "somewhereElse" location text), after-call fields correct.
- Prompt audit against the Inflate receptionist prompt: restructured to Role, Context, Task, Example Conversations (with * tool markers), Guardrails, Rules to Follow (last). Fillers "sparingly" (Abdullah, Oct 9). Draft `retell/builds/outbound-speed-to-lead/vapi-prompt-v2.txt`; live v1 saved as `vapi-prompt-v1-live.txt`. Not yet applied to Vapi.

## Next
- Phase B: Abdullah runs 8 web-call scenarios (books, not interested, callback, robot, renter, wrong number, silence, company question). Then cancel the test booking (needs a yes).
- Phase C: grade transcripts, tool calls and after-call fields; side-by-side with a Retell web test once that agent exists (needs approval).
- Phase D only if Vapi wins: n8n call body and webhook, Vapi server URL, phone number, compliance.

## Waiting on Abdullah
Retell KYC check, `create-outbound --apply`, n8n credential "Retell API (outbound)", the web-call tests, and any platform decision.
