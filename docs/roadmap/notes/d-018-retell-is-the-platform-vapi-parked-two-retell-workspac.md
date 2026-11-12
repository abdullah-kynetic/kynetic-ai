# D-018: Retell is the platform, Vapi parked; two Retell workspaces (Retell-for-Alex part superseded by D-025)

_Twenty note `9937a836`, created 2026-10-13, updated 2026-10-25. Exported 2026-11-12._

**Partly superseded 2026-10-25 by D-025:** ElevenLabs (v1 strict) is the voice platform for Alex. Still standing: Vapi parked; Nora and Emily stay on Retell workspace kyneticai, frozen.

## D-018: Retell is the platform, Vapi parked; two Retell workspaces
**Status:** decided by Abdullah
**Date:** 2026-10-13

**Decision:**
1. Retell AI is the voice-agent platform. The Vapi side experiment (assistant 8e51e8d6, n8n zeuXYovHQ4u75heS, now deactivated) is parked and is not active work.
2. Two Retell workspaces:
   - **abdullahblitz** (new): all new builds, starting with Alex, the Plan 1 outbound agent.
   - **kyneticai** (old): Nora (frozen original, agent_4c34644a04c74e27253e80167b) and Emily (Plan 2, paused).
3. The Plan 1 workflow is n8n `m2YJwZ1l8DTzyEkw` (Retell). The Vapi copy c4wD is renamed "VAPI COPY - do not use".

**Why:** Abdullah went back to Retell after the Oct 11 Vapi test failed on prompt behavior. The build docs and PR #11 config target Retell.

**Fixes:** the Vapi status note previously said "No platform decision (D-017) made", which was a misuse of D-017 (pricing).

**See also:** D-010, D-012, D-014, [PARKED] Vapi side experiment.
