# Decisions

Mirror of the Twenty decision notes. Twenty is canonical; this file mirrors it. On a mismatch, flag it rather than silently picking one. Do not reopen these without asking.

## D-001: Price is $1,500 setup + $997/mo
Status: superseded by D-017 (2026-10-13). Do not quote this price.
Date: 2026-10-01
Why: Replaces the $750 founding setup. Guarantee terms are still not set.
Replaced: $750 setup + $997/mo.
Superseded by: D-017 (first 3 clients $4,675, clients 4 and up $8,500, three Stripe invoices at 50/25/25).

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

## D-013: Two plans. Plan 1 is the outbound agent only; five paying clients before Plan 2
Status: decided. The price in this entry is superseded by D-017.
Date: 2026-10-06
Why: The outbound pitch gets us in front of qualified owners and makes money fastest. The full system is what we follow through on once we have credibility.
Plan 1: sell only the outbound speed to lead agent to owners already running Meta ads. Price is D-017, which replaces the $1,500 setup + $997/mo figure this decision originally used. Gate: 5 paying clients (Quentin's partnership terms still finalize at 5). Plan 2 (Revenue Recovery System): Reputation Engine, Inbound AI Receptionist (Emily), Lead Recovery and Nurture. After the gate, either stay on Plan 1 and sell the three as upsells to the same clients (if Plan 1 scales well) or reassess and bring Plan 2 forward as its own pitch. Plan 2 pricing is undecided.
Naming: "speed to lead" only means the outbound agent. Inbound is the Inbound AI Receptionist.
Consequence: Twenty task titles carry [P1]/[P2]. The Phase 7 demo gate uses the outbound demo. Package Menu and Offer Definition are Plan 2 reference only. If the fork is decided before client 5, Plan 1 onboarding should leave room for upsells.
See: Twenty note "BUSINESS MODEL: Two Plans".

## D-016: Demo is built on AM-1 Roofing's profile (option B), everything copied, only the name changes
Status: decided (amended 2026-10-08, later)
Date: 2026-10-08
Why: Abdullah's method is to copy a real, well-run business, build the demo from it, pitch it, then rename. AM-1 Roofing Inc (Bend, Oregon) is a close friend's company he expects to demo for and possibly sign, so the demo and the eventual client build use the same data. Spoken name is "Kynetic Roofing" (confirmed Oct 8; "KyneticAI Roofing" is not used). Timezone America/Los_Angeles.
Amendment: the original guardrail that kept AM-1's phone, email, address, license, ratings and certifications off the demo is withdrawn. The Kynetic Roofing (Demo) company record in Twenty now carries phone (541) 388-3621, address 52 SE 9th St Bend OR 97702 and rating 4.6 from 88. The Twenty note "BUSINESS PROFILE: Kynetic Roofing (Demo)" holds the rest (website, emails, owners, CCB license, certifications). The website field stays empty on the demo company because Twenty blocks one domain on two companies. The company record and the client account are both kept: the client account is what leads and calls link to.
Guardrails that remain: no dials to the AM-1 office number and no call to AM-1 without the owner's OK (owner gate D-002 not formally checked); unverified items (Meta ads, free estimate, financing, Facebook page, exact rating) are never stated as facts; Alex's warranty line stays generic unless Abdullah changes it; test calls only to numbers the tester owns, with consent.

## D-015: Plan 1 demo niche and names
Status: decided
Date: 2026-10-07
Why: Roofing only for the first build. Demo business is Kynetic Roofing (renamed Oct 8, 2026 from Summit Ridge Roofing; used everywhere in Retell, n8n and Twenty), agent Alex. Kynetic Restoration (Demo) stays with Plan 2. Roofing is high ticket, urgent, owner operated and runs on Meta lead ads; the Dallas Muse test found 25 real advertisers. Solar waits for counsel (1.4) and has different qualifiers. Kitchen and bath is the second niche to test (2.3). This is judgment, to be checked against Ad Library counts in task 2.1.
Consequence: PROMPT.md is filled in for Kynetic Roofing; a Cal.com event type for a roof inspection is needed.

## D-014: Outbound v1 architecture
Status: decided
Date: 2026-10-07
Why: Keeps v1 to two endpoints and one secret (the post call endpoint); matches D-012.
(1) Lead entry is an n8n form for now (stands in for the Meta lead form), with consent wording and checkbox; consent text, timestamp and source stored in Twenty. (2) Two n8n endpoints: the n8n intake form (public) and one post call endpoint filtered to `event == call_analyzed` with header auth (KI-005). Corrected Oct 7: check_availability_cal and book_appointment_cal are native Retell tools that call Cal.com directly (see the Emily snapshot llm.json), so no tools endpoint or action router is needed in v1; it is only needed later for a custom tool such as opt out logging or human transfer. (3) Light pre call gate: E.164 phone check, no re-call of the same phone within 24 hours of a new submission (scheduled retries not blocked), consent check; owner qualification stays upstream (D-002). (4) Opt out logging tool waits for 3.6. (5) Correction: Source Template 05 has no action router or tool webhooks (form trigger, Vapi call, 30s polling, analyzer, Sheets); the router is our own design.
Needs approval before building: adding Cal.com tools to the new outbound Retell agent.

## D-011: Outbound agent discloses it is an AI and that the call may be recorded
Status: decided
Date: 2026-10-06
Why: Of 14 reviewed sources, 4 disclose, 3 do not, none give conversion data or a legal basis. Fits D-007 (consent wording). Approved opener: "Hi, is this {{first_name}}? This is [Name], an AI assistant calling from [Company] about the form you just submitted. This call may be recorded. Is now an okay time?" Consent text, timestamp and lead source are stored in Twenty with every lead.
Consequence: Drop "Never mention AI" from the SolarShift prompt. Never deny being an AI. Counsel to confirm current AI-voice disclosure rules (task 1.4).

## D-012: Outbound v1 call handling
Status: decided
Date: 2026-10-06
Why: Keeps v1 small and testable. (1) Hang up on voicemail, log as voicemail, retry; leaving a voicemail is TBD. (2) First call within about 60 seconds of form submit, retries at 5 min, 1 hour, next day, max 4 attempts, run by a scheduled sweeper over Twenty. (3) gpt-4.1 + 11labs-Cimo, revisit after test calls. (4) Human transfer deferred past v1. (5) Retell webhook filtered to the final analyzed event replaces the polling loop; structured outcome from Retell native post-call analysis; Twenty record ID passed in call metadata.

## D-017: Plan 1 price is $4,675 for the first 3 clients and $8,500 after that
Status: decided. Quentin signed off.
Date: 2026-10-13
Why: Final price for the outbound speed-to-lead package. The first 3 clients pay $4,675. Clients 4 and up pay $8,500. Each client is billed as three Stripe invoices: 50% at the start, 25% when the system is built and sent for testing, and 25% at completion. Not a monthly subscription.
Replaced: D-001, and the price line originally in D-013.
Scope: Plan 1 only. Plan 2 pricing is still undecided. The 5-client gate in D-013 still stands.

## D-018: Retell is the platform; Vapi is parked. Two Retell workspaces
Status: decided
Date: 2026-10-13
Why: New voice work stays on Retell. The Vapi side experiment is parked. Its workflows were renamed and deactivated. The builder prompt is in `archive/vapi/` and is not a build spec.
Workspaces: `abdullahblitz` is for new builds, including the Alex outbound agent. `kyneticai` is the older workspace and holds Nora and Emily. Nora stays frozen.
Note (2026-10-17): the builder prompt named above was removed from main; see D-019.

## D-019: Legacy material removed from main; recoverable via tag
Status: decided
Date: 2026-10-17
Why: Main holds only current Kynetic AI material, organized around the four context files. Legacy material was removed from main, not moved to another repo. Recoverable via tag `archive/pre-reorg-2026-10-17`. No separate archive repo.
Removed: `archive/` (Vapi prompt, lead-scrape flow, trade-receptionist export, SeldonFrame BUILD_LOG), the duplicate `Claude Skills/brand-profile-generator`, and the generic `deep-research` and `frontend-design` skills.
