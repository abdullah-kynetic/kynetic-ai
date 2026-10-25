# Code Style

Kynetic Client CRM & Portal. Applies to every coding session and every milestone (M0-M10). Layout and contracts are owned by `ARCHITECTURE.md`; where this file and ARCHITECTURE.md differ, ARCHITECTURE.md wins and this file is corrected.

**Sources and precedence.** `DECISIONS_locked.md` (Oct 25, 2026) wins over `SPEC_client_crm_portal.md`. Feature IDs and module keys come from `docs/PRD.md` (F-01 to F-98). Anything in none of these is marked `Decided 2026-10-25 (recommended option: ...)` or, if it needs outside information, `UNRESOLVED`. Commands not yet verified in the repo are `Not configured`.

**Status of the repo.** The app repo does not exist yet. M0 creates it from the Kiranism `next-shadcn-dashboard-starter`. Until M0 merges, no format, lint or typecheck command in this document has been verified.

---

## Languages and conventions

- **Language/version:** TypeScript (strict) on Next.js 16, React 19, Tailwind CSS 4 and shadcn/ui. Data layer and forms use TanStack Table/Query/Form and Zod. Charts use Recharts, kanban uses dnd-kit, Cmd+K uses kbar (DECISIONS_locked, SPEC section 7). Postgres 16.
  - Exact TypeScript, Node and package-manager versions: Decided 2026-10-25 (recommended option approved: inherit what the starter pins at M0, record them in `ARCHITECTURE.md`, and add `engines` plus a `.nvmrc` or equivalent).
- **ORM:** Drizzle ORM is confirmed (Decided 2026-10-25).
- **Auth:** Better-Auth with Google and magic links, plus admin TOTP (Decided 2026-10-25). Auth code lives only behind the auth facade in `src/server/auth/` (ARCHITECTURE section 8). Clerk is removed in M0 and must not reappear.
- **Jobs, webhooks and email:** pg-boss for jobs and Resend for app email are confirmed (Decided 2026-10-25). Use only the facades in `src/server/jobs/` (`enqueue`, `registerWorker`), `src/server/webhooks/` (`ingestWebhook`) and the `EmailProvider` interface.
- **Naming**
  - Files and folders: `kebab-case` (matches the starter), e.g. `contact-form.tsx`, `use-contacts-query.ts`.
  - React components and types: `PascalCase`. Zod schema values: `camelCase` with a `Schema` suffix (`contactCreateSchema`); inferred type without the suffix (`ContactCreate`).
  - Functions, variables and hooks: `camelCase`; hooks start with `use`.
  - Constants and env var names: `SCREAMING_SNAKE_CASE`.
  - Database: tables plural `snake_case` (`deal_contacts`), columns `snake_case`, primary key `id`, tenant column always `tenant_id`, timestamps `*_at`, money `*_cents` (integer), durations `*_s`. Booleans read as predicates (`is_won`, `pinned`).
  - Module keys: `snake_case` strings from one TypeScript union, exactly as the PRD module catalog names them: `platform`, `alex_core`, `quote_followup`, `after_hours`, `missed_call_textback`, `reactivation`, `opm`, `followup_bundle`, `crm`. `crm` carries a level (`lite` or `full`) rather than separate keys. The union is exported from `src/server/modules/`; no string literals elsewhere.
  - Branches: `m<N>/<short-topic>`, e.g. `m2/kanban-board`. Decided 2026-10-25 (recommended option approved, not in sources).
- **Formatting/linting:** Not configured. The starter is expected to ship ESLint and Prettier, but this is not verified. Decided 2026-10-25 (recommended option approved: M0 confirms the starter's configs, pins them, and records the real commands under Verified commands; do not add Biome or another tool without approval).
- **Type safety**
  - `strict: true`. No `any`; use `unknown` and narrow with Zod. No `@ts-ignore`; `@ts-expect-error` only with a reason comment and an issue reference.
  - No non-null assertions (`!`) on external data.
  - Zod schemas are the single source of truth for shapes crossing a boundary (forms, server actions, route handlers, webhooks, jobs, CSV rows, query params, env). Derive TS types with `z.infer`.
  - Row types come from the Drizzle schema definition in `src/server/db/schema/`, not hand-written duplicates.
  - Money is integer cents; never floats. Timestamps are `timestamptz` in UTC; convert to the tenant timezone (`tenants.timezone`) only at display and in quiet-hours logic.
  - Environment variables are parsed once by a Zod schema in `src/server/env.ts` and never read from `process.env` elsewhere.

## Organization

The authoritative tree is in ARCHITECTURE.md section 9. Summary:

```
src/
  app/                        routes only: (client)/, (admin)/, api/hooks/, api/service/
  features/<feature>/         UI and feature code, one folder per feature area
  server/                     all server-only code
    db/schema/                Drizzle schema, one file per owning milestone
    tenancy/                  withTenant, withPlatform
    auth/                     auth facade: getSession, requireUser, requireRole, requireKynetic
    modules/                  requireModule, isModuleEnabled, listEnabledModules, ModuleDisabledError
    audit/                    audit(tx, {...})
    events/                   emitEvent, subscribe
    jobs/                     enqueue, registerWorker
    webhooks/                 ingestWebhook
    consent/                  canContact, recordConsent, revokeConsent
    notifications/            notify(tx, {...})
    activity/                 recordActivity
    adapters/{voice,sms,email}/   types.ts, fake.ts, provider files
    outbound/                 OutboundGate (gate.ts)
    automations/              enrollInSequence (M0 stub, M7 implements)
    env.ts  logger.ts  errors.ts
  components/ui/              shadcn primitives (generated; do not hand-edit)
drizzle/                      migrations (SQL including RLS); M0 baseline, then additive
tests/{unit,integration,e2e,helpers}/
deploy/                       Dockerfile, compose, Caddyfile, backup script
```

There is no `src/lib/` and no `modules/<key>/` folder. Module code lives in the milestone that owns it, under `src/features/` and `src/server/` as ARCHITECTURE section 9 shows.

- **Directory responsibilities**
  - `src/app/`: routing, data loading, composition. No business logic, no SQL.
  - `src/features/<feature>/`: UI plus feature code that is not server-only.
  - `src/server/`: business logic, DB access, adapters, jobs and events. Server-only (`import "server-only"`).
- **Shared components and utilities**
  - Reuse shadcn primitives in `src/components/ui/` before creating anything new. Starter data-table, kanban, sidebar and kbar wiring are reused, not rebuilt.
  - Delete the starter's demo code (Clerk, chat, sample Users/Products pages; SPEC section 11) in M0.
  - UI rules (colors, chips, tabular numbers, empty states, 44px touch targets) live in `DESIGN_SYSTEM.md`.
- **Business logic placement**
  - Business rules live in `src/server/` services and in feature `server` entry points. Never in React components, route files or SQL triggers.
  - Authorization and module gating are enforced on the server. The UI hides what a role cannot do but is never the enforcement.
  - Every tenant-scoped query runs inside `withTenant(ctx, fn)` so `app.tenant_id` is set and RLS applies.
- **Import and dependency boundaries** (ARCHITECTURE section 2)
  - `app/` may import from `features/`, `server/` (through public entry points) and `components/`.
  - A feature imports `server/*` services only through their public `index.ts`. It never imports another feature's internals; cross-feature use goes through the contract in ARCHITECTURE.md.
  - `server/` imports nothing from `features/` or `app/`.
  - Client components must not import anything `server-only`, `db/`, or secrets.
  - Enforce with a lint rule once lint is configured. Until then it is a review-checklist item. Decided 2026-10-25 (recommended option approved: add an import-boundary lint rule in M0; needs approval as a new dependency).
- **Milestone ownership.** A session edits only files in its own milestone's scope (ARCHITECTURE section 9 and SPEC section 10). Changes needed in another milestone's area go through its documented interface or are raised as a request, never made directly. M0-owned shared files (schema baseline, auth, tenancy, shell, CI) change only through a small, separately reviewed PR.

## Coding rules

- Keep functions focused; follow established repository patterns. If a pattern is missing, copy the nearest existing feature rather than inventing one.
- Validate external input at the trust boundary with Zod. Never trust a client-supplied `tenant_id`; derive it from the session.
- Handle loading, empty, error and success states explicitly. Every list has an empty state with a next action; every mutation shows a toast and offers undo where possible (SPEC section 9).
- Avoid silent failures and undocumented magic values. No bare `catch {}`; no swallowed promise rejections. Name thresholds (health-score weights, retry counts, quiet hours) as constants with a comment pointing at the spec or decision.
- Reuse existing components before creating abstractions. Prefer duplication over a premature abstraction until the third use.
- **Server vs client.** Default to Server Components. Add `"use client"` only for interactivity (drag, kbar, forms with local state). Fetch through server functions or TanStack Query with typed query keys per feature. Components do not call the app's own HTTP routes for data they can load on the server.
- **Mutation order.** Every server action and route handler runs these steps in this order. Do not reorder:
  1. Authenticate: `getSession()` / `requireUser()` (auth facade).
  2. `withTenant(ctx, fn)`: opens the transaction, sets `app.tenant_id`, `app.user_id`, `app.role`, and checks the membership role. Use `requireRole` for role-specific actions.
  3. `requireModule(ctx, key)` if the action belongs to a module.
  4. Validate input with Zod.
  5. Perform the write inside the transaction.
  6. `audit(tx, {...})` for every write (SPEC section 8).
  7. Return the standard result (see Errors).
- **Tenant isolation**
  - The application DB role is a non-owner role so RLS always applies (ARCHITECTURE section 4; PRD F-72). App code never connects as owner or superuser and never uses `BYPASSRLS`.
  - Client-table access goes only through `withTenant`. No raw pool queries on client tables. Kynetic-staff cross-tenant reads go only through `withPlatform(ctx, fn)`, which is audited.
  - Every new client table has `tenant_id NOT NULL`, RLS enabled and forced, a policy, a tenant index and a cross-tenant test (TESTING.md). A table without these does not merge.
  - "View as client" is read-only by default and logged on every session (PRD F-57). Do not add write paths that bypass it.
- **Module gating.** Upsells and Kynetic systems are per-tenant modules, each with its own backend (DECISIONS_locked; ARCHITECTURE section 3). Module keys are listed in "Languages and conventions" above and in the PRD module catalog.
  1. Storage is the `tenant_modules` table (PRD F-70: one row per tenant and module, with enabled state, changed-by and timestamp). DATABASE.md owns the table. The columns follow ARCHITECTURE section 3: `tenant_id, module_key, enabled, level, tier, config jsonb, changed_by, changed_at`. Flags are not env vars and not code constants.
  2. `requireModule(ctx, key)` throws `ModuleDisabledError` in actions and jobs. Route handlers return `403` with code `MODULE_DISABLED` (SECURITY.md) and write nothing. Every module route, action, job and event subscriber calls it first. Jobs cancel and log without retrying.
  3. `isModuleEnabled(ctx, key)` decides what to render. `listEnabledModules(ctx)` is loaded once in the layout. The UI uses `<ModuleGate module="...">`, which renders nothing when the module is off. Disabled modules never show an upgrade stub unless the PRD says so. UI hiding is a convenience, not security.
  4. A module-off tenant keeps its data. Turning a module off does not delete anything. Turning one on does not backfill.
  5. Flag changes are admin-only, go through the admin API, and write `audit_log` with before and after.
  6. Tiers (T1/T2/T3) and prices are business data on the tenant record and in admin config, never hard-coded in module logic. Prices are informational in v1 (PRD F-86).
- **Consent and outreach.** Consent state is read and written only through `canContact(ctx, contactId, channel, now)` and `recordConsent()` / `revokeConsent()` in `src/server/consent/`. Every call or SMS send passes through `OutboundGate` in `src/server/outbound/gate.ts`, the single guard shared by M4 and M7. Its consent check calls `canContact`. Notifications to users go through `notify(tx, { userId, type, title, link })` in `src/server/notifications/`; no feature writes `notifications` rows directly. (SECURITY.md names the same check `compliance.canContact(tenant, contact, channel, purpose, now)`; the name and signature are an open mismatch, see the hand-off.) It checks, in order: module enabled, consent for that channel (F-74), no opt-out or DNC, inside quiet hours in the contact's timezone, tenant not paused (F-42), and A2P approval for SMS. A failed check writes a "blocked: reason" activity. No module reimplements these checks. Kynetic's own outreach rules (phone only, human-dialed) are business rules in AGENTS.md, not application code.
- **Webhooks and jobs.** Use `ingestWebhook({ source, externalId, payload, verify })` from `src/server/webhooks/`. It verifies the signature, inserts into `webhook_events` idempotently on the unique `external_id`, and enqueues. Handlers must be idempotent: a replay is a no-op. Failures surface in integration health (SPEC section 6). Rule owned by ARCHITECTURE.md: scheduled jobs are allowed, polling external systems is not.
- **Integration adapters.** Providers sit behind the interfaces in `src/server/adapters/{voice,sms,email}/`: `VoiceProvider`, `SmsProvider`, `EmailProvider`, each with `types.ts`, `fake.ts` and provider files. Application code uses only the interface, never a vendor SDK. Every method takes an `idempotencyKey`. Provider errors normalize to `ProviderError { kind: 'transient' | 'permanent' | 'config', code, message }`. ElevenLabs is the primary voice provider and Retell the fallback (Decided 2026-10-25); the adapter supports both.
- **Secrets.** Never print, log, commit or paste secrets. Provider keys are encrypted at rest and never sent to the browser. Only non-secret `NEXT_PUBLIC_*` values are browser-visible. `.env*` files are git-ignored; commit only `.env.example` with placeholder names. Preview environments use no real client data.
- **Comments.** Explain *why*, not *what*. Reference the PRD F-xx ID when code encodes a business rule. No commented-out code.
- **Git hygiene.** Small commits, one concern each. No unrelated formatting churn in a feature diff.

## Errors and logging

- **Error body:** `{ ok: false, error: { code, message, fieldErrors? } }` (ARCHITECTURE section 6). Route handlers and server actions use the same body.
- **Error codes** (rule, ratified by SECURITY.md): `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `MODULE_DISABLED` (403), `NOT_FOUND` (404), `VALIDATION_FAILED` (400), `CONFLICT` (409), `RATE_LIMITED` (429), `PROVIDER_ERROR`, `INTERNAL` (500). Two rules come from SECURITY.md and are not open: a module that is off returns 403 `MODULE_DISABLED` (PRD F-70), and a cross-tenant record returns 404 `NOT_FOUND`, so existence is not leaked.
- Naming note: the error code is `MODULE_DISABLED` everywhere in this file. ARCHITECTURE section 3 uses lowercase `module_disabled` for the `webhook_events` skip reason, which is a separate field. That is acceptable, but ARCHITECTURE should say so.
- Never return raw database or provider errors to the client. Map to a code and a safe message; log the detail server-side.
- **Logging levels** (structured JSON, SPEC section 7): `error` (action failed, needs attention), `warn` (recoverable, retried), `info` (state change, job lifecycle), `debug` (off in production). Every entry carries `request_id`, and when known `tenant_id`, `user_id`, `module_key`, and job or webhook id. Logger is `src/server/logger.ts`. Decided 2026-10-25 (recommended option approved: the logging library is not chosen; wrap whichever is picked behind that file).
- **Redaction:** follow SECURITY.md. Until it is final, never log secrets or API keys, session tokens, webhook signing secrets, full phone numbers, emails or addresses, message bodies, call transcripts, recording URLs, or consent `captured_text` and IP. Log ids instead. The audit log is append-only and separate from application logs.
- Errors from jobs and webhooks update `integrations.last_error` and `error_count` so they show in integration health. They are not only logged.
- Sentry is optional (SPEC section 7); if enabled, apply the same redaction before send.

## Dependencies

- **New packages:** Not in the sources. Decided 2026-10-25 (recommended option approved: no new runtime dependency without Abdullah's approval stated in the PR description; reuse the starter's stack first; prefer maintained, permissively licensed packages).
- **Licensing is a hard rule.** MIT, Apache or BSD-compatible only. No AGPL code (Twenty, EspoCRM, SuiteCRM, Frappe, NocoBase) may be copied, forked or depended on; they are reference only. Atomic CRM (MIT) may be used as a data-model and screen reference. Copied starter code keeps its MIT notice.
- **Confirmed (2026-10-25):** Drizzle ORM, pg-boss, Resend. Still use them only through the interfaces above.
- **Versioning and lockfile:** Not in the sources. Decided 2026-10-25 (recommended option approved: commit one lockfile for the package manager chosen in M0; pin framework packages (Next, React, Drizzle, the auth library) to exact versions; install with the frozen-lockfile flag in CI; dependency bumps are their own PR).
- Remove unused starter dependencies (Clerk and demo-only packages) in M0.

## Database and migrations

- Schema changes only through checked-in migrations in `drizzle/` (ARCHITECTURE section 1). Never edit an applied migration; add a new one. Never run schema changes by hand against a shared environment.
- M0 ships the full baseline migration. After that, a milestone adds only additive columns and indexes to tables it owns, in its own migration (ARCHITECTURE section 1). Migrations are expand-then-contract so the previous image still works against the new schema.
- One migration per logical change, named with a timestamp and purpose. A migration that adds a client table includes RLS enable/force, the policy and indexes in the same file.
- Seed data is synthetic and lives in `tests/helpers/` or the seed folder ARCHITECTURE names; preview databases use seed data only.
- `custom jsonb` only for per-tenant custom fields. Everything else is a real column.

## Git and review conventions

- **Author and committer:** `abdullah-kynetic <abdullah@kyneticai.com>` (DECISIONS_locked). Check `git var GIT_AUTHOR_IDENT` before the first commit; if wrong, set `user.name` and `user.email`.
- **Trailers:** none. No `Co-authored-by` trailer for Claude or any AI, and no "Generated with" footer in commits or PR bodies (Abdullah, 2026-10-25). Amend any commit that has one before pushing.
- **Merges:** `--no-ff` merge commits only (DECISIONS_locked). No squash or rebase-merge. Never rewrite history on `main`. Each milestone thread merges when its tests pass; no big-bang merge.
- **Commits:** small, separate, imperative subject (e.g. `Add deal stage reorder action`), body explains why. Reference the PRD F-xx ID and milestone in the body, e.g. `F-16, M2`.
- **Deploys:** preview-only until Abdullah approves (DECISIONS_locked). Coding sessions never trigger production deploys, DNS, Cloudflare or server changes.
- **Secrets in git:** never commit or print secrets. If one is committed by mistake, stop and tell Abdullah; do not rewrite history on `main`.
- **Pull requests:** one milestone per PR. The description lists the F-xx IDs delivered and the tests run. Decided 2026-10-25 (recommended option approved: a PR template added in M0).

## Review checklist

- Implementation matches the approved Given/When/Then acceptance criteria for the F-xx IDs in the PR (PRD).
- Stays inside the milestone's scope; cross-milestone needs use the documented interface.
- Types, format and lint checks use confirmed repository commands (see Verified commands). Nothing is reported as passing unless it was run.
- No credentials, `.env` files or unrelated files in the diff; no real client data in seeds or fixtures.
- Every new client table has `tenant_id`, RLS enabled and forced, a policy, a tenant index and a cross-tenant test.
- Every server entry point follows the mutation order: authenticate, `withTenant`, `requireModule` if needed, Zod validation, audited write, standard result.
- Module code calls `requireModule` on the server and the UI uses `<ModuleGate>`; jobs of disabled modules cancel.
- Outbound call and SMS paths go through `OutboundGate`.
- Webhook handlers use `ingestWebhook` and are idempotent.
- Loading, empty, error and success states exist for each new view; mutations show a toast.
- No AGPL-derived code; no new dependency without approval.
- Tests cover meaningful changed behavior (TESTING.md), including a failure case.
- Commits authored as `abdullah-kynetic <abdullah@kyneticai.com>`; merges use `--no-ff`.

## Verified commands

None of these has been run, because the application repo does not exist yet.

- Format: Not configured
- Lint: Not configured
- Type check: Not configured
- Migrations: Not configured

Test commands (Vitest, Playwright, load test, restore drill) are owned by `TESTING.md`, not this file. M0 replaces each line above with the real command after running it, and records the date it was verified.

Never invent commands or claim checks passed without running them.
