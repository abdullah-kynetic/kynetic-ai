# Kynetic — current completion plan

Updated **2026-11-06**, America/Los_Angeles. This is the **one active completion checklist**, replacing old steps 0–12, milestone/wave execution order, and any proposed 13–22 numbering. Old IDs remain evidence references; they are not the new step numbers. This consolidation authorizes documentation only, not implementation, deployment or external tests.

## How to use this plan

Status vocabulary: **NOT ASSESSED** = insufficient review; **PARTIAL** = some implementation/evidence exists but acceptance is incomplete; **BLOCKED** = a named permission, dependency or external prerequisite prevents completion; **VERIFIED** = all scoped acceptance has dated, revision-bound evidence. An unchecked external gate cannot be relabeled VERIFIED because stub tests pass. Status applies to the whole step, with blocked sub-gates named separately.

Start with step 1's baseline evidence reconciliation before executing dependent work. Reuse existing implementation. Record source revision, environment, exact command/test, actual result, fixture/provider mode, evidence path and approval reference for each acceptance result. Keep local, deployed DEV and approved external outcomes separate. A historical done tick is a claim to reconcile, not proof of operational completeness. Do not calculate a completion percentage from these unequal steps.

Keep dev/codex-setup, small tested commits as abdullah-kynetic <abdullah@kyneticai.com>, no AI/coauthor trailers, no force push or main merge. Preserve the Mac-script VPS handoff and three-consecutive-failure stop rule. All existing safety rules remain binding; the conflict register below documents old wording without weakening it.

## Active checklist

- [ ] 1. Baseline audit — PARTIAL
- [ ] 2. Security/access — PARTIAL
- [ ] 3. Runtime/recovery — PARTIAL
- [ ] 4. Lead intake/safety — PARTIAL
- [ ] 5. Agency sales workflow — PARTIAL
- [ ] 6. Communications/booking — PARTIAL
- [ ] 7. Metrics/reporting — PARTIAL
- [ ] 8. Contracts/billing/delivery — PARTIAL
- [ ] 9. End-to-end acceptance — PARTIAL
- [ ] 10. Production release — BLOCKED

## 1. Baseline audit

**Status: PARTIAL. Scope/dependencies:** establish a revision-bound inventory of built, partial, missing and unverified behavior across client and agency sides before treating any old completion claim as current. No implementation dependency; source/evidence access required.

**Reuse:** crm/ source, migrations, native CRM models, old BUILD_PLAN task IDs, security/accessibility reviews, Codex history and resource/evidence JSON. The November 6 remaining-work report is preserved as a snapshot, not another active plan.

**Missing implementation:** none authorized by this audit. Identify actual gaps rather than replacing completed components. **Missing verification:** code-to-requirement mapping for every old done claim, reachability of referenced commits, exact test coverage and deployed configuration. The source review is not a new complete code/security audit.

**Acceptance/evidence:** reconcile the traceability tables below against source and historical evidence; classify each requirement; name stale/contradictory claims; distinguish real from stub integrations; account for all blockers and deferrals. Record the observed branch/revision and preserve unrelated untracked portal/ without interpreting it as deployed code. No numbered 13–22 plan was found in the inspected planning inventory; its proposed scope must still be carried through explicit requirements, not invented IDs.

**Gates:** local documentation/source inspection only now. Future read-only DEV observation must retain provenance. External/provider writes are not baseline evidence and are not authorized.

**Recorded baseline, not rerun in this cleanup:** implementation/audit 1eb4b8e; prior status synchronization c290951; report save f5ce33b; confirmed DEV c34b11aa359c933410bfec5522d9ced32cdc3e7e from Abdullah's Mac output. Historical local results: 527 unit PASS, three Chromium journeys PASS, 13 agency checks PASS/0 FAIL/two manual SKIP, build/typecheck/lint pass with existing warnings. Those results do not cover all requirements below. Latest UI remains unconfirmed on DEV; signed-runtime repair, worker readiness and external booking/delivery remain unverified.

## 2. Security/access

**Status: PARTIAL. Scope/dependencies:** authentication, 2FA, roles, tenant isolation, request signatures, safe secrets and privacy. Depends on step 1 inventory; protects every later step.

**Reuse:** verified signed-cookie/DB sessions, active-admin and view-as guards, Better Auth, RLS/tenant services, API rate limits, signed intake/provider hooks, encrypted native secret rotation, existing security tests/review.

**Missing implementation:** close any source-confirmed gaps in invitations/recovery, disabled-user sessions, webhook replay protection, redaction, audit coverage and credential least privilege. Do not reintroduce anonymous admin or client-persona fallback. Implement protected-ID guards in tooling if the historical audit finding remains reproducible; never exercise those tools against protected resources.

**Missing verification:** actual Abdullah/cofounder identities and roles; real sign-in/2FA/recovery; expiry/sign-out/revocation; owner/VA/view-as denial; cross-tenant A/B read/write/export/storage/job isolation; webhook raw-body signatures, stale timestamps, duplicates and wrong tenants; rotation invalidates old signatures without displaying secrets. Recheck KI-002/005/006/007/008/013 and the duplicate KI-013 labels by title/date rather than assuming the same issue.

**Acceptance/evidence:** anonymous admin 401/403; non-admin 403; verified active admin allowed; missing/invalid second factor denied; disabled/expired sessions denied. Cross-tenant tests must fail before mutation. Malformed/old/unsigned hooks fail; valid synthetic signatures pass once. Compare credential separation by safe assertions, never printing values. Record current dependency/security regression evidence separately from the Oct 29 review.

**Gates:** local synthetic tests first; actual DEV auth and role checks via Mac handoff when needed; invite/email delivery requires an approved recipient, and DNS/provider configuration needs specific approval. No live portal request/change is implied. Counsel and A2P readiness remain external prerequisites, not automatically resolved by server-side code.

## 3. Runtime/recovery

**Status: PARTIAL. Scope/dependencies:** isolated DEV deployment, worker/queue execution, schedules, migrations, storage, backups, restore and rollback. Depends on steps 1–2; services must be operational before provider tests.

**Reuse:** scripts/deploy-dev.sh and server helper; isolated kynetic-dev-portal database/volume and loopback 3031; Caddy DEV site; restricted sender-free runtime worker; pg-boss schedules; existing migration, backup and storage infrastructure.

**Missing implementation:** only source-confirmed gaps in release markers, worker health, dead-letter/retry visibility, recoverable jobs, backfill, retention and approved backup destinations. Do not rebuild deployment or change production routing.

**Missing verification:** newest UI revision on DEV; actual worker readiness and TEST_PHONE configuration without printing it; least-privilege DB roles; queue consumers; scheduled execution; migration compatibility; off-server database/object backups and an isolated restore; rollback safety. The historical missing TEST_PHONE/stopped-worker diagnostic has no newer clearance. A helper being prepared is not evidence it ran.

**Acceptance/evidence:** deploy requested revision to DEV only; health/auth/gate markers and unchanged production evidence; synthetic durable job goes queued→running→completed; restart/crash recovery and duplicate suppression; observe schedules in Pacific time including DST; failed job does not stall others. Restore database plus objects into an isolated target, verify counts/tenant isolation, test rollback/migration recovery. Document RPO/RTO from actual exercises rather than inventing targets or outcomes.

**Gates:** local disposable database and fake storage first. VPS deploy/restart/configuration/DEV URL checking requires push, one committed Mac script, stop and wait for output. Keep providers stubbed/outbound off, persona switching off and all DEV workflows inactive. Production backup/restore changes and DNS are separate approvals. Never equate app health with worker health.

## 4. Lead intake/safety

**Status: PARTIAL. Scope/dependencies:** signed source intake, normalization, attribution capture, deduplication, consent, local business/quiet hours, opt-outs, frequency/attempt caps, retries and global/tenant kills. Depends on steps 2–3.

**Reuse:** crm/src/app/api/hooks/leads/, crm/src/server/leads/, crm/src/server/consent/, outbound gate, durable webhook jobs, chain unit/integration tests, signed DEV smoke helper and rollback gate verifier.

**Missing implementation:** assess source-specific form/Meta/Angi/LSA mappings, post-call result/failure normalization, reusable authenticated n8n gate reads, parity and per-attempt audit. Preserve UTM/source/campaign identifiers end to end. Resolve retry-policy contradictions before configuring cadence. Keep server-side consent and fresh final-boundary checks even if n8n orchestrates.

**Missing verification:** valid signed DEV intake, exactly one contact/deal under duplicate/replayed events, async processing/restart, zero provider requests on denied gates, quiet-hours future scheduling, opt-out cancellation of pending work, cross-tenant secret denial and live-config-independent clock tests. Existing Mac gates/unsigned rejection do not prove this full journey. Existing approved synthetic Twenty evidence does not prove continuous writeback.

**Acceptance/evidence:** table-driven invalid input, unsupported FL/OK, protected recipient/AM-1, missing consent, opt-out/STOP, global/tenant kill, quiet/business-hour edges/DST, caps and retry exhaustion; prove no sink invocation when blocked. A valid synthetic signed lead persists before any dispatch; replay creates no extra attempt/contact/deal. Booking/reply/opt-out/closure prevent retries. Verify stale delayed jobs recheck gates and uncertain outcomes reconcile before retry.

**Gates:** fake clocks/providers and local synthetic DB first; signed DEV-only smoke via Mac when requested; keep outbound disabled. Real call/SMS requires separate explicit yes and TEST_PHONE through the dedicated DEV agent/number. Twenty writes require exact dry run and yes. Do Not Call registry lookup remains deferred; internal do-not-contact and all other safety rules remain required. No emergency bypass may silently override an opt-out.

## 5. Agency sales workflow

**Status: PARTIAL. Scope/dependencies:** Leads, Pipeline, manual call history/callbacks, campaigns, manual DM tracking, daily work and shared CRM records. Depends on steps 2–4; reconcile schema/stages before migrating data.

**Reuse:** isolated agency tenant, direction/channel fields, contacts/companies/deals, lead list, native pipeline/Kanban, transactional in-app new_lead alerts, manual call logger, campaign engine, timeline/tasks and manual inbound/outbound DM feed. Existing Kanban implementation is reuse, not proof of the requested agency board.

**Missing implementation:** separate untouched/retry prospects in Leads from engaged opportunities in Pipeline through views of shared records, with stable contact/deal links and no copying. Configure: Interested/callback needed → Demo/audit booked → Completed → Proposal sent → Contract sent → Signed/awaiting payment → Paid → Onboarding → Active. Keep no-show/reschedule, nurture, lost and do-not-contact as explicit separate handling. Define Completed as attended/completed demo, never merely booked.

Add dated callbacks, repeated call attempts/history and requeue rules; current first-pass logger excludes a prospect after one outcome. Include owner, value, next action, stage age, filters, count/value/weighted totals, persistent drag/drop, optimistic-version conflicts, undo, audit and keyboard/mobile move alternatives. Validate undo after concurrent edits without overwriting newer work. Home needs today's calls/tasks and a needs-attention queue; clients/businesses/contacts/deals, inbox/calendar/contracts must be discoverable. Real-data import/enrichment needs validation/deduplication and synthetic separation, not relaxed DEV guards.

**Missing verification:** exact stage model, existing board behavior under concurrency, cofounder ownership/handoffs, callback due times, repeated attempts, campaign pause/resume and enrolled-sequence immutability, stops and attribution. Manual tracking remains the chosen scope; no new dialer or AI cold calls.

**Acceptance/evidence:** one prospect can change views/stages without duplicate records; moves survive reload and show actor/time; stale moves conflict; safe undo; keyboard/touch parity. Fixtures prove retries/callbacks appear when due, blocked leads never queue, repeated attempts dedupe by event, campaigns stop on reply/booking/opt-out/closure. Stage movement alone sends nothing, reserves nothing, invites nobody and charges nothing.

**Gates:** local seeded/browser tests first; authenticated DEV walkthrough later; any real-data import or external tracking write requires separate approval. Human call logging never authorizes placing a call. Keep TEST_PHONE-only external testing and protected business rules.

## 6. Communications/booking

**Status: PARTIAL. Scope/dependencies:** shared inbox ingestion, threaded SMS/email, real dispatch, calendar availability/booking, DEV ElevenLabs tools, notifications, reminders and no-show recovery. Depends on steps 2–5 and ready restricted runtime.

**Reuse:** native SMS/email records, Twilio inbound/status and Resend hooks, agency drafts/stub sink, gate previews, sender adapters, appointment/calendar services, DEV ElevenLabs inventory, inactive DEV notification workflows. bookDevSyntheticAppointment is internal simulation, not a Cal reservation.

**Missing implementation:** route agency receiving identities to the right tenant/prospect; unknown-sender handling; thread IDs/reply headers; search/pagination/unread/assignment as needed; final-boundary approved-recipient resolution; real agency dispatch adapter, durable idempotency and delivery/failure/bounce/complaint state. Separate agency configuration from implicit alex_core voice enablement. Add draft editing, calendar/event-type mapping, authenticated availability/booking handlers, identity/timezone propagation, reschedule/cancel, missed-call/after-hours/reactivation behavior and stale reminder/no-show suppression.

**Missing verification:** designated DEV agent has working booking tools (latest recorded GET had zero referenced booking tools), dedicated number assignment, sender/domain and A2P readiness, actual provider callbacks, duplicate/out-of-order events, real reservation reconciliation. A reachable Cal API or attached number is not a complete booking test.

**Acceptance/evidence:** signed inbound event appears once in correct thread/workspace; opt-out blocks future jobs; voicemail is not human pickup; any reply is not positive reply. Gate denial yields zero provider calls. Stub success is visibly simulated/excluded from real metrics. Retry/timeout never duplicates a send/reservation; partial calendar/portal success reconciles. Booked ≠ attended; no-show creates one safe recovery task/draft, rescheduling cancels obsolete reminders. Server authorization rechecks before every workflow-dispatched send; snapshot consent is not a permit. Reconcile exact Twenty writeback separately with dry run and approval.

**Gates:** local fake providers first; DEV ingestion/gates/synthetic booking without network actions next; real delivery/reservation/invitation requires an exact approved plan. Calls/SMS only TEST_PHONE via DEV agent and dedicated DEV number; email recipient separately agreed. Keep n8n workflows inactive; no live Alex, Nora, Emily or existing workflow changes. DNS/provider credentials/activation remain independent approvals.

## 7. Metrics/reporting

**Status: PARTIAL. Scope/dependencies:** seven-day pickup/reply rates, funnels, stage conversion, attribution, daily digest, client weekly summaries, persisted downloadable reports and schedules. Depends on reliable steps 3–6 event models; step 8 supplies payment/cost data.

**Reuse:** dashboard cohort/rate functions, native daily metrics, agency manual call events, report generators/storage worker, transactional in-app alerts and Pacific 08:00 digest/hourly maintenance schedules.

**Missing implementation:** reconcile agency_call_attempts with native calls rollups; unify dashboard/daily/monthly definitions; persist agency report artifacts independently of owner-email delivery; admin-authorized download/viewer; retry/backfill/regeneration and overdue schedule visibility. Campaign attribution must exclude pre-assignment events. Capture UTM/source/campaign through intake, deal, booking and payment.

**Missing verification:** deployed schedule execution; DST/month boundaries; late/corrected events; historical outages; report storage existence and access isolation; zero-denominator cohorts. Current generateMonthlyReport metadata can exist without stored content; scheduled row creation is not a downloadable report.

**Acceptance/evidence:** fixed datasets reconcile dashboard/funnel/campaign/digest/report totals with explicit numerator/denominator. Default seven days; pickup = human-answered/attempted calls (not voicemail); reply = contacted prospects who reply/contacted prospects, with explicit outreach/reply-window cohort. Track positive replies separately. Booked, attended, signed, paid and active are distinct. Exclude failed/stub/synthetic activity from real performance. Verify unique events, costs/currency, attribution and timezone boundaries. Report object is retrievable, correctly scoped and downloadable, not merely marked ready.

**Gates:** synthetic reconciliation/sender-free generation first; actual DEV schedule evidence via Mac handoff; external weekly/email/SMS report delivery needs approved channel/recipient and consent policy. Landing-page sessions→lead conversion analytics, ad spend/CPL and deeper finance/team dashboards are explicit later sub-items, not silently dropped or claimed built (see deferrals). Preserve attribution now so later analytics are possible.

## 8. Contracts/billing/delivery

**Status: PARTIAL. Scope/dependencies:** proposal/contract lifecycle, per-deal billing, reconciliation, won-deal onboarding, operating client health, updates/support, offboarding and financial/team reporting. Depends on steps 2–7; pricing is per deal, not an invented fixed plan.

**Reuse:** proposal drafts, native documents/onboarding/client administration/support/health, masked secrets and inert DEV binding drafts; custom USD setup/optional recurring/installment terms, immutable invoice snapshots, local billing event ledger and reminder drafts.

**Missing implementation:** contract draft→review→sent→signed/declined/expired lifecycle, versioned agreement/e-sign references and audit, explicit provider choice before external e-sign work; Stripe test customers/invoices/subscriptions and signed public webhooks; stable IDs, amounts/periods, replay/order handling and reconciliation. Decide credits/refunds/discounts/tax requirements deliberately. Add approved draft/applied DEV integration binding path, secure secret provisioning and partial-failure recovery. Rehearse won→tenant/checklist/documents/access/provider configuration without automatic live actions.

**Missing verification:** real test-mode Stripe integration (current events are admin-scoped simulations), exact installments and payment failures, custom-deal changes, contract signing evidence, actual DEV secret rotation and application, client update/support browser journeys, renewal/health signal freshness, offboarding cancellation/export and role revocation. Existing native support code is reuse, not proof of the whole service journey.

**Acceptance/evidence:** signed ≠ paid ≠ active; a stage change causes no message/reservation/invite/charge. Payment events authenticate and dedupe, wrong amount/currency/tenant rejected, partial failures recover without duplicate invoices. Dunning stays drafts until approval. Synthetic onboarding links one deal to one client with intentional manual approvals; no false memberships. Rotate only DEV secret, new accepted/old rejected, never log value. Client support/update status is visible to correct users; offboarding blocks sends and exports only that client. Unit economics, usage/cap pauses, revenue/expenses and team workload/cost reconciliation need explicit implementation/evidence, not billing ledger assumptions.

**Gates:** local stub contracts/billing/onboarding first; DEV sender-free flows next; Stripe test-account writes, Twenty sync/backup, e-sign sends/invites and provider provisioning each need specific authorization. No live Stripe without yes. Legal terms/guarantees/recording disclosures need counsel decisions. Additional invoicing connectors and advanced finance/team features remain explicit later scope pending selection.

## 9. End-to-end acceptance

**Status: PARTIAL. Scope/dependencies:** complete agency/client journeys, failure recovery, browser/mobile/accessibility and security regression, then individually approved external tests. Depends on scoped acceptance for steps 2–8; not every later enhancement blocks a deliberately bounded pilot, but exclusions must be explicit.

**Reuse:** chain tests, real-session browser fixtures, local-only disposable DB helper, restricted worker smoke, API/checker/evidence regressions, mobile/dark/reduced-motion scans and historical security/accessibility/load reviews.

**Missing implementation:** add tests only for actual uncovered acceptance, not mirrored implementation. Build deterministic fixtures for new stage semantics, repeated attempts, report artifacts, provider reconciliation and no-side-effect transitions.

**Missing verification:** full new agency stage journey, signed runtime acceptance on deployed revision, real account/cofounder flows, contract→payment→onboarding→support→offboarding, manual screen-reader review, current security/dependency regression and representative load. Historical 527 units/three Chromium journeys do not certify all of these. Historical load evidence exists for a bounded search workload; it does not certify current end-to-end production load.

**Acceptance/evidence:** synthetic intake→lead/pipeline→manual contact→demo booking/attendance→proposal/contract→payment→onboarding→client operations/report/support; opt-out/no-show/lost/nurture branches; crash/replay/timeout recovery. Browser coverage includes keyboard/touch, mobile overflow/targets, dark/reduced motion, pending/error/empty states and no-JS where supported. Confirm anonymous/non-admin/cross-tenant denial after each relevant change. Include manual screen-reader evidence and scoped numeric performance limits.

**Gates:** local synthetic acceptance then DEV revision-bound walkthrough via Mac. Before any real action, present exact action/recipient/agent/number/provider writes, dry-run payload, expected records, retry/recovery and restoration plan; wait for yes. Old step-6 full live test and old step-9.2 TEST_PHONE send remain separate explicit approvals under this new numbering. Reconcile uncertain actions before retry, prohibit unexpected follow-ups and restore outbound off. Three consecutive failures on one check means record blocker, commit/push and wait; this reorganization does not reset counters.

## 10. Production release

**Status: BLOCKED. Scope/dependencies:** readiness review, explicit release approval, production deployment, verification and monitoring. Blocked on unverified steps 2–9, runtime/provider prerequisites and absent explicit production approval. No production action is authorized by this plan.

**Reuse:** tested deployment/rollback infrastructure, migration conventions, health checks, backup/restore and monitoring foundations; reuse does not authorize the legacy production deploy path.

**Missing implementation:** close only readiness-review-confirmed gaps in monitoring thresholds, stuck-job alerting, log rotation, private diagnostics, release runbook and recovery ownership. Maintain strict separation between DEV/test records and real operations.

**Missing verification:** current production configuration and least-privilege credentials, isolation, approved accounts, backup/restore, migration/rollback, worker/schedules and provider readiness; human-approved release scope, outstanding risk acceptance and rollback trigger. Historical production assertions are not current observations.

**Acceptance/evidence:** review exact revision, schema compatibility, dependency/security results, scoped E2E evidence, consent/A2P/legal requirements and approved sender/provider configuration. Approval must identify target/action/revision; deployment must preserve protected services and produce health/auth/gate/worker/queue evidence. Verify only explicitly approved production journeys, monitor provider outcomes/failures and document recovery owner. No force push, main merge or .github edit in this docs task. A later production source/merge decision requires its own instruction.

**Gates:** documentation/readiness review is local; production/VPS work remains Mac-script handoff with push, stop and output verification. DNS, workflow activation, live calls/messages/bookings/Stripe and protected integration actions remain independent gates even after a deployment approval. A successful DEV deploy, polished UI or local green test suite is never production approval.

## Traceability: November 6 remaining-work review

Each row retains the unfinished implementation **and** unverified behavior in the named historical section of [REMAINING-WORK.md](REMAINING-WORK.md), also uploaded as kynetic-remaining-work-2026-11-06.md. Mapping is coverage, not acceptance. No additional Twenty read/write was performed in this consolidation.

| Historical report section | Active step(s) | Carried-forward acceptance or gate |
| --- | --- | --- |
| 1 Latest UI deployment | 3, 9 | Current revision, authenticated screen checks, stub/outbound-off/auth preservation |
| 2 Actual DEV workflows | 5–9 | Real-session persisted lead/inbox/campaign/ops/billing walkthrough and logs |
| 3 Accounts/cofounders | 2, 9 | Explicit identities, 2FA, session recovery/revocation, role/view-as denial |
| 4 Background worker | 3 | TEST_PHONE readiness, restricted consumers, job transitions, restart/recovery |
| 5 Signed intake | 4, 9 | Valid signature, durable processing, replay/cross-tenant denial, zero denied sends |
| 6 DEV ElevenLabs tools | 6, 9 | Designated DEV agent/number, authenticated booking tools, result reconciliation |
| 7 Actual calendar booking | 6 | Real versus simulated appointment, timezone, idempotency, partial failure |
| 8 Twenty writeback | 4, 6, 8 | Stable object mapping, retry without redial/rebook, exact dry run and approval |
| 9 Four notifications | 6 | Fresh server gates, stale suppression, error redaction/recursion, inactive workflows |
| 10 Real agency leads | 4, 5 | Real/test separation, business fields, imports/dedup, assignment, protected states |
| 11 Inbox ingestion | 6 | Signed receiving identity routing, threads/status/order/opt-out, pagination |
| 12 Actual SMS/email | 6 | Dispatch adapter, stored approved recipients, idempotency, outcomes, draft editing |
| 13 Email/DNS | 2, 6, 10 | Sender verification, SPF/DKIM/DMARC/MX preservation, approved recipient/DNS |
| 14 Manual calls/campaigns | 5 | Repeated attempts, dated callbacks, due work, safe enrolled edits and stop rules |
| 15 Metrics correctness | 7 | Manual/native reconciliation, seven-day cohorts, attribution, timezone/backfill |
| 16 Reports/schedules | 3, 7 | Persist/download authorized artifact, generate≠deliver, observe actual clocks |
| 17 Ops desk | 2, 8 | Inert versus applied bindings, secure rotation/provisioning, health/digest freshness |
| 18 Real Stripe | 8 | Signed webhooks, real test-mode objects/reconciliation, custom pricing, no live charges |
| 19 Won-deal onboarding | 8, 9 | Documents, client/access/configuration/checklist with explicit transition gates |
| 20 Full live test | 9 | Exact separate approval, one scoped provider action, reconciliation and outbound reset |
| 21 Production/reliability | 10 | Approved release, restore/rollback/monitoring, no inferred production certification |
| Non-scope, suggested sequence and user inputs | 1–10 | Retain explicit deferrals, dependency order and recipient/account/provider choices below |

## Traceability: former Codex steps 0–12

| Old step | Active steps | Remaining scope despite historical local acceptance |
| --- | --- | --- |
| 0 Dev setup | 2, 3, 6 | Actual runtime/senders/tools; isolated deploy evidence does not prove provider operation |
| 1 Foundation | 2, 9, 10 | DEV auth is separate from production; regression and human access checks remain |
| 2 Alex on ElevenLabs | 6, 9 | Resource/GET checks do not prove tools, actual calendar booking or live delivery |
| 3 Lead→booking chain | 4, 6, 9 | Signed DEV runtime, real booking, retry outcomes and approved CRM writeback |
| 4 Texts/alerts | 6 | Inactive workflow/stub formatter checks do not establish actual dispatch |
| 5 Onboarding documents | 8, 9 | File existence does not prove contract/client/billing delivery lifecycle |
| 6 Go-live | 9, 10 | Original full live-test approval and production release are separate gates |
| 7 Agency lead model | 3, 5, 7 | Required model/alerts exist locally; deployed execution and richer real data unverified |
| 8 Inbox/rates | 6, 7 | Real ingestion/threading, consistent rollups/cohorts and deployed evidence |
| 9 Messaging | 4, 6, 9 | Real adapter absent; original manual 9.2 send explicitly unrun |
| 10 Outbound engine | 5 | Manual selected; repeated attempts/callbacks and campaign lifecycle/attribution |
| 11 Ops | 2, 7, 8 | Deployed rotation/schedules, applied DEV bindings, health and digest correctness |
| 12 Billing | 8 | Stub only; real test Stripe/webhooks/contracts/reconciliation remain |

## Traceability: historical BUILD_PLAN M0–M11

Every task is retained, including historical done rows, to avoid losing unverified sub-scope. Source: [BUILD_PLAN.md](../BUILD_PLAN.md). The old status below is **not adopted** as current acceptance; each row requires the active step’s local/DEV/external evidence. Original resume notes/PR references remain in the source. Later/deferred labels do not erase acceptance.

| Legacy ID | Requirement | Historical status (claim) | Active step(s) |
| --- | --- | --- | --- |
| M0-01 | Create the repo app from the starter; remove Clerk, chat and demo pages | done | 2, 3 |
| M0-02 | CI and tooling: lint, typecheck, Vitest, Playwright scaffold, GitHub Actions; record the real commands in TESTING and CODE_STYLE | done | 2, 3 |
| M0-03 | Docker Compose (app, worker, postgres, caddy), Zod env validation, `/api/health` | done | 2, 3 |
| M0-04 | Database roles, extensions, session-variable helper functions, `app_enable_tenant_rls` | done | 2, 3 |
| M0-05 | Baseline migration part A: tenancy, users, memberships, invitations, modules, secrets, audit, terms, billing and onboarding tables | done | 2, 3 |
| M0-06 | Baseline migration part B: CRM tables (companies, custom fields, contacts, pipelines, deals, activities, tasks, notes) | done | 2, 3 |
| M0-07 | Baseline migration part C: calls, messages, consents, webhooks, integrations, alex_configs, appointments, metrics, automations, notifications, imports, documents | done | 2, 3 |
| M0-08 | `withTenant`, `withPlatform`, two-tenant and role test fixtures, cross-tenant isolation suite | done | 2, 3 |
| M0-09 | SECURITY DEFINER roll-up functions and the NOLOGIN `kynetic_rollup` role | done | 2, 3 |
| M0-10 | Better-Auth: Google sign-in, email magic links, server sessions, account linking rules, `src/server/auth` facade | done | 2, 3 |
| M0-11 | Roles and permission checks: `requireUser`, `requireRole`, `requireKynetic`, deny-by-default matrix | done | 2, 3 |
| M0-12 | Admin TOTP two-factor: enrol, recovery codes, enforcement, reset by another admin | done | 2, 3 |
| M0-13 | Module mechanism: `tenant_modules`, `requireModule`, `<ModuleGate>`, 403 MODULE_DISABLED, nav registry | done | 9 (plus owning step) |
| M0-14 | Audit helper and append-only `audit_log` (before and after) | done | 2, 3 |
| M0-15 | Events (`emitEvent`, `subscribe`), jobs facade on pg-boss, idempotent webhook ingest (`ingestWebhook`) | done | 2, 3 |
| M0-16 | Consent service: `canContact`, record and revoke consent, DNC entries | done | 2, 3 |
| M0-17 | `notify()`, notifications table access, `recordActivity()` | done | 2, 3 |
| M0-18 | `OutboundGate` stub with kill-switch check; `enrollInSequence` stub | done | 9 (plus owning step) |
| M0-19 | Adapter interfaces and fakes for voice, SMS, email; storage `{put,get,remove}` interface with a local fake | done | 2, 3 |
| M0-20 | Service tokens (hashed) and bearer auth for `/api/service/*` | done | 2, 3 |
| M0-21 | Error shape, Zod helpers, Postgres rate limiter, security headers, Origin/CSRF check | done | 2, 3 |
| M0-22 | Secrets: envelope encryption for `tenant_secrets`, env-key handling | done | 2, 3 |
| M0-23 | App shell: rebrand tokens, layout, sidebar, header, dark-mode toggle, Kynetic-branded sign-in page | done | 2, 3 |
| M0-24 | Base UI components (buttons, inputs, table, dialog, toast, badge, empty and error states) | done | 2, 3 |
| M0-25 | Terms and Privacy acceptance page | done | 2, 3 |
| M0-26 | Seed data: module catalog and prices, automation templates, two synthetic demo tenants | done | 2, 3 |
| M0-27 | Preview environment pipeline: per branch, own database, synthetic seed only | done | 3, 9 |
| M0-28 | M0 gate: run all M0 acceptance tests, update TESTING statuses, confirm docs match, record resume notes | done | 9 (plus owning step) |
| M1-01 | Contacts service: CRUD, E.164 normalisation, duplicate detection, soft delete, tags, owner, `contact.*` and manual `lead.created` events | done | 5 |
| M1-02 | Leads list page: table, search, filters, sort, column toggle, paging, URL-saved state | done | 5 |
| M1-03 | Contact detail page: details, phones and emails, consent status, slots for timeline and deals | done | 5 |
| M1-04 | Slide-out create and edit panel with duplicate warning | done | 5 |
| M1-05 | Companies service and pages (CRM Lite) | done | 5 |
| M1-06 | Custom fields: definitions, values, settings UI, list and detail rendering (CRM Full) | done | 5 |
| M1-07 | Bulk actions: tag, assign, status, delete; enrol-in-sequence stub (CRM Full) | done | 5 |
| M1-08 | Merge duplicate contacts: survivor selection, move deals, notes and activities, soft-remove the loser, `contact.merged` | done | 5 |
| M1-09 | M1 gate: acceptance, TESTING statuses, docs | done | 9 (plus owning step) |
| M2-01 | Pipelines, stages and deals services; default stages seeded per tenant; `deal.*` events | done | 5 |
| M2-02 | Kanban board page: drag between stages, counts and totals, optimistic move with undo, filters | done | 5, 9 |
| M2-03 | Deal detail and slide-out (value, service type, expected close, source, lost reason) | done | 5 |
| M2-04 | Multi-contact deals with roles (CRM Full) | done | 5 |
| M2-05 | Configurable stages settings page (CRM Lite) | done | 5 |
| M2-06 | M2 gate | done | 9 (plus owning step) |
| M3-01 | Activities read API and timeline UI on contact and deal | done | 5 |
| M3-02 | Tasks service, My Tasks view (overdue, today, upcoming), task slide-out (CRM Lite) | done | 5 |
| M3-03 | Rich-text notes with @mentions and pin (CRM Lite) | done | 5 |
| M3-04 | Task-due job and notifications | done | 5 |
| M3-05 | M3 gate | done | 9 (plus owning step) |
| M4-01 | ElevenLabs voice adapter: start outbound call, verify webhook, parse call result | done | 4, 6 |
| M4-02 | Retell fallback adapter | done | 4, 6 |
| M4-03 | R2 storage adapter and signed URL minting | done | 4, 6 |
| M4-04 | Lead intake endpoint `/api/hooks/leads/:tenantKey` (signed token) | done | 4, 6 |
| M4-05 | Call-end processing job: write `calls`, `activities`, copy recording to R2, store transcript and summary | done | 4, 6 |
| M4-06 | Outbound call start on `lead.created`: call windows, retries, real `OutboundGate` | done | 9 (plus owning step) |
| M4-07 | Compliance enforcement: quiet hours 8am to 9pm lead-local, DNC, disclosure, recording flag | done | 4, 6 |
| M4-08 | Twilio SMS adapter, status and inbound webhooks, STOP and HELP into consents | done | 4, 6 |
| M4-09 | Resend adapter, webhook, bounce and complaint suppression | done | 4, 6 |
| M4-10 | Calls list page | done | 4, 6 |
| M4-11 | Call detail page: player, transcript, summary, extracted fields, flag for review | done | 4, 6 |
| M4-12 | Messages log page (SMS and email, delivery status) | done | 4, 6 |
| M4-13 | `alex_configs` service and read-only Alex settings view | done | 4, 6 |
| M4-14 | M4 gate | done | 9 (plus owning step) |
| M5-01 | Availability function (business hours, existing appointments, buffers) | done | 6 |
| M5-02 | Appointments service and booking endpoints for the voice tool (token per tenant) | done | 6 |
| M5-03 | Appointments calendar page (month, week, day); create, reschedule, cancel | done | 6 |
| M5-04 | Appointment events to timeline and notifications | done | 6 |
| M5-05 | M5 gate | done | 9 (plus owning step) |
| M6-01 | `metrics_daily` roll-up job per the PRD metric definitions | done | 7 |
| M6-02 | Seed fixture with hand-computed expected dashboard numbers | done | 7 |
| M6-03 | Dashboard page: stat cards vs baseline, trend and source charts, activity feed | done | 7 |
| M6-04 | Guarantee progress component | done | 7 |
| M6-05 | Reports service, `ReportSection` registry, monthly ROI report job (email and page) | done | 7 |
| M6-06 | Reports page | done | 7 |
| M6-07 | M6 gate | done | 9 (plus owning step) |
| M7-01 | Automation templates, toggles per tenant and settings UI | done | 4, 6 |
| M7-02 | Sequence engine: steps, delays, stop on reply or booking; `enrollInSequence` | done | 4, 6 |
| M7-03 | Stage-move rules and alerts (deal won email, hot-lead SMS to owner) | done | 4, 6 |
| M7-04 | Notifications UI: bell, popover, full page with tabs, email delivery | done | 4, 6 |
| M7-05 | `quote_followup` module | done | 4, 6 |
| M7-06 | `after_hours` module | done | 4, 6 |
| M7-07 | `missed_call_textback` module | done | 4, 6 |
| M7-08 | `reactivation` module and `reactivation_batches` | done | 4, 6 |
| M7-09 | `followup_bundle` admin switch | done | 4, 6 |
| M7-10 | Service API routes and signed outbound events for n8n | done | 4, 6 |
| M7-11 | M7 gate | done | 9 (plus owning step) |
| M8a-01 | Admin layout and navigation, all-clients entry point | done | 2, 8 |
| M8a-02 | 30-second onboarding form: tenant, owner invite, modules, templates, branding | done | 2, 8 |
| M8a-03 | User management across tenants: invite, deactivate, reset, roles | done | 2, 8 |
| M8a-04 | View as client with banner, read-only default, logged sessions | done | 2, 8 |
| M8a-05 | Audit log viewer with filters | done | 2, 8 |
| M8a-06 | Modules panel: toggle per tenant, CRM level, history | done | 2, 8 |
| M8a-07 | Plan and tier fields and billing tab | done | 2, 8 |
| M8a-08 | Onboarding checklist and owner setup progress card | done | 2, 8 |
| M8a-09 | M8a gate | done | 9 (plus owning step) |
| M8b-01 | All-clients table with MRR, leads in 30 days, booking rate, guarantee status | done | 2, 8 |
| M8b-02 | Health score job and chips | done | 2, 8 |
| M8b-03 | Integration health: per-client and global, A2P status, delivery failures, bounces | done | 2, 8 |
| M8b-04 | Per-client Alex config admin, prompt versions, test call | done | 2, 8 |
| M8b-05 | Backups: nightly encrypted dump to R2, retention, restore test job, backups page, manual backup | done | 2, 8 |
| M8b-06 | Flagged-call review queue (admin side of F-28) | done | 2, 8 |
| M8b-07 | Operations tools: kill switch, webhook replay, job viewer, suspend, 2FA reset, demo reseed | done | 2, 8 |
| M8b-08 | M8b gate | done | 9 (plus owning step) |
| M9-01 | Import engine part 1: file intake (csv, xlsx, size and row limits, signature check), column mapping, mapping templates | done | 5, 9 |
| M9-02 | Import engine part 2: dry-run validation, dedupe on E.164 phone and lower-case email, duplicate rule skip or fill-blanks, report | done | 5, 9 |
| M9-03 | Import engine part 3: commit job, source and batch tags, no-outreach guarantee, undo with edited-record list | done | 5, 9 |
| M9-04 | Import wizard UI (upload, map, preview, report, commit) | done | 5, 9 |
| M9-05 | Import history page and undo UI | done | 5, 9 |
| M9-06 | Global search and Cmd+K (CRM Full) | done | 5, 9 |
| M9-07 | CSV export per table view (CRM Full, permissioned) | done | 5, 9 |
| M9-08 | Branding settings: logo upload, color with contrast check, business name | done | 5, 9 |
| M9-09 | Business settings: hours, service area, services, transfer number, team | done | 5, 9 |
| M9-10 | Client Alex settings: pause and call hours only | done | 5, 9 |
| M9-11 | Settings pages: tags and notification preferences (Lite) | done | 5, 9 |
| M9-12 | Documents page and admin upload | done | 5, 9 |
| M9-13 | Mobile polish pass on daily-use pages | done | 5, 9 |
| M9-14 | M9 gate | done | 9 (plus owning step) |
| M10-01 | Security review against the SEC checklist; fix findings | done | 2, 9 |
| M10-02 | Load test and set numeric limits | done | 9, 10 |
| M10-03 | Restore drill on the production-like stack | done | 3, 10 |
| M10-04 | WCAG 2.2 AA audit: axe plus manual keyboard and screen-reader pass | blocked | 9 |
| M10-05 | Production server setup: compose project, Cloudflare, Caddy, deploy script, monitoring and alerts | blocked | 3, 10 |
| M10-06 | Email domain and DNS records (SPF, DKIM, DMARC) | blocked | 6, 10 |
| M10-07 | Pre-go-live gates checklist, synthetic demo tenant script, old portal and `/api/ingest/results` fate recorded | blocked | 9, 10 |
| M10-08 | Pilot client onboarding using the real flow (with Abdullah's yes) | blocked | 8–10 |
| M11-01 | OPM tables and services (`presence_items`, `review_snapshots`) | done | 8 |
| M11-02 | Admin OPM status and task list per client | done | 8 |
| M11-03 | Owner Online Presence tab and `ReportSection` for the monthly report | done | 8 |
| M11-04 | M11 gate | done | 9 (plus owning step) |
