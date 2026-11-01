# Architecture

Kynetic Client CRM & Portal.

Sources, in order: `DECISIONS_locked.md` (Oct 25, 2026; wins on any conflict), `SPEC_client_crm_portal.md`, `docs/PRD.md` (feature IDs F-01 to F-106, module catalog, acceptance criteria; authoritative for IDs, module keys and milestone tags), and the existing `portal/` in `abdullah-kynetic/kynetic-ai` (Next.js 16, Postgres RLS, Auth.js v5 beta, live on the OVH VPS at portal.kyneticai.com). Project memory (2026-10-22): Abdullah chose ElevenLabs as the voice platform, reversing Retell (D-018, not yet re-decided in the repo).

Labels: **Confirmed** = in the decisions or spec. **Decided** = approved by Abdullah on 2026-10-25 (explicitly, or as the recommended option when he told us to take it). **UNRESOLVED** = needs outside information. "Not configured" = a command or setting not verified for the new app.

## System purpose

A Kynetic-owned CRM and client portal for home-service businesses. Alex (the AI voice agent) and the other Kynetic systems write leads, calls, messages and appointments into the client's own tenant. The client sees what happened and what it earned against a baseline captured at signup (spec Section 1). Kynetic runs every client from one admin side.

Constraints taken from the sources:

- Client data lives in Postgres with row-level security per tenant. Twenty holds no client data; it stays Kynetic-internal (Confirmed).
- Base is the Kiranism next-shadcn-dashboard-starter (MIT). Drop Clerk. Atomic CRM is a reference for the data model and screens only. No AGPL code is forked (Confirmed).
- Every Kynetic system and upsell has a backend and is toggled on or off per tenant. With a module off, its routes return 403, its jobs no-op, and its data is kept (Confirmed; PRD F-70).
- Self-hosted in Docker on Abdullah's server, Cloudflare in front. Deploys are preview-only until Abdullah approves (Confirmed).
- Backups: nightly encrypted offsite, 30 daily and 12 monthly kept, monthly restore test (Confirmed).
- Commits authored `abdullah-kynetic <abdullah@kyneticai.com>`; merges `--no-ff`; secrets never printed or committed (Confirmed).
- Not building in v1: PRD "Not building" list and spec Section 11.

## Stack decisions

| Layer | Selected technology | Reason | Constraints |
| --- | --- | --- | --- |
| Frontend | Kiranism next-shadcn-dashboard-starter: Next.js 16, React 19, Tailwind 4, shadcn/ui, TanStack Table/Query/Form, Zod, Recharts, dnd-kit, kbar (Confirmed) | Dashboard shell, tables, kanban and Cmd+K already exist | Strip Clerk and demo routes (F-52). Client branding swaps logo and primary color only (spec Section 9). Visual tokens come from DESIGN_SYSTEM.md. |
| Backend/API | One Next.js app: server actions for UI mutations, route handlers for webhooks and service calls; a worker process from the same image for jobs (Confirmed by spec diagram) | One codebase, one image | Server enforces every permission and module flag. The UI only hides. |
| Jobs | pg-boss on the app's Postgres (Confirmed 2026-10-25) | No extra service; retries and delayed jobs | Confirm before M0 merges. Queue lives in its own schema, not tenant-scoped. |
| ORM and migrations | Drizzle ORM (Confirmed 2026-10-25). The existing `portal/` already uses Drizzle 0.45. | Typed schema; migrations reviewable in CI | RLS policies are hand-written SQL migrations, not generated. See PRD OD-4. |
| Database | Postgres 16 (Confirmed). RLS forced on every tenant table. Roles: owner (migrations only), app, worker (SECURITY 2.3.4). | Required by decisions | App and worker connect as non-owner roles with no `BYPASSRLS`. The owner role never runs in the app's environment.
| Authentication | Better-Auth with Google sign-in and email magic links, behind the `src/server/auth` facade (Decided 2026-10-25, PRD decision 2). Admin 2FA (TOTP, Better-Auth two-factor plugin) is in v1 (F-98). | Matches the spec; keeps the choice inside M0 | Clerk is dropped (Confirmed). |
| App email | Resend (Confirmed 2026-10-25). Existing portal already has a Resend path. | Branded sender; bounce and complaint webhooks | Behind the `EmailProvider` interface. |
| Voice | ElevenLabs is the primary provider; the Retell adapter stays as a fallback (Decided 2026-10-25, PRD decision 3). Abdullah assigns the D-number in the repo decision log. | Platform choice is configuration, not code | `alex_configs.provider` and `calls.provider` carry the provider name. |
| SMS | Twilio (Confirmed, spec Section 6) | Existing sender number | A2P campaign is not approved (sends fail 30034 per memory, 2026-10-22). No SMS-dependent module can go live until it is. UNRESOLVED (needs Twilio): A2P approval and per-tenant sending numbers. |
| Workflows | n8n, the self-hosted VPS instance (memory 2026-10-21). Runs cross-system workflows; calls our API with a service token. | Existing Kynetic workflows | New n8n workflows are built inactive; activation needs Abdullah's yes. |
| Files | S3-compatible storage (R2) behind the `{put, get, remove}` storage interface. Recordings are copied to R2 under the tenant prefix and served by signed URL (F-27). | Matches existing portal storage | Decided 2026-10-25 (recommended option approved). |
| Hosting | Docker Compose on the OVH VPS as a separate compose project with its own Docker network and its own Postgres (`app`, `worker`, `postgres`, Caddy). Cloudflare for DNS, TLS, WAF. No ports exposed except through Cloudflare. | Confirmed by spec and decisions | Decided 2026-10-25 (recommended option approved): `portal/` keeps running until M10 and Twenty's database is untouched. A separate VM is a Later hardening step. Caddy, as the existing portal uses. |

## System boundaries

- **Client (browser) owns:** rendering, optimistic UI (kanban drag, task completion, inline edits), URL-saved table views. It never holds provider keys and never decides permissions or whether a module is on.
- **Server owns:** authentication, tenant resolution, role checks, module-flag checks, Zod validation on every entry, business rules (dedupe, consent, quiet hours, booking rules), audit logging, webhook signature checks, idempotency, and every provider call. Provider keys are encrypted at rest and decrypted only server-side (F-87).
- **Postgres owns:** the last line of tenant isolation (RLS, F-72), uniqueness (`webhook_events`, dedupe keys), and the append-only `audit_log` (UPDATE and DELETE refused, F-60).
- **Worker owns:** webhook processing, retried provider calls, sequence steps, scheduled jobs, rollups (`metrics_daily`), the monthly report, reminders, backups. Every job is idempotent.
- **External services own:**
  - Voice provider: call execution, recording, transcript. On failure the call is marked failed; retries follow `alex_configs.retry`; integration health shows the error count (F-62).
  - Twilio: SMS delivery, numbers, A2P status, carrier-level STOP. A failed send is stored with its error and is not retried on registration errors.
  - Resend: email delivery and bounce or complaint webhooks.
  - n8n: long workflows. Its failures show in integration health; the app never blocks on n8n.
  - Google: sign-in now; Calendar sync is Later (F-25).
  - Cloudflare: DNS, TLS, WAF.
- **Out of scope:** everything in spec Section 11 and PRD "Not building"; Twenty as a store of client data; native apps; custom domains (F-40) and the public booking page (F-46) in v1.

Timing rule (resolves spec Section 10 against the sequence design): no polling of external systems and no timers that sync data. Delayed and scheduled jobs inside pg-boss are allowed (sequence steps, reminders, the monthly report, the backup trigger). Data arrives by webhook or by user action.

## Request and data flow

Interactive write (example: drag a deal to a new stage, F-16):

1. The client component applies the change optimistically and calls a server action.
2. The action validates input with Zod and reads the session.
3. `withTenant(ctx, fn)` opens a transaction, sets the session context from DATABASE.md: `app.tenant_id`, `app.user_id`, `app.role` (owner, staff, admin, va or system), `app.read_only`, and `app.impersonator_id` when viewing as a client. If the action belongs to a module, `requireModule(ctx, key)` runs first.
4. The service writes the row, calls `recordActivity()`, `audit()` and `emitEvent()` inside the same transaction, and commits.
5. Success confirms with a toast (with undo where possible). Failure rolls the card back and shows a retry toast (spec Section 9; F-16).

Inbound webhook (example: voice call ended, F-26 and F-27):

1. The provider calls the route handler through Cloudflare. The handler verifies the signature, resolves the tenant from the path key, and inserts into `webhook_events(source, external_id)`. A unique violation is a replay: return 200 and stop (F-77).
2. The handler enqueues a job and returns 200 quickly.
3. The worker claims the job, opens `withTenant`, writes `calls`, `activities`, `contacts` and `consents` as needed, emits `call.completed`, and sets `processed_at` (or `error`).
4. Failures retry with backoff; exhausted jobs stay visible in integration health (F-62).

Outbound action (example: a new lead starts an Alex call, F-78):

1. A subscriber to `lead.created` checks the module flag, then the `OutboundGate` (below).
2. The `VoiceProvider` adapter places the call with an idempotency key (`tenantId:contactId:trigger:attempt`).
3. The result is written to `calls`; the provider's callbacks return through the inbound flow.

`OutboundGate` calls `compliance.canContact(ctx, contactId, channel, now, opts?: { purpose? })` (the tenant comes from `ctx`; the contact is loaded inside), which SECURITY owns and which returns allow or one deny reason: `no_consent`, `consent_revoked`, `opted_out`, `internal_dnc`, `quiet_hours`, `module_off`, `tenant_suspended`, `alex_paused`, `outbound_disabled`, `sms_not_approved`, `rate_cap`, `unknown_timezone`. A deny writes an activity "blocked: reason" and does not call the provider. Feature code never imports a provider adapter directly (SECURITY SEC-T-13).

Onboarding import (F-90 to F-96, owner M9; the admin entry point is a button on the tenant page in M8a):

1. A Kynetic admin opens a tenant and uploads a CSV or XLSX. The route checks role (admin only), size and type, streams the file to private storage under `tenant_id/imports/`, and creates an `import_batches` row (`uploaded`).
2. The admin maps columns. The mapping is stored on the batch and can be saved per source.
3. A dry-run job parses the file in the worker, validates every row with the same Zod schemas as the forms, finds duplicates on E.164 phone and lower-case email, and writes only `report` and counts on the batch (`dry_run_ok` or `dry_run_failed`). It writes nothing to contacts, companies, deals or notes.
4. The admin reads the report and commits. Commit is refused unless the latest dry run for the same file hash and mapping succeeded. Contact, company, deal and note rows use tenant-scoped import entry points, write `imported_source`, `import_batch_id` and `external_id`, and create `import_batch_records` rows for undo. Row validation failures are reported while valid rows continue; an injected worker interruption after a completed row marks the batch failed and leaves prior rows undoable. Database-level transaction failures still roll the transaction back as a whole.
5. Imports do not use lead intake or emit `lead.created`; deal imports also suppress stage/outcome automations. This prevents import-time outreach. Imported notes are plain text escaped into the rich-text storage format and linked by source external id. The `OutboundGate` still decides every later call or text, so an imported contact with no consent is blocked (F-96).
6. Undo is a job: soft-delete records created by the batch, restore `filled_empty` values, skip and list records edited after import, then mark the batch `undone`. Everything is audited with the admin as actor.
7. Old-lead reactivation (F-82, M7) selects audiences by `imported_source` or `import_batch_id` and still passes through `canContact`.

Module: `platform` (always on), so an Alex-only tenant can be seeded too. Client-side import (F-95) and connectors (F-97) are Later.

## Interfaces

Names are contracts. Once M0 merges, a contract change needs Abdullah's yes and a note here.

### 1. Table ownership and shared schema

Migrations follow DATABASE.md: the M0 baseline migration (0001) creates every table in DATABASE.md with its RLS, grants, audit trigger and SECURITY DEFINER functions, so parallel threads never wait on or collide over another milestone's migration. Later milestones add only additive migrations (indexes, columns not in DATABASE.md, data-dependent FKs, seed rows) in their reserved range (M1 0100 to 0199, M2 0200 to 0299, and so on). "Owner" below means the milestone whose behaviour and service code own the table; it edits that table's definition only through an additive migration. Each owner keeps its schema definitions in `src/server/db/schema/<owner>.ts`.

| Owner | Tables |
| --- | --- |
| M0 | terms_acceptances (F-102), tenants, users, memberships, invitations, module_catalog, module_prices, tenant_modules, tenant_secrets, audit_log, impersonation_sessions, backup_runs, activities (write helper), service_tokens, consents (table, canContact), notifications (table, notify()); auth-library tables are global |
| M1 | companies, custom_field_defs, contacts |
| M2 | pipelines, pipeline_stages, deals, deal_contacts |
| M3 | tasks, notes, note_mentions (activities read API and timeline UI) |
| M4 | calls, messages, webhook_events, integrations, phone_numbers, alex_configs, alex_prompts (consent capture and STOP handling write through M0's consent service) |
| M5 | appointments |
| M6 | metrics_daily, reports |
| M7 | automation_templates, automations, automation_steps, automation_runs (notifications UI, preferences and email delivery) |
| M8 | `tenant_billing`, `tenant_billing_modules`, `onboarding_steps` (F-99, F-100) |
| M9 | import_batches, import_batch_records (F-90 to F-94, F-96); `tenant_documents` (F-103); export only for F-38 |
| M10 | none |

Rules for every tenant table (Confirmed by spec Section 5 and PRD F-72): `tenant_id uuid not null`, an index that starts with `tenant_id`, and `FORCE ROW LEVEL SECURITY` with a policy on `app.tenant_id`. The existing `portal/` uses `app.client_id`; the new build uses `app.tenant_id` as the spec says.

Platform tables (`webhook_events`, `service_tokens`'s hash store, pg-boss) are not tenant-scoped. `webhook_events`: the app role gets INSERT only; the worker reads and updates (SECURITY 2.3.5). Roles follow SECURITY.md 2.3.4: an owner role for migrations only (CI or deploy, never in the app's runtime environment), an app role, and a worker role. App and worker are non-owner, not superuser, not `BYPASSRLS`.

Kynetic staff views across tenants (F-53, F-54, F-62, F-63) follow SECURITY.md 2.3.6: no RLS policy grants cross-tenant rows to a staff role. Admin screens read through a small set of `SECURITY DEFINER` roll-up functions or views that return non-PII aggregates only. Opening one tenant's rows is view-as: it sets `app.tenant_id` for that tenant and is audited (F-57).

### 2. M0 contract package

M0 delivers these with real code for tenancy, RLS, audit and module guards, and in-memory fakes for the rest, so M1 to M9 build and test without waiting on each other. Paths are Decided.

```
src/server/tenancy/withTenant.ts    withTenant(ctx, fn): Promise<T>           // transaction + set_config
src/server/tenancy/withPlatform.ts  withPlatform(ctx, fn): Promise<T>         // wrapper for SECURITY DEFINER roll-ups only (SECURITY 2.3.6); no RLS bypass; audited
src/server/auth/index.ts            getSessionUser(headers), requireUser(headers), authorize(actor, action, tenantId?), resolveActor(user, tenantId?), requireRole(ctx, roles[]), requireKynetic(user, role?)   // DC-055, DC-056
src/server/modules/index.ts         requireModule(ctx, key), isModuleEnabled(ctx, key), listEnabledModules(ctx)
src/server/audit/index.ts           audit(tx, { action, entity, entityId, before, after })
src/server/events/index.ts          emitEvent(tx, envelope), subscribe(name, id, handler, { module? })   // DC-059
src/server/activity/index.ts        recordActivity(tx, { contactId, dealId, type, refTable, refId, summary, actor })
src/server/jobs/index.ts            enqueue(queue, payload, opts), registerWorker(queue, handler)
src/server/webhooks/index.ts        ingestWebhook({ source, externalId, payload, verify })   // idempotent insert + enqueue
src/server/consent/index.ts         compliance.canContact(ctx, contactId, channel, now, opts?: { purpose? }): allow | deny(reason) (SECURITY owns); recordConsent(), revokeConsent()
src/server/notifications/index.ts  notify(tx, { userId, type, title, link })   // M0 owns; M3, M4, M7 call it
src/server/adapters/{voice,sms,email}/types.ts + fake.ts
src/server/outbound/gate.ts         OutboundGate (shared by M4 and M7)
src/server/automations/enroll.ts    enrollInSequence(ctx, contactIds, key)   // M0 stub returns not_available; M7 implements
tests/helpers/                      two-tenant fixture, role fixtures, fake clock, webhook replay helper
```

Layout: this document's layout (`src/server/...`, `src/features/...`) is authoritative, and CODE_STYLE.md defers to it. CODE_STYLE.md follows it. Import rule: a feature may import from `server/*` services, never from another feature's internals.

### 3. Module flags and gating (decisions: every system and upsell is a per-tenant module with its own backend; PRD F-70)

Module keys (PRD module catalog, exact):

```ts
type ModuleKey =
  | 'platform'            // always on; not a flag
  | 'alex_core'           // AI voice receptionist
  | 'quote_followup'
  | 'after_hours'
  | 'missed_call_textback'
  | 'reactivation'
  | 'opm'                 // Online Presence Management
  | 'followup_bundle'
  | 'crm';                // with level: 'lite' | 'full' (F-85)
```

Storage (Decided; columns defined in DATABASE.md, not repeated here): one row per tenant and module in `tenant_modules`, unique on `(tenant_id, module_key)`, tenant-scoped RLS. The pricing tier (T1, T2, T3) is a tenant attribute stored with the plan (PRD F-86), not a module column. Only the admin API writes it, and every change writes `audit_log` with before and after.

Server rules:

- Every module route, server action, job and event subscriber calls `requireModule(ctx, key)` first. Off means: actions throw `ModuleDisabledError`; route handlers return 403 with `{ ok: false, error: { code: 'MODULE_DISABLED', message } }` and write nothing; jobs cancel and log, and do not retry; subscribers skip.
- Inbound webhooks for a disabled module are still stored in `webhook_events` and marked `skipped: module_disabled`, so nothing is lost.
- Turning a module off cancels its pending `automation_runs` (M7 handles `module.disabled`). Turning it on emits `module.enabled` and does not backfill.
- Gating is in the application layer. Data stays in the tenant and is hidden, not deleted (PRD F-70).

Client rules (implemented in M0-13: `src/components/modules/module-gate.tsx`, `src/config/nav-registry.ts`; layout wiring lands with M0-23): the layout loads `listEnabledModules(ctx)` once. Nav entries and dashboard cards declare `module?: ModuleKey`, and `<ModuleGate module="...">` renders nothing when off. Stat cards that depend on a module hide rather than show zeros. The server check is the real gate.

Core versus gated, as decided in PRD decision 1: `platform` is always on. The base portal (leads, pipeline kanban with default stages, appointments, call logs, messages log, reports, notifications, settings) belongs to `platform` and `alex_core` and needs no `crm` flag. `crm` is a paid upsell whose level controls Lite versus Full (PRD F-85, decision 1): Lite adds companies, tasks, rich notes, configurable stages and settings pages; Full adds custom fields, bulk actions, multi-contact deals, search, export and sequence enrollment. M0 builds the base portal and the module mechanism so Lite and Full ship gated. `alex_core` gates calls, call logs, the booking tool and Alex settings.

`followup_bundle` (PRD F-84, decided): enabling it sets `quote_followup`, `reactivation` and `missed_call_textback` in one admin action. Billing stays per member module.

### 4. Module backends

| Module | Backend | Triggers in | Writes | Milestone |
| --- | --- | --- | --- | --- |
| `alex_core` | `VoiceProvider` adapter; lead webhook; call-end processing; booking API; config | `lead.created`, voice webhooks, booking requests | `calls`, `activities`, `appointments`, `consents` | M4 (calls), M5 (booking), M8 (config UI) |
| `quote_followup` | Template sequence, starts when a deal enters Quoted (F-79) | `deal.stage_changed` | `automation_runs`, `messages` | M7 |
| `after_hours` | Inbound call handling outside business hours; creates contact, logs call, notifies staff (F-80) | inbound voice webhook | `calls`, `tasks`, `notifications` | M4 + M7 |
| `missed_call_textback` | One SMS to a missed caller with consent or a permitted basis; enabled free with `after_hours` (F-81) | `call.completed` with outcome no-answer or voicemail on an inbound call | `messages` | M7 |
| `reactivation` | One-time campaign over a selected audience; only consented contacts enter (F-82) | admin or owner launch | `automation_runs`, `messages` | M7 |
| `opm` | Business profile, review sites, directory listings, FB and IG posts, monthly report (F-83, F-48) | monthly job; admin actions | `presence_items`, `review_snapshots` (status and task records; no vendor integration in v1) | M11 (approved, PRD decision 6) |
| `followup_bundle` | Composite switch of three member modules (F-84) | admin action | `tenant_modules` | M0 (flag), M7 |
| `crm` | Lite and Full gating (F-85) | none | `tenant_modules.level` | M0 (flag); enforced in M1 to M9; base-portal routes are never gated by `crm` |

Spec conflict: the spec calls reviews a "reviews add-on" (F-48). Decisions put review work inside OPM. Treated here as part of `opm`, per PRD decision 7.

### 5. HTTP API contract

Conventions (Decided): JSON; Zod validation. Error bodies are `{ ok: false, error: { code, message, fieldErrors? } }` with the codes defined in CODE_STYLE.md (errors section): UNAUTHENTICATED (401), FORBIDDEN (403), MODULE_DISABLED (403), NOT_FOUND (404; also used for cross-tenant access, per SECURITY.md), VALIDATION_FAILED (400), CONFLICT (409), RATE_LIMITED (429), PROVIDER_ERROR (502, Decided), INTERNAL (500, Decided). UI mutations use server actions that call the same services and throw the same error types. Rate limits for login, webhooks and API are required (F-87); numbers are Not configured.

| Path | Purpose | Auth | Owner |
| --- | --- | --- | --- |
| `POST /api/hooks/leads/:tenantKey` | Inbound lead from forms, Angi, Google LSA, Facebook; creates contact and deal, emits `lead.created` (F-76) | signed token per tenant | M4 |
| Voice provider webhook | Call end: outcome, transcript, recording, extracted fields. Path: `POST /api/hooks/voice/:provider` | provider signature | M4 |
| Booking tool | Availability and create appointment (F-78). Path: `GET /api/hooks/voice/:tenantKey/availability`, `POST /api/hooks/voice/:tenantKey/appointments` | tool token per tenant | M5 (routing from M4) |
| Twilio status and inbound SMS | Path: `POST /api/hooks/twilio/status`, `POST /api/hooks/twilio/inbound`. STOP and HELP write consent (F-74). | Twilio signature | M4 |
| Resend events | Delivered, bounced, complained. Path: `POST /api/hooks/resend`. | Resend signature | M4 |
| Service API for n8n | Path: `/api/service/*`, bearer token from `service_tokens`, scoped to one tenant (F-89) | service token | M0 (auth), owners add routes |

The current `portal/` endpoint `/api/ingest/results` is not in the spec. Memory says nothing feeds it. Its fate is decided in M10; there is no data migration (F-88, decided 2026-10-25).

### 6. Event contract

Envelope (Decided): `{ id, name, version: 1, tenantId, occurredAt, actor: { type: 'user'|'alex'|'automation'|'system', id? }, payload }`. `actor.type` matches `activities.actor`. `emitEvent(tx, env)` enqueues in the same transaction (Decided: no separate outbox table). Delivery is at-least-once, so every subscriber is idempotent by `env.id`.

| Event | Producer | Spec? | Consumers |
| --- | --- | --- | --- |
| `lead.created` | M4 (webhook), M1 (manual) | Spec | M4 voice start, M7, n8n |
| `deal.stage_changed` | M2 | Spec | M3, M7 (rules, alerts), M6, n8n |
| `call.completed` | M4 | Spec | M3, M5, M6, M7, n8n |
| `call.flagged` | M4 (F-28) | Decided | M7, M8b (Kynetic review list and alert) |
| `contact.created`, `contact.updated`, `contact.merged` | M1 | Decided | M3, M7 |
| `contact.created`, `contact.updated`, `contact.deleted`, `contact.merged` | M1 | Decided (`contact.deleted` added, DC-072) | M3, M7 |
| `deal.created`, `deal.won`, `deal.lost` | M2 | Decided | M3, M6, M7 (won alert, F-33) |
| `message.received`, `message.status_changed` | M4 | Decided | M3, M7 (stop on reply, F-32) |
| `consent.recorded`, `consent.revoked` | M4 (via M0 service) | Decided | M7 (cancel runs) |
| `appointment.booked`, `.changed`, `.completed`, `.no_show` | M5 | Decided | M3, M6, M7 |
| `task.due`, `task.completed` | M3 | Decided | M7 (notify) |
| `module.enabled`, `module.disabled` | M8 | Decided | M7 |
| `import.batch_committed`, `import.batch_undone` | M9 | Decided | M6 (rollups), M7 (reactivation audiences) |
| `report.ready` | M6 | Decided | M7 (notify) |

Outbound to n8n: the worker POSTs the envelope with an HMAC header to an n8n webhook URL. Where that URL and its secret are stored is Decided 2026-10-25 (recommended option approved: `tenant_modules.config` for per-tenant URLs, a platform setting for the global one). Failed POSTs retry with backoff and count in integration health.

### 7. Adapter interfaces

Adapters live in `src/server/adapters/<kind>/`. Each kind has `types.ts`, `fake.ts` (in-memory, used in tests and preview), and one or more provider files. Callers use only the interface. Every method takes an `idempotencyKey`. Provider errors normalize to `ProviderError { kind: 'transient'|'permanent'|'config', code, message }`, so retry policy is shared.

```ts
interface VoiceProvider {
  readonly id: 'elevenlabs' | 'retell';          // ElevenLabs primary; Retell fallback (PRD decision 3)
  startOutboundCall(i: { tenantId; contactId; toE164; agentId; context; idempotencyKey }): Promise<{ providerCallId: string }>;
  parseWebhook(headers, rawBody): VerifiedVoiceEvent;   // verifies signature; throws on failure
  // VerifiedVoiceEvent: { externalId, providerCallId, kind: 'call.started'|'call.ended'|'inbound', direction,
  //   startedAt, durationS, outcome, sentiment?, recordingUrl?, transcript?, summary?, extracted?, costCents? }
  getRecordingUrl?(providerCallId: string): Promise<string>;
  placeTestCall?(i: { agentId; toE164 }): Promise<{ providerCallId: string }>;   // F-58 test button
}

interface SmsProvider {
  readonly id: 'twilio';
  send(i: { tenantId; toE164; fromE164; body; idempotencyKey }): Promise<{ providerId: string }>;
  parseStatusCallback(headers, rawBody): VerifiedSmsStatus;   // delivered | failed | undelivered + error code
  parseInbound(headers, rawBody): VerifiedInboundSms;          // flags STOP and HELP
  getA2pStatus?(tenantId: string): Promise<'none' | 'pending' | 'approved' | 'rejected'>;
}

interface EmailProvider {
  readonly id: 'resend';
  send(i: { tenantId; to; fromName; fromAddress; subject; html; text; idempotencyKey }): Promise<{ providerId: string }>;
  parseWebhook(headers, rawBody): VerifiedEmailEvent;          // delivered | bounced | complained
}
```

Reporting extension point (Decided): `ReportSection { key; module?: ModuleKey; build(tenantId, period): Promise<ReportBlock[]> }`. M6 owns the report job and registers core sections. OPM and other modules register theirs without editing M6.

OPM adapters (Decided, shape only): `ListingsProvider`, `ReviewsProvider`, `SocialPostProvider`, `BusinessProfileProvider`, each with a fake. Vendors are UNRESOLVED (needs outside information); v1 is status and task records only.

### 8. Auth facade

```ts
getSession(): Promise<{
  userId; email; kyneticRole: 'admin' | 'va' | null;
  memberships: { tenantId; role: 'owner' | 'staff' }[];
  activeTenantId?;
  impersonation?: { tenantId; byUserId; readOnly: true };
} | null>
requireUser(); requireRole(ctx, ['owner', 'staff']); requireKynetic('admin' | 'va')
```

View as client (F-57): sets `impersonation`, makes writes fail inside `withTenant` unless an admin explicitly escalates, shows a banner, stamps `audit_log.impersonator_id` on every write, and logs start and end. Staff permission toggles for exports and bulk delete (spec Section 2) are stored in tenant settings JSON or membership; decided in DATABASE.md (UNRESOLVED).

Permissions matrix (F-73) lives in SECURITY.md. Tenant users sign in with Google or an email magic link (F-71); a user without a membership is refused. Kynetic staff also complete TOTP (F-98).

### 9. Milestone contracts and ownership

Waves (spec, Confirmed): Wave 1 M0; Wave 2 M1, M4, M8 shell; Wave 3 M2, M3, M5, M9; Wave 4 M6, M7, M8 completes; Wave 5 M10. Merges are `--no-ff`, preview-only, when tests pass.

Spec dependency quirks, and how this document handles them (Decided):

- M8 spans waves 2 and 4. Split it into **M8a** (admin shell, onboarding F-55, users F-61, view-as F-57, audit viewer F-60, module toggles F-70; needs only M0) and **M8b** (all-clients F-53, health score F-54, integration health F-62, Alex config F-58, backups F-63; needs M4 and M6 services). The milestone ID stays M8.
- M3 depends on M2 because deal events feed the timeline. M0's `recordActivity()` lets M1, M2, M4 and M5 write activities from day one; M3 owns the timeline UI and read API.
- M5 depends on the M4 routing and `OutboundGate`. M4 publishes these first; M5 adds booking handlers and the calendar.
- M1 F-08 "enroll in sequence" needs M7; M0 ships the stub.
- M6 and M7 consume events and services only, never provider code.
- The upsell backends F-79 to F-84 and F-89: PRD decision 6: M7 for the sequence modules, M11 for OPM, M8a/M8b for the M8 split; M0 to M10 kept as in the spec.

| Milestone | PRD features owned | Imports | Exports (contract) | Must not touch |
| --- | --- | --- | --- | --- |
| M0 Foundation | F-52, F-102, F-60 (helper), F-70 (mechanism), F-71, F-72, F-73, F-84 (flag), F-74 (consent service only; M4 owns enforcement), F-85 (flag), F-87; `notify()` service | none | Section 2 package, module guard, auth facade | business logic of feature tables |
| M1 Contacts, companies, custom fields | F-05 to F-08, F-10, F-12 | M0 | contacts and companies services, dedupe, custom-field API, `contact.*` events | deals, timeline UI |
| M2 Deals and kanban | F-14 to F-17 (data and API) | M0, M1 services | deals and pipelines services, `deal.*` events | contact internals |
| M3 Activity, notes, tasks | F-19, F-20, F-22 | M0 (`recordActivity`, `notify`), M1, M2 | activities read API, tasks and notes services, `task.*` events | write paths of other tables |
| M4 Calls and messages | F-26 to F-28, F-30, F-74 (capture, STOP/HELP, enforce), F-75, F-76, F-77, F-78 (call) | M0, M1 | calls, messages, `alex_configs` services; `OutboundGate`; `call.completed`, `message.*`, `lead.created` | calendar, automations |
| M5 Appointments | F-24, F-78 (booking) | M0, M1, M4 routing | appointments service, availability function, `appointment.*` events | voice provider code |
| M6 Dashboard and reports | F-01 to F-03, F-49 | events and services of M2, M4, M5 | `metrics_daily` read API, `ReportSection` registry, `report.ready` | other tables (read via services) |
| M7 Automations and notifications | F-31 to F-33, F-35, F-79 to F-82, F-84, F-89 | M2, M3, M4 events; `OutboundGate` | automations services; `enrollInSequence` implementation; bell UI, preferences, email delivery (F-35) | provider adapters |
| M8 Admin (a and b) | F-53 to F-55, F-57, F-58, F-60 (viewer), F-61 to F-63, F-86, F-99 to F-101 | M0 (a); M4, M6 (b) | admin API, module toggle API, impersonation | tenant business logic |
| M9 Search, onboarding import, export, branding, settings, polish | F-37 to F-39, F-41 to F-44, F-90 to F-94, F-96, F-103 | M0, M1, M2, M3 (notes and timeline), M8a (admin entry point on the tenant page) | import service (`importBatches.dryRun`, `commit`, `undo`), search API, branding applied by M0 theme hook | adapters, outbound gate |
| M10 Hardening and launch | F-88 (clean launch, synthetic demo tenant); security review; load test; restore drill | all | none | no new features |
| M11 OPM (approved) | F-83, F-48 | M0, M6 `ReportSection` | OPM services and report section | everything else |

Ownership rule (goes into AGENTS.md): a thread edits only its milestone's files, tables and tests. A needed change to another milestone's contract is raised with Abdullah and recorded in the open questions, not made in place.

## Project structure

Location: Decided 2026-10-25 (recommended option approved: new top-level `crm/` in `abdullah-kynetic/kynetic-ai`, created from the Kiranism starter in M0; `portal/` stays live and untouched until M10). Tree is Decided:

```
crm/
  AGENTS.md (at kynetic-crm-docs/AGENTS.md in the project folder)
  drizzle/                       migrations (SQL for RLS); M0 baseline, then additive
  src/
    app/                         (client)/..., (admin)/..., api/hooks/..., api/service/...
    features/
      contacts/ companies/       M1
      deals/                     M2
      activity/ tasks/ notes/    M3
      calls/ messages/           M4
      calendar/                  M5
      dashboard/ reports/        M6
      automations/ notifications/  M7
      admin/                     M8
      search/ import-export/ settings/ branding/   M9
    server/
      db/schema/<owner>.ts
      tenancy/ auth/ modules/ audit/ events/ jobs/ webhooks/ consent/ activity/   M0
      adapters/{voice,sms,email}/                                                M0 interfaces + fakes; M4 providers
      outbound/                  OutboundGate (M0 stub, M4 real)
      automations/               M7 (enroll stub in M0)
    components/ui/               shared shadcn components (M0)
  tests/{unit,integration,e2e,helpers}/
  deploy/                        Dockerfile, compose, Caddyfile, backup script (M0, M10)
```

## Operations

- **Environments:** preview per branch with its own database and seed data, and production. Secrets per environment. No real client data in preview (spec). Deploy to production only after Abdullah approves (decisions). The existing `portal/` rule (D-022: deploy only through server-side `portal-deploy` of a merged `main` commit) applies to `portal/`; the production path for the new app is Decided 2026-10-25 (recommended option approved: the same restricted-key, health-check and rollback pattern).
- **Configuration:** environment variables validated at boot by a Zod schema (`crm/src/server/env.ts`; a bad environment exits the process at boot, M0-03). Required now: `APP_BASE_URL`, `DATABASE_URL`, `BETTER_AUTH_SECRET`, `APP_ENCRYPTION_KEY`; optional: `DATABASE_URL_WORKER`; `OUTBOUND_ENABLED` defaults to false. Provider keys are added by the task that first uses them. Compose project in `crm/deploy/` (app, worker, postgres, caddy); `docker compose config` verified, `docker compose up` not run (no Docker daemon in the build sandbox, 2026-10-26). Names are not defined here. Provider keys are encrypted at rest and never reach the browser (F-87).
- **Deploy and rollback:** images tagged per commit; rollback is redeploying the previous tag. Migrations are additive first (expand, then contract) so the previous image works against the new schema. Migrations run in CI, then as a separate production step with the owner role.
- **Backups:** nightly encrypted `pg_dump` offsite (R2; B2 only as a later second copy). 30 daily and 12 monthly kept. Monthly restore into a scratch database. Manual backup button (F-63). The Backups page shows last backup and last drill.
- **M8b admin operations:** the staff operations page lists integration health, flagged calls, failed webhook summaries, and a restricted recent-job summary. Failed webhook replay is transactional and idempotent; job payloads and outputs are not exposed. Admin Alex configuration test calls use the configured provider adapter; local acceptance injects a fake provider. Functions and grants are documented in `DATABASE.md`.
- **Logs and monitoring:** structured JSON logs with `tenantId`, `requestId`, `jobId`; never secrets or message bodies. Uptime check. Sentry optional (spec). Alert thresholds: set in "Monitoring and alerting"; `crm/deploy/prod/monitor/alerts.sh` implements them except the webhook-signature and provider-error alerts (not wired, see its README).
- **Scale:** target is 25+ clients (project goal). Latest local synthetic baseline (2026-10-28): 100 contact searches across 10,000 contacts using the app 10-connection pool; concurrency 20 measured p50 41.8ms/p95 75.2ms/p99 79.7ms, concurrency 100 measured p50 122.8ms/p95 218.1ms/p99 225.1ms. Both runs meet the approved p95 under 500ms target. A prior concurrency-100 run using the integration helper 2-connection pool measured p95 707.5ms; pool queueing caused the regression. EXPLAIN confirms phone fragments use `contacts_phone_fragment_trgm`; combined search chose a sequential scan taking 17.9ms on this disposable 10k-row fixture. These results verify only this local profile, not production hardware or client capacity. Docker-based production-like load remains unavailable.
- **Commands:** `crm/` exists as of M0-01 (Decided 2026-10-26: pins inherited from the starter, per CODE_STYLE). Node 22 (`engines` `>=22`, `.nvmrc`), bun (`bun.lock`), Next.js 16.4.2, React 19.3.0, TypeScript 7.0.2, Tailwind 4, oxlint and oxfmt. Verified in `crm/` on M0-01: `bun install`, `bun run build`, `bun run typecheck`, `bun run lint`, `bun run format:check`. Tests and CI: see TESTING "Verified commands" (M0-02). Migrate and seed: Not configured until M0-04 and M0-26. Sentry was removed with the starter's other demo dependencies (optional per spec; re-add under a later task if wanted). `portal/` today has `npm run lint`, `typecheck`, `test`, `db:migrate`, `db:seed`.


### Server and deployment setup (gap check 2026-10-25)
Approved by Abdullah 2026-10-25 (GP-06 to GP-11, DECISIONS DC-047). Items that need an action or outside information are marked UNRESOLVED.
- **Host.** Separate Docker Compose project on the OVH VPS (Decided, section "Hosting"): `app`, `worker`, `postgres`, `caddy`. Own Docker network and own Postgres, never shared with `portal/`, n8n or Twenty. Sizing: Decided 2026-10-25 (approved: at least 4 vCPU and 8 GB RAM, with Postgres data on its own volume; revisit after the M10 load test).
- **Network.** Caddy terminates TLS; only ports 80 and 443 are open, and 443 only to Cloudflare ranges (Confirmed: nothing exposed except through Cloudflare). SSH by key only, no root login, fail2ban, unattended security updates, host firewall on. Decided 2026-10-25 (approved: as written).
- **Secrets on the server.** An `.env` file owned by the deploy user with mode 600, outside the repo; never printed or committed. Per-environment values (F-87).
- **Image build and registry.** CI builds one image per commit and pushes it to GitHub Container Registry; the server pulls by tag. Decided 2026-10-25 (approved: GHCR, private).
- **Deploy.** A restricted `portal-deploy`-style script on the server (same pattern as D-022 for `portal/`): pull tag, run migrations as the owner role, start the new containers, call `/api/health`, roll back to the previous tag on failure. Production deploys happen only after Abdullah's yes.
- **Preview environments.** Per branch, own database, synthetic seed only (no real client data). Decided 2026-10-25 (approved: ephemeral Compose projects on the same VPS behind `*.preview.kyneticai.com`, protected by Cloudflare Access, at most two alive at once, torn down when the branch merges). Needs the Cloudflare DNS move below. Built in M0-27 (`crm/deploy/preview/`, workflow `crm-preview.yml`, off until repository variable `PREVIEW_ENABLED=true`): own Postgres per preview, the `prepare` step runs roles, migrations, seed and `bun run preview:check`, which exits 1 if any tenant is not a seed tenant, and the app and worker start only after it passes. Third live preview is refused. Not yet run on a server.
- **Production files (M10-05, DC-084).** `crm/deploy/prod/`: `compose.yml`, `Caddyfile`, `deploy.sh` (deploy, rollback, status), `deploy-entry.sh` (SSH forced command), `host/` (hardening, Cloudflare-only 443), `monitor/alerts.sh`, `tests/rehearse.sh`, and a runbook in its README. Images are built by `.github/workflows/crm-image.yml` (off until `IMAGE_PUSH_ENABLED=true`). Scripts are rehearsed against stubs in CI; **not yet run on the server** (needs Abdullah's yes per step). Known limit: Docker publishes ports around ufw, so the Cloudflare-only rule for 443 also needs a `DOCKER-USER` rule (README).
- **Recording and file storage.** R2 bucket, private, tenant-prefixed keys, versioning on, lifecycle rule that matches retention (PRD decision 9). The backup job also records the bucket's object counts so a restore drill can verify them.

### Domain, DNS and email domain (gap check 2026-10-25)
- **Portal domain.** `portal.kyneticai.com` for everyone (PRD decision 11). Today `kyneticai.com` DNS is at Squarespace and the bare domain does not resolve (project memory, 2026-10-22). Cloudflare in front of the portal needs the zone, or at least the `portal` and `*.preview` records, on Cloudflare. Approved (GP-07); needs Abdullah's action: move the nameservers to Cloudflare and recreate the Squarespace records first, so the site keeps working. This is pending question 9 in the project notes.
- **TLS.** Cloudflare edge certificate plus a Caddy origin certificate (Cloudflare Origin CA), full-strict mode. Certificate expiry is alerted at 14 days.
- **Email domain.** Resend sending domain on a subdomain, `mail.kyneticai.com`, with SPF, DKIM and DMARC (start at `p=none`, tighten to `quarantine` after a clean month). Decided 2026-10-25 (approved: as written; needs DNS access). Sender display name is the tenant's business name (F-39); the address stays Kynetic's verified domain; Reply-To is the owner's email.
- **Platform auth email.** Better Auth magic links are transactional platform messages. The Node app and worker boot path wires the Resend provider when `RESEND_API_KEY` is configured; the auth sender uses `Kynetic AI` and `EMAIL_FROM_ADDRESS`. Missing Resend configuration leaves email providers unset. Message links are HTML-escaped, expire in 15 minutes, and use a SHA-256 URL idempotency key. No token URL or provider key is logged.
- **Per-client custom domains** stay Later (F-40).

### Monitoring and alerting (gap check 2026-10-25)
Approved 2026-10-25 as written. Alert channel is email through Resend (Decided).
- `/api/health` checks database and queue. An external uptime monitor (proposal: a free hosted one) hits it every minute.
- Error tracking: Sentry optional (spec). Decided 2026-10-25 (approved: Sentry cloud free tier, with message bodies and PII scrubbed).
- Host metrics (CPU, memory, disk): Decided 2026-10-25 (approved: a small self-hosted agent such as Netdata or Uptime Kuma on the same VPS).
- Alerts: health failing 2 checks in a row; oldest queued job older than 10 minutes; more than 5 failed jobs in 15 minutes; more than 20 webhook signature failures in 10 minutes; newest backup older than 26 hours; disk above 80%; certificate within 14 days of expiry; 5xx rate above 2% for 5 minutes; Twilio or voice provider error spike (F-62).
- Logs: JSON to stdout, rotated by Docker (10 MB, 5 files), shipped nowhere in v1. Decided 2026-10-25 (approved: add a log shipper only if the load test shows a need).

### Provider integration details (gap check 2026-10-25)
Details to confirm against each provider's docs when M4 starts; the adapter interfaces in section 7 do not change.

| Provider | What we use | Inbound | Outbound | Keys (names only) | Open items |
| --- | --- | --- | --- | --- | --- |
| ElevenLabs (primary voice) | One agent per tenant (`alex_configs.agent_id`); outbound call API; agent tools call our availability and booking endpoints with the tenant tool token; recording and transcript fetched after the call and copied to R2 | `POST /api/hooks/voice/elevenlabs`, HMAC verified, stored in `webhook_events`, processed by a job that writes `calls`, `activities`, `appointments` | Start call with dynamic variables: contact first name, service, business name, disclosure text, call-window rules | `ELEVENLABS_API_KEY`, `ELEVENLABS_WEBHOOK_SECRET` | The account is on the free tier, demos only. UNRESOLVED (needs Abdullah: the paid plan, and how real calls get a phone number, since phone import is not available on free). Concurrency cap per account to be set at M4. |
| Retell (fallback) | Same adapter shape | `POST /api/hooks/voice/retell` | Same | `RETELL_API_KEY` | Parked; kept so the provider is a config choice. |
| Twilio | One Kynetic account; one number per tenant bought by an admin and stored in `phone_numbers` (auto-provision is F-56, Later); SMS through a Messaging Service | `POST /api/hooks/twilio/status` and `/inbound`, `X-Twilio-Signature` verified | `SmsProvider.send` through `OutboundGate` | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | A2P campaign not approved (error 30034). UNRESOLVED (needs Twilio): approval and per-tenant numbers. Opt-out wording is lowercase natural ("just reply stop"). STOP and HELP are mirrored into `consents` (F-74). |
| Resend | App email only (invites, magic links, notifications, reports) | `POST /api/hooks/resend`, signature verified; bounce and complaint mark the address suppressed and show in F-62 | `EmailProvider.send` | `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET` | Domain verification (above). Templates: invite, magic link, new lead, booked, task due, hot-lead alert, deal won, report ready, backup or security alert. Non-transactional mail carries an unsubscribe link. |
| n8n | Cross-system workflows through `/api/service/*` and signed outbound events (F-89) | service tokens | HMAC-signed event POSTs | token and secret live in n8n credentials | New workflows are built inactive; activation needs Abdullah's yes. |
| Twenty | Kynetic-internal only; no client data; push is Later, not v1 (PRD decision 16). `tenants.twenty_company_id` is a reference only (F-106 is Later). | none | none | none | none |

### Pre-go-live gates (gap check 2026-10-25)
No real client data enters the new portal until all of these pass: the restore drill; the cross-tenant isolation test (SEC-T-01 and SEC-T-02) against the production-like stack; the security review (M10); backups running off-server; known issues KI-006 (database passwords in the container environment) and KI-008 (dev password reuse) closed or shown not to apply to the new stack; Cloudflare in front with the origin locked down; the 8am to 9pm quiet-hours gate on; the kill switch tested; and the counsel-dependent items either answered or the affected channel left off for that tenant.

## Decisions and unknowns

### Confirmed

| Item | Source |
| --- | --- |
| Custom CRM and portal; client data in Postgres with RLS per tenant; no client data in Twenty | decisions |
| Kiranism starter base; Clerk dropped; Google sign-in; Atomic CRM as reference; no AGPL code | decisions |
| Backend for every system and upsell, toggled per tenant; the 8 module keys above | decisions, PRD |
| Milestones M0 then M1 to M10, one thread per milestone, merged in waves | decisions, spec |
| v1 branding is logo, color and name; texting inbox and call-cost visibility are Later | decisions (answers spec questions 3 and 4) |
| Backups 30 daily and 12 monthly; monthly restore test | decisions |
| Docker on Abdullah's server; Cloudflare in front; preview-only deploys; `--no-ff` merges | decisions |
| ElevenLabs chosen as the voice platform on 2026-10-22, reversing Retell | memory (Abdullah) |
| Canonical n8n is the self-hosted VPS instance | memory (Abdullah, 2026-10-21) |

### Decided 2026-10-25

Abdullah approved these explicitly or told us to take the recommended option. Detail lives in PRD "Decisions log".

1. Auth: Better-Auth, Google sign-in plus email magic links, admin 2FA in v1 (F-98).
2. Voice: ElevenLabs primary, Retell adapter as fallback.
3. Drizzle, pg-boss and Resend confirmed. `app.tenant_id` naming, `tenant_modules`, M0 baseline migration, event envelope, route paths and the `src/features` layout stand as written here.
4. Milestones: M8a/M8b split and M11 (OPM) approved. One thread owns one milestone.
5. Hosting: separate compose project, own network and database on the OVH VPS; Caddy. Domain: portal.kyneticai.com for everyone.
6. Files: recordings copied to R2, signed URLs. Backups to R2.
7. Retention: recordings and transcripts 12 months, messages 24, audit 24, consent 5 years after revocation, webhook payloads 30 days, raw import files 30 days after commit.
8. Client-editable Alex settings: pause and call hours only. Health score and guarantee target as in the PRD.  Metric definitions are decided (PRD decision 15).
9. Sequences: pg-boss in the app; n8n for cross-system workflows.
10. Lite/Full split and the follow-up bundle membership as in PRD decisions 1 and 7. Staff permission toggles (exports, bulk delete) live on `memberships`. Service tokens live in `service_tokens` (hashed); the n8n webhook URL and token live in n8n credentials, never in the repo.
11. Closed: no migration of the old portal; clean launch with a synthetic demo tenant (F-88).
12. Numeric rate limits, alert thresholds and scale limits: the SECURITY 5.4 numbers are the v1 defaults; M10's load test may tune them. Alerts go by email through Resend.
13. This doc is authoritative for layout; CODE_STYLE follows it.
14. Twenty push of tenant summaries is Later, not v1. Client data never goes into Twenty.

### Proposed 2026-10-31: n8n runs automations (not in effect until the plan is approved)

Source: DECISIONS DC-TBD-04, -05, -07, -08, -09, -11. Build tasks: BUILD_PLAN M12 to M20. Automation list: `docs/automation-map.md`. Draft transport and target endpoint contract: `docs/portal-n8n-contract.md` (M12-01; existing and proposed interfaces are labeled separately).

- **Split.** n8n runs lead sources in, starting calls and retries, sequences, reminders, no-show recovery, the consent decision, alerts, weekly and monthly emails, review requests, Stripe, Cal.com relay, Twenty backup and error alerts. The portal records everything, shows it live, owns consent and DNC lists, metrics math, report data, tenancy, logins, the event bus and webhook intake.
- **Lead chain.** Form, Meta, Angi or LSA triggers one n8n workflow. Step 1 posts the lead to the portal lead webhook, so it is saved before anything can fail. Step 2 runs the shared "may I contact" sub-workflow and posts the decision. Step 3 asks ElevenLabs to place the call. The provider result comes back through n8n to the portal.
- **What stays in the portal worker.** `event.dispatch`, `event.subscriber`, `webhook.process`, and the metrics and report math. Sequence steps, reminders, alert emails, task-due reminders and call retries move to n8n schedules. `backup.run` is not confirmed.
- **Voice.** ElevenLabs adapter first, behind the existing adapter interface. Retell is not built.
- **Backup to Twenty.** One way, Kynetic-side data plus per-tenant summaries with no personal data. Twenty never writes back.
- **Consent gate.** See SECURITY 3.1a. `OutboundGate` and `canContact` remain until the n8n sub-workflow passes the parity test.

### UNRESOLVED (needs outside information)

1. Twilio A2P campaign approval and per-tenant sending numbers. SMS modules cannot go live until approved. Missed-call detection needs a call-status event that the spec's Twilio entry does not cover.
2. Which F-97 direct connectors, and OPM vendors or connectors beyond status records.
3. State calling and recording rules and consent wording (counsel). The 8am-9pm lead-local window is decided; the per-state table is not.
4. Delivery date.

### Contradictions found

1. **Auth:** spec says Better-Auth; decisions allow Better-Auth or Auth.js. Resolved: Better-Auth (PRD decision 2).
2. **Reviews:** spec F-48 is a "reviews add-on"; decisions define OPM with reviews across sites. Treated as part of OPM.
3. **Voice:** spec lists "Retell/ElevenLabs" as open; memory says ElevenLabs was chosen on 2026-10-22; repo decision D-018 still says Retell. Do not code against Retell alone.
4. **M8:** spec places M8 in wave 2 with dependencies on M0, yet its acceptance and wave 4 need M4 and M6 data. Resolved by the approved M8a/M8b split.
5. **Sequences:** spec Section 6 says n8n runs sequences; the M7 scope and `automation_runs` say the app does. Resolved: pg-boss for sequences (Decided list, item 9).
6. **Modules vs milestones:** decisions require a backend per module; spec milestones contain no module home for OPM. Decided M11 (approved).
7. **Spec "no timers or polling sync"** vs sequences and reminders that need delayed jobs. Resolved by the timing rule in System boundaries: scheduled jobs are allowed; polling external systems is not.
8. **Outreach rule:** repo rule D-007 says outreach is phone only and human-dialed (Kynetic's own prospecting). The product sends AI calls and SMS to a client's own leads, including reactivation. These are the client's consented contacts, and PRD decision 14 treats D-007 as governing Kynetic's own prospecting only.
9. **Setting name:** existing portal uses `app.client_id`; spec uses `app.tenant_id`. The new build follows the spec.
10. **Drizzle and Resend:** decisions listed them "to confirm", and `portal/` already runs both. Confirmed (PRD decision 4).
11. **Text-back pricing:** decisions say text-back is free with after-hours; billing is Phase 2 (Later), so the flag is not enforced in v1.


### M13-02 voice selection (2026-11-01)

The existing ElevenLabs adapter is reused. `ELEVENLABS_LIVE_ENABLED` defaults false. Development/test select FakeVoiceProvider when the opt-in is absent, even when keys are present. Production in live mode refuses startup without the opt-in instead of accepting fake webhook signatures; explicit stub mode remains available for synthetic deployments. Selecting real ElevenLabs requires that opt-in plus `PROVIDER_MODE=live` and the required credentials; production then fails closed when credentials are missing. `PROVIDER_MODE=stub` always overrides the opt-in. OUTBOUND_ENABLED and OutboundGate remain separate controls. Retell selection is unchanged. Enabling live mode is not authorized by this code change; no provider request was made.

### Wave 32 service interfaces (2026-11-01)

Tenant-scoped send-state and contact-policy readers implement the minimal inputs in `portal-n8n-contract.md`. They are read-only and not a replacement for OutboundGate. Missing/malformed platform configuration is blocked; the snapshot explicitly advertises that the n8n migration gate has not passed. Actual n8n subworkflow refusal/parity tests remain pending while the connector reference tooling is unavailable.

`POST /api/service/call-results` implements the normalized bearer-authenticated result path, distinct from native provider-signature hooks. It accepts an existing tenant-owned contact and matching configured agent, records an immutable receipt, and reuses `writeCallInTransaction` exported by the calls facade. The shared persistence routine preserves existing disclosure, retention, DNC, activity and completion-event behavior; native/relay completions serialize on the tenant/provider/call advisory lock. Relay event identities also serialize before applying effects. An already-completed native call returns conflict on the relay path. A relay recording reference must point into the same tenant's calls storage area; it is never fetched from an arbitrary URL. Recording upload/ingestion and an actual n8n graph are not implemented by this endpoint. No sender cutover or native hook removal occurs.

### Portal-first sequence and agency workspace (2026-11-01)

Abdullah deferred n8n automation work and requested the remaining portal build. The synthetic-only M16 workspace may proceed ahead of M12-08's deferred integration gate. This changes implementation order; existing contact/outbound enforcement and live approval requirements remain. Remaining login/auth work stays last.

`src/server/agency` owns the admin-only synthetic workspace service. The tenant is isolated by normal RLS, has no owner invite or configured provider, and starts with outbound disabled. Agency lead records use the normal contact/deal services with no lead.created event. Rename and move operations reuse existing pipeline services, audit and timeline/event handling. Every agency action rechecks admin/TOTP via the existing guard and rejects view-as; the registry function independently checks the active admin database row. CRM Full gates agency feature operations. `inAgency` resolves the fixed registry tenant, never a request tenant ID. No shared M0 helper contract or app shell changes.
