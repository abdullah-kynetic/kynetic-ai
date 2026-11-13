# D-012: Outbound v1 call handling: hang up on voicemail and retry, fixed retry cadence, gpt-4.1 + 11labs-Cimo, human transfer deferred

_Twenty note `ddbe62be`, created 2026-10-06, updated 2026-10-17. Exported 2026-11-12._

## D-012: Outbound v1 call handling
**Status:** decided. Item 2 (retry cadence) is superseded by D-020 (2026-10-17); the rest stands.
**Date:** 2026-10-06

**Decision (v1 only):**
1. **Voicemail:** the agent hangs up on voicemail, the outcome is logged as voicemail, and the lead is retried. Leaving a voicemail message is TBD for a later version.
2. **Retry cadence:** first call within about 60 seconds of form submit, retries at 5 minutes, 1 hour and next day, maximum 4 attempts. Implemented as a scheduled sweeper over Twenty. **Superseded by D-020:** 90 second fast retry, then +10 and +60 minute sweeper retries, maximum 3 attempts, calls only 8:00 to 21:00 lead-local.
3. **Model and voice:** start with gpt-4.1 and voice 11labs-Cimo (D-008). Revisit after test calls.
4. **Human transfer:** deferred past v1. Adding it later is an agent tool plus a prompt change, not a rebuild.
5. **Result delivery:** Retell webhook filtered to the final analyzed event replaces the polling loop. Structured outcome comes from Retell native post-call analysis. The Twenty record ID is passed in call metadata.

**Why:** Keeps v1 small and testable while using the confirmed patterns from the source review (SOURCE TRANSCRIPTS 02, 05, 08).

**See also:** D-010, D-011, D-020, ACTIVE BUILD PLAN note Section 6.
