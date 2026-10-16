# Bland test track

Branch: `claude/provider-test-bland`. Shared rules, persona and scorecard: `providers/TEST_PLAN.md`.

## What lives here
- `BUILDER_PROMPT.md`: paste into Bland's builder (Norm). Pathway version of Alex, one question per node.
- `RESULTS.md`: fill in after every test round. One row per run, then the scorecard totals.

## Status
- [ ] Agent built in Bland (pathway, variables, voicemail, post-call fields)
- [ ] Cal.com availability + booking tools working
- [ ] Round 1: 10 runs, email spoken by the caller
- [ ] Round 2: 10 runs, email prefilled (no voice capture)
- [ ] Off-script runs (robot question, not interested, wrong number, silence, interruption)
- [ ] Real billing numbers captured for cost per minute
- [ ] Write-up against the Retell Alex Lab control

## Bland facts gathered so far (secondary sources, verify in the console)
- Pathways are node flowcharts; each node can generate a reply from a prompt or say a fixed scripted line. That is the lever for one-question-per-turn.
- Reported pricing is conflicting: roughly $0.11 to $0.14 a minute depending on plan, plus a small charge on very short outbound attempts, with transfers extra. Confirm on https://bland.ai/pricing and with a real billed call.
- Webhook integrations may be gated to paid plans. Confirm before relying on them.
- A builder assistant ("Norm") can propose pathway edits in plain language and show a diff.

## Do not
Touch Retell, n8n, Twenty or production Alex from this branch. Commit only files under `providers/bland/` and updates to `providers/TEST_PLAN.md` shared notes.
