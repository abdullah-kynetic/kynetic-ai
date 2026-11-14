# [ARCHIVED 2026-11-09, reference only; plan superseded by ROADMAP 7bfdcb7e] Kynetic AI Backend Systems: Build, Test, Deploy in 14 Days

_Twenty note `ca9e8c49`, created 2026-10-28, updated 2026-11-09. Exported 2026-11-12._

Source Page: https://cursor.com/canvas/store-aedc3439-bcce-49cc-b11f-5e32c7fc8ae4/d8e821f8-5edb-46fa-b18d-77beb0961337

Saved Oct 28, 2026.

Every backend system behind Kynetic, portal excluded: 15 internal ops systems and 11 client-facing services. Each one covers what it does, what exists, what is left, how to test it, and how it deploys per client inside D-024's 14-day go-live.

## All systems at a glance

| System | Status | Needed for client 1 | Owner |
| --- | --- | --- | --- |
| A0. Platform foundations | Partly built | Yes | Abdullah |
| A1. Lead sourcing and enrichment pipeline | Partly built | Yes (feeds every sale) | Abdullah; Scout suggested |
| A2. Dial gate: DNC, FL/OK, AM-1 | Not built | Yes | Abdullah; Scout suggested |
| A3. Dial queue for hand dialing | Partly built | Yes | Quentin and Taha use it; Sales Desk suggested |
| A4. Audit-call booking | Unknown | Yes | Abdullah; Sales Desk suggested |
| A5. Proposal and pricing calculator | Partly built | Yes | Abdullah; Sales Desk suggested |
| A6. Contract and invoicing triggers | Not built | Yes (manual allowed for client 1) | Abdullah |
| A7. Client intake into Twenty | Not built | Yes | Abdullah and Quentin (Q7) |
| A8. Per-client config | Partly built | Yes | Abdullah |
| A9. Monitoring and alerting | Partly built | Yes | Abdullah |
| A10. Support queue with the 12-hour SLA | Not built | Yes | Quentin |
| A11. Hours tracking per client | Not built | Yes | Everyone logs; Abdullah reviews |
| A12. Reporting and results tracking | Not built | Yes | Abdullah; Proof suggested |
| A13. Day 30 / 60 / 90 reviews | Partly built | Before client 1 day 30 | Abdullah |
| A14. Feedback, testimonials and referrals | Not built | Before client 1 day 30 | Not assigned; Proof suggested |
| B1. Alex, the speed-to-lead agent | Partly built | Yes (core offer) | Abdullah |
| B2. Paid ads management | Not built | No | Not assigned |
| B3. Emily, inbound AI receptionist (2a / 2b / 2c) | Partly built | Likely first add-on (assumption) | Abdullah |
| B4. Lead Recovery & Nurture (with old-lead reactivation) | Partly built | Likely first add-on (assumption) | Abdullah |
| B5. Estimate and quote follow-up | Not built | No | Abdullah |
| B6. Reputation Engine | Partly built | No | Abdullah |
| B7. Online Presence Management | Not built | No | Not assigned |
| B8. Scheduling and dispatch | Partly built | No | Abdullah |
| B9. Maintenance plans and repeat-service reminders | Not built | No | Abdullah |
| B10. Referral automation (client's customers) | Partly built | No | Abdullah |
| B11. CRM Lite and CRM Full (backend only) | Partly built | No | Abdullah |

> **SMS cannot reliably go live inside 14 days.** Each client's own A2P registration takes 2-3 weeks (D-004). Alex is voice and can launch by day 14; SMS parts of Emily 2a, Lead Recovery, reminders and confirmations wait for the client's approval. Kynetic's approved campaign covers Kynetic's own booking texts, not client traffic.

Statuses come from the repo docs (latest commit Oct 24) plus the Oct 28 A2P approval. Setup effort is marked as an assumption everywhere; no hours are estimated. Standing rules apply throughout: never touch Nora, Emily, Retell agent tools or Kynetic Restoration (Demo); every write to Twenty, n8n or Retell and every activation needs your yes.

## A. Internal ops backend

Systems that run Kynetic itself: finding and closing clients, onboarding them, and keeping delivery on promise. Open a system to see its full spec.

## A0. Platform foundations

- **Purpose:** The shared base every other system runs on: CRM, automation engine, voice, SMS, calendar, backups and secrets.
- **Status:** Partly built
- **Built today:** Twenty self-hosted with nightly backups (14 days) plus encrypted R2 copies (30 days). n8n backups in git. Kynetic's Twilio A2P approved Oct 28. Self-hosting n8n is planning only (3.10).
- **Components:** Self-hosted Twenty v2.46.0 at crm.kyneticai.com; n8n Cloud; Retell (abdullahblitz workspace for new builds); Twilio; cal.com; n8n workflow backups in git; secrets in .env and cloud environment variables.
- **Integrations:** Twenty MCP and API (100 requests per 60 seconds per key), n8n Twenty node with credential 41C04qbmnbi0GI2P, Retell API via tools/retell.py.
- **Data in Twenty:** Custom objects client_accounts, client_jobs, end_customers, customer_interactions, call_logs, invoices, expenses; opportunity stages DEMO_BOOKED to CLOSED_WON/LOST.
- **Owner:** Abdullah

- Left to build: Header auth on the post-call webhook and rotate the committed path (KI-005, AUDIT #2).
- Left to build: Hard-coded deny list of Nora, Emily and Kynetic Restoration (Demo) ids inside tools/retell.py (AUDIT #1).
- Left to build: Make tools/n8n_backup.py keep files missing from n8n instead of deleting them (AUDIT #3).
- Left to build: One error-trigger workflow that every client workflow reports to.

| Test | Plan |
| --- | --- |
| Unit / workflow | Run tools/n8n_backup.py --check; dry-run every tools/retell.py write; check the deny list refuses each protected id. |
| End-to-end (test client) | Restore last night's Twenty backup to a scratch instance and open a record (no restore test recorded yet). |
| Failure and retry | Post to the webhook without the secret and confirm it is rejected; hit the Twenty rate limit and confirm n8n retries. |
| Compliance | No secrets in git or messages; Twenty is the only system of record; no Google Drive, Sheets or Docs. |

- **Deployment:** Internal, set up once. Not per client.
- **Deploy checklist:** Webhook auth on → Deny list in retell.py → Backup restore tested → Error workflow wired
- **Setup effort:** One-time (assumption: small to medium)

## A1. Lead sourcing and enrichment pipeline

- **Purpose:** Keep a refilled pool of owner-verified, Meta-ad-running prospects for 100 dials a day each from Quentin and Taha (Q8).
- **Status:** Partly built
- **Built today:** Pilots ran Oct 19-20 (Run B, Apify DFW census, Treg on 3 owners, Firecrawl rerun on 10). Nothing scheduled in n8n or Modal. Apify account is Free with a $5 monthly cap (KI-012).
- **Components:** Apify Meta Ad Library census (tools/lead_census.py), Maps lookup for instant-form advertisers, Firecrawl owner and phone enrichment (tools/lead_enrich.py), Treg email find and verify, audit step, Twenty import.
- **Integrations:** Apify, Firecrawl, Treg, Twenty API.
- **Data in Twenty:** companies fields already created: Engine status (DIAL_READY/HOLD), Meta Page ID, Facebook Page, Live ads, Oldest ad, New ads (30d), est. ad spend low/high, Engine reason, State.
- **Owner:** Abdullah; Scout suggested

- Left to build: Geography filter and AI-receptionist detector in lead_enrich.py (handoff next steps).
- Left to build: Scheduled runs by trade and metro, written straight into Twenty with dedupe.
- Left to build: Spend cap and run log per batch.
- Left to build: Re-size the pool for 200 dials a day (the handoff sized it for 75).

| Test | Plan |
| --- | --- |
| Unit / workflow | Fixture tests for phone normalizing, BBB name matching (first two distinctive words), state parsing. |
| End-to-end (test client) | Re-run the DFW roofing answer key: it must find Joe Hall and Rainstone and write them to Twenty as DIAL_READY with sources. |
| Failure and retry | Firecrawl 429 bursts (pacing and retry), Apify cap reached mid-run, Twenty rate limit, wrong-business match caught by the audit. |
| Compliance | Every non-unknown cell has a source URL; owner names need a verbatim quote; FL and OK never written as dialable. |

- **Deployment:** Internal scheduled job, not per client.
- **Deploy checklist:** Filters added → Schedule set → Twenty write with dedupe → Audit sample per batch
- **Setup effort:** One-time (assumption: medium)

## A2. Dial gate: DNC, FL/OK, AM-1

- **Purpose:** No record reaches a dial queue unless it passes every hard rule.
- **Status:** Not built
- **Built today:** Nothing built. The demo record carries the real AM-1 office number, so the block must exist before any list touches the queue.
- **Components:** Do Not Call registry scrub, state exclusion (FL, OK), AM-1 Roofing block, internal do-not-call list, duplicate merge, owner gate (D-002).
- **Integrations:** DNC scrub tool (not chosen), Twenty, n8n.
- **Data in Twenty:** New fields needed (your yes): dialable, dncStatus, dncCheckedAt, doNotCall reason.
- **Owner:** Abdullah; Scout suggested

- Left to build: Choose the DNC scrub tool
- Left to build: Gate workflow run at import and before each day's queue
- Left to build: Re-scrub cadence (counsel to confirm)

| Test | Plan |
| --- | --- |
| Unit / workflow | Case table: FL address, FL area code with a non-FL address, OK, AM-1 by phone and by company, a DNC-listed number, a duplicate. |
| End-to-end (test client) | Import a seeded test list holding each case; only the clean records become dialable. |
| Failure and retry | Scrub tool down: records stay not dialable (fail closed), alert sent. |
| Compliance | Constraint, not plan: DNC scrub before dialing, no FL or OK, AM-1 is do-not-call. Counsel task 1.4 still open. |

- **Deployment:** Internal, set up once.
- **Deploy checklist:** Tool chosen → Fields approved → Seeded test passes → Fail-closed tested
- **Setup effort:** One-time (assumption: small)

## A3. Dial queue for hand dialing

- **Purpose:** Give each rep a ready list every day and capture every outcome.
- **Status:** Partly built
- **Built today:** call_logs object and the dashboard exist. Queue views, callback automation and daily counts do not.
- **Components:** Twenty view per rep (dialable, in local calling hours), outcome picklist, callback task on 'call me back', daily counts per rep.
- **Integrations:** Twenty, n8n. Dialing phone: Google Voice is named in task 4.2; the actual setup is unknown.
- **Data in Twenty:** call_logs (built, for Kynetic's own sales dials), tasks, 'Sales funnel' dashboard (goal still says $30K).
- **Owner:** Quentin and Taha use it; Sales Desk suggested

- Left to build: Per-rep queue views
- Left to build: Outcome to callback task
- Left to build: Daily dials, conversations and bookings per rep
- Left to build: Dashboard goal updated to D-024's $100K

| Test | Plan |
| --- | --- |
| Unit / workflow | Each outcome value maps to the right next step. |
| End-to-end (test client) | Log a set of test outcomes; callback tasks appear with the right due time; the daily count matches. |
| Failure and retry | Rep logs a dial twice: one record. Callback due outside the calling window moves to the next window. |
| Compliance | Constraint: hand dialing only for now; no AI-placed cold calls or cold SMS at scale (D-007). Calling window for cold calls: counsel to confirm. |

- **Deployment:** Internal.
- **Deploy checklist:** Views built → Callback automation tested → Counts verified
- **Setup effort:** One-time (assumption: small)

## A4. Audit-call booking

- **Purpose:** Turn a yes on the phone into a booked, confirmed, reminded audit call.
- **Status:** Unknown
- **Built today:** A2P is approved for these texts. Whether the texting workflow is wired up is not in the repo docs.
- **Components:** cal.com audit event, Twilio confirmation and reminder texts, opportunity at DEMO_BOOKED, no-show to NO_SHOW plus a rebook task.
- **Integrations:** cal.com, Twilio (A2P approved Oct 28), Twenty, n8n.
- **Data in Twenty:** Opportunity stages exist; prospect SMS consent field (assumption: new).
- **Owner:** Abdullah; Sales Desk suggested

- Left to build: Opportunity created on booking
- Left to build: No-show rebook flow
- Left to build: STOP and HELP handling logged in Twenty

| Test | Plan |
| --- | --- |
| Unit / workflow | Reminder times computed in the prospect's time zone. |
| End-to-end (test client) | Book a test slot with your own number: confirmation, reminder, reschedule and cancel all land and update Twenty. |
| Failure and retry | Twilio send fails: alert and retry; cal.com webhook missed: nightly reconcile. |
| Compliance | SMS consent captured on the booking form; STOP honored at once. |

- **Deployment:** Internal.
- **Deploy checklist:** Texts verified → Twenty stage updates → STOP tested
- **Setup effort:** One-time (assumption: small)

## A5. Proposal and pricing calculator

- **Purpose:** Q3: audit answers produce a value-based offer and a one-page proposal.
- **Status:** Partly built
- **Built today:** Both calculators exist on unmerged branches (revamp/13-audit-tool, feat/roi-calculator). No proposal template.
- **Components:** /audit page (fit verdict, leak math, solutions, pricing, talk track), /roi-calculator, proposal template (4.5), answers saved to the opportunity.
- **Integrations:** Site (Astro; deploys go to preview only), Twenty, n8n.
- **Data in Twenty:** Opportunity amount, stage PROPOSAL_SENT, audit answer fields (new, your yes).
- **Owner:** Abdullah; Sales Desk suggested

- Left to build: Proposal template
- Left to build: Save answers to Twenty
- Left to build: Settle value-based vs D-024 standard pricing

| Test | Plan |
| --- | --- |
| Unit / workflow | Calculator cases checked by hand against D-024 founding and standard prices. |
| End-to-end (test client) | Run a mock audit, generate the proposal, see the opportunity move to PROPOSAL_SENT. |
| Failure and retry | Missing answer blocks the proposal instead of guessing. |
| Compliance | Guarantee wording waits for the one-time lawyer review (Q12). |

- **Deployment:** Internal; site changes to preview only.
- **Deploy checklist:** Template approved → Preview deploy → Twenty write tested
- **Setup effort:** One-time (assumption: small)

## A6. Contract and invoicing triggers

- **Purpose:** CLOSED_WON sends the agreement and invoice 1; go-live and later milestones send the rest.
- **Status:** Not built
- **Built today:** Nothing built (4.6, 4.7, 4.8). No LLC, lawyer or E&O yet (Q12).
- **Components:** Agreement template plus e-sign, Stripe invoice 1 at signing, invoice 2 at go-live (founding 50/50; standard 50/25/25 with day 45), recurring from month 4.
- **Integrations:** Twenty, n8n, Stripe, e-sign tool (not chosen).
- **Data in Twenty:** invoices object (exists), opportunity stage, client account go-live date.
- **Owner:** Abdullah

- Left to build: LLC and attorney-reviewed agreement
- Left to build: CLOSED_WON workflow
- Left to build: Payment webhook to Twenty
- Left to build: Recurring billing

| Test | Plan |
| --- | --- |
| Unit / workflow | Milestone to invoice mapping for founding and standard terms. |
| End-to-end (test client) | Stripe test mode: a test opportunity to CLOSED_WON creates exactly one invoice 1; marking go-live creates exactly one invoice 2. |
| Failure and retry | Re-fired trigger creates no duplicate; failed payment alerts you. |
| Compliance | Invoices issued by the legal entity; every customer-facing send needs your approval. |

- **Deployment:** Internal; per client it reads the terms from the opportunity.
- **Deploy checklist:** Entity formed → Template reviewed → Stripe test mode passes → Live with your yes
- **Setup effort:** One-time (assumption: medium)

## A7. Client intake into Twenty

- **Purpose:** One form creates everything a build needs and starts the clock.
- **Status:** Not built
- **Built today:** Nothing built. Brand-profile skill can write the business profile from intake answers.
- **Components:** n8n intake form; client_accounts record; checklist tasks cloned from a template (5.1); baseline and guarantee X; access checklist; kickoff booking.
- **Integrations:** n8n form, Twenty, cal.com.
- **Data in Twenty:** client_accounts plus new fields (your yes): baselineMonthlyBookings, guaranteeX, monthlyLeadCount, goLiveDate, a2pStatus.
- **Owner:** Abdullah and Quentin (Q7)

- Left to build: Form
- Left to build: Template task list
- Left to build: Baseline and X calculation
- Left to build: Missing-item reminders

| Test | Plan |
| --- | --- |
| Unit / workflow | X = max(10, 0.2 × monthly bookings × 3) for a set of inputs. |
| End-to-end (test client) | Submit intake for a made-up test client (never the Kynetic Restoration demo); every record and task appears. |
| Failure and retry | Double submission updates the same account; missing fields trigger a reminder, not a half-built record. |
| Compliance | Credentials never collected in the form; they go straight into n8n credentials. |

- **Deployment:** Internal; runs per client.
- **Deploy checklist:** Fields approved → Form live → Test client passes
- **Setup effort:** One-time (assumption: small)

## A8. Per-client config

- **Purpose:** Every client's settings live in one place so templates never carry hard-coded values.
- **Status:** Partly built
- **Built today:** Client Config Lookup 05HI35dhaWXweO5i exists but reads Notion (legacy). Agent id and caller ID are literals in two Set nodes (AUDIT #6).
- **Components:** Config record per client (agent id, caller ID, cal.com event type, time zone, calling window, business facts, qualifiers); Client Config Lookup sub-workflow.
- **Integrations:** Twenty, n8n.
- **Data in Twenty:** client_accounts config fields (new, your yes).
- **Owner:** Abdullah

- Left to build: Move lookup to Twenty
- Left to build: Replace the two literals with lookups
- Left to build: [CLIENT] bracket template (3.7)

| Test | Plan |
| --- | --- |
| Unit / workflow | Lookup returns the right config for each of two test clients. |
| End-to-end (test client) | Two test clients run side by side; no call or booking uses the other client's settings. |
| Failure and retry | Missing config stops the workflow and alerts, never falls back to the demo. |
| Compliance | Never touch Nora, Emily or Kynetic Restoration (Demo) records. |

- **Deployment:** Internal; one record per client.
- **Deploy checklist:** Lookup on Twenty → Isolation test passes
- **Setup effort:** One-time (assumption: small)

## A9. Monitoring and alerting

- **Purpose:** Catch a broken call path before the client does.
- **Status:** Partly built
- **Built today:** Call and retry failure alerts exist in the Alex workflow.
- **Components:** Alert Call Failed and Alert Retry Failed nodes; workflow error trigger; sweeper heartbeat; daily check for leads with no call and calls slower than 60 seconds.
- **Integrations:** n8n, Retell, Twenty, email.
- **Data in Twenty:** end_customers firstRingAt and formSubmittedAt give speed to lead.
- **Owner:** Abdullah

- Left to build: Error trigger for all workflows
- Left to build: Heartbeat
- Left to build: Daily anomaly check

| Test | Plan |
| --- | --- |
| Unit / workflow | Speed-to-lead calculation from the two timestamps. |
| End-to-end (test client) | Force a failed call on a test client; the alert arrives. |
| Failure and retry | Pause the sweeper; the heartbeat alert fires. |
| Compliance | Alerts carry no secrets. |

- **Deployment:** Template; each client workflow points at the shared error workflow.
- **Deploy checklist:** Error workflow linked → Heartbeat on → Forced failure tested
- **Setup effort:** Per client (assumption: small)

## A10. Support queue with the 12-hour SLA

- **Purpose:** Every client request answered within 12 hours (Q7).
- **Status:** Not built
- **Built today:** Nothing built. Quentin owns support.
- **Components:** One intake channel (not chosen), a Twenty task per request with a due time 12 hours out, escalation before the deadline.
- **Integrations:** Twenty, n8n, chosen channel.
- **Data in Twenty:** tasks linked to client_accounts; firstResponseAt (new, your yes).
- **Owner:** Quentin

- Left to build: Pick the channel
- Left to build: Clock hours vs business hours
- Left to build: Escalation path

| Test | Plan |
| --- | --- |
| Unit / workflow | Due-time math across nights and weekends for the chosen rule. |
| End-to-end (test client) | Send a test request; task created, Quentin notified, response logged. |
| Failure and retry | Leave it unanswered; escalation reaches you before 12 hours. |
| Compliance | Client data stays in Twenty. |

- **Deployment:** Internal; each client gets the same channel.
- **Deploy checklist:** Channel chosen → Escalation tested
- **Setup effort:** One-time (assumption: small)

## A11. Hours tracking per client

- **Purpose:** Q13: time per client in onboarding and support from client 1, so the first bottleneck shows in data.
- **Status:** Not built
- **Built today:** No time object in Twenty.
- **Components:** Time entry record (client, person, stage, minutes, date) and a quick entry form.
- **Integrations:** Twenty, n8n form.
- **Data in Twenty:** New object (your yes).
- **Owner:** Everyone logs; Abdullah reviews

- Left to build: Object
- Left to build: Entry form
- Left to build: Weekly roll-up per client and stage

| Test | Plan |
| --- | --- |
| Unit / workflow | Roll-up sums match the entries. |
| End-to-end (test client) | Log a test client's onboarding; the roll-up shows it by stage. |
| Failure and retry | Entry with no client is rejected. |
| Compliance | None beyond the Twenty rule. |

- **Deployment:** Internal.
- **Deploy checklist:** Object approved → Form live
- **Setup effort:** One-time (assumption: small)

## A12. Reporting and results tracking

- **Purpose:** Weekly summary (5.6), monthly report (5.7) and progress against the baseline and X.
- **Status:** Not built
- **Built today:** The data fields exist from the Alex build; no report job.
- **Components:** Scheduled n8n jobs reading Twenty; drafts for your approval before they go to clients.
- **Integrations:** n8n, Twenty, email.
- **Data in Twenty:** end_customers (leadStatus, attemptCount, firstRingAt), customer_interactions (outcome, bookedSlot), baseline and X on the account.
- **Owner:** Abdullah; Proof suggested

- Left to build: Weekly summary
- Left to build: Monthly report
- Left to build: Guarantee progress line

| Test | Plan |
| --- | --- |
| Unit / workflow | Each metric checked against a hand query on test data. |
| End-to-end (test client) | One week of test leads on a test client produces a correct summary. |
| Failure and retry | Zero-lead week reports zero and flags it rather than failing. |
| Compliance | Client-facing reports need your approval. |

- **Deployment:** Template plus the client's account id.
- **Deploy checklist:** Metrics verified → Approval step on
- **Setup effort:** Per client (assumption: small)

## A13. Day 30 / 60 / 90 reviews

- **Purpose:** Q11: optimize at day 30 and 60, fully optimized by day 90; day 90 is the guarantee check.
- **Status:** Partly built
- **Built today:** The change path (edit spec, dry run, your yes, apply) is documented in docs/map/processes/change-alex.md.
- **Components:** Review tasks and a review booking from the go-live date, review pack (stats, worst calls, suggested edits), safe prompt change path.
- **Integrations:** n8n, Twenty, cal.com, Retell.
- **Data in Twenty:** goLiveDate on the account, tasks.
- **Owner:** Abdullah

- Left to build: Scheduled tasks
- Left to build: Review pack
- Left to build: Day 90 guarantee check

| Test | Plan |
| --- | --- |
| Unit / workflow | Dates computed from the go-live date. |
| End-to-end (test client) | Back-date a test client's go-live; the day 30 task and pack appear. |
| Failure and retry | Go-live date missing: alert, no tasks. |
| Compliance | Prompt changes need your yes; never edit protected agents. |

- **Deployment:** Template.
- **Deploy checklist:** Schedule tested → Pack reviewed
- **Setup effort:** Per client (assumption: small)

## A14. Feedback, testimonials and referrals

- **Purpose:** Survey after reviews, testimonials for Kynetic, referral asks and rewards.
- **Status:** Not built
- **Built today:** The archived Review Request + Response + Referral Chain workflow is a starting point (Notion-based).
- **Components:** Survey send, score on the account, low-score task, review and testimonial ask, referrer fields, reward owed.
- **Integrations:** n8n, Twenty, Twilio or email.
- **Data in Twenty:** New fields (your yes): feedbackScore, referrer, referralSource, rewardStatus.
- **Owner:** Not assigned; Proof suggested

- Left to build: Survey format
- Left to build: Reward type and amount
- Left to build: Twenty fields

| Test | Plan |
| --- | --- |
| Unit / workflow | Referral links tie back to the right referrer. |
| End-to-end (test client) | Test client gets the survey, gives a low score, task appears; a referred test lead shows its referrer. |
| Failure and retry | Duplicate referral credited once. |
| Compliance | Ask every client for a review; no gating. |

- **Deployment:** Internal.
- **Deploy checklist:** Fields approved → Flow tested
- **Setup effort:** One-time (assumption: small)

## B. Client delivery systems

One per Q5 catalog service, Alex first. Every one follows the same pattern: a template, a per-client config record in Twenty, a deploy checklist, and activation only with your yes.

## B1. Alex, the speed-to-lead agent

- **Purpose:** Call every new lead within 60 seconds, qualify, and book the appointment.
- **Status:** Partly built
- **Built today:** Built and live for the Kynetic Roofing demo; one end-to-end run Oct 15 (13.8 s to first ring, booked, logged). Prompt v1.2.3 sits unmerged on a branch.
- **Components:** Retell agent (gpt-4.1, 11labs-Cimo); n8n Outbound Speed to Lead (38 nodes): form, normalize, 24-hour duplicate check, gate, Twenty lead, time zone, 8:00-21:00 lead-local window, Retell call; call_analyzed webhook; 90-second fast retry, 5-minute sweeper, max 3 attempts (D-020); native cal.com tools.
- **Integrations:** Retell, n8n, Twenty, cal.com, lead source (today an n8n form standing in for Meta lead forms, D-014).
- **Data in Twenty:** end_customers (14 lead fields incl. consent text and timestamp), customer_interactions (outcome, bookedSlot), client_accounts.
- **Owner:** Abdullah

- Left to build: Webhook auth (KI-005)
- Left to build: Retry and duplicate tests
- Left to build: Caller ID confirmed not Nora's
- Left to build: [CLIENT] template (3.7)
- Left to build: Real Meta lead-form intake
- Left to build: Counsel sign-off (1.4)

| Test | Plan |
| --- | --- |
| Unit / workflow | E.164 normalizing, time zone from ZIP then area code, window gate, retry scheduling. |
| End-to-end (test client) | Test client with its own cal.com event: submit a lead to your own phone, call inside 60 seconds, book, logged in Twenty. |
| Failure and retry | No answer to 90-second retry to +60 minutes then stop at 3; voicemail hang-up; Retell error alert; out-of-window lead waits for local morning; duplicate within 24 hours blocked. |
| Compliance | AI and recording disclosure opener (D-011); consent stored; opt-out honored; test calls only to numbers you own; never dial AM-1. |

- **Deployment:** Template plus per-client config: create-outbound dry run, your yes, --apply; clone workflow inactive; set config; your yes to activate.
- **Deploy checklist:** Config record → Agent created → cal.com event → Workflow cloned and pointed at config → Lead source connected → Tests passed → Activated with your yes
- **Setup effort:** Per client (assumption: medium)

## B2. Paid ads management

- **Purpose:** Run the client's Meta and Google ads; with Alex and follow-up it forms the acquisition system (Q4).
- **Status:** Not built
- **Built today:** Nothing in the repo.
- **Components:** Ad account access, campaigns, lead forms wired into Alex intake, spend and lead reporting.
- **Integrations:** Meta and Google ad accounts, n8n, Twenty.
- **Data in Twenty:** leadSource on end_customers; campaign fields (new).
- **Owner:** Not assigned

- Left to build: Who runs ads
- Left to build: Lead form to Alex wiring
- Left to build: Reporting

| Test | Plan |
| --- | --- |
| Unit / workflow | Lead form fields map to the Alex intake. |
| End-to-end (test client) | Meta's test lead reaches Alex and gets called. |
| Failure and retry | Lead form disconnect alerts within a day. |
| Compliance | Consent wording on every lead form (D-007). |

- **Deployment:** Per client account setup plus the shared lead wiring.
- **Deploy checklist:** Access granted → Test lead passes
- **Setup effort:** Per client (assumption: medium)

## B3. Emily, inbound AI receptionist (2a / 2b / 2c)

- **Purpose:** 2a missed-call text-back; 2b after-hours and missed-call answering; 2c full 24/7 receptionist that qualifies, books and texts the owner a summary.
- **Status:** Partly built
- **Built today:** Emily build copy (40-node workflow, inactive, 13 Notion nodes) and an archived 13-node missed-call text-back on Notion. Emily, Nora and their tools are off-limits.
- **Components:** 2a: missed-call webhook to SMS; 2b/2c: Retell inbound agent, call forwarding from the client's line, booking tools, owner summary SMS.
- **Integrations:** Retell, Twilio, n8n, cal.com, Twenty.
- **Data in Twenty:** end_customers, customer_interactions.
- **Owner:** Abdullah

- Left to build: New inbound template built fresh, not by editing Emily
- Left to build: Twenty instead of Notion
- Left to build: Per-client forwarding guide
- Left to build: Client A2P for any SMS

| Test | Plan |
| --- | --- |
| Unit / workflow | After-hours detection in the client's time zone. |
| End-to-end (test client) | Call a test client's number and let it ring out: 2a text arrives; 2b/2c agent answers, books, owner summary arrives. |
| Failure and retry | Booking tool down: agent takes a message and alerts; SMS fails: logged and retried. |
| Compliance | AI disclosure; STOP handling; SMS only after the client's A2P approves (D-004). |

- **Deployment:** Template per tier plus config and the client's call-forwarding setup.
- **Deploy checklist:** Forwarding set → A2P approved (2a) → Agent created → Tests passed
- **Setup effort:** Per client (assumption: 2a small, 2b/2c medium)

## B4. Lead Recovery & Nurture (with old-lead reactivation)

- **Purpose:** One-time revival of the old lead list, then ongoing call, text and email follow-up until book or opt-out, with a recovered-revenue report.
- **Status:** Partly built
- **Built today:** Archived Reactivation Sender (7 nodes) and Reply Handler (7 nodes), both on Notion.
- **Components:** List import and consent check, reactivation sender, AI reply handler, nurture sequence, report.
- **Integrations:** Twilio, email, n8n, Twenty, OpenRouter (reply handler).
- **Data in Twenty:** end_customers with consent and opt-out fields, customer_interactions.
- **Owner:** Abdullah

- Left to build: Move to Twenty
- Left to build: Consent rules for old leads
- Left to build: Recovered-revenue report

| Test | Plan |
| --- | --- |
| Unit / workflow | Opt-out and consent filters. |
| End-to-end (test client) | Seed a test client list of your own numbers; messages send, replies classified, bookings logged. |
| Failure and retry | Bulk send throttled; reply handler error routes to a human. |
| Compliance | Counsel on texting and AI-calling past leads (D-007 bars cold SMS at scale and AI cold calls); client A2P. |

- **Deployment:** Template plus the client's list and config.
- **Deploy checklist:** Consent check passed → A2P approved → Seeded test passes
- **Setup effort:** Per client (assumption: medium)

## B5. Estimate and quote follow-up

- **Purpose:** 2-3 weeks of automatic follow-up after each estimate, with an alert when the customer replies interested.
- **Status:** Not built
- **Built today:** No workflow. The archived invoice follow-up demo is a pattern only.
- **Components:** Estimate-sent trigger (client's software or manual entry), sequence, reply detection, owner alert.
- **Integrations:** Client's field service software (unknown per client), Twilio, email, n8n, Twenty.
- **Data in Twenty:** client_jobs (estimate), customer_interactions.
- **Owner:** Abdullah

- Left to build: Trigger per software
- Left to build: Sequence
- Left to build: Alert

| Test | Plan |
| --- | --- |
| Unit / workflow | Sequence stops on reply or booking. |
| End-to-end (test client) | Test estimate to your own number; sequence runs; reply alerts the owner. |
| Failure and retry | Trigger missed: daily reconcile. |
| Compliance | Consent and opt-out; client A2P. |

- **Deployment:** Template plus software connector.
- **Deploy checklist:** Connector tested → Sequence approved
- **Setup effort:** Per client (assumption: medium)

## B6. Reputation Engine

- **Purpose:** Ask every customer for a review after the job, plus monthly reporting.
- **Status:** Partly built
- **Built today:** Archived Review Request + Response + Referral Chain (15 nodes, Twilio, Notion).
- **Components:** Job-completed trigger, review request, response handling, monthly report.
- **Integrations:** Twilio, n8n, Twenty, the client's review profiles.
- **Data in Twenty:** client_jobs, end_customers.
- **Owner:** Abdullah

- Left to build: Move to Twenty
- Left to build: Job-completed trigger per software
- Left to build: Report

| Test | Plan |
| --- | --- |
| Unit / workflow | Every completed job gets one request. |
| End-to-end (test client) | Complete a test job; request arrives; response logged. |
| Failure and retry | No duplicate requests on re-fired triggers. |
| Compliance | Ask every customer; never filter unhappy ones away from Google (Google and FTC rules). |

- **Deployment:** Template plus review links.
- **Deploy checklist:** Links set → Test job passes
- **Setup effort:** Per client (assumption: small)

## B7. Online Presence Management

- **Purpose:** Google Business Profile, reviews on every listing, directory listings, Facebook and Instagram posts, monthly report.
- **Status:** Not built
- **Built today:** Nothing in the repo.
- **Components:** Profile access, posting schedule, review monitoring, listings audit, report.
- **Integrations:** Google Business Profile, Meta, n8n, Twenty.
- **Data in Twenty:** client_accounts, notes.
- **Owner:** Not assigned

- Left to build: Access method
- Left to build: Posting workflow
- Left to build: Report

| Test | Plan |
| --- | --- |
| Unit / workflow | Scheduled posts land in the right account. |
| End-to-end (test client) | Post to a test profile and read it back. |
| Failure and retry | Revoked access alerts. |
| Compliance | Excludes ads, video and site redesigns (Q5). |

- **Deployment:** Per client access plus template.
- **Deploy checklist:** Access granted → First post approved
- **Setup effort:** Per client (assumption: medium)

## B8. Scheduling and dispatch

- **Purpose:** Bookings straight into the client's calendar or field service software, with confirmations, reminders, tech assignment alerts and on-my-way texts.
- **Status:** Partly built
- **Built today:** cal.com booking works through Alex's native tools. No software connectors.
- **Components:** Calendar or software connector, reminder sequence, assignment alert, on-my-way trigger.
- **Integrations:** cal.com (built for Alex), client software (unknown), Twilio, n8n.
- **Data in Twenty:** client_jobs, customer_interactions.
- **Owner:** Abdullah

- Left to build: Connectors
- Left to build: Reminders
- Left to build: Dispatch texts

| Test | Plan |
| --- | --- |
| Unit / workflow | Time zone handling for reminders. |
| End-to-end (test client) | Book a test job; it appears in the test calendar; reminders arrive. |
| Failure and retry | Double booking prevented; connector down alerts. |
| Compliance | Client A2P for texts. |

- **Deployment:** Template plus connector.
- **Deploy checklist:** Connector tested → A2P approved
- **Setup effort:** Per client (assumption: medium to large)

## B9. Maintenance plans and repeat-service reminders

- **Purpose:** Sell and renew maintenance plans and remind past customers when service is due.
- **Status:** Not built
- **Built today:** Nothing built.
- **Components:** Due-date tracking, reminder sequence, renewal flow.
- **Integrations:** Twilio, email, n8n, Twenty.
- **Data in Twenty:** end_customers, client_jobs with service dates (fields assumed new).
- **Owner:** Abdullah

- Left to build: Data model
- Left to build: Sequences

| Test | Plan |
| --- | --- |
| Unit / workflow | Due dates computed per plan. |
| End-to-end (test client) | Back-dated test customer gets the reminder. |
| Failure and retry | Opted-out customer never messaged. |
| Compliance | Consent and opt-out; client A2P. |

- **Deployment:** Template plus plan settings.
- **Deploy checklist:** Plans entered → Test reminder passes
- **Setup effort:** Per client (assumption: small)

## B10. Referral automation (client's customers)

- **Purpose:** Ask happy customers for referrals and track and reward the ones that become jobs.
- **Status:** Partly built
- **Built today:** The archived Review + Referral Chain has a referral step.
- **Components:** Ask after the job, referral link or code, tracking, reward.
- **Integrations:** Twilio, n8n, Twenty.
- **Data in Twenty:** end_customers referrer fields (new).
- **Owner:** Abdullah

- Left to build: Tracking
- Left to build: Reward rules

| Test | Plan |
| --- | --- |
| Unit / workflow | Referred job maps to its referrer. |
| End-to-end (test client) | Test referral becomes a test job; reward shows as owed. |
| Failure and retry | Self-referral or duplicate credited once. |
| Compliance | Consent; client A2P. |

- **Deployment:** Template plus reward settings.
- **Deploy checklist:** Rules set → Test passes
- **Setup effort:** Per client (assumption: small)

## B11. CRM Lite and CRM Full (backend only)

- **Purpose:** The data and automations behind the two CRM tiers ($1,000 + $500/mo and $2,000 + $750/mo). The portal screens are out of scope here.
- **Status:** Partly built
- **Built today:** The objects exist. What Lite vs Full includes is not defined.
- **Components:** Per-client data in Twenty (customers, jobs, interactions), tenant isolation, import from the client's old system.
- **Integrations:** Twenty, n8n.
- **Data in Twenty:** end_customers, client_jobs, customer_interactions linked to client_accounts.
- **Owner:** Abdullah

- Left to build: Define Lite vs Full features
- Left to build: Import tool
- Left to build: Isolation tests

| Test | Plan |
| --- | --- |
| Unit / workflow | Every record carries its client account. |
| End-to-end (test client) | Import a test client's sample data; counts match. |
| Failure and retry | Bad rows rejected with a report. |
| Compliance | On exit the client keeps their data (Q11): export tested. |

- **Deployment:** Template import plus config.
- **Deploy checklist:** Import tested → Export tested
- **Setup effort:** Per client (assumption: medium)

## 14-day deployment runbook

| Day | Alex | Likely first add-ons: Emily 2a and old-lead reactivation |
| --- | --- | --- |
| Day 0 | Signed, invoice 1 paid, intake form and kickoff link sent, intake creates the Twenty account and task list. | Start the client's A2P registration today; it takes 2-3 weeks (D-004). |
| Day 1 | Kickoff call. Baseline captured and X agreed. Access requests sent (lead source, calendar). | Collect the call-forwarding details (2a) and the old lead list (reactivation). |
| Day 2 | Config record filled. cal.com event type created. Business profile drafted from intake. | Consent check on the old list. |
| Day 3 | Prompt filled from the [CLIENT] template. create-outbound dry run, your yes, apply. | Clone the 2a and reactivation templates, inactive. |
| Day 4 | Workflow cloned inactive and pointed at the config. Error workflow linked. | Point both at the config. |
| Day 5 | Lead source connected in test mode. Unit checks pass. | Seed test numbers you own. |
| Day 6 | Internal tests: first call, 90-second retry, +60-minute retry, stop at 3, voicemail, duplicate, out-of-window. | Voice-only checks; SMS parts wait for A2P. |
| Day 7 | Client test call and script approval. Fixes logged. | Client approves message copy. |
| Day 8 | Compliance check: disclosure opener, consent on the client's form, opt-out, webhook auth. | Counsel's answer on texting old leads in hand. |
| Day 9 | Launch review against the readiness gate. Weekly summary and alerts wired. | Go or hold decision for each add-on. |
| Day 10 | Go-live with your yes (assumption: day 10 leaves time for booked appointments by day 14). | Go live only if A2P is approved; otherwise built and tested, waiting. |
| Days 11-13 | Watch every call; fix within the 12-hour support promise; log hours. |  |
| Day 14 | D-024 check: live with booked appointments. Go-live invoice. Day 30 review scheduled. | Report status of each add-on. |

The add-on choice is an assumption based on the upsells D-024 already prices. D-024 sells upsells after day 30, so in practice the add-on column restarts at its own day 0. Day-by-day placement is an assumption to be replaced by the times from the Quentin dry run (6.1).

## Readiness gate before client 1

- [x] Twenty self-hosted with nightly and off-site backups
- [x] Kynetic's own Twilio A2P approved (Oct 28)
- [x] Alex first-attempt call, booking and logging tested (Oct 15)
- [ ] LLC formed
- [ ] Agreement template reviewed by a lawyer
- [ ] E&O insurance in place
- [ ] Counsel sign-off (1.4), incl. guarantee wording and call recording
- [ ] Post-call webhook auth on (KI-005)
- [ ] Retry path and duplicate check tested
- [ ] Caller ID confirmed not Nora's line
- [ ] [CLIENT] template and Add a Client guide (3.7)
- [ ] Per-client config on Twenty with an isolation test
- [ ] Intake form with baseline and X
- [ ] Dial gate: DNC scrub, FL/OK, AM-1
- [ ] Error workflow, heartbeat and forced-failure test
- [ ] Support queue with the 12-hour rule
- [ ] Hours tracking object
- [ ] Invoice path (Stripe automation or manual link)
- [ ] Dry run with Quentin as a fake client, every step timed (6.1)
- [ ] Launch gate checklist ticked from evidence (7.1)

Status as of Oct 28, 2026, from the repo docs and the A2P update.

## Build priorities to 5 clients by Dec 31

| Build | Why | Needed before |
| --- | --- | --- |
| Platform fixes (A0) and dial gate (A2) | Safety first; the gate protects every dial | Now |
| Lead pipeline (A1), dial queue (A3), booking (A4) | 200 dials a day needs a refilled pool and tracking | Now |
| Calculator and proposal (A5) | Every demo needs an offer | Next demos |
| Legal: LLC, agreement, lawyer, E&O | Nothing signs safely without them (Q12) | Client 1 signs |
| Alex gaps and [CLIENT] template (B1), per-client config (A8) | The core offer must deploy repeatably | Client 1 signs |
| Intake (A7), monitoring (A9), support (A10), hours (A11) | Needed from day 0 of client 1 | Client 1 signs |
| Dry run with Quentin (6.1) and the readiness gate | Proves the 14-day runbook before a real client | Client 1 signs |
| Contract and invoicing triggers (A6) | Manual works for client 1, not for five | Client 2 signs |
| Reporting (A12) and day 30/60/90 reviews (A13) | Client 1 hits day 30 | Client 1 day 30 |
| Emily 2a and Lead Recovery templates (B3, B4) | Likely first add-ons (assumption); SMS waits on client A2P | First upsell |
| Feedback and referrals (A14) | Referrals are the cheapest next client | Client 1 day 30 |
| Remaining services (B2, B5-B11) | Plan 2 is gated at 5 paying clients (D-013) | After client 5 |

If "5 clients by end of December" (Q9) means live, not signed, the fifth must sign by Dec 17 to fit the 14-day go-live. D-024's goal counts signed contracts.

## Decisions needed

1. Does Q9's 5 clients by Dec 31 mean signed or live?
2. Which DNC scrub tool, and the re-scrub cadence (counsel).
3. Support channel, and clock hours vs business hours for the 12-hour promise.
4. Twenty fields and objects to approve: dial gate, baseline and X, config, hours, feedback, referrals.
5. E-sign tool, and Stripe automation vs manual links for client 1.
6. Which add-ons to offer first, and whether any SMS can launch before the client's A2P approves.
7. Counsel on texting and AI-calling old leads for reactivation.
8. Who runs paid ads and online presence work.
9. What CRM Lite includes vs CRM Full.
10. Merge Alex prompt v1.2.3 and publish (needs your yes).

## Sources

- Lifecycle Page: Kynetic AI Client Lifecycle: First Contact to Referrals
- /workspace/overview-interview.md (Q5 catalog, Q7, Q10-Q13)
- kynetic-ai/KYNETIC_CONTEXT.md, docs/decisions.md, docs/progress.md, docs/known-issues.md
- kynetic-ai/retell/builds/outbound-speed-to-lead/BUILD_PLAN.md
- kynetic-ai/docs/plans/PLAN1-REMAINING.md, AUDIT.md; docs/lead-engine-handoff.md
- kynetic-ai/n8n/workflows (active and archive)


