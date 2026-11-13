# [ARCHIVED 2026-11-09, technical detail only; status lives in ROADMAP 7bfdcb7e] DEV — Kynetic portal and agency: remaining build and test work — 2026-11-06

_Twenty note `834a4ff9`, created 2026-11-06, updated 2026-11-09. Exported 2026-11-12._

# Kynetic portal and agency — remaining build and verification work

Updated: 2026-11-06. Branch: `dev/codex-setup`.

This document preserves the detailed remaining-work review requested by Abdullah. It separates missing implementation, integrations to connect, and behavior still to prove on DEV. It does not change steps 0–6 or authorize external tests, production operations, outreach, Stripe charges, workflow activation or additional CRM mutations.

Earlier completion percentages were too confident about operational readiness. The portal and local foundations are well developed, but local/stub acceptance does not establish that messaging, booking, billing, reporting and background operation work with real providers.

## Verified baseline

| Item | Last recorded evidence |
| --- | --- |
| Implementation and UI audit | `1eb4b8e223a81d88d0a44e727fb04f73fdcbf910` |
| Status synchronization | `c290951` |
| Confirmed DEV deployment | `c34b11aa359c933410bfec5522d9ced32cdc3e7e` |
| Unit tests | 527 passing |
| Chromium agency journeys | 3 passing |
| Agency checks | 13 PASS, 0 FAIL, 2 manual SKIP |
| Build, typecheck and lint | Pass; existing lint warnings remain |
| Real agency outbound delivery | Not implemented in the agency dispatch path |
| Real Stripe operations | Not implemented |
| Step-6 live test | Not run |
| Production deployment | Not approved or performed |

These counts prove the documented local synthetic/stub checks, not provider delivery, deployed scheduling or production readiness. See CURRENT_STATUS.md, PROGRESS.md, AGENCY-REVIEW.md and vps-evidence.json alongside this report.

## 1. Deploy the latest UI to DEV

The last confirmed deployment contains the base agency features but predates the Motion/Impeccable/Unslop refinements. Deploy the current branch through the existing Mac handoff, confirm the deployed revision and inspect the new screens. Recheck stub providers, disabled outbound dispatch, anonymous-admin rejection and unsigned-intake rejection. The later UI changes require no new database migration.

A deployment success marker does not establish that authenticated agency workflows work. No production deployment is implied.

## 2. Verify the actual deployed agency workflows

The supplied Mac output proves isolated database/app health, root HTTP 200, sign-in HTTP 200, anonymous admin HTTP 401, unsigned intake HTTP 401, blocked safety gates, quiet-hours deferral, rolled-back fixtures and zero provider requests.

Still needed on the deployed app:

- Sign in as an actual authorized administrator.
- Create a synthetic agency lead and verify persistence after refresh and re-login, the new-lead alert, direction/channel filters and stage changes.
- Log a manual DM and verify the inbox filters.
- Save a message draft and prove the server blocks disallowed delivery.
- Create/assign a campaign, enroll a synthetic prospect, complete tasks and simulate advancement.
- Save an integration draft without changing a live integration.
- Save custom deal terms, draft an invoice, simulate billing events and generate a reminder draft.
- Inspect browser console and app logs for errors without exposing secrets.

Completion means these operations work with the deployed database, configuration and verified session—not only in local browser tests.

## 3. Abdullah and cofounder accounts

Verified active-admin guards exist. Actual accounts still need identification/provisioning, explicit role assignment and real sign-in verification. Check two-factor authentication where configured, session expiry/sign-out, account disabling and access revocation. Confirm owner/VA users and view-as sessions cannot enter agency administration.

No invitations or access grants were made by this review. A sign-in page returning 200 does not prove email delivery, Google authentication or account recovery. Cofounder identities and approval for any external invitation are needed before sending invitations.

## 4. Background worker and runtime readiness

An app can be healthy while no jobs are running. The last explicit readiness diagnostic reported TEST_PHONE absent from the DEV app and the DEV dispatch worker stopped. A repair path was prepared, but no newer readiness evidence clears those findings. The deploy script starts the restricted worker only when its runtime override exists.

Verify current worker status, release marker, database role and queue access. Process a synthetic job and inspect its state transitions. Restart the worker under control and prove recovery, isolation of failed jobs and absence of duplicate processing.

The restricted worker intentionally does not register real voice/SMS/email adapters. Preserve that boundary until a separately approved test. Completion means an actual synthetic job is processed on DEV, not merely that a container exists.

## 5. Signed lead-intake chain

Local coverage includes signatures, invalid/unsigned requests, deduplication, processing, consent, quiet hours, kill switches, retries and fixture rollback. The supplied DEV output proves unsigned rejection and the safety-gate verifier; it does not prove the entire signed intake path.

Submit a valid signed synthetic intake and verify exactly one contact/deal. Replay it and prove deduplication. Verify asynchronous processing, zero provider requests on blocked paths, a future retry time for quiet-hours deferral, restart recovery, correct tenant-secret selection and cross-tenant denial.

This verification can remain synthetic and provider-free: no call, SMS, calendar reservation or Twenty write is required.

## 6. DEV ElevenLabs tools and integration

A DEV agent and dedicated number are recorded. The latest read-only evidence showed two system tools and zero referenced booking tools. Number attachment and a successful GET do not prove booking capability.

Read the current designated step-2 DEV agent configuration; do not confuse it with the initial empty setup agent. Configure availability/booking tools on DEV only, their server handlers, the DEV calendar/event type, identity propagation, authenticated tool requests, validated inputs, timeouts and honest failures. Verify outcome writeback to the portal and recheck number assignment.

Test timezone-correct availability, closed-slot rejection, one booking under retries, uncertain-timeout reconciliation, honest tool-error responses and matching portal/calendar records. Changes/cancellation need their own scope if required. Do not modify live Alex. Client callback AI remains separate from the agency's selected manual calling workflow; no AI cold-calling feature was authorized.

## 7. Actual calendar booking

`bookDevSyntheticAppointment` in `crm/src/server/leads/dev-chain.ts` creates an internal DEV appointment with a simulation identifier. It does not reserve a Cal.com slot.

Build/verify provider availability and booking integration with the intended event type, duration, timezone and participant identity. Add idempotency and reconcile both partial-success directions: provider succeeds while portal persistence fails, and portal state exists while provider fails. Reconcile uncertain timeouts before retrying; prevent duplicate reservations and distinguish proposed from confirmed appointments.

Calendar invitations can send email. Any real reservation or invitation needs its own approval. Completion requires an approved real reservation correctly linked to the portal, rather than a simulated BOOKED state.

## 8. Twenty writeback

Four previously approved synthetic operations have evidence in `step3-twenty-evidence.json`. Their BOOKED state was a simulation, not proof of continuous provider-to-CRM writeback.

Remaining integration work: map stable object/field IDs; define matching and deduplication; enforce test/dev tags; reconcile a successful booking followed by failed CRM writeback; retry CRM work without redialing or rebooking; surface failure state; exclude protected records.

Before further business-record writes, show the exact dry run: object, target, fields, values, DEV classification and deduplication behavior, then wait for Abdullah's yes. Never DELETE or touch Kynetic Restoration (Demo). Creating this specifically requested documentation is separate from authorizing lead/client mutations.

## 9. Missed-call texts, reminders and alerts

Four DEV notification workflows were imported inactive: missed-call, reminder, owner-alert and error-alert. They have disabled sends, no approved delivery credentials, TEST_PHONE expressions and synthetic gate snapshots.

Build/verify real trigger identity and server-side dispatch rechecks; stale/cancelled reminder suppression; deduplication; quiet-hours deferral; global and tenant kills; redacted error payloads; recursion prevention for error alerts; delivery-result persistence.

Workflow input claiming consent must never substitute for a fresh server-side eligibility decision. Build that boundary first. Workflow activation requires separate permission; permitted synthetic/manual DEV tests can leave workflows inactive.

## 10. Agency lead model for real business use

Current DEV entry deliberately enforces synthetic addresses/numbers, and manual calling rejects non-synthetic prospects. It is not ready for importing a real prospect list.

Before real data: explicitly separate real-data workspaces from DEV; define business/contact fields, editing, assignment, import validation, duplicate detection/merge, ownership/handoffs, test-data exclusion from metrics and internal do-not-contact/protected/closed states. Keep the Florida/Oklahoma client exclusion.

Current creation captures contact name, email, optional phone, state, direction and channel. Business name, website, contact role, owner, source detail and structured notes may need additions using the existing CRM model. Do not relax DEV guards as a shortcut to real-data support.

## 11. Unified inbox and inbound ingestion

The inbox reads native SMS/email records and manually tracked DMs with local filters. Actual communications ingestion still needs agency routing. Existing Twilio inbound/status and Resend hooks are foundations to reuse.

Map receiving numbers/addresses to the workspace and senders to prospects. Handle unknown senders safely; verify signatures, event deduplication, delivery state, timestamps, out-of-order events, tenant isolation and opt-outs that block future sends.

The current interface is a feed rather than a full threaded mail application. Reply links select a prospect/channel but do not supply provider email-thread headers. The query limit is 100. Search, pagination, unread state, assignments and richer threads are operational improvements to consider. DMs intentionally remain manual; no LinkedIn or other DM account is connected.

## 12. Real SMS/email composition and delivery

`crm/src/server/agency/messaging.ts` explicitly has no network adapter. It saves drafts, previews safety gates and records allowed operations as agency stub activity.

Implement a real dispatch abstraction with approved senders, stored-recipient resolution, TEST_PHONE enforcement at the final SMS boundary, an explicitly approved email recipient, fresh consent/quiet-hours/kill checks, durable idempotency, provider identifiers, delivery/failure/bounce/complaint/opt-out handling and uncertain-timeout reconciliation. Keep simulated activity separate from real delivery.

The current preview uses the `alex_core` module; agency configuration must not implicitly enable voice. The form only accepts synthetic numbers, so an approved TEST_PHONE test needs a controlled server fixture/provisioning path, not arbitrary real-number entry. Email replies need thread identifiers/headers. Draft editing/revision also needs a usable path beyond create-and-preview.

Flipping PROVIDER_MODE does not implement delivery. Completion requires an explicitly approved delivery, provider result, duplicate prevention and proven blocking paths.

## 13. Email sender and DNS readiness

Resend and `mail.kyneticai.com` appear in the architecture, but the inventory is not verification of the current account/domain.

Confirm account access, sender/domain ownership, existing DNS, SPF/DKIM/return-path configuration, DMARC alignment and provider verification while preserving inbound MX records. Verify an approved recipient receives an authenticated message and signed webhooks are handled.

DNS changes require explicit permission. Authentication mail, invitations, notifications and reports are separate email paths with intentional policies; possessing an API key proves none of them.

## 14. Manual calls and campaigns

The selected product is: call personally outside the portal and log outcomes. No dialer vendor or AI calling is needed.

The current first pass accepts one call outcome per contact, then removes that contact from the queue and rejects a second new log. Callback is an outcome without a dated reminder. Add multiple attempts with stable event IDs, history, callback scheduling and requeue eligibility. Recheck protected/do-not-contact/closed states and prevent duplicate clicks.

Campaign enrollment, delays, manual completion, simulation and stop conditions exist. Remaining operational improvements include a due-today queue, reminders, pause/resume behavior, safe changes to enrolled sequences and attribution. UI supports four steps while the server supports twenty. Current campaign outcomes can include activity before assignment, so they are not reliable campaign attribution yet.

Stops are checked when advancing; immediate event-driven stopping is an additional behavior to decide. Historical opt-out stopping is deliberately conservative; later re-consent/new-campaign rules need explicit treatment before changing that safety behavior.

## 15. Metrics accuracy and reconciliation

The agency dashboard reads manual call attempts from `agency_call_attempts`, while scheduled rollups read native `calls`. A manual attempt can affect the dashboard without appearing in monthly call totals.

Unify or reconcile those sources. Align dashboard, campaign, daily and monthly definitions; prevent double counting; exclude simulation; define UTC daily buckets versus Pacific presentation; handle late/corrected events, outages, backfills, month boundaries and daylight-saving changes.

The seven-day reply cohort currently requires outreach and response within its chosen window. A prospect contacted before the window but replying inside it may be excluded; document the denominator precisely. Completion requires controlled fixtures that reconcile across all views, not merely independent percentage unit tests.

## 16. Usable monthly reports and actual schedules

Agency maintenance calls `generateMonthlyReport`, which creates metadata and returns report sections. The separate generic delivery worker persists report content and emails tenant owners. Agency maintenance does not perform that storage write, so a ready row does not guarantee a downloadable artifact.

Implement sender-free agency report persistence, an authorized administrator viewer/download, corrected metrics, regeneration and backfill. Do not invent tenant memberships or reuse the generic email-delivery worker blindly. Separate generation from any approved delivery.

Maintenance currently rolls up today/yesterday and creates the previous month's report when absent; this is not full historical recovery. Observe actual hourly maintenance, the 8 a.m. America/Los_Angeles digest and monthly generation on DEV. A scheduler row or function test does not establish that deployed jobs execute.

## 17. Operations desk

Health overview, onboarding links, secret status/rotation, digest preview and DEV integration metadata exist. Webhook/n8n fields are inert drafts, not applied runtime dispatch bindings or n8n API configuration.

Add an explicitly approved DEV application path with draft/applied distinction, safe connection testing, an audit trail, partial-failure handling/rollback and strict target validation.

Secret rotation uses encrypted native storage and invalidates the old signature without exposing plaintext in the UI. The external DEV producer still needs secure provisioning of the replacement secret without logging it.

Verify intended client coverage, whether the agency itself belongs in that list, health freshness, drilldowns and actionable failures. Test digest behavior when the requesting administrator becomes disabled. The current digest is a small aggregate; richer failed-job, overdue-task and client-link content would be additional implementation.

## 18. Real Stripe integration

Existing work is local/stub: custom terms, installments, draft invoices, simulated events and reminder drafts. It does not create real customers/invoices/subscriptions, finalize/send invoices, collect money or expose a signed public Stripe webhook.

Build deal-to-customer mapping; per-deal setup and optional recurring amounts; Stripe test-mode prices/invoices/subscriptions; currency, installments, due dates and billing periods; stable stored Stripe IDs; signed endpoint verification; event deduplication/order/retry handling; reconciliation; and explicit cancellation/change behavior. Decide refunds, credits, discounts and taxes if needed. Keep invoice delivery and collection under separate controls.

Test success, payment failure, recurrence, cancellation and webhook retry/reconciliation in test mode; review exact amounts before any live operation. Per-deal pricing is already an adequate product decision—fixed published plans are not required to proceed with test-mode implementation. No live charges without explicit yes.

## 19. Won-deal onboarding end to end

Onboarding documents and native client onboarding exist, but the entire agency-won-deal to operating-client journey remains unproven.

Rehearse synthetic proposal/terms, agreement, billing setup, client workspace, users/roles, intake secret, calendar, DEV agent/number, integration bindings, consent setup, checklist and explicit go-live gate.

Define which transitions are intentionally manual versus automatic. Moving a deal to won must not accidentally send invitations or create live integrations.

## 20. Step-6 full live test

This has not run. Verify the individual integrations and runtime first.

Prepare an exact test plan identifying the DEV agent and dedicated DEV number, TEST_PHONE from environment without printing its value, synthetic consent/timezone, gate state, whether booking/messages/email/Twenty writes are included, expected records and timeout/recovery behavior.

Observe accepted intake, exactly-once processing, safety decisions, one specifically approved provider action, conversation/tools, booking if included, portal outcomes and only approved writeback. Prevent unexpected follow-ups. Reconcile uncertain results before retrying and restore outbound-disabled state afterward.

Approval for one call does not authorize an additional SMS, email, calendar invitation or CRM mutation. Wait for Abdullah's explicit approval before the full live test.

## 21. Production release and reliability

Production readiness is separate from DEV success. Review revision/migrations, production configuration and secrets, account access, backup/restore, rollback, worker recovery, stuck-job/failure monitoring, private logs, real/test data isolation, pagination and performance.

Reuse the existing foundations rather than rebuilding them. Current tests do not certify load testing, independent penetration testing, every browser or a production restore drill. A finished-looking UI is not approval to deploy production.

## Intentionally outside the remaining scope

- Agency AI cold calling was not selected; manual calling needs no dialer vendor.
- DM account integrations were not selected; manual inbound/outbound tracking is intentional.
- Fixed Stripe prices are unnecessary for per-deal billing.
- Do Not Call registry checks remain explicitly deferred; internal do-not-contact, consent and protected-recipient rules still apply.
- Additional decorative redesigns or paid assets are not required. The UI refinements already exist in code.
- No promotional story/video was requested.

## Recommended completion order

| Order | Work |
| --- | --- |
| 1 | Deploy latest UI to DEV and verify administrator/cofounder access |
| 2 | Verify worker readiness and signed synthetic intake |
| 3 | Correct metrics aggregation and persist usable reports |
| 4 | Support repeated manual attempts, callbacks and agency workflow |
| 5 | Implement controlled DEV SMS/email delivery |
| 6 | Complete DEV booking tools and calendar integration |
| 7 | Finish notification boundaries and separately approved writeback |
| 8 | Implement Stripe test-mode integration |
| 9 | Run individually approved external integration tests |
| 10 | Run the explicitly approved step-6 live test |
| 11 | Complete production readiness review and seek release approval |

## Information and approvals eventually needed

Cofounder account identities; approved sender and email-test recipient configuration; DEV calendar/event-type setup; Stripe test-account access; and explicit approvals for external tests. These do not all need answers immediately: independent implementation can continue without real provider actions.

## Evidence references

- `docs/codex/CURRENT_STATUS.md`: current implementation/deployment distinction.
- `docs/codex/PROGRESS.md`: historical acceptance and check evidence.
- `docs/codex/vps-evidence.json`: user-reported DEV deployment/auth/gate output.
- `docs/codex/dev-live-test-readiness.json`: historical read-only provider readiness.
- `docs/codex/dev-resources.json`: designated DEV resource inventory.
- `docs/codex/step3-twenty-evidence.json`: the four previously approved synthetic operations.
- `docs/codex/AGENCY-REVIEW.md`: screen/test guide.
- `docs/ui/AGENCY-DESIGN.md` and `docs/ui/UNSLOP-REVIEW.md`: UI work and review.

This report is an engineering snapshot, not a new execution authorization. Preserve all existing safety and approval boundaries while resolving it.

