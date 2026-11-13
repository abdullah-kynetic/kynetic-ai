# [ARCHIVED 2026-11-09, reference only; plan superseded by ROADMAP 7bfdcb7e] Kynetic AI Client Delivery: 5-Stage Plan

_Twenty note `36968a8d`, created 2026-10-28, updated 2026-11-09. Exported 2026-11-12._

Source Page: https://cursor.com/canvas/store-aedc3439-bcce-49cc-b11f-5e32c7fc8ae4/ce3d99ff-3b35-4531-9abd-f2cb40c72c3e

Saved Oct 28, 2026.

The approved delivery split, signed to renewal, stage by stage: tasks by day, owners, client touchpoints, Twenty data, tools with build status, KPIs, risks and what to build next. Stage 2 has the most built today; stages 1 and 5 have nothing fully built.

## Related pages

- [Kynetic AI Client Lifecycle: First Contact to Referrals](https://cursor.com/canvas/store-aedc3439-bcce-49cc-b11f-5e32c7fc8ae4/f7ccad3a-5bf6-424b-a49f-c1d3098c69d0)
- [Kynetic AI Backend Systems: Build, Test, Deploy in 14 Days](https://cursor.com/canvas/store-aedc3439-bcce-49cc-b11f-5e32c7fc8ae4/d8e821f8-5edb-46fa-b18d-77beb0961337)

## The five stages

Flow:

- Signed → 1. Onboard (Days 0-3)
- 1. Onboard (Days 0-3) → 2. Build and launch (Days 3-14): Everything to build
- 2. Build and launch (Days 3-14) → 3. Run (Ongoing from day 14): Alex live and booking
- 3. Run (Ongoing from day 14) → 4. Optimize (Days 30, 60, 90): Stable, client informed
- 4. Optimize (Days 30, 60, 90) → 5. Grow the account (Day 90+): Guarantee hit, upsell clear
- 5. Grow the account (Day 90+) → Renew?
- Renew? → 3. Run (Ongoing from day 14): Yes: 3, 6, 12 months or monthly
- Renew? → Exit: client keeps data, Kynetic keeps IP: No

Stage 3 keeps running underneath stages 4 and 5. Guarantee: X = max(10, 20% × monthly booked appointments × 3), extra free work until it is reached, provided lead flow stays roughly steady (Q10).

## Build gaps per stage

| Stage | Built | Partly | Not built | Biggest gap |
| --- | --- | --- | --- | --- |
| Stage 1. Onboard (days 0-3) | 0 | 1 | 6 | No agreement, intake or invoicing automation |
| Stage 2. Build and launch (days 3-14) | 3 | 1 | 5 | No per-client template; Alex gaps open |
| Stage 3. Run (ongoing from day 14) | 2 | 0 | 6 | Only failure alerts exist |
| Stage 4. Optimize (days 30 / 60 / 90) | 1 | 2 | 3 | No scheduler or guarantee tracking |
| Stage 5. Grow the account (day 90+) | 0 | 1 | 6 | Nothing automated; reward and renewal pricing undecided |

> **SMS will not fit inside 14 days for most clients.** The client's own A2P registration takes 2-3 weeks (D-004), so Stage 2 launches Alex on voice and any texting waits for approval. Submitting it on day 0 is the mitigation.

Counts include one item marked unknown in Stage 2 (real Meta lead-form intake), which is not in the three columns. Statuses come from the two earlier Pages and the repo docs as of Oct 24, plus the Oct 28 A2P approval. "Bot after client 3" follows Q7 (move onboarding and support to bots after the first 3 clients); which bot is still open.

## Stage 1. Onboard (days 0-3)

- **Goal:** Everything needed to build is in hand by day 3.
- **Exit criteria:** Agreement signed, invoice 1 paid, kickoff held, intake complete, lead source and calendar access granted, the client's A2P registration submitted, baseline and X signed off by the client.

### Tasks in order

| When | Task | Owner | Bot after client 3 |
| --- | --- | --- | --- |
| Day 0 | Mark the opportunity CLOSED_WON; send agreement and invoice 1 (founding: 50% of $6,500, D-024) | Abdullah | Yes, as drafts you approve |
| Day 0 | Create the client account and onboarding task list in Twenty | Abdullah | Yes |
| Day 0 | Send welcome, intake form and kickoff booking link | Quentin | Yes |
| Day 0 | Collect business details and submit the client's own A2P registration (2-3 weeks, D-004) | Abdullah | Partly: collection yes, submission stays manual |
| Day 1 | Kickoff call: goals, offers, booking rules, qualifiers | Abdullah + Quentin (Q7) | No |
| Day 1 | Send access requests: lead source (Meta lead forms), calendar, call forwarding details if add-ons | Quentin | Yes (reminders) |
| Days 1-2 | Capture baseline monthly booked appointments and monthly lead count with evidence; compute X; client signs off | Abdullah | Calculation yes, sign-off no |
| Day 2 | Fill the per-client config record; draft the business profile | Abdullah | Partly |
| Day 3 | Onboarding exit check against the list above | Abdullah | No |

### Client touchpoints

| When | Touchpoint | Message (draft, sent with your approval) |
| --- | --- | --- |
| Day 0 | Agreement and invoice 1 | Here is your agreement and first invoice; we start the build when both are done. |
| Day 0 | Welcome | Welcome to Kynetic: your intake form, kickoff link, and what happens in the next 14 days. |
| Day 1 | Kickoff call | Walk through goals, booking rules and the 14-day plan. |
| Days 1-2 | Access checklist | Step-by-step access requests, one per tool, with reminders until done. |
| Day 2 | Baseline and goal | Your baseline is your monthly booked appointments × 3; our 90-day target is X more. |

### Inputs and Twenty fields

| Input | Twenty | State |
| --- | --- | --- |
| Legal name, signer, payment terms | opportunity, invoices | Exists |
| Business profile, services, area, hours, booking rules, qualifiers, FAQs | client_accounts + notes | Exists (fields to extend) |
| Baseline monthly bookings, monthly lead count, X | baselineMonthlyBookings, monthlyLeadCount, guaranteeX | New (your yes) |
| A2P status and submit date | a2pStatus | New (your yes) |
| Onboarding checklist | tasks linked to the client account | Exists |
| Hours spent onboarding | time entry object | New (your yes) |

### Tools and automations

| Automation | Tool | Status |
| --- | --- | --- |
| CLOSED_WON sends agreement, invoice 1 and welcome draft (4.6, 5.2) | Twenty + n8n + Stripe | Not built |
| Attorney-reviewed agreement with e-sign (4.7, 4.8) | E-sign tool not chosen | Not built |
| Intake form creates the account and task list (5.1) | n8n form + Twenty | Not built |
| Kickoff booking | cal.com | Not built |
| Baseline and X calculation | n8n + Twenty | Not built |
| Client A2P registration | Twilio (Kynetic's own approved Oct 28) | Not built |
| Business profile from intake | brand-profile skill | Partly built |

### Templates, checklists and SOPs

- Agreement template (lawyer reviewed)
- Welcome message
- Intake form
- Access guides per tool
- A2P information request
- Baseline sign-off sheet
- Onboarding task template in Twenty
- Day-of-close SOP (5.4)

### KPIs

- Days from signing to onboarding exit (target: day 3, per the approved split)
- Intake complete by day 3 (yes/no)
- A2P submitted on day 0 or 1 (yes/no)
- Onboarding hours per client (Q13, no target yet)

### Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Client slow to grant access | Daily reminders; a call on day 2 if still missing; decide whether the 14-day clock pauses |
| A2P takes 2-3 weeks | Submit on day 0; Alex is voice and launches without it |
| Baseline has no evidence | Require a calendar or CRM export before sign-off |
| No LLC, lawyer or E&O yet (Q12) | Readiness gate blocks the first signature |

### Build next

1. LLC and lawyer-reviewed agreement
2. Intake form into Twenty with baseline and X fields
3. Onboarding task template
4. CLOSED_WON automation (manual is fine for client 1)
5. A2P data collection inside intake

## Stage 2. Build and launch (days 3-14)

- **Goal:** Alex is live and booking by day 14 (D-024).
- **Exit criteria:** QA passed, client approved the script, workflow activated with your yes, at least one booked appointment, client trained.

### Tasks in order

| When | Task | Owner | Bot after client 3 |
| --- | --- | --- | --- |
| Day 3 | Audit current lead handling: where leads come from, how fast they are called, how bookings happen | Abdullah | No |
| Day 3 | Fill the prompt from the [CLIENT] template; create-outbound dry run, your yes, apply | Abdullah | Drafting yes, apply needs your yes |
| Day 4 | Clone the workflow inactive, point it at the config, link the error workflow; create the cal.com event type | Abdullah | Partly |
| Day 5 | Connect the lead source in test mode | Abdullah | No |
| Day 6 | Internal QA: first call, 90-second retry, +60-minute retry, stop at 3, voicemail, duplicate, calling window, booking, Twenty logging | Abdullah + Quentin | Yes (scripted test runner) |
| Day 7 | Client test call and script approval | Abdullah | No |
| Day 8 | Fixes; compliance check: AI disclosure, consent on the client's form, opt-out, webhook auth | Abdullah | No |
| Day 9 | Launch review against the gate; client training | Abdullah + Quentin | Training material yes, call no |
| Day 10 | Go-live with your yes (assumption: day 10 leaves room for bookings by day 14) | Abdullah | No |
| Days 11-14 | Watch every call; first booking; go-live invoice (founding: other 50%) | Abdullah, Quentin | Monitoring yes |

### Client touchpoints

| When | Touchpoint | Message (draft, sent with your approval) |
| --- | --- | --- |
| Day 3 | Audit findings | What we found in your lead handling and what Alex will change. |
| Day 7 | Test call | Alex calls you as a lead would; approve the script or tell us what to change. |
| Day 9 | Training | How bookings reach you, what Alex says, how to reach support. |
| Day 10 | Go-live notice | Alex is live: every new lead gets a call in under 60 seconds. |
| Day 14 | Go-live invoice and first results | Your first booked appointments and the go-live invoice. |

### Inputs and Twenty fields

| Input | Twenty | State |
| --- | --- | --- |
| Agent id, caller ID, cal.com event type, time zone, calling window | client_accounts config fields | New (your yes) |
| Lead fields (consent text, consentAt, firstRingAt, leadStatus, attemptCount, nextAttemptAt, lastOutcome) | end_customers | Exists |
| Call outcome, booked slot, Retell call id, summary | customer_interactions | Exists |
| Go-live date | goLiveDate | New (your yes) |

### Tools and automations

| Automation | Tool | Status |
| --- | --- | --- |
| Alex agent and 38-node Outbound Speed to Lead workflow (demo) | Retell + n8n | Built |
| Create agent per client (dry run, apply with your yes) | tools/retell.py create-outbound | Built |
| [CLIENT] template and Add a Client guide (3.7) | Repo + n8n | Not built |
| Per-client config lookup | n8n Client Config Lookup (reads Notion) | Partly built |
| Post-call webhook auth (KI-005) | n8n | Not built |
| Retry and duplicate tests | QA script | Not built |
| Real Meta lead-form intake | n8n + Meta | Unknown |
| Call and retry failure alerts | n8n | Built |
| Go-live invoice trigger | n8n + Stripe | Not built |
| Launch gate checklist (7.1) | Repo doc | Not built |

### Templates, checklists and SOPs

- [CLIENT] prompt template
- Add a Client guide
- QA test script
- Compliance checklist
- Client script sign-off
- Training guide
- Go-live message
- Launch gate checklist

### KPIs

- Go-live day (by day 14, D-024)
- Booked appointments by day 14 (D-024 promise)
- Speed to lead under 60 seconds (Q10)
- QA passes on the first run (yes/no)

### Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Client's lead form lacks consent wording | Provide the wording; go-live blocked until it is on the form |
| Booking lands in the wrong calendar | Two-client isolation test before go-live |
| Retry path fails in production | Retry tests in QA; heartbeat in Stage 3 |
| No bookings by day 14 (D-024 fee waiver) | Go live by day 10; check lead volume at kickoff |
| SMS confirmations not allowed yet | Voice first; SMS after the client's A2P approves |

### Build next

1. Close the Alex gaps: webhook auth, retry and duplicate tests, caller ID check
2. [CLIENT] template (3.7)
3. Config on Twenty
4. QA script and launch gate
5. Quentin dry run (6.1) to time every step

## Stage 3. Run (ongoing from day 14)

- **Goal:** Stable, and the client is informed.
- **Exit criteria:** Ongoing: no unresolved alerts, every support request answered within 12 hours, weekly summary and monthly report delivered, hours logged.

### Tasks in order

| When | Task | Owner | Bot after client 3 |
| --- | --- | --- | --- |
| Daily | Check alerts and the daily anomaly report (leads with no call, calls over 60 seconds) | Abdullah | Yes |
| Within 12 h | Answer every support request (Q7) | Quentin | Yes (triage and first response) |
| As needed | Fix prompt or flow issues through the change-alex path, with your yes | Abdullah | No |
| Weekly | Send the weekly summary after your approval (5.6) | Abdullah | Yes |
| Monthly | Send the monthly report (5.7) | Abdullah | Yes |
| Continuous | Log hours per client (Q13) | Everyone | Partly |

### Client touchpoints

| When | Touchpoint | Message (draft, sent with your approval) |
| --- | --- | --- |
| Weekly | Summary | This week: leads, calls, average speed to lead, booked appointments. |
| Monthly | Report | The month against your baseline and the 90-day target. |
| As needed | Support reply | Answer within 12 hours. |
| As needed | Incident notice (assumption) | What broke, what we did, and that it is fixed. |

### Inputs and Twenty fields

| Input | Twenty | State |
| --- | --- | --- |
| Speed to lead | end_customers formSubmittedAt and firstRingAt | Exists |
| Outcomes and bookings | customer_interactions outcome, bookedSlot; end_customers leadStatus | Exists |
| Support requests | tasks + firstResponseAt | tasks exist; field new |
| Hours | time entry object | New (your yes) |

### Tools and automations

| Automation | Tool | Status |
| --- | --- | --- |
| Call and retry failure alerts | n8n | Built |
| Error workflow and sweeper heartbeat | n8n | Not built |
| Daily anomaly check | n8n + Twenty | Not built |
| Support queue with a 12-hour timer | Twenty + n8n (channel not chosen) | Not built |
| Weekly summary (5.6) | n8n + Twenty | Not built |
| Monthly report (5.7) | n8n + Twenty | Not built |
| Hours tracking | Twenty | Not built |
| Safe prompt change path | change-alex.md + tools/retell.py | Built |

### Templates, checklists and SOPs

- Support SOP
- Incident SOP
- Weekly summary template
- Monthly report template
- Hours logging SOP

### KPIs

- Speed to lead under 60 seconds (Q10)
- Share of leads called
- Booking rate (no target set)
- Support first response within 12 hours (Q7)
- Hours per client per week (Q13)

### Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Silent failure, e.g. the sweeper stops | Heartbeat alert |
| Retell or Twilio outage | Alert plus manual callbacks (assumption: Quentin) |
| Support load grows unseen | Hours data per client from client 1 |
| Report numbers wrong | Check each metric against a Twenty query on test data |

### Build next

1. Error workflow and heartbeat
2. Support queue and channel
3. Weekly summary
4. Hours object
5. Monthly report

## Stage 4. Optimize (days 30 / 60 / 90)

- **Goal:** Guarantee hit, upsell clear.
- **Exit criteria:** By day 90: X more booked appointments (counting rule to be decided), tuning logged, next-system recommendation accepted or declined.

### Tasks in order

| When | Task | Owner | Bot after client 3 |
| --- | --- | --- | --- |
| Day 30 | Review pack (stats, worst calls, suggested edits), review call, tuning list; upsell audit opens (D-024 sells upsells after day 30) | Abdullah | Pack yes, call no |
| Day 60 | Second review; tuning; guarantee progress update | Abdullah | Pack yes |
| Day 90 | Guarantee check: if short of X, keep working free until it is reached (Q10) | Abdullah | Calculation yes |
| Day 90 | Recommend next systems from the Q5 catalog; proposal | Abdullah | Draft yes |

### Client touchpoints

| When | Touchpoint | Message (draft, sent with your approval) |
| --- | --- | --- |
| Days 30, 60, 90 | Review call | What changed, what it did, what is next. |
| Days 30, 60 | Guarantee progress | You are at N of X extra booked appointments. |
| Day 90 | Guarantee statement | Target met, or we keep working free until it is. |
| Day 90 | Next-system proposal | Based on the audit, the systems that fit next. |

### Inputs and Twenty fields

| Input | Twenty | State |
| --- | --- | --- |
| Baseline, X, monthly lead count (steady-flow condition) | baselineMonthlyBookings, guaranteeX, monthlyLeadCount | New (your yes) |
| Booked appointments | customer_interactions bookedSlot | Exists |
| Review dates and tuning log | tasks + notes | Exists |
| Upsell | new opportunity linked to the client | Exists |

### Tools and automations

| Automation | Tool | Status |
| --- | --- | --- |
| Review tasks and booking from the go-live date | n8n + Twenty + cal.com | Not built |
| Review pack | n8n + Retell data | Not built |
| Guarantee progress calculation | n8n + Twenty | Not built |
| Safe prompt change path | change-alex.md + tools/retell.py | Built |
| Audit calculator for the upsell audit | site /audit (branch, not deployed) | Partly built |
| Upsell system templates (Emily, reactivation, reviews) | Retell + n8n archive | Partly built |

### Templates, checklists and SOPs

- Review agenda
- Tuning log
- Guarantee statement
- Upsell audit
- Proposal template

### KPIs

- Progress toward X at days 30, 60 and 90
- Booking rate trend
- Changes shipped per review
- Upsell accepted (yes/no)

### Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Lead flow drops, voiding the guarantee condition | Track monthly lead count from day 0 |
| Dispute on how X is counted | Define it in the agreement |
| Tuning breaks the flow | Dry run plus your yes for every change |
| Upsell conflicts with the 5-client gate (D-013) | Decide upsell timing |

### Build next

1. Review scheduler from goLiveDate
2. Guarantee progress line in reports
3. Review pack
4. Upsell audit flow

## Stage 5. Grow the account (day 90+)

- **Goal:** Renew and expand, or exit cleanly; turn results into proof and referrals.
- **Exit criteria:** Renewal signed (3, 6, 12 months or month to month) or exit completed with a data export; testimonial or case study captured where permitted; referral asked.

### Tasks in order

| When | Task | Owner | Bot after client 3 |
| --- | --- | --- | --- |
| Before day 90 (assumption) | Present renewal options; longer terms get better pricing (Q11) | Abdullah | Reminder yes, conversation no |
| Day 90 | Feedback survey | Quentin | Yes |
| Day 90+ | Review and testimonial ask (every client) | Quentin | Yes |
| Day 90+ | Case study draft; founding clients trade one for the $4,000 prepaid months 4-6 option (D-024) | Abdullah | Draft yes |
| Day 90+ | Referral ask and tracking | Quentin | Yes |
| On renewal | Recurring billing (founding $1,500/mo, D-024) | Abdullah | Yes |
| On exit | Export the client's data, switch workflows off, release the number; Kynetic keeps systems, prompts and workflows (Q11) | Abdullah | Checklist yes |

### Client touchpoints

| When | Touchpoint | Message (draft, sent with your approval) |
| --- | --- | --- |
| Before day 90 | Renewal options | Your results so far and the terms for continuing. |
| Day 90 | Survey | A short survey on how it is going. |
| Day 90+ | Testimonial and review ask | Would you share a review and a short testimonial? |
| Day 90+ | Case study approval | Here is the before-and-after; approve before we publish. |
| Day 90+ | Referral ask | Know another owner losing leads? Here is how referrals work. |
| On exit | Offboarding notice | Your data export and the end date. |

### Inputs and Twenty fields

| Input | Twenty | State |
| --- | --- | --- |
| Feedback score and comment | feedbackScore | New (your yes) |
| Testimonial and case study permission | publishPermission | New (your yes) |
| Referrer, referral source, reward status | referrer, referralSource, rewardStatus | New (your yes) |
| Contract term, renewal date, exit date | contractTerm, renewalDate, exitDate | New (your yes) |

### Tools and automations

| Automation | Tool | Status |
| --- | --- | --- |
| Renewal reminder and options | n8n + Twenty | Not built |
| Recurring billing | Stripe | Not built |
| Feedback survey | n8n + form | Not built |
| Review and testimonial ask | n8n (archived Review + Referral Chain, Notion-based) | Partly built |
| Case study draft | n8n | Not built |
| Referral tracking and rewards | Twenty + n8n | Not built |
| Offboarding checklist and data export | Twenty + n8n | Not built |

### Templates, checklists and SOPs

- Renewal options sheet
- Survey
- Testimonial request
- Case study template
- Referral offer
- Offboarding SOP

### KPIs

- Renewal rate
- Feedback score
- Testimonials collected
- Referrals made and referral-sourced signings

### Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Renewal talk starts too late | Reminder ahead of the contract end |
| Exit dispute over IP | Clause in the agreement (Q11), lawyer reviewed |
| Review gating | Ask every client |
| Referral reward undefined | Decide type and amount |

### Build next

1. Renewal reminder and options
2. Feedback survey
3. Referral fields and tracking
4. Case study flow
5. Offboarding checklist

## Decisions needed

1. Do the two guarantees stack: D-024's live in 14 days or that month's fee is waived, and Q10's X more appointments in 90 days?
2. Standard pricing after the founding 3: D-024's $10,000 package or the value-based calculator (Q3)?
3. Upsell timing: from day 30 (D-024) or after the 5-client gate (D-013)?
4. Does 5 clients by Dec 31 (Q9) mean signed or live? If live, the fifth must sign by Dec 17.
5. How X is counted (all Alex-booked appointments or only those above baseline) and what counts as roughly steady lead flow.
6. Does the 14-day clock pause while the client is late on access, and does the build start before invoice 1 is paid?
7. Support channel, and clock hours vs business hours for the 12-hour promise.
8. Renewal pricing per term (Q11 says longer terms get better pricing; no figures yet beyond D-024's founding and standard rates).
9. Referral reward type and amount.
10. Which bots take the tasks marked for bots after client 3.
11. Twenty fields and objects to approve: baseline and X, config, goLiveDate, a2pStatus, hours, feedback, referrals, contract term.

## Sources

- Lifecycle Page and Backend Systems Page
- /workspace/overview-interview.md (Q3, Q5, Q7, Q10-Q13)
- kynetic-ai/docs/decisions.md (D-004, D-013, D-020, D-024), KYNETIC_CONTEXT.md, progress.md, known-issues.md
- kynetic-ai/retell/builds/outbound-speed-to-lead/BUILD_PLAN.md


