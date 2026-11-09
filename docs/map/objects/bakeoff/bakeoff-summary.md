---
type: object
cluster: bakeoff
universe: ghost
status: stale
entity: branch claude/provider-test-elevenlabs: providers/
verified_on: 2026-10-22
verified_at: 5888b13 (source unchanged since 67763e6)
---

# Voice bake-off (Retell vs ElevenLabs)

> Stale as of 2026-11-08 PST. The bake-off is closed. ElevenLabs won (D-025, 2026-10-25). Do not treat "no verdict" as the current state.

Not on `main`. On `origin/claude/provider-test-elevenlabs`: `providers/BAKEOFF_SUMMARY.md`, `TEST_PLAN.md`, and `providers/elevenlabs/` (HANDOFF, RESULTS, PROMPT, PROMPT_V2, TEST_SCRIPTS, PRICING, BUILD_MAP, SMS_TOOL, snapshots of two agents). A Bland branch exists too. The sentence that used to say no verdict was logged is the Oct 22 card text. D-025 is the verdict.

## If you change this
- **Hits:** only the 11Labs workflow on the VPS (`xlmyRd5jBBBu8LX7`, inactive), and production Alex only if ElevenLabs wins.
- **Does not hit:** Alex, Nora, Emily, Cal event `7404470` (test event `7520336` is separate).
