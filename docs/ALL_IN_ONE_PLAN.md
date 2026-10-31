# All-in-one portal plan (DRAFT for Abdullah's OK, 2026-10-31)

Extends `docs/BUILD_PLAN.md` (M0 to M11 stay as they are). New milestones are M12 to M18. Nothing here is built, deployed or sent. Tenant setup for Coastal Roofing stays on hold until Abdullah says go.

Companion: `docs/automation-map.md` (every automation, owner, status).

## Decisions this plan assumes (Abdullah, 2026-10-30/31)

| # | Decision | Needs a decision entry |
|---|---|---|
| 1 | Kynetic cold outreach is human only. D-007 stays. AI calls and SMS go only to people who asked for contact. | no |
| 2 | Dialer is the user's phone plus portal logging. Twilio click-to-call is a later milestone. | no |
| 3 | Billing plans are data (Oct 25 prices or D-017, chosen per proposal). Stripe invoices are drafts for approval. | yes (pricing source) |
| 4 | Twenty backup is one way: Kynetic-side data plus per-tenant summaries with no personal data. | yes, supersedes DC-043 |
| 5 | Cal.com stays the calendar. | no |
| 6 | Alerts by email now; SMS to Abdullah after Twilio A2P is approved. | no |
| 7 | ElevenLabs is the first voice provider. Retell is not built. | yes (D-025 not merged) |
| 8 | n8n runs the automations. The portal records everything and shows it live. n8n makes the consent, quiet-hours and DNC decision and the portal logs it with the reason. | yes, supersedes the portal-side gate rule |
| 9 | Reports: live portal dashboard plus a weekly email from n8n. | no |

Open (not decided): agency and client pipeline stages (proposed below), review requests, Later items.

## Risk to read before approving

Decision 8 removes the single portal gate that every call and text passes through today (`crm/src/server/outbound/gate.ts`). Consent, 8am to 9pm calling hours, state rules and DNC then live in n8n workflows. To keep that safe the plan requires: one shared n8n sub-workflow that every send goes through, the portal logging each decision, a kill switch the portal can flip, and tests that try to break the rules. Counsel questions (`docs/counsel-questions.md`) are still open. Not confirmed: whether counsel is fine with this arrangement.

## Split

- **Portal:** records, dashboards, consent and DNC lists, metrics math, report data, tenancy, logins, event bus, webhook intake.
- **n8n:** lead sources in, starting calls and retries, sequences, reminders, no-show recovery, consent decision, alerts, weekly and monthly emails, Stripe, Cal.com relay, Twenty backup, review requests, error alerts.
- Built and working stays where it is.

## Milestones

Columns follow BUILD_PLAN. Size: S 1 to 3 hours, M 3 to 8 hours, L 1 to 2 days. All status `todo`. All n8n workflows are built inactive and never activated without Abdullah's yes.

### M12 n8n contract and safety (first, alone)

| ID | Task | Depends | Acceptance | Size | Model |
|---|---|---|---|---|---|
| M12-01 | Write the portal/n8n contract doc: events n8n sends, endpoints the portal exposes, signing, retries, idempotency | none | Doc reviewed. Every automation in the map has an owner and an endpoint. | S | Opus |
| M12-02 | Record decisions 3, 4, 7, 8 in `docs/DECISIONS.md` | M12-01 | Entries added with Abdullah's confirmation. No D-number guessed. | S | Haiku |
| M12-03 | Portal endpoint: n8n posts a "contact decision" (allow or deny, reason, rule that fired). Stored on the lead timeline. | M12-01 | Integration test: allow and deny both stored, tenant isolated, duplicate post ignored. | M | Sonnet |
| M12-04 | Portal kill switch n8n reads before any send (global and per tenant) | M12-03 | Test: switch on means the shared sub-workflow refuses. | S | Sonnet |
| M12-05 | Admin screen to issue a tenant's lead-webhook secret and show the n8n URL | M12-01 | Secret shown once, rotated, never logged. Access test for non-admin. | M | Sonnet |
| M12-06 | Shared n8n sub-workflow "may I contact" (consent, quiet hours, state rules, DNC, frequency caps) reading portal data | M12-03 | Fake-data test table covers every rule, including quiet hours at edges and Florida/Oklahoma blocks. Logs a decision per run. | L | Opus |
| M12-07 | Gate parity test: same inputs through the old portal gate and the n8n sub-workflow give the same answer | M12-06 | All cases match or each difference is listed for Abdullah. | M | Opus |
| M12-08 | M12 gate: review of decisions, risk list, kill switch | M12-07 | Abdullah's yes. | S | Haiku |

### M13 Client lead-to-call chain (ElevenLabs, stub first)

| ID | Task | Depends | Acceptance | Size | Model |
|---|---|---|---|---|---|
| M13-01 | n8n workflow: form/Meta/Angi/LSA lead in, post to portal, check contact decision, start call | M12-08 | Fake-source test: lead appears in portal first, then a fake call starts. Lead is never lost if call step fails. | L | Sonnet |
| M13-02 | ElevenLabs adapter in the portal (stub and real behind a switch) | M12-01 | Stub passes. Real mode off by default. | M | Opus |
| M13-03 | Call result flow: provider webhook to n8n to portal (outcome, transcript, recording link) | M13-02 | Fake call shows outcome on the lead. Duplicate result ignored. | M | Sonnet |
| M13-04 | Retry schedule in n8n (5 min, 1 hour, next day, max 4), each retry re-checks contact decision | M13-01 | Test with fake clock. No retry after opt-out or booking. | M | Sonnet |
| M13-05 | Booking through Cal.com from the call, relayed to portal | M13-03 | Fake booking appears on the lead and moves the deal stage. | M | Sonnet |
| M13-06 | Fix deal-to-booked rule (`booked` vs `Estimate Booked`) | none | Regression test. | S | Sonnet |
| M13-07 | New-lead alert and hot-lead alert by email | M13-01 | Fake lead sends one email. No duplicate. | S | Sonnet |
| M13-08 | Opt-out and STOP handling end to end | M12-06 | Fake STOP stops all further sends, logged with reason. | M | Opus |
| M13-09 | M13 gate: full fake run, lead to call to booking to report data | M13-08 | Abdullah's yes. Real provider test calls need a separate yes. | S | Haiku |

### M14 Follow-up sequences, reminders, reviews

| ID | Task | Depends | Acceptance | Size | Model |
|---|---|---|---|---|---|
| M14-01 | Sequence steps in n8n (SMS and email) with the contact decision before each send | M13-09 | Test: steps fire in order, stop on reply or opt-out. SMS stays off until A2P. | L | Sonnet |
| M14-02 | Appointment reminders (24h, 2h) | M13-05 | Fake appointment sends two reminders. | M | Sonnet |
| M14-03 | No-show recovery | M14-02 | No-show triggers one recovery message and a task. | M | Sonnet |
| M14-04 | Review request after job done (needs Abdullah's answer on timing and wording) | M14-01 | Draft message only; test sends to a fake number. | M | Sonnet |
| M14-05 | Missed-call text-back, after-hours reply, reactivation moved or kept | M14-01 | Parity with existing portal behavior. | M | Sonnet |

### M15 Reporting and alerts

| ID | Task | Depends | Acceptance | Size | Model |
|---|---|---|---|---|---|
| M15-01 | n8n schedule that triggers daily metrics per tenant | M13-09 | Metrics rows appear for fake tenants each day. | S | Sonnet |
| M15-02 | Weekly client email from n8n (counts, bookings, link to portal) | M15-01 | Fake tenant gets one email with correct numbers. | M | Sonnet |
| M15-03 | Monthly report scheduling | M15-01 | Report generated for a fake tenant. | S | Sonnet |
| M15-04 | Error alerts for failed n8n workflows to email | M12-01 | Forced failure sends one alert. | S | Sonnet |
| M15-05 | SMS alert to Abdullah (blocked until A2P) | M15-04 | Test with fake number only. | S | Sonnet |

### M16 Kynetic agency tenant: leads, dialer, pipeline

| ID | Task | Depends | Acceptance | Size | Model |
|---|---|---|---|---|---|
| M16-01 | Create Kynetic as its own tenant (synthetic data first) | M12-08 | Isolation test with a client tenant. | M | Opus |
| M16-02 | Lead sources inbound vs outbound; outbound split by channel (cold call, SMS, email, DM) | M16-01 | Filters and counts correct on seeded data. | M | Sonnet |
| M16-03 | Human dialer queue: next lead, script, DNC flag, one-tap outcome log | M16-02 | Seeded run: DNC lead is never shown. Outcome saved with time. | L | Sonnet |
| M16-04 | Campaigns | M16-02 | Create, assign leads, see results. | M | Sonnet |
| M16-05 | Agency pipeline stages (proposed, unconfirmed: New, Contacted, Interested, Proposal Sent, Won, Lost, Nurture) | M16-01 | Stages editable, moves logged. | M | Sonnet |
| M16-06 | Never-dial list guard (AM-1 Roofing, FL, OK, DNC) in the dialer | M16-03 | Test: blocked numbers cannot be logged as called. | S | Opus |

### M17 Proposals, onboarding, billing

| ID | Task | Depends | Acceptance | Size | Model |
|---|---|---|---|---|---|
| M17-01 | Proposal builder (draft, never auto-sent; Problem, Agentic Solution, Roadmap, ROI) | M16-05 | Draft saved and rendered. | M | Sonnet |
| M17-02 | Price plans as data | M17-01 | Both price models loadable; no hard-coded price. | M | Sonnet |
| M17-03 | Client onboarding checklist and tenant creation from a won deal (no live provider calls) | M17-01, M12-05 | Fake client created end to end. | L | Sonnet |
| M17-04 | Stripe draft invoices from n8n (needs Abdullah's yes before any real Stripe write) | M17-02 | Stripe test mode only. Draft created and logged. | L | Sonnet |
| M17-05 | Payment received and dunning (test mode) | M17-04 | Fake failed payment starts dunning. | M | Sonnet |

### M18 Backup, digest, cleanup

| ID | Task | Depends | Acceptance | Size | Model |
|---|---|---|---|---|---|
| M18-01 | Twenty one-way backup of Kynetic data and tenant summaries (no personal data) | M12-02 | Test proves no client personal data in the payload. Writes need Abdullah's yes. | L | Opus |
| M18-02 | Daily digest to Abdullah | M15-01 | Fake data digest arrives. | S | Sonnet |
| M18-03 | Twilio click-to-call dialer (later, only after A2P and volume) | M16-03 | Deferred. | L | Opus |
| M18-04 | Update docs, progress, known issues | all | Docs match what was built. | S | Haiku |

## Order

M12 runs alone first. M13 and M16 can then run in parallel threads. M14 and M15 follow M13. M17 follows M16. M18 last.

## Not in this plan

Coastal Roofing tenant (on hold). Real provider calls, production deploys, DNS, n8n activation, writes to Retell, Twenty or Notion: each needs Abdullah's specific yes. Nora and Emily are untouched.

## Not confirmed

- Whether current portal lead webhook accepts every lead-source shape.
- What `backup.run` does.
- Counsel's view of consent logic in n8n.
- Final pipeline stages, review-request timing, Later items.
