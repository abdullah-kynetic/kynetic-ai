# Automation map (draft, 2026-10-31)

Replaces the missing `docs/automation-map-draft.md`. Status comes from the Oct 30 brief plus a quick look at `crm/src/server` on branch `work`. Anything not checked in code is marked "not confirmed".

Rules from Abdullah's answers (2026-10-30):
- Kynetic cold outreach is human only (D-007 stays). AI calls and SMS go only to people who asked for contact.
- Dialer: your phone plus portal logging now. Twilio click-to-call is a later milestone.
- Billing plans are stored as data (Oct 25 prices or D-017, set per proposal). Stripe invoices are drafts for approval.
- Twenty backup is one way: Kynetic-side data plus per-tenant summaries with no personal data. Needs a new decision entry superseding DC-043.
- Booking stays on Cal.com.
- Alerts: email now, SMS to Abdullah once Twilio A2P is approved.
- Voice provider: ElevenLabs first. Retell is not built.
- **n8n runs the automations. The portal records everything and shows it live.** n8n decides consent, quiet hours and DNC. The portal logs each decision with its reason. This supersedes the portal-side `canContact` gate (needs a new decision entry).
- Reports: live portal dashboard plus a weekly email from n8n.

Open: none from the question list (stages, review timing and Later items settled Oct 31).

Source audit (2026-10-31): `docs/audit-M12-M20.md` corrects stale implementation claims below; `docs/portal-n8n-contract.md` maps every row to existing or proposed interfaces. Existing portal sequences, ElevenLabs/Retell adapters and scheduled database backups are implemented; replacement n8n flows remain pending. Historical workflow counts/activation were not checked live.

Legend: Owner N8N = runs in n8n. PORTAL = records and shows. Status: built, partial, missing, not confirmed.

## B. Client side (e.g. a roofer tenant)

| # | Automation | Owner | Status | Note |
|---|---|---|---|---|
| B1 | Lead intake from form, Meta, Angi, LSA | N8N catches, PORTAL stores | partial | Portal has `/api/hooks/leads/[tenantKey]` with signature check. No admin screen to issue the secret or n8n URL. |
| B2 | Dedupe and save lead, show live | PORTAL | built (not confirmed end to end) | `server/leads`. |
| B3 | Consent, quiet hours, DNC, state rules decision | N8N | conflict | Built in portal as `outbound/gate.ts` + `consent`. New plan moves the decision to n8n. Portal keeps the lists and logs the decision. |
| B4 | Start Alex call within about 60 seconds | N8N | partial | Portal call code is stub mode. ElevenLabs adapter is not live. |
| B5 | Call result back (outcome, transcript, recording) | N8N relays, PORTAL stores | partial | `/api/hooks/voice/[provider]` exists. |
| B6 | Alex checks slots and books | N8N + Cal.com | partial | Portal has `appointments/availability` and `book`. Cal.com wiring not confirmed. |
| B7 | Retries (5 min, 1 hour, next day, max 4) | N8N | missing | Sequences have no steps, nothing sends. |
| B8 | SMS follow-up | N8N | blocked | Twilio A2P not approved, sends fail. |
| B9 | Booked appointment moves deal stage | PORTAL | partial | M13-06 now targets `Estimate Booked`; PostgreSQL regression execution pending. |
| B10 | Appointment reminders | N8N | missing | Stubs. |
| B11 | No-show recovery | N8N | missing | Stubs. |
| B12 | New-lead alert to owner | N8N | missing | No `new_lead` alert. Hot-lead and deal-won alerts exist. |
| B13 | Missed-call text-back, after-hours, reactivation | N8N | partial | Code in `server/automations`. Cannot send until SMS works. |
| B14 | Review request 2 hours after payment received | N8N | missing | Decided Oct 31. Email until A2P, then text. |
| B15 | Daily metrics | N8N triggers, PORTAL computes | missing | Computed in `metrics/daily.ts`, never scheduled. |
| B16 | Weekly email report to client | N8N | missing | New requirement. |
| B17 | Monthly report | PORTAL page | partial | `reports/worker.ts` exists, never scheduled. |
| B18 | Opt-out and STOP handling | N8N acts, PORTAL records | partial | `/api/hooks/twilio/inbound`. Not confirmed. |
| B19 | Error alerts for failed workflows | N8N | missing | |

## A. Kynetic agency side (run as its own tenant)

| # | Automation | Owner | Status | Note |
|---|---|---|---|---|
| A1 | Inbound leads (site form, Cal.com bookings) | N8N in, PORTAL stores | missing | |
| A2 | Outbound lead lists by channel (cold call, SMS, email, DMs) | PORTAL | missing | Scraping stays in n8n or tools. |
| A3 | Human dialer queue: next lead, script, DNC flag, log outcome | PORTAL | missing | Phone plus log. |
| A4 | Campaigns | PORTAL | missing | |
| A5 | Agency pipeline | PORTAL | missing | Stages: New, Contacted, Interested, Proposal Sent, Won, Lost, Nurture. |
| A6 | Proposal draft for approval | PORTAL | missing | Never auto-sent. |
| A7 | Stripe draft invoices | N8N | missing | Needs approval before send. |
| A8 | Payment received, dunning | N8N | missing | |
| A9 | Client onboarding: create tenant, issue webhook secret, checklist | PORTAL | partial | Admin client screens exist. No secret issuing. |
| A10 | Daily digest to Abdullah | N8N | missing | |
| A11 | Agency reporting | PORTAL | missing | |
| A12 | Twenty one-way backup | N8N | missing | Needs new decision. |

## Fixes before launch

1. Sequence steps (B7), deal stage rule (B9), reminders and no-show (B10, B11), new-lead alert (B12), scheduling of B15 and B17, webhook secret admin screen (B1 and A9).
2. Move the consent decision from the portal gate to n8n (B3), with tests on the n8n side.

## Not confirmed

Whether the lead webhook accepts all the lead-source shapes. Whether voice and Cal.com wiring match what n8n would send. Which n8n workflows would be reused: 22 exist, all inactive.
