# Merged small decision notes (from Twenty, 2026-11-14 cleanup)

Current authority: D-023 and D-025 stay in notes/. Originals are in this folder.

---

# D-002: Owner gate. Call only the business owner; drop businesses with a front desk

_Twenty note `a3629c74`, created 2026-10-13, updated 2026-10-14. Exported 2026-11-12._

## D-002: Owner gate. Call only the business owner; drop businesses with a front desk
**Status:** decided; a rewording is PENDING
**Date:** not confirmed (Sep–Oct 2026)

**Decision:** cold dials go only to the business owner. Drop businesses with a receptionist or front desk.

**Pending:** the Lane A session (Oct 10–12) proposes rewording this to "no dedicated instant-response inside-sales team or call center" (the product calls the business's leads, so a front desk doesn't affect fit). Not yet decided.

**Source:** reconstructed Oct 13, 2026 from references in Twenty notes (Decision History, D-012 to D-017, Lane A, Plan 1 notes). The repo's docs/decisions.md wasn't available in this pass, so the wording and date are **not confirmed** against it.

---

# D-003: Build everything first, switch outreach on once; never sign faster than setup capacity

_Twenty note `6a8b0188`, created 2026-10-13, updated 2026-10-17. Exported 2026-11-12._

## D-003: Build everything first, switch outreach on once; never sign faster than setup capacity
**Status:** decided
**Date:** not confirmed

**Decision:** build the whole Plan 1 system and sales kit first, then switch outreach on once. Never sign clients faster than they can be set up. D-017 sets dialing to start Oct 15; the launch gate (task 7.1) still verifies readiness.

**Source:** reconstructed Oct 13, 2026 from references in Twenty notes (Decision History, D-012 to D-017, Lane A, Plan 1 notes). The repo's docs/decisions.md wasn't available in this pass, so the wording and date are **not confirmed** against it.

**Update (Oct 17, 2026):** dialing start moved from Oct 15 to Tuesday Oct 20 (could move up to Monday Oct 19). The launch gate still has to be verified before the first dial.

---

# D-004: Voice first; SMS only after A2P 10DLC registration

_Twenty note `b245bc4c`, created 2026-10-13, updated 2026-10-14. Exported 2026-11-12._

## D-004: Voice first; SMS only after A2P 10DLC registration
**Status:** decided
**Date:** not confirmed

**Decision:** go live with voice first. SMS gets switched on only after the client's (and our) A2P 10DLC registration is approved (task 1.3, task 5.3).

**Source:** reconstructed Oct 13, 2026 from references in Twenty notes (Decision History, D-012 to D-017, Lane A, Plan 1 notes). The repo's docs/decisions.md wasn't available in this pass, so the wording and date are **not confirmed** against it.

---

# D-005: not confirmed

_Twenty note `e5cd78b0`, created 2026-10-13, updated 2026-10-14. Exported 2026-11-12._

## D-005: not confirmed
**Status:** NOT CONFIRMED

No reference to D-005 was found in any Twenty note. Check the repo docs/decisions.md and rewrite this note with the real decision.

**Source:** reconstructed Oct 13, 2026 from references in Twenty notes (Decision History, D-012 to D-017, Lane A, Plan 1 notes). The repo's docs/decisions.md wasn't available in this pass, so the wording and date are **not confirmed** against it.

---

# D-006: Twenty is the CRM and system of record

_Twenty note `ebf1ff4c`, created 2026-10-13, updated 2026-10-14. Exported 2026-11-12._

## D-006: Twenty is the CRM and system of record
**Status:** decided
**Date:** Sep 24, 2026

**Decision:** Twenty is the sole CRM and system of record (tasks, decisions, demo build progress, leads, calls). The repo mirrors Twenty. SeldonFrame/Kynetic OS dropped. Notion is legacy reference only: don't log new work there and don't migrate old Notion leads.

**Source:** reconstructed Oct 13, 2026 from references in Twenty notes (Decision History, D-012 to D-017, Lane A, Plan 1 notes). The repo's docs/decisions.md wasn't available in this pass, so the wording and date are **not confirmed** against it.

---

# D-007: Hard sales and consent rules

_Twenty note `4a3ffc39`, created 2026-10-13, updated 2026-10-14. Exported 2026-11-12._

## D-007: Hard sales and consent rules
**Status:** decided
**Date:** not confirmed

**Decision:**
- No AI-placed cold calls. All cold dials are made by hand.
- No cold SMS at scale. No ringless voicemail drops.
- Consent wording is required on any form that triggers a callback. Store the consent text, timestamp and source in Twenty (see D-011, D-014).
- Call only the business owner (D-002).

**Source:** reconstructed Oct 13, 2026 from references in Twenty notes (Decision History, D-012 to D-017, Lane A, Plan 1 notes). The repo's docs/decisions.md wasn't available in this pass, so the wording and date are **not confirmed** against it.

---

# D-008: Agent voice is 11labs-Cimo

_Twenty note `4cfdc943`, created 2026-10-13, updated 2026-10-14. Exported 2026-11-12._

## D-008: Agent voice is 11labs-Cimo
**Status:** decided
**Date:** Oct 5, 2026 (repo PR #9, task 1.2)

**Decision:** keep 11labs-Cimo as the voice, inherited from the Inflate AI original build. D-012 applies it to the outbound agent (gpt-4.1 + 11labs-Cimo). Revisit after test calls.

**Source:** reconstructed Oct 13, 2026 from references in Twenty notes (Decision History, D-012 to D-017, Lane A, Plan 1 notes). The repo's docs/decisions.md wasn't available in this pass, so the wording and date are **not confirmed** against it.

---

# D-009: Full voice-agent build is being redone from scratch

_Twenty note `f1361c2c`, created 2026-10-05, updated 2026-10-14. Exported 2026-11-12._

## D-009: Full voice-agent build is being redone from scratch
**Status:** decided
**Date:** 2026-10-05

**Decision:** The entire voice-agent build (Emily rebuild + new outbound speed-to-lead agent/workflow) is being redone from scratch, not incrementally patched. Abdullah's words: "The entirety of the build is completely being redone... Anything that you have that is similar is completely wrong."

**Why:** After reviewing 9 YouTube build transcripts (SOURCE TRANSCRIPT 01-09) and 6 uploaded build artifacts (SOURCE TEMPLATE 01-06) on Retell/Vapi outbound voice-agent builds, Abdullah concluded the existing build approach and assumptions were wrong and the new build should be synthesized fresh from the best patterns across all 15 sources rather than extended from what existed before this point.

**What this supersedes:** Any prior assumption that Phase 3 tasks (3.1-3.7) were simple incremental edits to the existing Emily n8n workflow/Retell agent. The confirmed-done items (1.1 Cal.com key, 1.2 voice choice) still stand and are not being redone. Everything else in Phase 3, especially the outbound/speed-to-lead side (3.5), is being architected fresh.

**Replaced:** The prior implicit plan of patching Emily's existing n8n workflow and bolting outbound onto it with minimal changes.

**See also:** Note "ACTIVE BUILD PLAN: Emily Rebuild + Speed-to-Lead Outbound (Oct 5, 2026)" for the actual synthesized plan and the three open architecture decisions still pending Abdullah's confirmation (one agent vs two, consolidated vs per-tool webhooks, outbound qualification gate scope).

---

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

---

# D-011: Outbound agent discloses it is an AI and that the call may be recorded

_Twenty note `4c3d0c15`, created 2026-10-06, updated 2026-10-14. Exported 2026-11-12._

## D-011: Outbound agent discloses it is an AI and that the call may be recorded
**Status:** decided
**Date:** 2026-10-06

**Decision:** The outbound speed-to-lead agent states up front that it is an AI assistant and that the call may be recorded. Approved opening line: "Hi, is this {{first_name}}? This is [Name], an AI assistant calling from [Company] about the form you just submitted. This call may be recorded. Is now an okay time?" The consent text, timestamp and lead source are stored in Twenty with every lead.

**Why:** Source review (Oct 6, 2026, 14 saved sources): 4 disclose (03, 04, 05, 09), 3 do not (06, 07, 08), SOURCE TEMPLATE 05 explicitly instructs "Never mention AI", the rest are silent. Only SOURCE TRANSCRIPT 03 argues for disclosure (AI voice ethics best practice). No source gives data on pickup or conversion impact, and none cite a legal basis. Disclosure fits D-007 (consent wording on any form that triggers a callback).

**Consequence:** Drop the "Never mention AI" line from the SolarShift prompt when adapting it. Do not deny being an AI if asked directly. Current federal and state AI-voice disclosure rules have not been verified; counsel to confirm (related to task 1.4).

**See also:** ACTIVE BUILD PLAN note; SOURCE LIBRARY note.

---

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

---

# D-013: Two plans. Plan 1 is the outbound agent only; five paying clients before Plan 2 (pricing SUPERSEDED by D-023)

_Twenty note `30f5094f`, created 2026-10-06, updated 2026-10-25. Exported 2026-11-12._

**Superseded Oct 24, 2026 by new pricing — see D-023: Current offer, pricing, niches and upsells.** Any old pricing or niches below ($4,675 first 3 / $8,500 after, $800 / $2,000 / $3,500 tiers, 1,200 minutes then 25¢/min, remodelers + foundation repair niche list, $30K goal) are no longer valid. Current: founding (first 3) $6,500 setup + 3 months (50% signing / 50% go-live), then $1,500/mo or $4,000 prepaid months 4–6; standard $10,000 (50/25/25: signing / go-live / day 45; month 4 free if paid in full), then $2,000/mo or $5,000 prepaid months 4–6. Software included, no per-minute charges (fair-use clause). Niches: remodelers (any), solar + battery, custom pools, windows + doors, decks + outdoor living; must be running Meta ads. Upsells: reactivation $3,000 or $1,000/mo; quote follow-up $2,500 + $500/mo; after-hours $1,500 + $500/mo. Goal: $100K signed contracts by Dec 31, 2026.

**Pricing in item 1 superseded by D-017 (final, Oct 13, 2026): $4,675 / $8,500 3-month packages, 50/25/25 invoices. The rest of this decision stands.**

## D-013: Two plans
**Status:** decided
**Date:** 2026-10-06

**Decision:**
1. **Plan 1 (foot in the door):** sell only the outbound speed to lead agent to owners already running Meta ads, at $1,500 setup plus $997/mo. Nothing else is built or sold until the gate.
2. **Gate:** 5 paying Plan 1 clients (setup fee paid, on the monthly plan).
3. **Plan 2 (Revenue Recovery System):** Reputation Engine, Inbound AI Receptionist (Emily) and Lead Recovery and Nurture. After the gate, either stay on Plan 1 and sell the three systems as upsells to the same clients (if Plan 1 is scaling well), or reassess and bring Plan 2 forward as its own pitch (if it is not).
4. **Naming:** "speed to lead" only ever means the outbound agent. Inbound is called the Inbound AI Receptionist.

**Why:** The outbound pitch gets us in front of qualified business owners and makes money fastest. The full system is what we follow through on once we have credibility and work under our belt.

**Consequence:** Task titles carry [P1] or [P2]. The Phase 7 launch gate uses the outbound demo, not the inbound one. Package Menu and Offer Definition are Plan 2 reference only, with superseded pricing. Plan 2 pricing is still undecided. If the fork is decided before client 5, Plan 1 onboarding should leave room for upsells.

**See also:** BUSINESS MODEL: Two Plans; D-001, D-003, D-010.

---

# D-014: Outbound v1 architecture: n8n form intake, two endpoints, light pre-call gate

_Twenty note `b6ceab9c`, created 2026-10-07, updated 2026-10-14. Exported 2026-11-12._

## D-014: Outbound v1 architecture
**Status:** decided (corrected Oct 7, 2026, see item 6)
**Date:** 2026-10-07

**Decision:**
1. **Lead entry:** an n8n form for now. It stands in for the client's Meta lead form and can be swapped for the real Meta trigger later. The form carries the consent wording and a consent checkbox (D-007, D-011). Consent text, timestamp and lead source are stored in Twenty with the lead.
2. **Two n8n endpoints:** (a) the n8n intake form, public by design; (b) one post call endpoint that filters on `event == call_analyzed`, with a header auth secret (KI-005). No tools endpoint in v1 (see item 6).
3. **Light pre call gate:** phone format check (E.164), no re-call of the same phone within 24 hours of a new submission, and a consent check. Scheduled retries from D-012 are not blocked by the 24 hour window. Owner qualification stays upstream (D-002).
4. **Opt out logging tool:** not in v1. It comes with compliance task 3.6.
5. **Source Template 05 correction:** it does not contain an action router or any tool webhooks. It has an n8n form trigger, a Vapi call node, a 30 second polling loop, an analyzer and Google Sheets writes. ACTIVE BUILD PLAN Section 4 premise was wrong on this point.
6. **Correction (found in the Emily snapshot):** Retell's check_availability_cal and book_appointment_cal are native Retell tools that call Cal.com directly. They are not n8n webhooks. So the outbound agent needs no tools endpoint, and the earlier three endpoint plan with an action router is replaced by two endpoints. A tools endpoint is only needed later if a custom tool is added (for example opt out logging or human transfer).

**Why:** Keeps v1 to two endpoints and one secret, and matches D-012 (webhook replaces polling).

**Approval still needed before building:** adding the two native Cal.com tools (and end_call) to the new outbound Retell agent is a per change approval under the Retell tools rule. The Cal.com event type must be one for the outbound client niche; Emily's 7025524 is Water Damage Assessment.

**See also:** D-010, D-011, D-012, D-013, ACTIVE BUILD PLAN note Sections 4 to 6.

---

# D-015: Plan 1 demo is Kynetic Roofing (roofing only), agent Alex

_Twenty note `5aa97b30`, created 2026-10-07, updated 2026-10-14. Exported 2026-11-12._

## D-015: Plan 1 demo niche and names
**Status:** decided
**Date:** 2026-10-07 (renamed 2026-10-08)

**Decision:**
1. **Niche:** roofing only for the first build and demo. Solar is not included.
2. **Demo business: Kynetic Roofing**, with the agent named Alex. Renamed on Oct 8, 2026 from Summit Ridge Roofing. This is the demo business name everywhere: Retell, n8n, Cal.com, Twenty, the repo. Kynetic Restoration (Demo) stays with Plan 2.
3. **Order of niches:** roofing first, kitchen and bath tested second (task 2.3). Window and siding, outdoor living and garage floor coatings come later or not at all.

**Why:** Roofing is high ticket, urgent, owner operated and runs on Meta lead ads, and the Dallas Muse test already found 25 real advertisers. Solar uses different qualifiers (bill size, shade, financing) and is a heavy TCPA litigation space, so it waits until counsel has weighed in (1.4). Window and siding advertisers are often franchises or call center companies that fail the owner gate (D-002). Outdoor living is seasonal. Garage coatings are the lowest ticket. This is judgment, to be checked against Meta Ad Library advertiser counts in task 2.1.

**Consequence:** The outbound prompt in the repo (retell/builds/outbound-speed-to-lead/PROMPT.md) is filled in for Kynetic Roofing. A Cal.com event type for a roof inspection exists (ID 7404470). Qualifiers: own the property, leak vs storm damage vs replacement, how soon.

**See also:** D-013, D-014, PLAN 1: NEXT 10 STEPS.

---

# D-016: Demo is built on AM-1 Roofing's profile (option B), named Kynetic Roofing

_Twenty note `63fd2e9e`, created 2026-10-08, updated 2026-10-14. Exported 2026-11-12._

## D-016: Demo built on AM-1 Roofing's profile
**Status:** decided (amended 2026-10-08, later)
**Date:** 2026-10-08

**Decision:** The demo business is Kynetic Roofing, built on the real profile of AM-1 Roofing Inc (Bend, Oregon), a business owned by a close friend of Abdullah's whom he expects to demo for and possibly sign. Everything is the same as AM-1 except the name: services, materials, hours (Monday to Friday 8 to 5), Central Oregon service area, process, and now also contact details and credentials. Time zone America/Los_Angeles (Cal.com, Retell, n8n). Supersedes the Dallas setting in D-015.

**Name:** Spoken and displayed name is "Kynetic Roofing" (confirmed by Abdullah Oct 8, 2026). It is the company_name variable. "KyneticAI Roofing" is not used and has no record.

**Amendment (Oct 8, later): copy everything.** Abdullah decided to copy the real business's information onto the demo so it reads as a real business, with only the name changed. This replaces the original guardrail that kept AM-1's phone, email, address, license, ratings and certifications off the demo record. Now on the Kynetic Roofing (Demo) company record: phone (541) 388-3621, address 52 SE 9th St, Bend OR 97702, Google rating 4.6 from 88 reviews. In the BUSINESS PROFILE note (attached to the company and the client account): website, emails, owners, 1993 start, CCB license, CertainTeed and GAF certifications, warranty wording. The website field is left empty on the demo company because Twenty does not allow the same domain on two companies.

**Remaining guardrails:**
1. No dials to the AM-1 office number from the demo or from test flows. Any call to AM-1 needs the owner's OK first. Owner gate (D-002) is not formally checked; Abdullah knows the owner personally.
2. Facts we could not verify (Meta ads, free estimate, financing, Facebook page, exact rating: 4.5 to 4.9 from 80 to 99) are never stated as facts in a pitch. Say "I couldn't find X on your site".
3. Free inspection is the offer under test, not a claim that AM-1 offers one.
4. Alex's spoken warranty line stays generic ("manufacturer warranties available on qualifying installs") unless Abdullah says to name the CertainTeed warranty.
5. Test calls go only to numbers the tester owns, with consent.

**Why:** It is Abdullah's method: copy a real, well run business, build the demo from it, pitch them, then rename. Here the business is a friend's, so the demo and the eventual client build are the same data.

**See also:** D-015, BUSINESS PROFILE: Kynetic Roofing (Demo), DEMO BRIEFING note, repo demo-business/PROFILE.md.

---

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

---

# D-020: Outbound retry cadence and calling window are as built (supersedes D-012 item 2)

_Twenty note `9a057779`, created 2026-10-17, updated 2026-10-17. Exported 2026-11-12._

## D-020: Outbound retry cadence and calling window are as built
**Status:** decided
**Date:** 2026-10-17

**Decision:** keep the retry behavior the n8n workflow "Outbound Speed to Lead" (m2YJwZ1l8DTzyEkw) already has. Abdullah chose it over the D-012 retry plan.
1. Attempt 1 goes out on form submit.
2. After a no-answer or voicemail on attempt 1, a fast retry runs about 90 seconds later. If the fast retry does not run, the 5-minute sweeper picks the lead up at +10 minutes.
3. After a no-answer or voicemail on attempt 2, the next try is about 60 minutes later (sweeper).
4. Maximum 3 attempts.
5. Calls only inside 8:00 to 21:00 in the lead's local time (time zone from ZIP, then area code). Outside the window the lead is queued for the local morning.

**Replaces:** D-012 item 2 (retries at 5 minutes, 1 hour and next day, maximum 4 attempts) and the 9:00 to 20:00 Pacific window in the build plan. The rest of D-012 stands.

**Why:** it is what is built, and the first attempt was tested end to end on Oct 15. The retry path itself has not run yet (the only lead booked on the first call).

**Source:** read from the live workflow on Oct 17, 2026 (nodes Wait 90 Seconds, Update Lead After Call, Find Leads Due for Retry, Resolve Lead Timezone). Repo mirror: docs/decisions.md D-020.

**See also:** D-012, D-014.

---

# Decision Index

_Twenty note `552d2872`, created 2026-10-13, updated 2026-11-09. Exported 2026-11-12._

# CURRENT RECONCILIATION — November 8, 2026 (PST)

Current business authority: canonical five-step roadmap 7bfdcb7e-4f49-4c1c-94b9-7ffc46d50747; frozen baseline v1 603fe300-c5df-49e9-9f04-b0582acd7816; scorecard 5c44b12e-44b4-4e60-a29b-c8c51ea589c0. Twenty owns business planning; GitHub owns technical evidence. Historical bodies below are retained for provenance, not executable current instructions.
Sequence: (1) consolidate; (2) sales-ready foundation and (3) reusable first delivery package run in parallel; (4) human cold-call remodelers and sign the FIRST THREE clients; (5) deliver, measure, refine templates and earn case studies, then expand channels/multi-location work. Do not require all later systems before selling.
First delivery package: Alex + ONE unified CRM deliverable + scheduling + essential follow-up. Standard portal integration, bespoke portal work and background automations are distinct scopes. Other system templates remain a preserved LATER backlog, not a prerequisite to selling.
Alex platform: ElevenLabs, with n8n on the Kynetic VPS orchestrating backend automation. Retell Alex is parked. Portal surfaces results/status/actions, not an automation editor. This planning correction is not a vendor configuration change or proof of live integrations.
Safety: never invoke or modify Nora, live Emily, live Alex agent_8201m5afn2rbeb7v29xfkhh1pjef, or Kynetic Restoration (Demo) under this cleanup. Use separate approved DEV/demo resources for future tests. No production deployment, calls, texts, messages, workflow activation, paid-plan change, schema change, or commercial-term invention is authorized here. Human cold outreach only; preserve consent, quiet-hours, kill-switch and counsel gates; no FL/OK, no HIPAA, AM-1 do-not-call, no Google Drive/Docs/Sheets. Use only TWENTY_BASE_URL + TWENTY_SELFHOST_API_KEY; never TWENTY_API_KEY or REST DELETE.

Commercial authority reconciliation: D-023 (93db3245-96ee-4fb8-8afd-73ae66985d95) is the dated approved October 24 pricing decision and expressly supersedes D-017. Do not ask Abdullah to choose again between those two historical decisions. Reconcile stale text against the approved record; later November 6 founding/standard/transformation figures are proposals unless a separate approval is evidenced. This cleanup does not approve those proposals, change financial terms, alter opportunity tier schema, or certify today's entire commercial package final.
Current remodeler guarantee, locked November 5 in Growth Playbook 21fba68a-226b-4693-834f-7408366adf11: “We book remodelers 20% more appointments than last month in 30 days, or we work free until we do.” Baseline is last month's booked appointments; client maintains last month's ads level and takes the appointments set. This is booked appointments, not guaranteed jobs/revenue. This replaces the older 14-day/month-fee-waiver guarantee only; it does not itself change the dated approved prices. Earlier 14-day operational plans may remain historical estimates, not this guarantee.

Decision index reconciliation: D-017 pricing is superseded by approved dated D-023. D-018 Retell-for-Alex is superseded by D-025 (ElevenLabs); Nora/Emily remain frozen. Old D-003 “build everything first” and D-013 five-client expansion gate are superseded as sequencing instructions by the November8 five-step roadmap. Latest remodeler guarantee is the November5 Growth Playbook entry, not D-023's older guarantee. ONE CRM replaces Lite/Full as a system deliverable; no new CRM price is decided here. Twenty is already self-hosted; old pending self-hosting/niche entries are historical. Do not invent a new numbered decision or reuse a number while repo/Twenty numbering differs.

---

## Historical pre-reconciliation body — retained verbatim; current guidance above takes precedence. Historical claims are not current proof or permission.

**Superseded Oct 24, 2026 by new pricing — see D-023: Current offer, pricing, niches and upsells.** Any old pricing or niches below ($4,675 first 3 / $8,500 after, $800 / $2,000 / $3,500 tiers, 1,200 minutes then 25¢/min, remodelers + foundation repair niche list, $30K goal) are no longer valid. Current: founding (first 3) $6,500 setup + 3 months (50% signing / 50% go-live), then $1,500/mo or $4,000 prepaid months 4–6; standard $10,000 (50/25/25: signing / go-live / day 45; month 4 free if paid in full), then $2,000/mo or $5,000 prepaid months 4–6. Software included, no per-minute charges (fair-use clause). Niches: remodelers (any), solar + battery, custom pools, windows + doors, decks + outdoor living; must be running Meta ads. Upsells: reactivation $3,000 or $1,000/mo; quote follow-up $2,500 + $500/mo; after-hours $1,500 + $500/mo. Goal: $100K signed contracts by Dec 31, 2026.

**Added Oct 25, 2026:** D-025 (ElevenLabs is the voice platform for Alex, v1 strict; text promise removed until Twilio A2P approves) partly supersedes D-018. **Next free number: D-026** (the repo branches use D-023 for the site rebuild and D-024 for the offer; reconcile with Twenty's D-023 when they merge).

# Decision Index
One line per numbered decision. Each one has its own note titled "D-0xx: ..." (DECISION, AUTOMATIONS_BUILD). Never edit an old decision; supersede it with a new one. The dated pre-number log is in "Decision History".

| # | Decision | Status |
|---|---|---|
| D-001 | Plan 1 price $1,500 + $997/mo | superseded by D-017 |
| D-002 | Owner gate: call owners only, drop front desk | decided; rewording pending |
| D-003 | Build first, switch outreach on once; don't oversell capacity | decided |
| D-004 | Voice first, SMS after A2P | decided |
| D-005 | not confirmed | not confirmed |
| D-006 | Twenty is the system of record | decided Sep 24 |
| D-007 | Hard sales and consent rules | decided |
| D-008 | Voice 11labs-Cimo | decided Oct 5 |
| D-009 | Full voice-agent build redone from scratch | Oct 5 |
| D-010 | Inbound and outbound are separate Retell agents; inbound paused | Oct 6 |
| D-011 | Outbound agent discloses AI + recording; consent stored in Twenty | Oct 6 |
| D-012 | v1 call handling: voicemail hang-up, retries, gpt-4.1 + Cimo | Oct 6 |
| D-013 | Two plans; Plan 1 only until 5 paying clients | Oct 6 (pricing superseded by D-017) |
| D-014 | v1 architecture: n8n form, two endpoints, light gate | Oct 7 |
| D-015 | Demo is Kynetic Roofing (roofing only), agent Alex | Oct 7 |
| D-016 | Demo built on AM-1 Roofing's profile; never dial AM-1 | Oct 8 |
| D-017 | 3-month packages $4,675 / $8,500, 50/25/25 invoices | superseded by D-023 (Oct 24) |
| D-018 | Retell is the platform, Vapi parked; workspaces abdullahblitz / kyneticai | Oct 13; Retell-for-Alex part superseded by D-025 |
| D-025 | ElevenLabs is the voice platform for Alex (v1 strict); text promise removed until Twilio A2P approves | Oct 25 |

Pending decision candidates: D-002 rewording; launch niche (roofing vs bath/foundation); self-hosting Twenty.

---

# Decision History (Aug 21–Oct 13, 2026; dated log before D-numbers)

_Twenty note `9829d593`, created 2026-09-24, updated 2026-10-25. Exported 2026-11-12._

**Superseded Oct 24, 2026 by new pricing — see D-023: Current offer, pricing, niches and upsells.** Any old pricing or niches below ($4,675 first 3 / $8,500 after, $800 / $2,000 / $3,500 tiers, 1,200 minutes then 25¢/min, remodelers + foundation repair niche list, $30K goal) are no longer valid. Current: founding (first 3) $6,500 setup + 3 months (50% signing / 50% go-live), then $1,500/mo or $4,000 prepaid months 4–6; standard $10,000 (50/25/25: signing / go-live / day 45; month 4 free if paid in full), then $2,000/mo or $5,000 prepaid months 4–6. Software included, no per-minute charges (fair-use clause). Niches: remodelers (any), solar + battery, custom pools, windows + doors, decks + outdoor living; must be running Meta ads. Upsells: reactivation $3,000 or $1,000/mo; quote follow-up $2,500 + $500/mo; after-hours $1,500 + $500/mo. Goal: $100K signed contracts by Dec 31, 2026.

Dated log kept as history. The numbered decisions (D-001 onward) are the canonical record; see 'Decision Index'.

Full chronological record of every dated decision made on the Kynetic AI account. Imported from Notion, most recent decisions at the bottom:

**Aug 21-22, 2026** — Geography stripped from all outreach-facing content. No geography qualifier at all, cold outreach lines reference the niche directly. No hyphens/dashes in script copy.

**Aug 21, 2026** — Twilio number purchase deferred to first paying client's deployment.

**Aug 21, 2026 (unresolved)** — CA-specific outreach references conflict with the locked national/niche-based ICP. Flagged, not yet resolved at time of that entry (later resolved Sep 8).

**Aug 21, 2026** — Demo business chosen: Chrome Water Damage Experts (Austin, TX), 5.0 stars, 14 reviews.

**Aug 21, 2026** — Offer structure for cold outreach confirmed: free audit + free demo, offered together.

**Aug 22, 2026** — Pillar 5 reference build saved: Inflate AI's Trades AI Receptionist (Retell + n8n), used as inspiration/reference, not spec.

**Aug 22, 2026** — Session handoff: build work continues in Claude Code.

**Aug 27, 2026** — Adopted SeldonFrame (open source AI front office for agencies) as the base for Kynetic's client-delivery CRM, rejecting trycompai/crm. Vendored into platform/seldonframe/ in the kynetic-ai repo. Existing stack (n8n, Modal, Apify, Retell/Twilio/Cal.com) unchanged.

**Aug 27, 2026** — First production deployment live at kynetic-ai-fawn.vercel.app (Vercel + Neon Postgres). LLM calls routed through OpenRouter.

**Sep 5, 2026** — Full client-facing document set created: Service Agreement, Welcome Packet, Invoice Template, Project Brief, Delivery Guide, Monthly Report, Payment Terms & Processor Setup, Thank You/Review/Referral Process, Feedback Doc, Package Menu. Payment processor: Stripe.

**Sep 6, 2026** — Outreach channels expanded to 3: Cold Calling, Cold SMS, Cold Voicemail Drop (Slybroadcast). Warm Outreach formally dropped.

**Sep 7, 2026** — TCPA Emergency-branch opt-out gap resolved. A burst pipe/storm damage does not qualify for TCPA's emergency exemption, and an inbound call alone does not create consent to text. Fix: one verbal consent turn added to the Retell agent's Emergency-case prompt before the SMS webhook fires.

**Sep 7, 2026** — Session closed, renamed SeldonFrame to Kynetic OS across 280 files. Referral incentive set at 30% of setup fee, paid on signing.

**Sep 8, 2026** — CA/geography contradiction resolved. No CA-specific outreach plan exists anywhere; all locked docs target nationally by niche. Stale CA references dropped.

**Sep 11, 2026** — Pillar 5 (Kynetic Restoration demo) built out in Claude Code: n8n side Notion-backed, TCPA-compliant, tested. Retell side untouched, Phase 3 next. Key build decisions: inline hardcoded values + bracket-token template instead of config-node concentration; Cal.com live booking on Abdullah's own account; n8n AI-agent model moved to OpenRouter (gemini-2.5-flash-lite for drafting agents, gemini-2.5-flash for reconciliation); Retell API key stays in .mcp.json; phone number purchase and real inbound-call payload capture dropped from this pass.

**Sep 16, 2026** — Full folder reorg executed. Offer Definition rewritten to the 3-system model (AI Speed-to-Lead Agent, Reputation Engine, Lead Recovery & Nurture), replacing the old 5-pillar model. Restoration job value corrected to $5,000-$9,000.

**Sep 16, 2026** — Pass 2 content audit: 7-Pillar language relabeled to the 3-System model across the whole workspace.

**Sep 16, 2026** — Master Tracker rebuilt into a lean Command Center. Stale trackers archived. Kynetic OS CRM Build Tracker folder dissolved.

**Sep 17, 2026** — System 1 and System 2 numbers swapped: Reputation Engine is now System 1, AI Speed-to-Lead Agent is now System 2. System 3 (Lead Recovery & Nurture) unchanged.

**Sep 24, 2026** — Twenty confirmed as the sole CRM and system of record for Kynetic AI, including all business tasks and demo build progress. SeldonFrame / Kynetic OS dropped entirely. Notion kept for reference and archive only. Demo business (Kynetic Restoration) added to Twenty as a company and client account; 30 tasks created covering the 3 systems and business work; System 2 build tracker copied into Twenty.

**Sep 25, 2026** — Outreach plan: follow the Meta Ads Library plan exactly as written, nothing extra added. Target businesses actively running Meta ads, build a CSV, enrich in Apollo (ownerphones.com as backup), cold call with a speed to lead offer, and pitch an inbound AI agent when the ad goes to a phone number. See "Meta Ads Outreach Plan (Launch Mon Sep 28)".

**Sep 25, 2026** — Cold calling starts Monday Sep 28 at 9am. Everything needed to sell and deliver must be done before Monday morning, including outbound Nora (calls form leads within 60 seconds) and the client template.

**Sep 25, 2026** — Must operate as a professional agency from day one: agreement, onboarding, client portal, reporting. Client facing timeline set: live in 7 days, portal by day 14, texts on after carrier approval (day 14 to 21), results review at day 30. See "Client Onboarding Map + Client Timeline".

**Sep 25, 2026** — Cold SMS at scale not being used for now due to personal legal exposure as a sole proprietor. Only one handwritten text after a missed call.

---

## Continued: Sep 26, 2026 onward (merged from 'Decision Log (Sep 26 onward)', archived Oct 13, 2026)

Continuation of the main Decision Log. Most recent at the bottom.

**Sep 26, 2026** — Kynetic AI is described as an AI implementation firm: "We audit how a business runs, find where it's losing time and money, and build and run the AI systems that fix it." No niche lock on the brand or website; niche landing pages per campaign.

**Sep 26, 2026** — Five stage business audit (lead acquisition, sales, onboarding, delivery, retention; every step as verb, owner, tool; color coded) run on Kynetic itself. Map in note "Business Audit: Five Stage Map (Sep 26, 2026)". Grey and red steps reviewed weekly and filled in over time.

**Sep 26, 2026** — Sales process: hybrid, 3 steps. Cold call books a demo, demo call with live Nora, then proposal and close. After signing, the five stage audit of the client is how further systems get sold.

**Sep 26, 2026** — Target niches: home service businesses with emergency calls (roofing, HVAC, restoration, plumbing).

**Sep 26, 2026** — Founding client pricing for the first 3 clients: ~~$750 setup + $997/mo~~ (superseded by D-017), speed to lead offer. A results guarantee will be offered; terms not yet set.

**Sep 26, 2026** — Cold calling starts once everything is built, no fixed date. This replaces the Monday Sep 28 start.

**Sep 26, 2026** — Demo: one Nora build with the business name and services swapped per niche via the [CLIENT] template.

**Sep 26, 2026** — Calls placed from Google Voice.

**Sep 26, 2026** — Cold call opener to be rewritten to drop the "I ran an audit before I called" line. Final wording later.

**Sep 26, 2026** — Quentin and Abdullah run Kynetic together. Quentin: main sales lead and tests every client system before go live. Abdullah: build and delivery. Quentin's lawyer contacts review the client agreement. Partnership terms, pricing and roles finalized at 5 clients.

**Sep 26, 2026** — Lead scraping, enrichment and loading into Twenty will be fully automated.

**Sep 26, 2026** — LLC formed after the second client.

**Oct 13, 2026** — D-017: Plan 1 is sold as 3-month packages at 15% off list ($4,675 for the first 3 clients, $8,500 after), billed as three Stripe invoices per client: 50% at start, 25% when built and sent for testing, 25% at completion. Goal $30K collected by Dec 31 from 5 clients (aim for 6). Replaces ~~$1,500 setup + $997/mo~~ (superseded by D-017); Quentin signed off Oct 13, 2026. Abdullah says the build and all Phase 7 launch gate items will be done by Oct 14, so dialing starts Oct 15 (75 a day). Math in "Q4 Revenue Plan: $30K by Dec 31, 2026".
