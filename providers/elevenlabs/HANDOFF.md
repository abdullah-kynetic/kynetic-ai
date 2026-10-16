# ElevenLabs track: handoff (updated 2026-10-16)

## Context
Voice-provider bake-off for Alex (outbound speed-to-lead, Kynetic Roofing demo). Retell is the current platform (D-018); Bland and ElevenLabs are being tested against the Retell control "Alex Lab". This is a bake-off, not a decision. Shared rules, persona and scorecard: `providers/TEST_PLAN.md`. Branch: `claude/provider-test-elevenlabs`.

## State
- ElevenLabs agent exists in Abdullah's dashboard, but a pre-config test (RESULTS.md run 0) showed it was running the builder's default prompt, not `PROMPT.md`. Needs fixing first.
- `PROMPT.md` now has the no-filler variant (no um/uh). Retell control still uses fillers; note it in the write-up.
- Abdullah allowed `api.elevenlabs.io` and `api.cal.com` in the environment network settings and added `ELEVENLABS_API_KEY`. It was not visible in the session that was open at the time (variables load at session start). `CAL_API_KEY` is present.
- Abdullah wants Claude to make the agent edits via the API, one agent only, logging each change in RESULTS.md.
- Three PROMPT.md items still unverified (pause tag, time variable name, Cal.com v2 shapes). Docs sites were unreachable before the network change; retry now.

## Next steps
1. Check `ELEVENLABS_API_KEY` is set. If not, stop and tell Abdullah.
2. Read the agent config via API; diff against PROMPT.md (prompt, first message `Hi, is this {{first_name}}?`, dynamic variables, voice speed 1.0).
3. Fix mismatches, enable end call, voicemail hang-up with no message, post-call data fields.
4. Create check_availability and book_appointment server tools (Cal.com event type 7404470, America/Los_Angeles); test availability read-only first.
5. Abdullah runs test calls; Claude pulls transcripts, timings and cost, scores them, fills RESULTS.md and the README checklist.
6. Cancel test bookings only after asking Abdullah.

## Hard rules
No changes to Retell, n8n, Twenty, production Alex (agent_71e3cfc8384aa38a910a506b53), Nora, Emily, or Kynetic Restoration (Demo). Commit only under providers/elevenlabs/ plus shared notes in providers/TEST_PLAN.md. Never commit keys. Message Abdullah only with a result or one needed input.

## Prompt to resume
> Continue the ElevenLabs track on branch claude/provider-test-elevenlabs. Read CLAUDE.md, providers/TEST_PLAN.md, providers/elevenlabs/HANDOFF.md, README.md, PROMPT.md, RESULTS.md, then follow the next steps in HANDOFF.md.
