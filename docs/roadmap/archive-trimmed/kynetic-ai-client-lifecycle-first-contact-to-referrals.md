# [ARCHIVED 2026-11-09, reference only; plan superseded by ROADMAP 7bfdcb7e] Kynetic AI Client Lifecycle: First Contact to Referrals

_Twenty note `b19550f2`, created 2026-10-28, updated 2026-11-09. Exported 2026-11-12._

Source Page: https://cursor.com/canvas/store-aedc3439-bcce-49cc-b11f-5e32c7fc8ae4/f7ccad3a-5bf6-424b-a49f-c1d3098c69d0

Saved Oct 28, 2026.

The whole journey in 25 stages: 9 before signing, 12 in delivery and 4 after results. Each covers what happens, who owns it, the data it needs, what to automate with which tool, and build status. The Alex core is built; most of the pipeline around it is not.

## The cycle at a glance

| Stage | When | Owner today | Status |
| --- | --- | --- | --- |
| P1. Lead sourcing and list building | Ongoing, ahead of dialing | Abdullah (lead-engine work so far) | Not built |
| P2. List enrichment and verification | Before a record becomes dialable | Abdullah (assumption) | Not built |
| P3. Outreach | Daily | Quentin and Taha (Q6, Q8) | Partly built |
| P4. Follow-up | Same day to next callback | Quentin and Taha | Not built |
| P5. Booking the demo / audit call | On the call or right after | Quentin and Taha book; Abdullah runs it | Partly built |
| P6. Demo and informal audit | The audit call | Abdullah (audits and closing); Quentin closes too | Partly built |
| P7. Pricing calculator and proposal | End of the audit call or within a day (assumption) | Abdullah | Partly built |
| P8. Objection handling | On the demo and in follow-up | Abdullah, Quentin, Taha | Not built |
| P9. Closing | Demo call or follow-up | Abdullah and Quentin (Taha also sells) | Not built |
| 1. Contract and payment | Day 0 | Abdullah, Quentin or Taha (closing) | Not built |
| 2. Kickoff and onboarding intake | Days 0-2 | Abdullah + Quentin (Q7) | Partly built |
| 3. Access and integrations | Days 1-5 | Abdullah | Not built |
| 4. Baseline capture for the guarantee | Days 1-7 | Not assigned (assumption: Abdullah) | Not built |
| 5. Build and configure | Days 3-10 (assumption) | Abdullah (systems build, Q6) | Partly built |
| 6. QA and testing | Days 8-12 (assumption) | Abdullah; Quentin for the dry run (6.1) | Partly built |
| 7. Go-live | By day 14 (D-024 promise) | Abdullah | Not built |
| 8. First 30 days monitoring | Days 14-44 | Quentin (support), Abdullah (fixes) | Partly built |
| 9. Day 30 / 60 / 90 optimization | Days 30, 60, 90 | Abdullah | Not built |
| 10. Ongoing reporting and results tracking | Monthly | Abdullah (assumption) | Partly built |
| 11. Upsell audit | After day 30 (D-024) | Abdullah (audits) | Partly built |
| 12. Renewal or exit | Before month 3 ends | Not assigned (assumption: Abdullah) | Not built |
| R1. Results collection and proof | Day 90 onward (assumption) | Not assigned | Not built |
| R2. Client feedback / NPS | Assumption: after each day 30/60/90 review and at renewal | Quentin (support, assumption) | Not built |
| R3. Testimonials and reviews of Kynetic | After first results (assumption) | Not assigned | Not built |
| R4. Referral asks, tracking and rewards | 30-day check-in onward (task 5.8) | Not assigned | Not built |

- **7** Automations built
- **20** Partly built
- **61** Not built
- **2** Unknown

Stage status is the weakest link in that stage. Timings marked "assumption" are not from any decision; D-024's 14-day go-live is the only dated promise. Statuses come from repo docs as of Oct 24, 2026 (latest commit), so anything changed since then is not reflected.

## Rules that run through every stage

- Twenty is the only system of record. No Google Drive, Sheets or Docs anywhere in delivery.
- Support promise: respond within 12 hours (Q7). Quentin owns support today.
- Track hours per client in onboarding and support from client 1, so the first bottleneck shows in data (Q13).
- Clients 1-3 can run on checklists and hands; after client 3, move onboarding and support to bots (Q7).
- Never sign clients faster than they can be set up (D-003).
- Voice goes live day 1; SMS only after the client's A2P approves (D-004).
- Alex discloses it is an AI and that the call may be recorded (D-011). No AI cold calls, no cold SMS at scale (D-007).
- Customer-facing messages, workflow activation and any write to Twenty, n8n or Retell need your yes.

Hard rules for the pre-signing stages are constraints, not plan: a Do Not Call registry scrub before dialing; hand dialing only for now, with Q8's other channels after the first clients and cold SMS flagged for counsel as a TCPA risk; no prospecting in FL or OK; AM-1 Roofing is do-not-call. Sales Desk, Scout and Proof appear only as suggested bot owners.

## P1. Lead sourcing and list building

- **When:** Ongoing, ahead of dialing
- **What happens:** Build call lists of home service businesses in the D-024 trades that run Meta ads and fit Q2 (about $50K-100K+/mo and willing to grow). Main source: scraping (Meta Ad Library advertisers by trade and metro, then Maps and directories), topped up with purchased lists or manual research. Scraping is allowed as of Abdullah's Oct 28 decision.
- **Owner today:** Abdullah (lead-engine work so far)
- **Prospect or client receives:** Nothing yet; the prospect is not contacted at this stage.
- **Data needed:** Business name, Facebook Page ID, trade, state, owner name, published business phone, Meta ads evidence (active ad count), revenue signal, and a source URL for every cell.
- **Bot that could own it (suggestion):** Scout (runs and schedules the scrapes)

| Automate | System or tool | Status |
| --- | --- | --- |
| Meta Ad Library advertiser census (one DFW roofing pilot run Oct 20) | Apify actor + tools/lead_census.py | Partly built |
| Scheduled scrape by trade and metro, FL/OK dropped, results written straight into Twenty | Apify + n8n (or Modal) + Twenty; nothing built in Modal or n8n yet | Not built |
| Import purchased lists into Twenty as a supplement | Twenty import or n8n (vendor not chosen) | Not built |
| Manual research template: source URL per cell, verbatim owner quote | Twenty fields, method in docs/lead-engine-handoff.md | Partly built |
| Size of the lead pool for 200 dials a day | Twenty dashboard | Not built |

Constraint (hard rule, not plan): No prospecting in FL or OK. AM-1 Roofing is do-not-call. Twenty is the system of record.

The Oct 20 lead-engine handoff sized the launch gate at about 3,000 owner-gated numbers for 75 dials a day. Nobody has re-sized it for Q8's 200 a day. The Apify account is on the Free plan with a $5 monthly cap (KI-012).

## P2. List enrichment and verification

- **When:** Before a record becomes dialable
- **What happens:** Confirm the owner's name and the phone that reaches the owner, check the Meta ads are live, apply the owner gate (D-002), drop FL/OK and do-not-call records, and dedupe against Twenty.
- **Owner today:** Abdullah (assumption)
- **Prospect or client receives:** Nothing yet.
- **Data needed:** Owner name with a source quote, business phone with a source, ad check by Facebook Page URL or domain (never by exact-name search), state, do-not-call status.
- **Bot that could own it (suggestion):** Scout (runs the scrape, enrichment and audit step)

| Automate | System or tool | Status |
| --- | --- | --- |
| Gate at import: FL/OK excluded, AM-1 Roofing flagged do-not-call, duplicates merged | Twenty fields + n8n check | Not built |
| Do Not Call registry scrub before any record is dialable | Not chosen | Not built |
| Meta Ad Library check by Page URL or domain | Manual, method documented in the lead-engine docs | Partly built |
| Owner name and published phone from sites, BBB and registries (code-only rerun on 10 businesses Oct 20) | Firecrawl + tools/lead_enrich.py (paces and retries on 429s) | Partly built |
| Email find and verify, phone find (tested on 3 owners Oct 20) | Treg paid enrichment | Partly built |
| Hand-dial a sample to confirm which phone reaches the owner (KI-012) | Manual | Not built |

Constraint (hard rule, not plan): Do Not Call registry scrub before dialing. No FL or OK. AM-1 Roofing is do-not-call. Never guess an owner or phone.

The owner gate is in flux: D-002 drops businesses with a front desk, but Twenty notes say keep them. The reword is pending your yes (KI-011). Separate from scraping, the lead-engine docs still list two open items: calling the personal mobile numbers Treg returns is a TCPA question for counsel (1.4), and the Lane A rule against people-search and data-broker sites has no recorded reason.

## P3. Outreach

- **When:** Daily
- **What happens:** Hand-dial owners: 100 dials a day each from Quentin and Taha, 200 total (Q8). Pitch Alex as the fix for leads they already pay for (Q10 positioning).
- **Owner today:** Quentin and Taha (Q6, Q8)
- **Prospect or client receives:** A cold call from a human.
- **Data needed:** Daily dial list from Twenty, opener script, call outcome per dial.
- **Bot that could own it (suggestion):** Sales Desk (dial queue and daily counts)

| Automate | System or tool | Status |
| --- | --- | --- |
| Kynetic's own sales dials logged per call | Twenty call_logs object | Built |
| Daily dial queue per rep, filtered by state, do-not-call and local calling hours | Twenty view (assumption) | Not built |
| Dials, conversations and bookings per rep per day | Twenty 'Sales funnel' dashboard (goal still says $30K) | Partly built |
| Opener and voicemail script (4.1) | Repo doc | Partly built |

Constraint (hard rule, not plan): Hand dialing only for now. No AI-placed cold calls and no cold SMS at scale (D-007). Q8 plans cold email, cold SMS, referral offers, own ads, content and partnerships only after the first clients, and cold SMS carries a TCPA risk that was flagged for counsel. No FL or OK. Never dial AM-1 Roofing.

## P4. Follow-up

- **When:** Same day to next callback
- **What happens:** Work every 'call me back' and 'send me info': callback at the agreed time, a short info email after a real conversation, then another dial.
- **Owner today:** Quentin and Taha
- **Prospect or client receives:** Callback at the time they asked for; info email only if they asked for it.
- **Data needed:** Callback time, interest level, email address and permission to email, last outcome.
- **Bot that could own it (suggestion):** Sales Desk (callback reminders and email drafts)

| Automate | System or tool | Status |
| --- | --- | --- |
| Call outcome creates a callback task with a due time in Twenty | Twenty + n8n | Not built |
| 'Send info' email drafted for the rep to approve and send | n8n draft (manual send) | Not built |
| Prospect follow-up automation (open Twenty task) | Twenty + n8n | Not built |

Constraint (hard rule, not plan): No cold SMS. Customer-facing messages need approval before sending.

## P5. Booking the demo / audit call

- **When:** On the call or right after
- **What happens:** Book the owner into the audit call, confirm it and remind them, and rebook no-shows.
- **Owner today:** Quentin and Taha book; Abdullah runs it
- **Prospect or client receives:** Booking link or invite, confirmation and reminder texts.
- **Data needed:** Owner name, phone, email, business, SMS consent, time zone.
- **Bot that could own it (suggestion):** Sales Desk (reminders and no-show rebooks)

| Automate | System or tool | Status |
| --- | --- | --- |
| Opportunity created at DEMO_BOOKED (stages DEMO_BOOKED to CLOSED_WON/LOST exist) | Twenty | Partly built |
| Confirmation and reminder texts from the audit-call booking page (A2P approved Oct 28) | cal.com + Twilio | Unknown |
| No-show moves to NO_SHOW and creates a rebook task | Twenty + n8n | Not built |

The repo docs predate the A2P approval, so whether the texting workflow is wired up is unknown.

## P6. Demo and informal audit

- **When:** The audit call
- **What happens:** Live Alex demo plus qualifying questions that double as an informal audit (Q2): revenue, growth goal, ad spend and lead flow, how fast leads get called today, current booking numbers.
- **Owner today:** Abdullah (audits and closing); Quentin closes too
- **Prospect or client receives:** A live demo call from Alex and a read on where they lose leads.
- **Data needed:** Answers to the qualifying questions; the current booked appointments figure also seeds the guarantee baseline.

| Automate | System or tool | Status |
| --- | --- | --- |
| Demo agent Alex (Kynetic Roofing) and its workflow | Retell + n8n | Built |
| Audit page: fit verdict, leak math, solutions, pricing, talk track | site /audit (branch revamp/13-audit-tool, not deployed) | Partly built |
| Audit answers saved to the Twenty opportunity; stage to DEMO_HELD | Twenty + n8n | Not built |

Constraint (hard rule, not plan): Test and demo calls only to numbers the tester owns. Never dial the AM-1 office number on the demo record.

## P7. Pricing calculator and proposal

- **When:** End of the audit call or within a day (assumption)
- **What happens:** Q3: positioning answers go into the calculator, which produces a value-based offer. Founding clients (first 3) get the fixed $6,500 package. The proposal goes out and the stage moves to PROPOSAL_SENT.
- **Owner today:** Abdullah
- **Prospect or client receives:** One-page proposal with price, scope, payment schedule and guarantee.
- **Data needed:** Audit answers, job value, lead volume, close rate, chosen services, prices.
- **Bot that could own it (suggestion):** Sales Desk (drafts the proposal for your approval)

| Automate | System or tool | Status |
| --- | --- | --- |
| ROI calculator (unlisted presenter tool) | site /roi-calculator (branch feat/roi-calculator, not deployed) | Partly built |
| Pricing logic in the audit page | site /audit | Partly built |
| One-page proposal template (4.5) | Repo or portal (no Google Docs) | Not built |
| Proposal builder from the service catalog | Portal phase C | Not built |

Site deploys go to preview only.

## P8. Objection handling

- **When:** On the demo and in follow-up
- **What happens:** Answer the common objections (price, trust in AI, timing, 'we already call fast') with a shared script, and capture new ones.
- **Owner today:** Abdullah, Quentin, Taha
- **Prospect or client receives:** Straight answers, the guarantee, proof once case studies exist.
- **Data needed:** Objection logged per call, which answer worked, outcome.
- **Bot that could own it (suggestion):** Sales Desk (keeps the library current)

| Automate | System or tool | Status |
| --- | --- | --- |
| Demo script and objection library (4.2) | Repo doc | Not built |
| Objection tag on each call note and opportunity | Twenty field (needs your yes) | Not built |
| Weekly roll-up of top objections and win rate per answer | n8n reading Twenty | Not built |

Guarantee wording is on the list for the one-time lawyer review (Q12).

## P9. Closing

- **When:** Demo call or follow-up
- **What happens:** Get the yes, send the agreement and first invoice (hands off to delivery stage 1), mark CLOSED_WON, or CLOSED_LOST with a reason.
- **Owner today:** Abdullah and Quentin (Taha also sells)
- **Prospect or client receives:** Agreement and first invoice.
- **Data needed:** Accepted proposal, signer details, lost reason when it is a no.

| Automate | System or tool | Status |
| --- | --- | --- |
| CLOSED_WON trigger (shared with stage 1) | Twenty + n8n + Stripe | Not built |
| Capacity check before signing: open builds vs team time (D-003) | Twenty view | Not built |
| Lost reason captured and a later re-contact task created | Twenty + n8n | Not built |

Flag from Q12: form the LLC before the first client signs.

## Guarantee math

`Baseline = monthly booked appointments × 3`

`X = max(10, 0.2 × Baseline)`

Current monthly booked appointments (example input, not a client figure): 20

- **90-day baseline:** 60 appointments
- **20% of baseline:** 12
- **Guarantee target X (rounded up):** 12 more appointments in 90 days
- **Minimum applies?:** No

The minimum of 10 sets X whenever the client books fewer than about 17 appointments a month. Condition: the client keeps lead flow roughly steady. Remedy is extra free work until X is reached, never a refund (Q10). Rounding up is an assumption; the overview does not say how to round.

## 1. Contract and payment

- **When:** Day 0
- **What happens:** Follows the close in P9: the agreement is signed and the first payment is collected. Founding clients pay 50% of $6,500 at signing (D-024).
- **Owner today:** Abdullah, Quentin or Taha (closing)
- **Prospect or client receives:** Proposal, agreement, first invoice, welcome message.
- **Data needed:** Audit-call answers, chosen services, price, payment terms, client's legal name and signer, the Twenty opportunity.

| Automate | System or tool | Status |
| --- | --- | --- |
| Audit calculator that produces the offer | site /audit page (branch revamp/13-audit-tool, not deployed) | Partly built |
| Opportunity to CLOSED_WON triggers agreement + invoice 1 + welcome draft (tasks 4.6, 5.2) | Twenty + n8n + Stripe | Not built |
| Attorney-reviewed agreement template (4.7, 4.8) | Contract template + e-sign tool (tool not chosen) | Not built |
| One-page proposal template (4.5) | Portal proposal builder (Portal phase C) | Not built |

Q12: no LLC, lawyer or E&O insurance yet. Those sit in front of the first signature.

## 2. Kickoff and onboarding intake

- **When:** Days 0-2
- **What happens:** Kickoff call is booked, the client fills one intake form, the client account is created in Twenty and the portal account follows from it.
- **Owner today:** Abdullah + Quentin (Q7)
- **Prospect or client receives:** Kickoff booking link, intake form, portal invite (sent only after your one-click approval).
- **Data needed:** Business profile, services and offers, service area, hours, booking rules, qualifying questions, FAQs, owner contacts, brand voice.

| Automate | System or tool | Status |
| --- | --- | --- |
| Intake form creates client_accounts + checklist tasks from a Twenty template (5.1) | n8n form + Twenty | Not built |
| Kickoff booking | cal.com event type (kickoff type not created) | Not built |
| Twenty to portal client sync, upsert on twenty_company_id (Portal phase B) | n8n + portal POST /api/sync/clients | Not built |
| Portal client record and invite flow | Portal admin 'New client' form (manual today) | Partly built |
| Business profile write-up from intake | .claude/skills/brand-profile | Partly built |

## 3. Access and integrations

- **When:** Days 1-5
- **What happens:** Collect access to the lead source, calendar and any field service software, set the caller ID, and start the client's own A2P registration on day 1 because it takes 2-3 weeks (D-004).
- **Owner today:** Abdullah
- **Prospect or client receives:** Access checklist with step-by-step instructions, tracked in the portal.
- **Data needed:** Meta lead form or ads access, calendar access, CRM/FSM credentials, business details for A2P.

| Automate | System or tool | Status |
| --- | --- | --- |
| Access checklist with auto-reminders for missing items | Portal scope items + n8n reminders | Not built |
| Real Meta lead-form intake (today an n8n form stands in, D-014) | n8n + Meta lead ads | Unknown |
| Credentials go straight into n8n credentials, never into chat or logs | n8n | Not built |
| Per-client A2P registration | Twilio (Kynetic's own number is approved; client numbers are not) | Not built |

## 4. Baseline capture for the guarantee

- **When:** Days 1-7
- **What happens:** Record the client's current monthly booked appointments and lead volume, compute the guarantee target X, and get the client to sign off on it.
- **Owner today:** Not assigned (assumption: Abdullah)
- **Prospect or client receives:** Written baseline and guarantee target.
- **Data needed:** Current monthly booked appointments, monthly lead count (for the 'lead flow roughly steady' condition), and the evidence behind both.

| Automate | System or tool | Status |
| --- | --- | --- |
| Baseline questions inside the intake form | n8n form | Not built |
| Compute X and store baseline + X on the client account | n8n + new Twenty fields (need your yes) | Not built |
| Show target and progress in the portal | Portal results page | Not built |

## 5. Build and configure

- **When:** Days 3-10 (assumption)
- **What happens:** Copy the Alex template for the client: prompt, agent config, cal.com event type, n8n workflow settings, Twenty client account, caller ID. Add any purchased extras.
- **Owner today:** Abdullah (systems build, Q6)
- **Prospect or client receives:** Build progress on the portal timeline.
- **Data needed:** Intake profile, scripts, qualifiers, booking rules, calendar, caller ID.

| Automate | System or tool | Status |
| --- | --- | --- |
| Alex agent + 38-node Outbound Speed to Lead workflow (demo) | Retell + n8n m2YJwZ1l8DTzyEkw | Built |
| [CLIENT] bracket template + Add a Client guide (3.7); two hard-coded Set-node literals become variables | Repo + n8n + tools/retell.py | Not built |
| Create agent per client (dry run, --apply only with your yes) | tools/retell.py create-outbound | Built |
| Per-client config lookup | n8n Client Config Lookup 05HI35dhaWXweO5i (still reads Notion) | Partly built |

## 6. QA and testing

- **When:** Days 8-12 (assumption)
- **What happens:** Test calls to tester-owned numbers, retry path, duplicate check, calling hours, booking, Twenty logging, opt-out and webhook security. Client approves the script.
- **Owner today:** Abdullah; Quentin for the dry run (6.1)
- **Prospect or client receives:** Test call for sign-off.
- **Data needed:** Test numbers you own, test leads, the client's approval.

| Automate | System or tool | Status |
| --- | --- | --- |
| First-attempt call, booking and logging (tested Oct 15, 13.8 s to first ring) | n8n + Retell + Twenty + cal.com | Built |
| Retry path and duplicate-check test | Scripted test checklist | Not built |
| Post-call webhook auth (KI-005, task 3.6) | n8n | Not built |
| Launch gate checklist (7.1) | Repo doc, ticked from evidence | Not built |

## 7. Go-live

- **When:** By day 14 (D-024 promise)
- **What happens:** Switch the client's workflow on (your yes each time), connect the real lead source, tell the client, collect the go-live payment (founding: other 50%).
- **Owner today:** Abdullah
- **Prospect or client receives:** Go-live notice, how to read the portal, support channel and the 12-hour response promise.
- **Data needed:** Passed QA, client sign-off, live lead source.

| Automate | System or tool | Status |
| --- | --- | --- |
| Portal milestone done updates Twenty and triggers the matching Stripe invoice (Portal phase F) | Portal + n8n + Stripe | Not built |
| Go-live message drafted for your approval | n8n | Not built |
| SMS confirmations for the client's leads (only after the client's A2P approves) | Twilio | Not built |

## 8. First 30 days monitoring

- **When:** Days 14-44
- **What happens:** Watch every call and failure, speed to lead under 60 seconds, bookings and no-shows. Fix prompt issues. Answer support within 12 hours.
- **Owner today:** Quentin (support), Abdullah (fixes)
- **Prospect or client receives:** Weekly summary, alerts, support answers within 12 hours.
- **Data needed:** Retell call_analyzed data, Twenty interactions, cal.com bookings, support tickets.

| Automate | System or tool | Status |
| --- | --- | --- |
| Alert on failed call or failed retry | n8n nodes Alert Call Failed / Alert Retry Failed | Built |
| Daily results feeder to the portal (5.5); endpoint exists, nothing posts to it | n8n to /api/ingest/results | Partly built |
| Weekly summary + error alerts (5.6) | Scheduled n8n reading Twenty | Not built |
| Support queue with a 12-hour timer | Not chosen (Twenty task + n8n timer proposed) | Not built |
| Hours logged per client | Twenty (no time object exists yet) | Not built |

## 9. Day 30 / 60 / 90 optimization

- **When:** Days 30, 60, 90
- **What happens:** Q11: systems go in, get optimized at day 30 and day 60, and are fully optimized by day 90. Day 90 is also the guarantee check.
- **Owner today:** Abdullah
- **Prospect or client receives:** Review call, written list of changes, progress against the guarantee target.
- **Data needed:** Booking rate, failed or poor calls, retry results, client feedback, baseline and X.

| Automate | System or tool | Status |
| --- | --- | --- |
| Auto-create review tasks and a review booking at day 30/60/90 from the go-live date | n8n + Twenty + cal.com | Not built |
| Review pack: stats, worst calls, suggested prompt edits | n8n + Retell data | Not built |
| Safe prompt change path (edit spec, dry run, yes, apply) | docs/map/processes/change-alex.md + tools/retell.py | Built |

## 10. Ongoing reporting and results tracking

- **When:** Monthly
- **What happens:** Monthly report on leads, speed to lead, calls, bookings against baseline, guarantee progress, and hours spent on the client.
- **Owner today:** Abdullah (assumption)
- **Prospect or client receives:** Monthly report and a live portal dashboard.
- **Data needed:** The same data as stage 8, plus hours per client.

| Automate | System or tool | Status |
| --- | --- | --- |
| Monthly report (5.7) | Scheduled n8n reading Twenty | Not built |
| Client dashboard pages (results charts, timeline, documents) | Portal (blocked from real data by KI-006, KI-008) | Partly built |
| Per-call feed (call_events table) | Portal + post-call workflow | Not built |

## 11. Upsell audit

- **When:** After day 30 (D-024)
- **What happens:** Q3: after Alex, audit systems, operations and management, then propose what the business needs from the Q5 catalog.
- **Owner today:** Abdullah (audits)
- **Prospect or client receives:** Audit findings and a proposal.
- **Data needed:** Results so far, audit answers, catalog prices.

| Automate | System or tool | Status |
| --- | --- | --- |
| Service catalog + proposal builder + timeline estimator | Portal phase C | Not built |
| Emily inbound receptionist (paused, near-done) | Retell + n8n 0PwP1tUf4478lNbf | Partly built |
| Starts for missed-call text-back, reactivation, review + referral chain | n8n archive workflows | Partly built |

## 12. Renewal or exit

- **When:** Before month 3 ends
- **What happens:** Renew at 3, 6 or 12 months or month to month (Q11). Founding: $1,500/mo, or $4,000 prepaid for months 4-6 for a case study (D-024). On exit the client keeps their data and Kynetic keeps the systems, prompts and workflows.
- **Owner today:** Not assigned (assumption: Abdullah)
- **Prospect or client receives:** Renewal options and a results recap; on exit, a data export.
- **Data needed:** 90-day results, guarantee status, contract end date.

| Automate | System or tool | Status |
| --- | --- | --- |
| Renewal reminder and options ahead of the contract end | n8n + Twenty | Not built |
| Recurring billing | Stripe | Not built |
| Case study and referral ask (5.8) | n8n | Not built |
| Offboarding: data export, workflows off, number released | Twenty export + n8n checklist | Not built |

## R1. Results collection and proof

- **When:** Day 90 onward (assumption)
- **What happens:** Compare 90 days of bookings against the baseline and X, plus speed to lead, and turn the result into a before-and-after case study. Founding clients trade a case study for the $4,000 prepaid months 4-6 option (D-024).
- **Owner today:** Not assigned
- **Prospect or client receives:** A results recap; a case study draft to approve.
- **Data needed:** Baseline, X, booked appointments, speed-to-lead times, client's written permission to publish.
- **Bot that could own it (suggestion):** Proof

| Automate | System or tool | Status |
| --- | --- | --- |
| Before-and-after report from Twenty data | n8n reading Twenty | Not built |
| Case study draft for your and the client's approval | n8n draft | Not built |
| Publish permission stored on the client account | Twenty field (needs your yes) | Not built |

## R2. Client feedback / NPS

- **When:** Assumption: after each day 30/60/90 review and at renewal
- **What happens:** Short survey after each review; a low score opens a follow-up for you inside the 12-hour support promise.
- **Owner today:** Quentin (support, assumption)
- **Prospect or client receives:** A short survey.
- **Data needed:** Score, comment, date, client account.
- **Bot that could own it (suggestion):** Proof

| Automate | System or tool | Status |
| --- | --- | --- |
| Survey sent after each review | n8n + form | Not built |
| Score stored on the client account | Twenty field (needs your yes) | Not built |
| Low score creates a task for you | n8n + Twenty | Not built |

## R3. Testimonials and reviews of Kynetic

- **When:** After first results (assumption)
- **What happens:** Ask every client for a review and a short testimonial, the same no-gating rule as the Reputation Engine.
- **Owner today:** Not assigned
- **Prospect or client receives:** A review request and a testimonial ask.
- **Data needed:** Client contact, review link, testimonial permission.
- **Bot that could own it (suggestion):** Proof

| Automate | System or tool | Status |
| --- | --- | --- |
| Review and testimonial ask for every client | n8n (reuse the archived Review Request + Response + Referral Chain) | Partly built |
| Testimonials stored with permission | Twenty | Not built |

Constraint (hard rule, not plan): Ask every client; never steer unhappy ones away from public reviews (Google and FTC rules).

## R4. Referral asks, tracking and rewards

- **When:** 30-day check-in onward (task 5.8)
- **What happens:** Ask happy clients for introductions, tag each referred lead with its referrer in Twenty, and pay the reward when the referral signs.
- **Owner today:** Not assigned
- **Prospect or client receives:** Referral ask; a reward when a referral signs.
- **Data needed:** Referrer, referred business, lead source = referral, outcome, reward owed and paid.
- **Bot that could own it (suggestion):** Proof (asks), Sales Desk (tracks referred leads)

| Automate | System or tool | Status |
| --- | --- | --- |
| Referral ask and 30-day check-in (5.8) | n8n | Not built |
| Referrer and referral-source fields | Twenty (needs your yes) | Not built |
| Reward owed when the referred client pays | Twenty + n8n | Not built |

Reward type and amount are not decided. Q8 lists online referral offers as a later channel.

## Build order for 5 clients by Dec 31

| # | Build | Why | Needed before |
| --- | --- | --- | --- |
| 1 | Hard-rule gate at list import: FL/OK out, AM-1 do-not-call, dedupe, Do Not Call registry scrub | Constraints must hold before any list is dialed | Next dial list |
| 2 | Scheduled scrape and enrichment into Twenty (Apify census, Firecrawl lead_enrich.py, Treg), with the audit step kept | 200 dials a day needs a steady, refilled pool | Dialing at 200 a day |
| 3 | Dial queue per rep, dial logging and daily counts in Twenty | Measures Q8's 100 a day each | Dialing at 200 a day |
| 4 | Opener, demo script and objection library (4.1, 4.2) | Two reps need one script | Next demos |
| 5 | Audit booking: DEMO_BOOKED opportunity, confirmation and reminder texts, no-show rebook | A2P is now approved; no-shows cost demos | Next demos |
| 6 | Audit page and ROI calculator to preview, answers saved to Twenty, proposal template (4.5) | Q3 pricing runs through the calculator | Next demos |
| 7 | LLC, contract template, one lawyer review, E&O insurance | Nothing can be signed safely without them (Q12) | Client 1 signs |
| 8 | Close Alex gaps: webhook auth, retry and duplicate tests, caller ID check | The core product must be safe to run for a paying client | Client 1 go-live |
| 9 | Per-client Alex template + Add a Client guide (3.7) | Every client reuses it; biggest time saver | Client 1 build |
| 10 | Intake form to Twenty, with baseline, X and the access checklist (5.1) | Feeds build, guarantee and reporting | Client 1 kickoff |
| 11 | Hours-per-client log and 12-hour support queue | Q13 rule and the Q10 promise start at client 1 | Client 1 go-live |
| 12 | Weekly summary + error alerts (5.6) | Doubles as monitoring for every client | Client 1 week 1 |
| 13 | Closed-won automation: agreement, Stripe invoice 1, kickoff booking (5.2, 4.6) | Manual is fine for client 1; needed before signings stack up | Client 2 signs |
| 14 | Day 30/60/90 review tasks + monthly report with guarantee progress (5.7) | First client hits day 30 about 30 days after go-live | Client 1 day 30 |
| 15 | Portal must-fixes, then daily results feeder and Twenty-to-portal sync | The portal cannot hold real data until KI-006/KI-008 close | Client 3 (bots take over after 3, Q7) |
| 16 | Service catalog + proposal builder, upsell systems | Plan 2 is gated at 5 paying clients (D-013) | After client 5 |
| 17 | Referral ask and referrer tracking in Twenty (5.8) | Referrals are the cheapest next client | Client 1 day 30 |
| 18 | Feedback survey after each review | Catches problems before renewal | Client 1 day 30 |
| 19 | Results report, case study and testimonial ask | Founding clients trade a case study for prepaid months 4-6 | Client 1 day 90 |
| 20 | Renewal and offboarding automation | First renewal comes at the end of month 3 | Assumption: early 2027 |

"Needed before" is the latest point each piece can land, not a calendar date. The order is a recommendation; dates depend on when client 1 signs. Items 1-6 feed the pipeline, which is the bottleneck to 5 clients until the first one signs.

## Conflicts in the sources

> **Two guarantees are on record.** D-024 (Oct 24) says live in 14 days with booked appointments or that month's fee is waived. Q10 (Oct 26) says X more appointments in 90 days or we keep working for free. They may stack, but nothing says so.

- Pricing after founding: D-024 sets a $10,000 standard package; Q3 says value-based via the calculator. docs/progress.md still quotes the superseded D-017 price.
- Payment split: D-024 founding is 50/50 (signing / go-live) and standard is 50/25/25; the portal plan still describes D-017's three Stripe invoices.
- Upsell timing: D-024 sells upsells after day 30; D-013 gates Plan 2 systems until 5 paying clients.
- Upsell prices: D-024 prices reactivation ($3,000 one-time or $1,000/mo), quote follow-up ($2,500 + $500/mo) and after-hours/missed calls ($1,500 + $500/mo); the Q5 catalog review treated most services as unpriced.
- Client Config Lookup still reads Notion, which is legacy.
- Lead pool: the lead-engine handoff sized the launch gate for 75 dials a day; Q8 now plans 200.
- Lead engine: the Apify account is Free with a $5 monthly cap, below the $30 you expected (KI-012).
- Owner gate: D-002 drops front-desk businesses; Twenty notes say keep them (KI-011).

## Decisions you need to make

1. Which guarantee applies: 14-day, 90-day, or both.
2. How 'X more appointments' is counted (all Alex-booked appointments, or only those above baseline) and what evidence sets the baseline.
3. What counts as 'lead flow roughly steady'.
4. Standard pricing: D-024's $10,000 or the value-based calculator.
5. Whether upsells start at day 30 or wait for the 5-client gate.
6. Who owns baseline capture, QA and renewals, and Taha's role in delivery.
7. The support channel and whether the 12 hours are clock hours or business hours.
8. Where hours per client live in Twenty (a new object or field needs your yes).
9. E-sign tool, and Stripe automation versus manual links for clients 1-3.
10. Whether clients can see call transcripts or recordings in the portal (counsel question).
11. LLC, lawyer and E&O timing, all before the first signature.
12. Scraping budget and plan for Apify, Firecrawl and Treg, and whether to add a purchased list.
13. When to add Q8's other channels, and counsel's answer on cold SMS before it is used.
14. D-002 owner-gate reword, and whether personal mobile numbers from Treg may be dialed (counsel 1.4).
15. Which tool runs the Do Not Call registry scrub.
16. Referral reward type and amount.
17. Feedback survey format and timing.
18. Whether Sales Desk, Scout and Proof take the suggested stages.

## Sources

- /workspace/overview-interview.md (Q1-Q13)
- kynetic-ai/KYNETIC_CONTEXT.md
- kynetic-ai/docs/decisions.md (D-003, D-004, D-013, D-014, D-020, D-024)
- kynetic-ai/retell/builds/outbound-speed-to-lead/BUILD_PLAN.md
- kynetic-ai/docs/plans/PLAN1-REMAINING.md, PORTAL-BUILDOUT.md, AUDIT.md
- kynetic-ai/docs/known-issues.md, progress.md


