# D-010: Inbound and outbound are two separate Retell agents; inbound is paused, outbound is the active build

_Twenty note `0b35f8ed`, created 2026-10-06, updated 2026-10-14. Exported 2026-11-12._

## D-010: Inbound and outbound are two separate Retell agents; inbound is paused, outbound is the active build
**Status:** decided
**Date:** 2026-10-06

**Decision:** Resolves OPEN DECISION 1 from the ACTIVE BUILD PLAN note (Oct 5) as **two separate agents**, not one agent branched by dynamic variables. Inbound (Emily) and outbound (speed-to-lead) will be two distinct, separately-named Retell agents with their own LLM/prompt, not a single agent forked by direction.

**Scope/sequencing:** Inbound (Emily) build is considered close to done and is now paused/left alone — it will only be touched again to customize it for a client-specific demo. Active build focus shifts entirely to the outbound speed-to-lead agent. **Correction (Oct 6, 2026):** the outbound agent is not being built from zero or from a merged inbound+outbound draft. Abdullah's existing "VOICE AGENT PROMPT" upload is SOURCE TEMPLATE 05 — an already outbound-only prompt (the SolarShift prompt) paired with a matching Facebook Ad Form n8n JSON, built specifically for this speed-to-lead use case. That pair is the primary starting draft for the new outbound agent and workflow (see ACTIVE BUILD PLAN note, Sections 6-7), adapted with Twenty/Cal.com in place of Google Sheets/Calendar and run through the SOURCE TEMPLATE 06 house style.

**Why:** Matches Abdullah's actual cold-call sales/demo motion — two separate, nameable agents let him pitch and demo inbound and outbound as distinct capabilities.

**Supersedes:** The 'pending confirmation' status on OPEN DECISION 1 in the ACTIVE BUILD PLAN note (Oct 5, 2026) and the implicit option of keeping inbound+outbound on one agent.

**See also:** ACTIVE BUILD PLAN: Emily Rebuild + Speed-to-Lead Outbound (Oct 5, 2026) — Section 1.5 (current focus + correction), Section 3 (resolved), Sections 6-7 (outbound build spec using SOURCE TEMPLATE 05 as the starting draft, now the sole active focus).
