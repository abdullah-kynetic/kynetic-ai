# ElevenLabs test track

Branch: `claude/provider-test-elevenlabs`. Shared rules, persona and scorecard: `providers/TEST_PLAN.md`.

## What lives here
- `PROMPT.md`: first message, system prompt, variables, system tools, Cal.com server tool specs.
- `RESULTS.md`: fill in after every test round. One row per run, then the scorecard totals.

## Status
- [ ] Agent created in ElevenLabs (first message, prompt, variables, voice speed 1.0)
- [ ] Voicemail detection set to hang up with no message
- [ ] Cal.com availability + booking server tools working
- [ ] Round 1: 10 runs, email spoken by the caller
- [ ] Round 2: 10 runs, email prefilled (no voice capture)
- [ ] Off-script runs (robot question, not interested, wrong number, silence, interruption)
- [ ] Real billing numbers captured for cost per minute
- [ ] Write-up against the Retell Alex Lab control

## Do not
Touch Retell, n8n, Twenty or production Alex from this branch. Commit only files under `providers/elevenlabs/` and updates to `providers/TEST_PLAN.md` shared notes.
