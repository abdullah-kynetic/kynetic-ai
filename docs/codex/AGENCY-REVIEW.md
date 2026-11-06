# Agency steps 7–12 — local review

> Current status: [CURRENT_STATUS.md](CURRENT_STATUS.md). Agency base code was deployed to DEV at `c34b11a` per Mac output; subsequent UI refinements through `1eb4b8e` await deployment. Latest tests: 527 unit cases, 3 browser workflows.

All implementation is on dev/codex-setup. Nothing in this work deploys or changes production. The previous step-6 live-test gate remains; step 9's real TEST_PHONE send is also pending. Source and local tests do not establish deployed behavior.

## Choices confirmed by Abdullah

- Existing isolated synthetic agency tenant; only verified, active staff admins (Abdullah and explicitly provisioned cofounders). No new accounts, invites or memberships were granted.
- In-app new-lead alerts and daily summaries at 08:00 America/Los_Angeles; monthly reports. No external notification recipient/channel is enabled.
- SMS/email inbox plus manual inbound/outbound DM logging. No DM account connection.
- Last-seven-days dashboard: answered calls / attempted calls; unique messaged prospects replying after outreach / unique successfully messaged prospects. Failed messages and simulated sends are excluded; empty denominators display an em dash.
- Manual calls outside the portal and outcome logging. No vendor, AI call, live agent or automatic dialing.
- Editable manual task sequences; configured delays, no automatic dispatch; stop on reply, booking, opt-out/DNC, unavailable contact, or closed deal.
- Custom USD pricing per deal: setup, optional monthly fees, optional setup installments. Manual invoice/reminder drafts; no fixed plan prices.

## Screens to review on DEV (new UI requires deployment)

Start at `/admin/agency`. The workspace remains synthetic: fictional names, @example.test email addresses and reserved test phone fixtures only. Do not enter real prospects here.

1. **Agency dashboard** — create a synthetic lead, filter direction/channel, change pipeline stage; see immediate agency alert and seven-day rate counts. Alerts are agency-only, separate from client membership notifications.
2. **Inbox** — channel/status filters for native SMS/email and manually logged DMs. Manual DMs do not send anything. SMS/email compose links use the selected prospect.
3. **Compose** — save a draft, then check gates. With outbound disabled it reports blocked. Synthetic allowed-path tests use disposable local fixtures; no real sender is wired to this UI. Both email and SMS require consent; replies do not bypass gates.
4. **Campaigns** — create a campaign, assign a lead, save one to four task steps, enroll assigned leads. Due steps may be simulated or marked manually completed. History distinguishes simulation from manual completion and never counts either as a real provider call. Enrolled sequences are immutable; create a new campaign to change them.
5. **Operations** — client health overview and onboarding links; DEV workflow/webhook binding drafts are metadata only and never configure dispatch, call n8n, or activate a workflow. Secret status is masked; rotation is limited to the synthetic agency tenant and invalidates old signatures. No plaintext is returned by the agency UI. Digest preview and in-app scheduler do not send email/SMS.
6. **Billing** — enter agreed deal fees, make installments total setup exactly, create setup/installment/monthly invoice drafts. Billing-period retries deduplicate; conflicting snapshots reject. Simulate finalized/paid/payment-failed Stripe-shaped events locally. Overdue reminders remain drafts and disappear from the active reminder list after payment. The ledger is explicitly a stub, not evidence of real payment.

## Local verification

Run `bash scripts/checks/agency-local.sh` from the repository with Bun, psql and TEST_DATABASE_ADMIN_URL configured for a **disposable loopback PostgreSQL** maintenance database. The helper creates isolated test databases; it refuses remote hosts. It runs checks 7–12, typecheck, lint, unit/integration suites and a production build. Set AGENCY_BROWSER_CHECKS=1 to include browser review; Playwright Chromium must be installed or PLAYWRIGHT_CHROMIUM_PATH set to an installed executable.

Expected manual SKIPs: 9.2 (real TEST_PHONE send) and 12.3 (live Stripe). They are intentional authorization gates, not completed live checks. No tests here use provider APIs or Twenty writes. Base agency migrations were included in the user-confirmed c34b11a DEV deployment. Subsequent UI refinements have no new migration and still await a Mac DEV deployment.

## Remaining external verification

- Base agency code was deployed to DEV at c34b11a and its gate/auth evidence recorded. The later UI refinements remain undeployed; authenticated screen behavior and actual worker/schedule execution still need DEV verification.
- Sender-free DEV worker now registers agency maintenance and digest consumers. Durable schedules are tested locally; real 08:00 execution and deployed worker registration must be observed after DEV deployment. It registers no sender adapters.
- Actual email sender, explicitly approved email test recipient, DEV SMS configuration and any TEST_PHONE send remain separate. This UI intentionally has no real delivery adapter path.
- Stripe account integration, a signed public Stripe webhook endpoint and real invoices/charges are not enabled. The admin simulator processes Stripe-shaped payloads only.
- Existing manual dialer is a first-pass queue; campaigns can schedule later manual tasks. No callback dial or reminder is sent automatically.
- Twenty and n8n remote state are unchanged. No main/.github/production/live Alex changes.
