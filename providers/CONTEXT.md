# providers: voice platform bake-off and ElevenLabs go-live

One job: records for Alex's voice platform. ElevenLabs v1 strict is the platform (D-025).

## Files
- `elevenlabs/golive/`: v1 prompt before and after the text promise was removed (2026-10-22), plus the restore note.
- `elevenlabs/SMS_TOOL.md` and the bake-off files (`BAKEOFF_SUMMARY.md`, `TEST_PLAN.md`, `RESULTS.md`) are on branch `claude/provider-test-elevenlabs` (not on main).

## Rules
- Prompt changes on the live agent need Abdullah's yes, except the pre-approved restore of the text wording once the Twilio A2P campaign is approved.
- Never print API keys (`ELEVENLABS_API_KEY_blitz`).
- Go-live plan: `docs/plans/ALEX-ELEVENLABS-GOLIVE.md`.
