# ElevenLabs track: handoff (updated 2026-10-19)

## Context
Voice-provider bake-off for Alex (outbound speed-to-lead, Kynetic Roofing demo). Retell is the current platform (D-018). The bake-off is Retell vs ElevenLabs only (Bland dropped). Abdullah's read as of 2026-10-19: ElevenLabs is ahead and a little cheaper; the scorecard and billing still need to confirm it before a decision is logged. Shared rules, persona and scorecard: `providers/TEST_PLAN.md`. Branch: `claude/provider-test-elevenlabs`. Twenty: task 3.9 and the bake-off note.

## State
- Work is on the second ElevenLabs account (key env `ELEVENLABS_API_KEY_blitz`). Agents: v1 strict `agent_8201m5afn2rbeb7v29xfkhh1pjef` (PROMPT.md), v2 loose `agent_9701m5afn5rxehardsqttkq3pbjh` (PROMPT_V2.md). Old-account agents are snapshots only.
- Both agents use the native Cal.com integration ("cal.com testing", API-integration connection `icxn_9201m5am6y02ehpvw4rndr4xzd6p`): `calcom_get_available_slots`, `calcom_create_booking` on test event 7520336 (location fixed; address in booking notes). Native tools are inline `api_integration_webhook` tools; PATCH of an agent prompt replaces built_in_tools, so re-send `end_call` and `voicemail_detection` after any prompt PATCH.
- Prompts: text confirmation, combined form confirmation, two earliest slots, full address, noise handling, booking-failure handling, UTC to Pacific conversion.
- Script 1 ran once on each prompt (see RESULTS.md runs 1 and 2). Booking failed from a tool fault, since fixed. No real booking has run end to end yet.
- n8n draft `11Labs | Outbound Speed to Lead` (`xlmyRd5jBBBu8LX7`) is inactive and never run. See BUILD_MAP.md.

## Next steps
0. Treat ElevenLabs as the leading candidate; fill the scorecard and cost comparison (from billing) and log a decision if it wins.
1. Abdullah re-runs Script 1 on both agents (gives his own cell number when asked); Claude pulls transcripts and scores in RESULTS.md. Then scripts 3, 4, 6.
2. Add a text-confirmation tool (stub first; real send after KI-003).
3. Decide the LLM question (deepseek-v41-flash vs gpt-4.1).
4. Wire n8n only if ElevenLabs wins.

## Hard rules
No changes to Retell, production Alex (agent_71e3cfc8384aa38a910a506b53), Nora, Emily, or Kynetic Restoration (Demo). Never change Cal.com event 7404470. Never commit keys. Cancel test bookings only after asking Abdullah.

## Prompt to resume
> Continue the ElevenLabs track on branch claude/provider-test-elevenlabs. Read CLAUDE.md, providers/TEST_PLAN.md, providers/elevenlabs/HANDOFF.md, README.md, PROMPT.md, PROMPT_V2.md, RESULTS.md, then follow the next steps in HANDOFF.md.
