# providers: voice platform bake-off and ElevenLabs go-live

> Records only. Current direction is `docs/STATUS.md`. Do not change or invoke live Alex `agent_8201m5afn2rbeb7v29xfkhh1pjef`. The A2P text-restore note below is not approval to edit that agent and is not approval for cold SMS. `docs/plans/ALEX-ELEVENLABS-GOLIVE.md` already carries a superseded-as-status banner.

One job: records for Alex's voice platform. ElevenLabs v1 strict is the platform (D-025). Retell is parked for Alex.

## Files
- `elevenlabs/golive/`: v1 prompt before and after the text promise was removed (2026-10-22), plus the restore note.
- `elevenlabs/snapshots/2026-10-19-blitz/`: production Alex agent (`agent_8201m5afn2rbeb7v29xfkhh1pjef`) and its two Cal.com tools, copied from PR #31. See the README there.
- `elevenlabs/SMS_TOOL.md`: draft text-confirmation tool (not applied).
- The bake-off files (`BAKEOFF_SUMMARY.md`, `TEST_PLAN.md`, `RESULTS.md`, the v2 agent) stay on branch `claude/provider-test-elevenlabs` (draft PR #31, not on main).

## Rules
- Prompt changes on the live agent need Abdullah's yes, except the pre-approved restore of the text wording once the Twilio A2P campaign is approved.
- Never print API keys (`ELEVENLABS_API_KEY_blitz`).
- Go-live plan: `docs/plans/ALEX-ELEVENLABS-GOLIVE.md`.
