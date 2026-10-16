# ElevenLabs track: handoff (updated 2026-10-16)

## Context
Voice-provider bake-off for Alex (outbound speed-to-lead, Kynetic Roofing demo). Retell is the current platform (D-018); Bland and ElevenLabs are being tested against the Retell control "Alex Lab". This is a bake-off, not a decision. Shared rules, persona and scorecard: `providers/TEST_PLAN.md`. Branch: `claude/provider-test-elevenlabs`.

## State (2026-10-16, later)
- Steps 1 to 4 done via API; full change log in RESULTS.md. Agent `agent_9301m52zy185e609f8vyws4r1r7q` now runs PROMPT.md (the earlier failure was a workflow override node, now removed). Tools check_availability and book_appointment created and attached; Cal.com slots call verified, booking call not yet exercised (real booking).
- Docs sites remain blocked, so pause tag and `{{system__time}}` are unverified; `{{system__time}}` is accepted by the API but not confirmed to resolve. Check the first transcript.
- Open question for Abdullah: LLM is `deepseek-v41-flash`, left as found. Say if a different one should be used.

## Next steps
1. Abdullah runs test call 1 (voice-email round); Claude pulls transcript, timing, cost via `GET /v1/convai/conversations`, scores it, fills RESULTS.md.
2. First booking confirms the book_appointment body shape; fix if Cal.com rejects it.
3. Continue rounds per README. Cancel test bookings only after asking Abdullah.

## Hard rules
No changes to Retell, n8n, Twenty, production Alex (agent_71e3cfc8384aa38a910a506b53), Nora, Emily, or Kynetic Restoration (Demo). Commit only under providers/elevenlabs/ plus shared notes in providers/TEST_PLAN.md. Never commit keys. Message Abdullah only with a result or one needed input.

## Prompt to resume
> Continue the ElevenLabs track on branch claude/provider-test-elevenlabs. Read CLAUDE.md, providers/TEST_PLAN.md, providers/elevenlabs/HANDOFF.md, README.md, PROMPT.md, RESULTS.md, then follow the next steps in HANDOFF.md.
