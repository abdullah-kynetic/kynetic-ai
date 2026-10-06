# Decisions

Mirror of the Twenty decision notes. If this disagrees with Twenty, Twenty wins. Do not reopen these without asking.

## D-001: Price is $1,500 setup + $997/mo
Status: decided
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

## D-011: Outbound agent discloses it is an AI and that the call may be recorded
Status: decided
Date: 2026-10-06
Why: Source review of 14 saved sources: 4 disclose, 3 do not, SOURCE TEMPLATE 05 says "Never mention AI", the rest are silent. Only SOURCE TRANSCRIPT 03 argues for disclosure. No source gives conversion data or a legal basis. Fits D-007 (consent wording).
Opening line: "Hi, is this {{first_name}}? This is [Name], an AI assistant calling from [Company] about the form you just submitted. This call may be recorded. Is now an okay time?"
Consequence: remove "Never mention AI" from the adapted prompt, never deny being an AI if asked, store consent text, timestamp and source in Twenty with each lead. Current federal and state disclosure rules are unverified; counsel to confirm (task 1.4).

## D-012: Outbound v1 call handling
Status: decided
Date: 2026-10-06
Why: Keeps v1 small and testable using patterns confirmed across the source review.
- Voicemail: hang up, log "voicemail", retry. Leaving a message is TBD for a later version.
- Retry cadence: first call within about 60s of submit, then 5 min, 1 hour, next day, max 4 attempts, via a scheduled sweeper over Twenty.
- Model and voice: gpt-4.1 with 11labs-Cimo (D-008), revisit after test calls.
- Human transfer: deferred past v1 (an added tool and prompt change, not a rebuild).
- Results arrive by Retell webhook filtered to the final analyzed event (no polling). Outcome from Retell native post-call analysis. Twenty record ID passed in call metadata.
