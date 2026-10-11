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
- Prompt audit against the Inflate receptionist prompt: restructured to Role, Context, Task, Example Conversations (with * tool markers), Guardrails, Rules to Follow (last). Fillers "sparingly" (Abdullah, Oct 9). Draft `retell/builds/outbound-speed-to-lead/vapi-prompt-v2.txt`; live v1 saved as `vapi-prompt-v1-live.txt`. Applied to Vapi Oct 9 with approval (assistant version v9 -> v10); re-read confirmed only the system prompt changed.

## Session 3d (Oct 9, 2026): Vapi build brought to test-ready
- Prompt v2 fixes applied to Vapi (assistant v10 to v11): Vapi-safe "hold on" rule, phone line and silence rule removed, examples 2, 5, 8 written out in full. Live prompt equals `retell/builds/outbound-speed-to-lead/vapi-prompt-v2.txt`.
- n8n: new workflow "Outbound Speed to Lead (Vapi)" `zeuXYovHQ4u75heS`, 27 nodes, built from the Retell workflow (published ACTIVE later the same day at Abdullah's instruction) (code copy: `retell/builds/outbound-speed-to-lead/n8n-vapi-workflow.ts`). Retell workflow `m2YJwZ1l8DTzyEkw` untouched. Changes: Vapi create-call body (assistantOverrides.variableValues plus twenty_id and attempt), header-auth end-of-call webhook, Vapi payload normalization, first-call calling-hours gate (outside 9:00 to 20:00 Pacific the lead is queued for the sweeper).
- Vapi assistant v11 to v12: server URL set to the new workflow's production webhook, serverMessages = end-of-call-report only. No server secret yet.
- Dry runs (pinned, no Twenty writes, no calls): booked payload, voicemail with empty structured output, and a non-final status-update message all behaved correctly. Real Vapi call object confirmed: assistantOverrides.variableValues is echoed, structuredOutputs is an object keyed by id, summary sits at call.summary.
- Twenty read-only check: every select value the workflow writes exists (leadStatus, lastOutcome, interaction outcome, ownsProperty, issueType, timeline, leadSource, SPEED_TO_LEAD, VOICE).
- Not done (needs Abdullah, cannot be done from here): create the two n8n credentials, attach them, set the Vapi server secret, add a phone number later. See known-issues.

## Oct 10: hardcoded names, n8n connection fixes
- Original Vapi assistant `8e51e8d6` now has company name (Kynetic Roofing) and agent name (Alex) hardcoded (v14); the copy `c418f6e2` keeps all variables. n8n no longer sends company_name/agent_name (removed from Call Settings and both call bodies) and was republished. service_type and lead_source are still sent (unused by the prompt).
- n8n draft fixes: Call Settings node restored, "Vapi API (outbound)" attached to both call nodes, "Vapi webhook secret" on the webhook; published version now matches the draft. Vapi sends the `x-vapi-secret` header (custom header on the assistant).
- Still open: first real web-call report not yet seen in n8n Executions (connection test pending).

## Oct 11: calendar lookup fixed (Path 4), Vapi to n8n connection proven
- Connection test: a web call reached n8n (execution 1423) and the report was read correctly (outcome, callback time, notes). Secret header matched.
- Bug found: Vapi's apiRequest tool cannot send query parameters, so the old GET to Cal.com /v2/slots failed ("usernames property is wrong"). Alex fell back to a callback (as designed).
- Fix: new Path 4 inside the main workflow (6 nodes): "Calendar Lookup Webhook" (header auth, Vapi webhook secret) -> "Calendar Window" (today to +14 days, Los Angeles) -> "Get Cal.com Slots" (credential "Cal.com Vapi", Bearer Auth) -> "Format Slots" (exact day, else nearest days, with spoken text and exact start) -> "Respond With Slots". Production path `/webhook/vapi-calendar-lookup-8c41f6a2d93b`. Tested live: 0.8 to 1 s (2.7 s cold), exact / earliest / nearest all correct.
- Vapi: check_availability now POSTs to that webhook (body: optional preferred_date, time_of_day; header x-vapi-secret; Cal.com key removed from that tool). Both calendar tools got one spoken line ("One moment while I check." / "Booking that now."). Alex prompt v15 reads match/slots/note and offers nearest times when a day is full.
- Still to test by Abdullah: free chat test (calendar offers, Wednesday afternoon, full day), then the full booking call. Booking tool (book_appointment, direct Cal.com POST) unchanged.

## Next
- Phase B: Abdullah runs 8 web-call scenarios (books, not interested, callback, robot, renter, wrong number, silence, company question). Then cancel the test booking (needs a yes).
- Phase C: grade transcripts, tool calls and after-call fields; side-by-side with a Retell web test once that agent exists (needs approval).
- Phase D only if Vapi wins: n8n call body and webhook, Vapi server URL, phone number, compliance.

## Waiting on Abdullah
Retell KYC check, `create-outbound --apply`, n8n credential "Retell API (outbound)", the web-call tests, and any platform decision.
