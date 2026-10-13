# Decisions

Mirror of the Twenty decision notes. If this disagrees with Twenty, Twenty wins. Do not reopen these without asking.

## D-001: Price is $1,500 setup + $997/mo
Status: superseded by D-017 (pricing; see also D-013 in Twenty)
Date: 2026-10-01
Why: Replaces the $750 founding setup. Guarantee terms are still not set.
Replaced: $750 setup + $997/mo.

## D-002: Owner gate
Status: decided
Date: 2026-10-01
Why: Call only the business owner at a number tied to the owner. Drop businesses with a receptionist or front desk, because they already have someone answering.

## D-003: Build everything first, then switch outreach on once
Status: decided
Date: 2026-10-01
Why: After outreach is on it only speeds up. Never sign clients faster than a client can be set up.

## D-004: Voice first onboarding
Status: decided
Date: 2026-10-01
Why: Client A2P (SMS) registration takes 2 to 3 weeks. Voice goes live day 1, SMS when A2P approves.

## D-005: Nora is frozen, all new work goes on Emily
Status: decided
Date: 2026-09-28
Why: Nora is the live original. Emily is the build copy (one agent for inbound and outbound).

## D-006: Twenty is the CRM and system of record
Status: decided
Date: 2026-09-26
Why: Notion is legacy and being phased out. Never design new CRM logging in Notion.
Replaced: Notion.

## D-007: Hard rules
Status: decided
Why: No AI placed cold calls, no cold SMS at scale, no ringless voicemail drops, consent wording on any form that triggers a callback.

## D-008: Emily's voice is 11labs-Cimo
Status: decided
Date: 2026-10-05
Why: It's what Emily already had, inherited from the Inflate AI reference build (confirmed in retell/builds/_inflate-original/agent.json). Capability matters more than voice for this build; voice is a 30-second swap per client later if needed. Keeping it unblocks publishing now instead of spending time picking a new one.

## D-009: Full voice-agent build is being redone from scratch
Status: decided
Date: 2026-10-05
Why: After reviewing 9 YouTube build transcripts and 6 uploaded build artifacts on Retell/Vapi outbound voice-agent builds, decided the existing build approach was wrong and the new build (Emily rebuild + outbound speed-to-lead) should be synthesized fresh from the best patterns across all sources, not incrementally patched. 1.1 and 1.2 (Cal.com key, voice choice) still stand. See Twenty note "ACTIVE BUILD PLAN: Emily Rebuild + Speed-to-Lead Outbound (Oct 5, 2026)" for the synthesized plan and open architecture decisions.
Replaced: The prior implicit plan of patching Emily's existing n8n workflow and bolting outbound onto it with minimal changes.

## D-010: Inbound and outbound are two separate Retell agents; inbound paused, outbound is the active build
Status: decided
Date: 2026-10-06
Why: n8n forks into separate workflows regardless of agent count, so one shared agent doesn't save the hard work; cloning a Retell agent template is a one-time cost, not recurring; two separate, nameable agents match Abdullah's cold-call pitch/demo motion and let him sell/demo inbound and outbound as distinct capabilities. Resolves OPEN DECISION 1 from the Twenty note "ACTIVE BUILD PLAN: Emily Rebuild + Speed-to-Lead Outbound."
Scope: Inbound (Emily) build is paused — considered near-done, touched again only to customize for a client-specific demo. Outbound (speed-to-lead) is the sole active build target. Correction (2026-10-06): the outbound agent is not built from a merged inbound+outbound prompt — that was a wrong assumption. Abdullah's "VOICE AGENT PROMPT" upload is SOURCE TEMPLATE 05 (Twenty), an already outbound-only prompt (SolarShift) paired with a matching Facebook Ad Form n8n JSON, built for this exact speed-to-lead use case. That pair is the primary starting draft for the new outbound agent/workflow, adapted to Twenty/Cal.com and run through the SOURCE TEMPLATE 06 house style.
Replaced: D-005's parenthetical "(one agent for inbound and outbound)" description of Emily, and the open/unconfirmed status of Decision 1 in the ACTIVE BUILD PLAN note.

## D-017: Outbound speed-to-lead sold as 3-month packages, 15% off, milestone billing
Status: decided by Abdullah; business partner sign-off pending
Date: 2026-10-13
Why: Goal is $30K by Dec 31, 2026. First 3 clients: $4,675 package (list $2.5K setup + $1K/mo x 3 = $5,500). Clients 4+: $8,500 package (list $4K setup + $2K/mo x 3 = $10,000). Payment split 50% at start, 25% when built and sent for testing, 25% at completion (assumed to mean build go-live; confirm). Needs 5 clients ($31,025), aim for 6. Full math in docs/revenue-plan-q4-2026.md.
Replaced: D-001 ($1,500 setup + $997/mo).
Scope: outbound speed-to-lead agent only. Funnel rates in the plan are assumptions to be replaced with real data after about 500 dials.
Open conflict: D-003 and the MASTER PLAN Phase 7 launch gate (Twenty) say no dialing until the build is done. The revenue plan starts dialing Oct 14. Abdullah to decide which gives.
Note: this mirror is stale. Twenty already has D-011 to D-016 (AI disclosure, call handling, two plans, outbound architecture, Kynetic Roofing demo). D-017 is the next free number in Twenty.
