# ElevenLabs test track

Branch: `claude/provider-test-elevenlabs`. Shared rules, persona and scorecard: `providers/TEST_PLAN.md`.

## Start here
Full summary of the bake-off: `providers/BAKEOFF_SUMMARY.md`. Current state: `HANDOFF.md`. Test scripts: `TEST_SCRIPTS.md`. Pricing: `PRICING.md`.

## What lives here
- `PROMPT.md`: first message, system prompt, variables, system tools, Cal.com server tool specs.
- `RESULTS.md`: fill in after every test round. One row per run, then the scorecard totals.

## Status
- [x] Agent configured in ElevenLabs (first message, prompt, variables, voice speed 1.0), workflow override removed
- [x] Voicemail detection set to hang up with no message (config set; untested on a real voicemail)
- [ ] Cal.com availability + booking working (native Cal.com tools on event 7520336 attached to both blitz agents; availability verified, real booking not yet run)
- [ ] Round 1: 10 runs, email spoken by the caller
- [ ] Round 2: 10 runs, email prefilled (no voice capture)
- [ ] Off-script runs (robot question, not interested, wrong number, silence, interruption)
- [ ] Real billing numbers captured for cost per minute
- [ ] Write-up against the Retell Alex Lab control

## Do not
Touch Retell, n8n, Twenty or production Alex from this branch. Commit only files under `providers/elevenlabs/` and updates to `providers/TEST_PLAN.md` shared notes.
