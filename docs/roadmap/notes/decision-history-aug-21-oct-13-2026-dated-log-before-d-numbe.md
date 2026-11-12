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
