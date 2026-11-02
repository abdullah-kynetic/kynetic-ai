# Build plan

The whole Client CRM & Portal, broken into small tasks, ordered so building can run continuously in waves. Sources: `docs/PRD.md` (features), `docs/ARCHITECTURE.md` (milestones and contracts), `docs/DATABASE.md`, `docs/SECURITY.md`, `docs/DESIGN_SYSTEM.md`, `docs/CODE_STYLE.md`, `docs/TESTING.md`. Decisions: `docs/DECISIONS.md`.

Rules for using this file:
- One thread works one task at a time. A task may start only when every dependency is `done`. Tasks in the same wave with `Parallel = yes` can run in separate threads at once.
- Every task ends with its acceptance tests passing in CI, the affected docs updated in the same PR (`AGENTS.md`), and its row updated here (status, resume notes).
- Nothing here deploys, merges or touches live systems on its own. Deploys, provider changes and merges need Abdullah's yes.
- Gap-check items (F-99 to F-103 and the operations setup) were approved for v1 on 2026-10-25 (DECISIONS DC-047).
- Do not widen a task. If the work is bigger than its size, split it, add the new rows here, and note it in the PR.

## Columns

| Column | Meaning |
| --- | --- |
| ID | `M<milestone>-<nn>`. The last task of each milestone is its gate. |
| Implements | The doc sections and PRD features the task builds. Abbreviations: PRD, ARCH (ARCHITECTURE), DB (DATABASE), SEC (SECURITY), DS (DESIGN_SYSTEM), CS (CODE_STYLE), T (TESTING). |
| Depends | Task IDs that must be `done` first. |
| Acceptance | What must pass. The full test rows are in `docs/TESTING.md`. |
| Size | XS under 1 hour, S 1 to 3 hours, M 3 to 8 hours, L 1 to 2 days. Nothing is bigger; split it. |
| Model | Recommended model. Haiku: docs, boilerplate, simple UI, gates. Sonnet: most features. Opus: architecture, auth, RLS, compliance and tricky integrations. |
| Parallel | `yes` if it can run beside other tasks of its wave in a separate thread; `no` if it touches shared contracts or must run alone. |
| Wave | Build wave, computed from dependencies. Wave n starts when its dependencies in earlier waves are done. |
| Status | `todo`, `in-progress`, `blocked`, `done`, `cut-off`. |
| Resume notes | For a thread cut off by usage limits: see "Resuming a cut-off task". |

## Status legend and update protocol
- Start a task: set `in-progress`, add `branch: <name>` to Resume notes, commit that change on your task branch.
- Finish: set `done` when acceptance tests pass and the PR is open. Add the PR number.
- Blocked: set `blocked` and write exactly what is needed and from whom (for example "needs Abdullah's yes on GP-01").
- Cut off: if the thread is stopping (usage limit or context), set `cut-off` and fill the Resume notes before anything else.

## Resuming a cut-off task
Resume notes must contain, in this order: `branch:`; `last commit:` (short hash); `done so far:`; `files touched:`; `tests:` (which pass, which fail, what command); `next step:` (one concrete action); `watch out:` (anything surprising). A new thread reads the task row, the Implements sections, the branch diff against `main`, then continues from `next step`. It sets the status back to `in-progress` and adds `resumed: <date>`.

## Summary
- 128 tasks in 13 milestone groups and 29 waves.
- Proposed 2026-10-31, not yet approved: 60 more tasks in M12 to M20 (see "M12 to M20 All-in-one portal" below).
- Models: Sonnet 76, Opus 29, Haiku 23.
- Sizes: S 30, M 70, L 28.

## Wave plan
Wave n can start when all its tasks' dependencies are done. The count of tasks marked parallel is how many threads can usefully run at once.

| Wave | Tasks | Can run in parallel |
| --- | --- | --- |
| 1 | M0-01 | 0 of 1 |
| 2 | M0-02, M0-03, M0-19 | 3 of 3 |
| 3 | M0-04 | 0 of 1 |
| 4 | M0-05 | 0 of 1 |
| 5 | M0-06, M0-07, M0-22 | 3 of 3 |
| 6 | M0-08, M0-26 | 1 of 2 |
| 7 | M0-09, M0-10, M0-13, M0-14, M0-15, M0-16, M0-17, M0-20, M0-27 | 5 of 9 |
| 8 | M0-11, M0-12, M0-18, M0-21, M0-23 | 4 of 5 |
| 9 | M0-24 | 1 of 1 |
| 10 | M0-25 | 1 of 1 |
| 11 | M0-28 | 0 of 1 |
| 12 | M1-01, M4-01, M4-03, M4-04, M4-08, M4-09, M7-04, M8a-01, M9-08, M9-09, M10-05 | 8 of 11 |
| 13 | M1-02, M1-03, M1-05, M2-01, M4-02, M4-05, M4-06, M4-12, M4-13, M8a-02, M8a-03, M8a-04, M8a-05, M8a-06, M10-06 | 12 of 15 |
| 14 | M1-04, M1-06, M1-07, M2-02, M2-03, M2-04, M2-05, M3-01, M4-07, M4-10, M4-11, M8a-07, M8a-08, M9-10 | 12 of 14 |
| 15 | M1-08, M2-06, M3-02, M3-03, M4-14, M8a-09, M9-11 | 4 of 7 |
| 16 | M1-09, M3-04, M5-01, M7-01, M8b-03, M8b-04, M8b-05, M8b-06, M8b-07, M9-12 | 10 of 10 |
| 17 | M3-05, M5-02, M5-03, M7-02, M7-03, M7-10, M9-01, M9-06, M9-07, M10-02, M10-03, M10-04 | 10 of 12 |
| 18 | M5-04, M7-05, M7-06, M7-07, M7-08, M9-02 | 5 of 6 |
| 19 | M5-05, M7-09, M9-03 | 1 of 3 |
| 20 | M6-01, M7-11, M9-04, M9-05, M9-13 | 3 of 5 |
| 21 | M6-02, M6-03, M6-04, M6-05, M9-14 | 4 of 5 |
| 22 | M6-06 | 1 of 1 |
| 23 | M6-07 | 0 of 1 |
| 24 | M8b-01, M11-01 | 2 of 2 |
| 25 | M8b-02, M11-02, M11-03 | 3 of 3 |
| 26 | M8b-08, M11-04 | 2 of 2 |
| 27 | M10-01 | 0 of 1 |
| 28 | M10-07 | 0 of 1 |
| 29 | M10-08 | 0 of 1 |

The milestone waves from the spec still hold: M0 first and alone; M1, M4 and M8a next; then M2, M3, M5 and M9 parts; then M6, M7, M8b; then M10; M11 after M6. Task waves are finer and win when they disagree about what can start.

## M0 Foundation (base portal shell and the shared contracts; built first and alone)

| ID | Title | Implements | Depends | Acceptance | Size | Model | Parallel | Wave | Status | Resume notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M0-01 | Create the repo app from the starter; remove Clerk, chat and demo pages | PRD F-52; ARCH Project structure; CS layout |  | App boots; no Clerk dependency; demo routes return 404; `npm run build` passes | S | Sonnet | no | 1 | done | PR #45, branch: m0/app-from-starter |
| M0-02 | CI and tooling: lint, typecheck, Vitest, Playwright scaffold, GitHub Actions; record the real commands in TESTING and CODE_STYLE | CS tooling; T commands | M0-01 | CI green on an empty change; commands documented (replaces "Not configured") | M | Sonnet | yes | 2 | done | PR #46, branch: m0/ci-tooling (stacked on m0/app-from-starter, PR #45) |
| M0-03 | Docker Compose (app, worker, postgres, caddy), Zod env validation, `/api/health` | ARCH Operations, Server and deployment setup; SEC 6.2 | M0-01 | `docker compose up` serves health; a missing env var stops boot | M | Sonnet | yes | 2 | done | PR #47, branch: m0/compose-env-health (stacked on m0/ci-tooling, PR #46) |
| M0-04 | Database roles, extensions, session-variable helper functions, `app_enable_tenant_rls` | DB RLS and privileges; SEC 2.3 | M0-03 | Roles exist; app role is not owner and has no BYPASSRLS; helpers return NULL when unset | M | Opus | no | 3 | done | PR #49, branch: m0/db-roles-helpers (stacked on m0/compose-env-health, PR #47) |
| M0-05 | Baseline migration part A: tenancy, users, memberships, invitations, modules, secrets, audit, terms, billing and onboarding tables | DB Schema (tenancy, Modules, Secrets and audit, Gap-check additions) | M0-04 | Migration applies on empty DB; every tenant table ENABLE+FORCE RLS (SEC-T-01 setup) | M | Opus | no | 4 | done | PR #50, branch: m0/baseline-a (stacked on m0/db-roles-helpers, PR #49) |
| M0-06 | Baseline migration part B: CRM tables (companies, custom fields, contacts, pipelines, deals, activities, tasks, notes) | DB Schema (Clients through Activities) | M0-05 | Applies cleanly; indexes start with tenant_id | M | Sonnet | yes | 5 | done | PR #51, branch: m0/baseline-b (stacked on m0/baseline-a, PR #50) |
| M0-07 | Baseline migration part C: calls, messages, consents, webhooks, integrations, alex_configs, appointments, metrics, automations, notifications, imports, documents | DB Schema (Calls through Imports) | M0-05 | Applies cleanly; table list equals DATABASE Entities | M | Sonnet | yes | 5 | done | PR #52, branch: m0/baseline-c (stacked on m0/baseline-b, PR #51) |
| M0-08 | `withTenant`, `withPlatform`, two-tenant and role test fixtures, cross-tenant isolation suite | ARCH 2; SEC 2.3; T RLS tests | M0-06, M0-07 | SEC-T-01 and SEC-T-02: tenant A cannot read or write tenant B through API or SQL as the app role | L | Opus | no | 6 | done | PR #53, branch: m0/with-tenant (stacked on m0/baseline-c, PR #52) |
| M0-09 | SECURITY DEFINER roll-up functions and the NOLOGIN `kynetic_rollup` role | SEC 2.3.6; DB RLS | M0-08 | Roll-ups return aggregates with no PII; no policy contains an admin clause | M | Opus | no | 7 | done | PR #54, branch: m0/rollups (stacked on m0/with-tenant, PR #53) |
| M0-10 | Better-Auth: Google sign-in, email magic links, server sessions, account linking rules, `src/server/auth` facade | PRD F-71; SEC 2.1; ARCH 8 | M0-08 | Sign-in with Google and a magic link; no membership refused; used or expired link refused | L | Opus | no | 7 | done | PR #55, branch: m0/better-auth (stacked on m0/rollups, PR #54) |
| M0-11 | Roles and permission checks: `requireUser`, `requireRole`, `requireKynetic`, deny-by-default matrix | PRD F-73; SEC 2.2 | M0-10 | One test per matrix row; staff toggles for export and bulk delete honored | M | Opus | no | 8 | done | PR #60, branch: m0/permissions (stacked on m0/better-auth, PR #55) |
| M0-12 | Admin TOTP two-factor: enrol, recovery codes, enforcement, reset by another admin | PRD F-98; SEC 2.1 | M0-10 | Staff without TOTP reach only enrolment; reset is audited | M | Opus | yes | 8 | done | PR #67, branch: claude/project-thread-3kib4k (stacked on m0/better-auth, PR #55) |
| M0-13 | Module mechanism: `tenant_modules`, `requireModule`, `<ModuleGate>`, 403 MODULE_DISABLED, nav registry | PRD F-70, F-85; ARCH 3 | M0-08 | SEC-T-12 for every module key; `crm` off still shows base portal routes | M | Opus | no | 7 | done | PR #63, branch: m0/module-guard (stacked on m0/permissions, PR #60) |
| M0-14 | Audit helper and append-only `audit_log` (before and after) | PRD F-60 (helper); SEC audit | M0-08 | SEC-T-35; app role has INSERT only; reads through audit_search() | M | Sonnet | yes | 7 | done | branch: claude/project-thread-jpnkh3 PR #56 (stacked on m0/rollups, PR #54) |
| M0-15 | Events (`emitEvent`, `subscribe`), jobs facade on pg-boss, idempotent webhook ingest (`ingestWebhook`) | ARCH 2, 6; PRD F-77 | M0-08 | Duplicate external id processed once; job retries with backoff | L | Opus | no | 7 | done | PR #68, branch: m0/events-jobs (stacked on m0/module-guard, PR #63) |
| M0-16 | Consent service: `canContact`, record and revoke consent, DNC entries | PRD F-74; SEC 3 | M0-08 | Table-driven `canContact` tests (channel, purpose, quiet hours, DNC, revoked) | M | Opus | yes | 7 | done | PR #62, branch: claude/project-thread-r5u25p (stacked on m0/rollups, PR #54) |
| M0-17 | `notify()`, notifications table access, `recordActivity()` | ARCH 2 | M0-08 | Unit tests; notification row created in the caller's transaction | S | Sonnet | yes | 7 | done | PR #57, branch: m0/notify (stacked on m0/rollups, PR #54) |
| M0-18 | `OutboundGate` stub with kill-switch check; `enrollInSequence` stub | ARCH 2; SEC Appendix D | M0-16 | With the kill switch on, a send is refused; stub returns not_available | M | Opus | yes | 8 | done | PR #66, branch: m0/outbound-gate (stacked on PR #62, m0-16 canContact) |
| M0-19 | Adapter interfaces and fakes for voice, SMS, email; storage `{put,get,remove}` interface with a local fake | ARCH 7; CS adapters | M0-01 | Each fake passes the shared contract test | M | Sonnet | yes | 2 | done | PR #48, branch: m0/adapters-fakes (stacked on m0/ci-tooling, PR #46) |
| M0-20 | Service tokens (hashed) and bearer auth for `/api/service/*` | PRD F-89; DB service_tokens | M0-08 | Token is scoped to one tenant; revoked token refused | S | Sonnet | yes | 7 | done | PR #58, branch: m0/service-tokens (stacked on m0/rollups, PR #54) |
| M0-21 | Error shape, Zod helpers, Postgres rate limiter, security headers, Origin/CSRF check | SEC 5; CS errors | M0-10 | Limit hit returns 429; state-changing route without Origin refused | M | Sonnet | yes | 8 | done | PR #64, branch: m0/21-security-primitives (stacked on m0/better-auth, PR #55) |
| M0-22 | Secrets: envelope encryption for `tenant_secrets`, env-key handling | SEC 4 | M0-05 | Ciphertext in DB; API never returns a decrypted token (SEC-T-34) | M | Opus | yes | 5 | done | PR #59, branch: m0/secrets-envelope (stacked on m0/rollups, PR #54) |
| M0-23 | App shell: rebrand tokens, layout, sidebar, header, dark-mode toggle, Kynetic-branded sign-in page | DS tokens, layout, sign-in rules; PRD F-44 | M0-01, M0-13 | Renders per role; keyboard path works; axe passes | M | Sonnet | yes | 8 | done | PR #69, branch: claude/project-thread-y17hqd (stacked on m0/module-guard, PR #63) |
| M0-24 | Base UI components (buttons, inputs, table, dialog, toast, badge, empty and error states) | DS components | M0-23 | Components match tokens; focus rings visible; axe passes | M | Haiku | yes | 9 | done | PR #70, branch: claude/project-thread-ir5a0i (stacked on PR #69) |
| M0-25 | Terms and Privacy acceptance page | PRD F-102; DB terms_acceptances | M0-10, M0-24 | Unaccepted user redirected; accepted once, not asked again | S | Haiku | yes | 10 | done | PR #71, branch: claude/project-thread-zoyqu2 (stacked on PR #70) |
| M0-26 | Seed data: module catalog and prices, automation templates, two synthetic demo tenants | DB Migrations and seed data | M0-07 | Seed is idempotent; demo data is synthetic (555-01xx numbers) | S | Sonnet | yes | 6 | done | PR #61, branch: claude/project-thread-enu0nh (stacked on m0/rollups, PR #54) |
| M0-27 | Preview environment pipeline: per branch, own database, synthetic seed only | ARCH Operations | M0-02, M0-03, M0-26 | Preview deploys with no real data; torn down on merge | M | Sonnet | yes | 7 | done | PR #65, branch: m0/preview-env (stacked on PR #61 / M0-26). Not deployed: needs the Cloudflare move, server setup and PREVIEW_ENABLED (crm/deploy/preview/README.md). `docker compose up` not run (no daemon) |
| M0-28 | M0 gate: run all M0 acceptance tests, update TESTING statuses, confirm docs match, record resume notes | AGENTS; T | M0-01..M0-27 | All M0 rows pass in CI; PR ready for review | S | Sonnet | no | 11 | done | branch: m0/gate (combines PRs #47–#71; see resume notes in the PR) |

## M1 Leads and contacts (base portal) plus companies (Lite) and custom fields and bulk actions (Full)

| ID | Title | Implements | Depends | Acceptance | Size | Model | Parallel | Wave | Status | Resume notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M1-01 | Contacts service: CRUD, E.164 normalisation, duplicate detection, soft delete, tags, owner, `contact.*` and manual `lead.created` events | PRD F-05, F-07; DB contacts | M0-28 | Duplicate phone/email flagged; tenant isolation test; events emitted | L | Sonnet | no | 12 | done | [PR #79](https://github.com/abdullah-kynetic/kynetic-ai/pull/79), stacked on #72. No migration; DC-070 to DC-072. |
| M1-02 | Leads list page: table, search, filters, sort, column toggle, paging, URL-saved state | PRD F-05; DS lists | M1-01 | Given 10,000 contacts the list reads under 500 ms p95; filters survive reload | M | Sonnet | yes | 13 | done | [PR #95](https://github.com/abdullah-kynetic/kynetic-ai/pull/95), stacked on #79. No migration; DC-085. |
| M1-03 | Contact detail page: details, phones and emails, consent status, slots for timeline and deals | PRD F-06; DS detail | M1-01 | Page loads all sections; other tenant's id returns 404 | M | Sonnet | yes | 13 | done | [PR #85](https://github.com/abdullah-kynetic/kynetic-ai/pull/85), stacked on #79. Page at `/dashboard/contacts/[id]`; deals, timeline, tasks, notes sections are empty slots until M2 and M3. |
| M1-04 | Slide-out create and edit panel with duplicate warning | PRD F-07 | M1-01, M1-02 | Creating a duplicate shows the match and blocks silent duplicates | S | Haiku | yes | 14 | done | [PR #99](https://github.com/abdullah-kynetic/kynetic-ai/pull/99), stacked on #95. No migration, no DC. Merge offer waits for M1-08. |
| M1-05 | Companies service and pages (CRM Lite) | PRD F-10 | M1-01 | Module off returns 403; rollup of contacts and deals correct | M | Sonnet | yes | 13 | done | [PR #90](https://github.com/abdullah-kynetic/kynetic-ai/pull/90), stacked on #79. No migration; DC-087. |
| M1-06 | Custom fields: definitions, values, settings UI, list and detail rendering (CRM Full) | PRD F-12 | M1-01, M1-02 | Each field type validates; `lite` tenant gets 403 | L | Sonnet | yes | 14 | done | [PR #109](https://github.com/abdullah-kynetic/kynetic-ai/pull/109), stacked on #95 (M1-01, M1-02). No migration; DC-100. |
| M1-07 | Bulk actions: tag, assign, status, delete; enrol-in-sequence stub (CRM Full) | PRD F-08 | M1-02 | 20 selected rows updated in one action and audited | M | Sonnet | yes | 14 | done | [PR #111](https://github.com/abdullah-kynetic/kynetic-ai/pull/111), stacked on #95. No migration; DC-101. |
| M1-08 | Merge duplicate contacts: survivor selection, move deals, notes and activities, soft-remove the loser, `contact.merged` | PRD F-07 | M1-01, M1-04 | Merge moves all linked records and is audited; loser is soft-removed | M | Sonnet | yes | 15 | done | Service, server action, portal control, integration and Playwright coverage added on the current work branch. |
| M1-09 | M1 gate: acceptance, TESTING statuses, docs | AGENTS; T | M1-01..M1-08 | All M1 rows pass | S | Haiku | no | 16 | done | Focused M1 integration files pass one at a time; typecheck, format, lint, build and 20 Playwright E2E tests pass. |

## M2 Pipeline and kanban (base portal) with configurable stages (Lite) and multi-contact deals (Full)

| ID | Title | Implements | Depends | Acceptance | Size | Model | Parallel | Wave | Status | Resume notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M2-01 | Pipelines, stages and deals services; default stages seeded per tenant; `deal.*` events | PRD F-14, F-17; DB deals | M0-28, M1-01 | Default stages exist; Lost requires a reason | L | Sonnet | no | 13 | done | [PR #89](https://github.com/abdullah-kynetic/kynetic-ai/pull/89), stacked on #79. No migration; DC-096. |
| M2-02 | Kanban board page: drag between stages, counts and totals, optimistic move with undo, filters | PRD F-16; DS kanban | M2-01 | Move persists and emits `deal.stage_changed`; undo restores | L | Sonnet | yes | 14 | done | [PR #98](https://github.com/abdullah-kynetic/kynetic-ai/pull/98), stacked on #89. No migration. Browser drag check and E2E not run (no sign-in fixture). |
| M2-03 | Deal detail and slide-out (value, service type, expected close, source, lost reason) | PRD F-14 | M2-01 | Money stored in cents; lost reason enforced | M | Sonnet | yes | 14 | done | [PR #107](https://github.com/abdullah-kynetic/kynetic-ai/pull/107) |
| M2-04 | Multi-contact deals with roles (CRM Full) | PRD F-15 | M2-01 | `lite` tenant gets 403; roles saved | S | Sonnet | yes | 14 | done | [PR #102](https://github.com/abdullah-kynetic/kynetic-ai/pull/102) |
| M2-05 | Configurable stages settings page (CRM Lite) | PRD F-17, F-43 | M2-01 | Rename, reorder, add stage; deals keep their stage | M | Sonnet | yes | 14 | done | [PR #108](https://github.com/abdullah-kynetic/kynetic-ai/pull/108), stacked on #89. No migration; DC-105. |
| M2-06 | M2 gate | AGENTS; T | M2-01..M2-05 | All M2 rows pass | S | Haiku | no | 15 | done | PR pending, stacked on #108 with #98, #107 and #102 merged in. Merged scope helper (DC-117). typecheck, test (unit) and test:integration (297) pass. No migration. |

## M3 Timeline, tasks and notes

| ID | Title | Implements | Depends | Acceptance | Size | Model | Parallel | Wave | Status | Resume notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M3-01 | Activities read API and timeline UI on contact and deal | PRD F-19; DS timeline | M0-28, M2-01 | Calls, messages, stage changes and notes appear in order; type filter works | M | Sonnet | no | 14 | done | [PR #110](https://github.com/abdullah-kynetic/kynetic-ai/pull/110), stacked on #89 with the M1-03 branch merged in. `listActivities` service plus `Timeline` component, live on the contact page; deal page mounts it in M2-03. No DC or migration used. |
| M3-02 | Tasks service, My Tasks view (overdue, today, upcoming), task slide-out (CRM Lite) | PRD F-20 | M3-01 | Overdue task listed; completion undo | M | Sonnet | yes | 15 | done | PR (see thread), stacked on #110. `server/tasks` service (create, edit, complete, reopen as undo, soft delete and restore, My Tasks grouped by the tenant's day), My Tasks page at `/dashboard/tasks`, task slide-out, live Tasks section on the contact page, nav entry. All gated on `crm` Lite. Task-due notification is M3-04. No DC or migration used. |
| M3-03 | Rich-text notes with @mentions and pin (CRM Lite) | PRD F-22 | M3-01 | Mention notifies teammate through `notify()` | M | Sonnet | yes | 15 | done | [PR #118](https://github.com/abdullah-kynetic/kynetic-ai/pull/118), stacked on #110. Notes service (create, edit, pin, soft delete, list), sanitizer, `note_mentions`, `mention` notification kind (migration 0053, DC-114), Notes card with Tiptap editor on the contact page. Company and deal pages mount `NotesSection` when they exist. |
| M3-04 | Task-due job and notifications | PRD F-20, F-35 | M3-02 | Due task creates a notification once | S | Sonnet | yes | 16 | done | `task.due` delayed pg-boss queue, worker handler, idempotent notification check, and integration coverage added on the current work branch. |
| M3-05 | M3 gate | AGENTS; T | M3-01, M3-02, M3-03, M3-04 | All M3 rows pass | S | Haiku | no | 17 | done | Timeline, task, notes, notification/activity and task-due integration suites pass one at a time; build checks pass. |

## M4 Alex calls, messages, compliance

| ID | Title | Implements | Depends | Acceptance | Size | Model | Parallel | Wave | Status | Resume notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M4-01 | ElevenLabs voice adapter: start outbound call, verify webhook, parse call result | PRD F-77, F-78; ARCH 7; ARCH Provider integration details | M0-28 | Contract test passes against the fake and recorded fixtures; bad signature rejected | L | Opus | no | 12 | done | [PR #76](https://github.com/abdullah-kynetic/kynetic-ai/pull/76). Fixtures follow the documented payload shape, not a live recording; re-record at M10-08. |
| M4-02 | Retell fallback adapter | ARCH 7 | M4-01 | Same contract test passes | M | Sonnet | yes | 13 | done | [PR #84](https://github.com/abdullah-kynetic/kynetic-ai/pull/84), wired into call-end processing in [#97](https://github.com/abdullah-kynetic/kynetic-ai/pull/97). DC-088. |
| M4-03 | R2 storage adapter and signed URL minting | PRD F-27; SEC 2.3 item 10 | M0-28 | Private bucket; URL expires in 5 minutes; wrong tenant 404 | M | Sonnet | yes | 12 | done | Local SigV4/FakeStorage tests and live test-bucket acceptance pass. `r2-live-m8b.test.ts` verified upload/list/download, 300-second signed URL use, actual expiry rejection, tenant UUID prefix list isolation and cross-tenant 404 against only `kynetic-portal-test`; test objects were removed. |
| M4-04 | Lead intake endpoint `/api/hooks/leads/:tenantKey` (signed token) | PRD F-76 | M0-28 | Creates contact and deal and emits `lead.created`; bad token refused | M | Sonnet | yes | 12 | done | [PR #78](https://github.com/abdullah-kynetic/kynetic-ai/pull/78). |
| M4-05 | Call-end processing job: write `calls`, `activities`, copy recording to R2, store transcript and summary | PRD F-26, F-27 | M4-01, M4-03 | Duplicate webhook creates one call; recording reachable only by signed URL | L | Opus | no | 13 | done | [PR #96](https://github.com/abdullah-kynetic/kynetic-ai/pull/96). |
| M4-06 | Outbound call start on `lead.created`: call windows, retries, real `OutboundGate` | PRD F-78; SEC 3.4 | M4-01, M4-04 | No call outside the window; kill switch honored; retry cadence tested with a fake clock | L | Opus | no | 13 | done | [PR #100](https://github.com/abdullah-kynetic/kynetic-ai/pull/100). Crash gap (dialed, provider call id unsaved) closed in the M4 gate, DC-119. |
| M4-07 | Compliance enforcement: quiet hours 8am to 9pm lead-local, DNC, disclosure, recording flag | PRD F-74, F-75; SEC 3 | M4-06 | Table-driven tests incl. DST; two-party state flagged from config | L | Opus | no | 14 | done | [PR #114](https://github.com/abdullah-kynetic/kynetic-ai/pull/114). Per-state table content still needs counsel. |
| M4-08 | Twilio SMS adapter, status and inbound webhooks, STOP and HELP into consents | PRD F-74, F-30; ARCH Provider integration details | M0-28 | Signature verified; STOP revokes SMS only; sends gated by A2P status | L | Opus | yes | 12 | done | [PR #81](https://github.com/abdullah-kynetic/kynetic-ai/pull/81). Live sends wait on A2P approval. |
| M4-09 | Resend adapter, webhook, bounce and complaint suppression | PRD F-30, F-35 | M0-28 | Bounce marks the address; shows in integration health data | M | Sonnet | yes | 12 | done | [PR #74](https://github.com/abdullah-kynetic/kynetic-ai/pull/74). Migration 0019, DC-077. Resend provider and Better Auth magic-link sender are now wired in Node app and worker startup; fake-fetch unit coverage verifies provider config, escaped link content, sender/recipient, URL-hash idempotency and no-key behavior. No real Resend request or production email was made. |
| M4-10 | Calls list page | PRD F-26; DS calls | M4-05 | Filters and outcome chips; 10,000-call list under 500 ms p95 | M | Sonnet | yes | 14 | done | [PR #106](https://github.com/abdullah-kynetic/kynetic-ai/pull/106). |
| M4-11 | Call detail page: player, transcript, summary, extracted fields, flag for review | PRD F-27, F-28 | M4-05, M4-03 | Flag sets `calls.flagged` and notifies Kynetic | M | Sonnet | yes | 14 | done | [PR #104](https://github.com/abdullah-kynetic/kynetic-ai/pull/104). |
| M4-12 | Messages log page (SMS and email, delivery status) | PRD F-30 | M4-08, M4-09 | Delivery status updates on webhook | S | Haiku | yes | 13 | done | [PR #92](https://github.com/abdullah-kynetic/kynetic-ai/pull/92). |
| M4-13 | `alex_configs` service and read-only Alex settings view | PRD F-42, F-58 (data) | M4-01 | Owner sees settings; raw prompt never returned | S | Sonnet | yes | 13 | done | [PR #86](https://github.com/abdullah-kynetic/kynetic-ai/pull/86). |
| M4-14 | M4 gate | AGENTS; T | M4-01..M4-13 | All M4 rows pass; no real call or text in any test | S | Haiku | no | 15 | done | M4 gate: all M4 PRs combined on top of m0/gate. Typecheck, lint, 232 unit and 342 integration tests pass; Playwright E2E rows not run. DC-119. |

## M5 Appointments and booking

| ID | Title | Implements | Depends | Acceptance | Size | Model | Parallel | Wave | Status | Resume notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M5-01 | Availability function (business hours, existing appointments, buffers) | PRD F-24, F-78; DB appointments | M4-14 | Pure-function tests incl. timezones and DST | M | Opus | no | 16 | done | `availableSlots` added with timezone/DST, existing-appointment buffers and pure tests. |
| M5-02 | Appointments service and booking endpoints for the voice tool (token per tenant) | PRD F-78 | M5-01, M4-01 | Booking into a taken slot refused; idempotent | M | Sonnet | yes | 17 | done | Availability and booking endpoints added with per-tenant service-token scopes, atomic overlap protection, and external-event idempotency. |
| M5-03 | Appointments calendar page (month, week, day); create, reschedule, cancel | PRD F-24; DS calendar | M5-01 | Reschedule updates deal stage and emits `appointment.*` | L | Sonnet | yes | 17 | done | Day/week/month range views, create, reschedule, cancel, overlap protection, audit, and appointment events added. |
| M5-04 | Appointment events to timeline and notifications | PRD F-19, F-35 | M5-02 | Booked appointment appears on contact timeline | S | Haiku | yes | 18 | done | Appointment activity and `appointment.booked` event are recorded; worker subscriber creates an idempotent owner notification. |
| M5-05 | M5 gate | AGENTS; T | M5-01, M5-02, M5-03, M5-04 | All M5 rows pass | S | Haiku | no | 19 | done | Typecheck, production build, format check, lint (warnings only), and appointment availability tests pass. |

## M6 Dashboard and reports

| ID | Title | Implements | Depends | Acceptance | Size | Model | Parallel | Wave | Status | Resume notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M6-01 | `metrics_daily` roll-up job per the PRD metric definitions | PRD Metric definitions, F-01; DB metrics | M4-14, M5-05 | Hand-computed expected values from the seed fixture match | L | Opus | no | 20 | done | Idempotent tenant/day rollup worker, source metrics, and dashboard aggregation added. |
| M6-02 | Seed fixture with hand-computed expected dashboard numbers | T Expected values | M6-01 | Fixture and expected values stored together; signed off by Abdullah | M | Sonnet | yes | 21 | done | Hand-computed metrics fixture stored beside unit assertions; fixed-clock guarantee assertions included. |
| M6-03 | Dashboard page: stat cards vs baseline, trend and source charts, activity feed | PRD F-01, F-02; DS dashboard | M6-01 | Cards hide when the module is off; numbers match the fixture | L | Sonnet | yes | 21 | done | Dashboard stat cards, daily trend bars, lead-source bars, recent activity, and 30-day metric aggregation added. |
| M6-04 | Guarantee progress component | PRD F-03 | M6-01 | Progress and days left correct on a fixed clock | S | Haiku | yes | 21 | done | Pure `guaranteeProgress` calculation and dashboard progress display added. |
| M6-05 | Reports service, `ReportSection` registry, monthly ROI report job (email and page) | PRD F-49; ARCH 7 | M6-01 | Full month fixture produces the report; `report.ready` emitted | L | Sonnet | yes | 21 | done | Tenant-scoped report generation, reusable sections, tenant-prefixed storage artifacts, `report.ready`, and owner email worker added. |
| M6-06 | Reports page | PRD F-49; DS reports | M6-05 | Report opens for the right tenant only | S | Haiku | yes | 22 | done | Tenant-scoped reports listing page added and included in navigation. |
| M6-07 | M6 gate | AGENTS; T | M6-01..M6-06 | All M6 rows pass | S | Haiku | no | 23 | done | M6 rollup, dashboard, guarantee, reports, fixture tests, typecheck, lint, build, and formatting checks pass. |

## M7 Automations, notifications and upsell modules

| ID | Title | Implements | Depends | Acceptance | Size | Model | Parallel | Wave | Status | Resume notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M7-01 | Automation templates, toggles per tenant and settings UI | PRD F-31 | M4-14, M2-06 | Template on creates runs; off cancels pending runs | M | Sonnet | no | 16 | done | Tenant-scoped template listing/toggles, permission/module checks, audit records, settings UI, active-run cancellation, lead trigger subscriber, and sequence enrollment queue added. |
| M7-02 | Sequence engine: steps, delays, stop on reply or booking; `enrollInSequence` | PRD F-32; ARCH 2 | M7-01 | Reply stops the sequence; every send goes through `OutboundGate` | L | Opus | no | 17 | done | Disposable PostgreSQL/fake SMS acceptance covers transient retry, quiet-hour deferral/early delivery, module-off no-send, tenant-isolated reply stop, and appointment-booked stop. |
| M7-03 | Stage-move rules and alerts (deal won email, hot-lead SMS to owner) | PRD F-33 | M7-01 | Booked call moves the deal; alert sent once | M | Sonnet | yes | 17 | done | Deal-won and hot-lead notifications are idempotent; appointment booking moves a matching deal to the Booked stage. |
| M7-04 | Notifications UI: bell, popover, full page with tabs, email delivery | PRD F-35; DS notifications | M0-28 | Unread count correct; email sent through the adapter | M | Sonnet | yes | 12 | done | PR #83 (https://github.com/abdullah-kynetic/kynetic-ai/pull/83), stacked on #72; DC-078; no migration |
| M7-05 | `quote_followup` module | PRD F-79 | M7-02 | Deal entering Quoted starts the sequence; module off no-ops | M | Sonnet | yes | 18 | done | `tests/integration/m7-module-acceptance.test.ts` verifies disabled no-op, quoted-stage enrollment when enabled, and duplicate event delivery creates one run. |
| M7-06 | `after_hours` module | PRD F-80 | M7-02, M4-14 | Inbound outside hours creates contact, logs call, notifies staff | M | Sonnet | yes | 18 | done | `tests/integration/m7-module-acceptance.test.ts` verifies module-off no-op and an after-hours inbound call creates one staff notification despite duplicate event delivery. Call/contact creation stays covered by the M4 intake path. |
| M7-07 | `missed_call_textback` module | PRD F-81 | M7-02, M4-08 | One text to a consented or permitted caller; none otherwise | M | Sonnet | yes | 18 | done | `tests/integration/m7-module-acceptance.test.ts` verifies one fake-provider SMS for a consented missed call and no SMS without consent; module gating is covered for this subscriber. A2P, DNC and quiet-hour combinations remain covered only by shared outbound-gate acceptance. |
| M7-08 | `reactivation` module and `reactivation_batches` | PRD F-82 | M7-02 | Only consented contacts enter; imported contacts without consent excluded | L | Sonnet | yes | 18 | done | Added the tenant-scoped reactivation batch table and launch service. Audiences are restricted to imported source or batch, every contact passes `canContact` for SMS, only consented contacts create queued automation runs, and launches are audited. |
| M7-09 | `followup_bundle` admin switch | PRD F-84 | M7-05, M7-07, M7-08 | Enabling sets the three member modules in one audited action | S | Haiku | yes | 19 | done | Admin bundle toggle atomically switches followup_bundle, quote_followup, reactivation, and missed_call_textback together; each change uses the existing audited module function and billing snapshot path. |
| M7-10 | Service API routes and signed outbound events for n8n | PRD F-89; ARCH 5, 6 | M0-20, M7-01 | n8n token calls a route for one tenant; events carry an HMAC | M | Sonnet | yes | 17 | done | `service-tokens.test.ts` covers actual route tenant scope, revocation and authorization; `n8n-events-m7.test.ts` covers canonical `lead.created` HMAC and stable event ID/signature across 503 retry; `lead-intake.test.ts` proves replay emits `lead.created` once. |
| M7-11 | M7 gate | AGENTS; T | M7-01..M7-10 | All M7 rows pass | S | Haiku | no | 20 | done | M7 focused acceptance suites pass on disposable PostgreSQL with fake providers: sequence retry/reply/booking, notification isolation/email, F-79 to F-84 modules, F-89 route and retry, and lead emission idempotency. Typecheck passes. Production acceptance and live provider behavior remain outside local verification. |

## M8a Admin shell

| ID | Title | Implements | Depends | Acceptance | Size | Model | Parallel | Wave | Status | Resume notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M8a-01 | Admin layout and navigation, all-clients entry point | PRD F-53 (shell); DS admin | M0-28 | Only Kynetic roles reach admin routes | S | Haiku | no | 12 | done | PR: https://github.com/abdullah-kynetic/kynetic-ai/pull/77; stacked on m0/gate (#72); DC-079; no migration |
| M8a-02 | 30-second onboarding form: tenant, owner invite, modules, templates, branding | PRD F-55; SEC invites | M8a-01, M0-28 | Form creates tenant, invite and checklist in one action; invite email on approval | L | Sonnet | yes | 13 | done | [PR #93](https://github.com/abdullah-kynetic/kynetic-ai/pull/93) |
| M8a-03 | User management across tenants: invite, deactivate, reset, roles | PRD F-61 | M8a-01 | Deactivated user loses all sessions | M | Sonnet | yes | 13 | done | [#91](https://github.com/abdullah-kynetic/kynetic-ai/pull/91) |
| M8a-04 | View as client with banner, read-only default, logged sessions | PRD F-57; SEC 2.6 | M8a-01 | Writes fail in read-only; every write stamps the impersonator | L | Opus | yes | 13 | done | PR: https://github.com/abdullah-kynetic/kynetic-ai/pull/94; stacked on M8a-01 (#77); DC-093; migration 0032 |
| M8a-05 | Audit log viewer with filters | PRD F-60 | M8a-01 | Filter by tenant, user, action; VA read per SEC 2.2 | M | Sonnet | yes | 13 | done | PR: https://github.com/abdullah-kynetic/kynetic-ai/pull/88; stacked on M8a-01 (#77); DC-094; no migration |
| M8a-06 | Modules panel: toggle per tenant, CRM level, history | PRD F-70, F-85 | M8a-01 | Toggle audited; flag change takes effect on next request | M | Sonnet | yes | 13 | done | PR: https://github.com/abdullah-kynetic/kynetic-ai/pull/87; stacked on #77 (M8a-01); DC-095; no migration |
| M8a-07 | Plan and tier fields and billing tab | PRD F-86, F-99; DB tenant_billing | M8a-06 | Price snapshot per module; owner and VA get 403 | M | Sonnet | yes | 14 | done | [PR #101](https://github.com/abdullah-kynetic/kynetic-ai/pull/101) |
| M8a-08 | Onboarding checklist and owner setup progress card | PRD F-100; DB onboarding_steps | M8a-02 | Checklist created per module; owner sees only client-visible steps | M | Sonnet | yes | 14 | done | PR #105 |
| M8a-09 | M8a gate | AGENTS; T | M8a-01..M8a-08 | All M8a rows pass | S | Haiku | no | 15 | done | PR: https://github.com/abdullah-kynetic/kynetic-ai/pull/115; combines #77, #93, #91, #94, #88, #87, #101, #105; DC-118; no migration |

## M8b Admin operations

| ID | Title | Implements | Depends | Acceptance | Size | Model | Parallel | Wave | Status | Resume notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M8b-01 | All-clients table with MRR, leads in 30 days, booking rate, guarantee status | PRD F-53 | M6-07, M8a-09 | Shows roll-up data only through SECURITY DEFINER functions | M | Sonnet | no | 24 | done | Verified three-tenant rollups, owner-role denial, hand-scored 76/0 fixtures, and admin browser thresholds on disposable PostgreSQL (2026-10-28). |
| M8b-02 | Health score job and chips | PRD F-54; PRD decision 10 | M6-07, M8b-01 | Scores match hand-computed fixtures; thresholds 70 and 40 | M | Sonnet | yes | 25 | done | Verified score formula, 70/40 thresholds, default threshold display and tenant separation in integration and admin E2E tests (2026-10-28). |
| M8b-03 | Integration health: per-client and global, A2P status, delivery failures, bounces | PRD F-62 | M4-14, M8a-09 | Failures appear within one minute of the webhook | M | Sonnet | yes | 16 | done | Disposable-PostgreSQL integration and E2E verify provider error and A2P rollups; delivery-time freshness remains unmeasured. |
| M8b-04 | Per-client Alex config admin, prompt versions, test call | PRD F-58 | M4-14, M8a-09 | Test call uses the fake in preview; change is audited | M | Sonnet | yes | 16 | done | Verified admin-only config update, prompt version increment and test call through injected FakeVoiceProvider; browser edit path passed (2026-10-28). No real provider call was made. |
| M8b-05 | Backups: nightly encrypted dump to R2, retention, restore test job, backups page, manual backup | PRD F-63; ARCH Operations | M0-28, M8a-09 | Dump appears in R2; restore into scratch passes SEC-T-01 and SEC-T-02 | L | Opus | yes | 16 | done | Verified on only `kynetic-portal-test`: live encrypted `pg_dump` upload, list, download, decryption, actual scratch restore from the downloaded dump, tenant RLS checks, 30 daily/12 monthly R2 retention pruning, and cleanup (`tests/integration/r2-live-m8b.test.ts`). Existing local admin list/manual queue/page checks also pass. |
| M8b-06 | Flagged-call review queue (admin side of F-28) | PRD F-28 | M4-14, M8a-09 | Flag appears; admin marks reviewed | S | Haiku | yes | 16 | done | Verified tenant-scoped flagged-call listing, review action and audit record in disposable-PostgreSQL integration and E2E (2026-10-28). |
| M8b-07 | Operations tools: kill switch, webhook replay, job viewer, suspend, 2FA reset, demo reseed | PRD F-101; SEC Appendix D | M8a-09, M0-18 | Kill switch stops sends; replay processes once | L | Opus | yes | 16 | done | Verified synthetic call/SMS blocked by kill switch, failed webhook replay queued once on duplicate request, safe job summary view and tenant suspend/reactivate. Existing admin 2FA reset and demo seed integration tests pass (2026-10-28). |
| M8b-08 | M8b gate | AGENTS; T | M8b-01..M8b-07 | All M8b rows pass | S | Haiku | no | 26 | done | Existing M8b integration/E2E gate passed (35 integration, 4 admin/backup E2E, typecheck/build); live R2 backup/restore/retention passed in 2 integration tests on only `kynetic-portal-test`. No production bucket or provider used. |

## M9 Search, import, export, branding, settings, polish

| ID | Title | Implements | Depends | Acceptance | Size | Model | Parallel | Wave | Status | Resume notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M9-01 | Import engine part 1: file intake (csv, xlsx, size and row limits, signature check), column mapping, mapping templates | PRD F-90; SEC 5.3; DB Imports | M1-09, M8a-09 | 10 MB and 50,000 row limits enforced; .xlsm and archives refused | M | Opus | no | 17 | done | CSV intake enforces size, binary, malformed and row limits before storage. XLSX and XLSM are deliberately refused with tested `xlsx_not_available` before storage. Contact/company/deal/note record types and mappings are supported; the latest dry-run mapping is saved on its import batch and prefilled for the same entity/source, covered by E2E. |
| M9-02 | Import engine part 2: dry-run validation, dedupe on E.164 phone and lower-case email, duplicate rule skip or fill-blanks, report | PRD F-91; DB Imports | M9-01 | Dry run changes nothing; report lists failures with row numbers | L | Opus | no | 18 | done | Disposable PostgreSQL integration proves dry-run read-only at 1,000 mixed rows and 50,000 valid rows, row issue reporting, E.164 duplicate detection, refusal without a matching dry run, fill-empty behavior and undo restoration. |
| M9-03 | Import engine part 3: commit job, source and batch tags, no-outreach guarantee, undo with edited-record list | PRD F-92, F-93, F-96; ARCH import flow | M9-02 | No `lead.created` emitted; undo lists records edited after import; partial batch is undoable | L | Opus | no | 19 | done | Synthetic integration covers contact/company/deal/note metadata, linked parents, deals in mapped stages with cents, no `lead.created`, batch undo, consent import and append-only revoke on undo, imported-contact consent gating in M7, and injected worker interruption with a failed, undoable partial batch. Commit remains a single tenant-scoped DB transaction; hard database failure rollback is not fault-injected. |
| M9-04 | Import wizard UI (upload, map, preview, report, commit) | PRD F-90, F-91, F-94; DS import | M9-03 | Admin completes a 50,000-row dry run; client roles get 403 | L | Sonnet | yes | 20 | done | E2E covers contact/company/deal/note mapping, a 50,000-row synthetic file through the wizard, same-source mapping prefill, history undo, owner/VA 403, and tenant-A batch replay under tenant B returning 404. UI HTTP responses are faked for form flows; disposable PostgreSQL integration verifies the actual import services including 50,000-row dry-run and multi-entity commit. |
| M9-05 | Import history page and undo UI | PRD F-93 | M9-03 | Undo removes batch records; edited records listed | M | Sonnet | yes | 20 | done | Playwright history/undo interaction passes for admin; integration proves batch records soft-removed and edited contacts listed/preserved. |
| M9-06 | Global search and Cmd+K (CRM Full) | PRD F-37 | M1-09, M2-06 | Phone fragment finds the contact; search under 500 ms p95 | M | Sonnet | yes | 17 | done | `search-m9.test.ts` and `load-m10.test.ts` pass on 10,000 synthetic contacts with tenant isolation. On the app-equivalent 10-connection pool, the latest 100-read run measured p95 75.2ms at concurrency 20 and 218.1ms at concurrency 100. EXPLAIN confirms phone fragments use `contacts_phone_fragment_trgm`; combined search uses a sequential scan measured at 17.9ms. Cmd+K E2E passes. |
| M9-07 | CSV export per table view (CRM Full, permissioned) | PRD F-38; SEC export rules | M1-09 | Export honors filters and the staff permission; audited | M | Sonnet | yes | 17 | done | `tests/integration/export-m9.test.ts` proves filtering, tenant scope, full-module/permission denial and audit; `tests/unit/export-csv.test.ts` proves formula neutralization. CSV download E2E passed in the prior local run; the focused Playwright rerun passed 2026-10-28 with the disposable PostgreSQL endpoint explicitly set. |
| M9-08 | Branding settings: logo upload, color with contrast check, business name | PRD F-39; SEC uploads; DS client color rules | M0-28 | Bad file refused; low-contrast color refused | M | Sonnet | yes | 12 | done | Local save/audit/format/contrast and tenant checks pass; saved name/color visibility passes browser E2E. Live synthetic logo upload, R2 readback, browser download, and cleanup pass in `tests/e2e/m9-r2-logo.spec.ts` using only `kynetic-portal-test`. |
| M9-09 | Business settings: hours, service area, services, transfer number, team | PRD F-41 | M0-28 | Hours feed availability and call windows | M | Sonnet | yes | 12 | done | [PR #82](https://github.com/abdullah-kynetic/kynetic-ai/pull/82); migration 0021, DC-081 |
| M9-10 | Client Alex settings: pause and call hours only | PRD F-42; PRD decision 8 | M4-13 | Other fields are not writable; change audited | S | Sonnet | yes | 14 | done | [#103](https://github.com/abdullah-kynetic/kynetic-ai/pull/103) |
| M9-11 | Settings pages: tags and notification preferences (Lite) | PRD F-43 | M2-05, M7-04 | Preferences honored by `notify()` | M | Haiku | yes | 15 | done | [PR #116](https://github.com/abdullah-kynetic/kynetic-ai/pull/116) |
| M9-12 | Documents page and admin upload | PRD F-103; DB tenant_documents | M4-03, M8a-09 | Signed URL; other tenant 404 | M | Haiku | yes | 16 | done | PDF-only admin upload (10 MB cap and magic prefix), tenant-prefixed private storage, owner Documents page and five-minute signed download redirect. Disposable PostgreSQL/FakeStorage proves upload, owner download and foreign-tenant 404; E2E proves owner list/download route and synthetic admin upload UI. |
| M9-13 | Mobile polish pass on daily-use pages | PRD F-44; DS responsive | M1-09, M2-06, M3-05, M5-05 | Playwright 390px passes; 44px touch targets | M | Sonnet | yes | 20 | done | Playwright 390px audit passes for no-overflow and 44×44px targets across dashboard, contacts, appointments, tasks and documents. Contact phone uses a 44px `tel:` link. Manual visual device review is outside this automated acceptance and remains unverified. |
| M9-14 | M9 gate | AGENTS; T | M9-01..M9-13 | All M9 rows pass | S | Haiku | no | 21 | done | Local M9 acceptance passed on disposable PostgreSQL/fakes: 17 focused integration and 17 Playwright tests, typecheck/build; live test-bucket logo upload/download E2E adds one passing Playwright test. Coverage includes F-37/F-38, XLSX refusal, multi-entity imports and recovery, F-39, F-44, F-103. Live owner/pilot and production storage remain outside acceptance. |

## M10 Hardening and launch

| ID | Title | Implements | Depends | Acceptance | Size | Model | Parallel | Wave | Status | Resume notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M10-01 | Security review against the SEC checklist; fix findings | SEC Appendix A and 7 | M9-14, M7-11, M8b-08 | Review checklist signed; no open high findings | L | Opus | no | 27 | done | Review evidence: `docs/security-review-M10-01.md`. Tenant-leading contacts trigram index (`b7b8e57`), shared auth IP/email limits (`8256212`), and API/search/export/import limits (`430da61`, tests `4ffce62`) are implemented. Focused rate-limit/search/list/export/import suites passed 34 tests; withApi unit tests passed 5; typecheck passed; affected M10 accessibility/security and M9 search/export browser suites passed 10/10 with no limit errors. Supervisor reports Bun 1.4.2 production audit clean (366 packages), one moderate dev-only esbuild advisory, and matching PostgreSQL 17.10 M8b restore tests 5/5; earlier full PG16.14 integration run was 627 passed, 2 failed, 2 skipped, with the index issue fixed and restore mismatch explained. No high findings remain. Production verification is still pending for edge TLS/origin lock-down, deployed headers, and CI secret scanning; the dev dependency advisory is low. |
| M10-02 | Load test and set numeric limits | ARCH Operations Scale; PRD decision 13 | M9-12 | p95 targets met; limits recorded in ARCH | M | Sonnet | yes | 17 | done | 100 synthetic searches over 10,000 contacts passed at concurrency 20 (p95 75.2ms) and 100 (p95 218.1ms) using the app-equivalent pool max=10. EXPLAIN confirms phone-fragment trigram index; combined search sequential scan measured 17.9ms. Production capacity remains unverified. |
| M10-03 | Restore drill on the production-like stack | ARCH Operations; T restore drill | M8b-05 | Scratch restore passes isolation tests | M | Opus | yes | 17 | done | 2026-10-29 VPS drill: synthetic restore-source DB migrated and seeded with demo-a/demo-b/demo-sales; `kynetic_backup` pg_dump, AES-GCM encryption, upload to authorized kynetic-portal-test, read-after-write download/decrypt, scratch pg_restore, tenant RLS isolation assertions all passed. PostgreSQL 16 client used. Test object, backup_runs row, and temporary source DB were removed; test bucket backup prefix verified empty. Live portal health remained 200/ok. Repo fixes for backup role public/drizzle read access are commits  dd16456 and 15457d0. |
| M10-04 | WCAG 2.2 AA audit: axe plus manual keyboard and screen-reader pass | DS Accessibility; PRD decision 13 | M9-12 | No AA failures on daily-use pages | M | Sonnet | yes | 17 | blocked | Automated evidence: `docs/a11y-review-M10-04.md`. Axe scanned 24 routes in light/dark and desktop/390px mobile (96 clean page-state scans), using WCAG 2.0/2.1/2.2 A and AA tags; the combined `m10-a11y-security.spec.ts` + `shell.spec.ts` run passed 21/21, including keyboard and focus checks. Initial product findings were five affected DOM nodes (audit summaries, two mobile table regions and Kanban board ARIA); all fixed in `d25d682`, `720b81f`, and `246d35d`. Manual screen-reader review: not verified, needs a human screen-reader pass. Keep blocked until that human review is recorded. |
| M10-05 | Production server setup: compose project, Cloudflare, Caddy, deploy script, monitoring and alerts | ARCH Server and deployment setup, Monitoring | M0-27, M0-28 | Health check green; alert test fires; deploy and rollback rehearsed | L | Opus | blocked | 12 | blocked | Legacy backup verified at `/var/backups/portal-legacy-20261028T231704Z`; Caddy backup at `/var/backups/portal-caddy-swap-20261029T024426Z/Caddyfile`. New app/worker/Postgres stack at `/opt/portal-new`, app on `127.0.0.1:3021`, R2 test bucket only, provider mode stub, outbound disabled. Bootstrap, role migrations, app health and worker verified. Portal-only Caddy change validated/reloaded; portal, Twenty, n8n, Kien all returned 200. Old app/DB containers are stopped; named volume retained. M10-03 production-like R2 restore drill passed and all synthetic/temp R2 objects and DB records were cleaned. Deploy/rollback rehearsal passed: built app/worker from source commit `15457d0`, verified app healthy and worker running with zero restarts, then restored the saved `4f104ff` app/worker compose and repeated the checks; the legacy DB volume and neighboring services were untouched. Exact legacy and image rollback commands are in `crm/deploy/prod/README.md`. Gate remains blocked because the production alert email test requires Resend/real email, which is excluded from approved scope; DNS/pilot/client-data checks also remain unapproved. |
| M10-06 | Email domain and DNS records (SPF, DKIM, DMARC) | ARCH Domain, DNS and email domain | M10-05 | Resend domain verified | S | Sonnet | yes | 13 | blocked | DNS and Resend domain verification are live-system changes, explicitly excluded without Abdullah's approval. |
| M10-07 | Pre-go-live gates checklist, synthetic demo tenant script, old portal and `/api/ingest/results` fate recorded | ARCH Pre-go-live gates; PRD F-88 | M10-01..M10-06 | Every gate ticked; demo tenant seeded with synthetic data only | M | Sonnet | no | 28 | blocked | Depends on open M10-01/03/04/05/06 and owner decision on legacy portal/API fate. Production readiness is not claimed. |
| M10-08 | Pilot client onboarding using the real flow (with Abdullah's yes) | PRD F-55, F-90; AGENTS Live systems | M10-07 | Pilot live and used daily | L | Sonnet | no | 29 | blocked | Pilot onboarding is explicitly outside this task and requires Abdullah's approval for the live production action. |

## M11 Online Presence Management

| ID | Title | Implements | Depends | Acceptance | Size | Model | Parallel | Wave | Status | Resume notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M11-01 | OPM tables and services (`presence_items`, `review_snapshots`) | PRD F-83, F-48; DB Not in the baseline schema | M0-28, M6-07 | Module off returns 403; data kept | M | Sonnet | no | 24 | done | PostgreSQL integration covers module-off denial, retained records, tenant isolation, audited item/snapshot writes and month filtering; `presence.test.ts` passed (4 tests, 2026-10-28). |
| M11-02 | Admin OPM status and task list per client | PRD F-83; DS OPM | M11-01, M8a-09 | Admin updates an item; audited | M | Sonnet | yes | 25 | done | Admin client page supports presence task create/status updates and audited review snapshot capture; service write and audit assertions pass in `presence.test.ts`. |
| M11-03 | Owner Online Presence tab and `ReportSection` for the monthly report | PRD F-83; ARCH 7 | M11-01, M6-05 | Section appears only with `opm` on | M | Sonnet | yes | 25 | done | Monthly report sections include enabled OPM snapshots; owner page and report browser flow pass in `tests/e2e/m11-presence.spec.ts` (2026-10-28). |
| M11-04 | M11 gate | AGENTS; T | M11-01, M11-02, M11-03 | All M11 rows pass | S | Haiku | no | 26 | done | Focused presence and baseline integration tests (20 passed), M11 browser flow (1 passed), typecheck and production build pass. No vendor connector was built; vendor selection remains unresolved and out of v1 status-only scope. |


## M12 to M20 All-in-one portal (proposed 2026-10-31, waits for Abdullah's approval)

Source of the decisions: `docs/DECISIONS.md` section "All-in-one portal, 2026-10-30/31". Companion: `docs/automation-map.md`. Nothing here is built. n8n workflows are built inactive and never activated without Abdullah's yes. Real provider calls, deploys, DNS, and writes to Retell, Twenty or Notion each need his specific yes. Waves are assigned when approved.

### M12 n8n contract and safety (the gate tasks must be done before any send task)

| ID | Title | Implements | Depends | Acceptance | Size | Model | Parallel | Wave | Status | Resume notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M12-01 | Write the portal/n8n contract doc: events n8n sends, endpoints the portal exposes, signing, retries, idempotency | automation-map; DECISIONS DC-TBD | none | Doc reviewed. Every automation in the map has an owner and an endpoint. | S | Opus | yes | 30 | done | Contract technically reviewed against implementation: docs/portal-n8n-contract.md; all map rows covered. User authorized continued local implementation 2026-11-01. Locked supersedes and live go-live approval remain M12-02/M12-08 gates. |
| M12-02 | Record decisions 3, 4, 7, 8 in `docs/DECISIONS.md` | automation-map; DECISIONS DC-TBD | M12-01 | Entries added with Abdullah's confirmation. No D-number guessed. | S | Haiku | yes | 31 | blocked | Explicit confirmation of locked-decision supersedes 3/4/7/8 remains pending; no numbers guessed. Independent local feature work proceeds without replacing the current safety gate. |
| M12-03 | Portal endpoint: n8n posts a "contact decision" (allow or deny, reason, rule that fired). Stored on the lead timeline. | automation-map; DECISIONS DC-TBD | M12-01 | Integration test: allow and deny both stored, tenant isolated, duplicate post ignored. | M | Sonnet | yes | 31 | done | Evidence-only scoped endpoint + migration 1001. PostgreSQL 16 integration 9/9 passed: allow/deny timeline, replay/concurrency/conflict, isolation/FK, revoked/scope denial, schema, module-off logging, rollback and immutable grants. Typecheck passed. Local only, CI pending. |
| M12-04 | Portal kill switch n8n reads before any send (global and per tenant) | automation-map; DECISIONS DC-TBD | M12-03 | Test: switch on means the shared sub-workflow refuses. | S | Sonnet | yes | 32 | in-progress | Portal send-state reader implemented and PostgreSQL-tested (scope, live admin flags, isolation, malformed-config denial). Uses environment global disable and existing tenant flags; actual shared n8n-subworkflow refusal acceptance remains pending. |
| M12-05 | Admin screen to issue a tenant's lead-webhook secret and show the n8n URL | automation-map; DECISIONS DC-TBD | M12-01 | Secret shown once, rotated, never logged. Access test for non-admin. | M | Sonnet | yes | 31 | done | Admin webhook page/actions built; synthetic PostgreSQL tests 6/6 passed (rotation, encrypted storage, old-signature rejection, role/disabled checks, safe status, atomic audit). Unit action tests added for view-as denial and safe errors. No real secrets issued; browser/CI pending. |
| M12-06 | Shared n8n sub-workflow "may I contact" (consent, quiet hours, state rules, DNC, frequency caps) reading portal data | automation-map; DECISIONS DC-TBD | M12-03 | Fake-data test table covers every rule, including quiet hours at edges and Florida/Oklahoma blocks. Logs a decision per run. | L | Opus | yes | 32 | in-progress | Minimal contact-policy reader implemented/tested: consent status, DNC, timezone/state windows, counts/caps, module/A2P inputs. migrationGatePassed=false. n8n rule graph and parity not implemented; connector reference retry still fails. FL/OK outright blocks vs existing narrower windows need an explicit parity difference review. |
| M12-07 | Gate parity test: same inputs through the old portal gate and the n8n sub-workflow give the same answer | automation-map; DECISIONS DC-TBD | M12-06 | All cases match or each difference is listed for Abdullah. | M | Opus | yes | 33 | todo |  |
| M12-08 | M12 gate: review of decisions, risk list, kill switch | automation-map; DECISIONS DC-TBD | M12-02, M12-03, M12-04, M12-05, M12-07 | Abdullah's yes. | S | Haiku | yes | 34 | todo |  |

### M13 Client lead-to-call chain (ElevenLabs, stub first)

| ID | Title | Implements | Depends | Acceptance | Size | Model | Parallel | Wave | Status | Resume notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M13-01 | n8n workflow: form/Meta/Angi/LSA lead in, post to portal, check contact decision, start call | automation-map; DECISIONS DC-TBD | M12-08 | Fake-source test: lead appears in portal first, then a fake call starts. Lead is never lost if call step fails. | L | Sonnet | yes | 35 | todo |  |
| M13-02 | ElevenLabs adapter in the portal (stub and real behind a switch) | automation-map; DECISIONS DC-TBD | M12-01 | Stub passes. Real mode off by default. | M | Opus | yes | 31 | done | Reused existing adapter; ELEVENLABS_LIVE_ENABLED defaults false. Explicit live mode + opt-in + keys required for real selection. Focused provider/env unit tests pass, including fake idempotency and zero fetch. No live call. |
| M13-03 | Call result flow: provider webhook to n8n to portal (outcome, transcript, recording link) | automation-map; DECISIONS DC-TBD | M13-02 | Fake call shows outcome on the lead. Duplicate result ignored. | M | Sonnet | yes | 32 | in-progress | Portal result relay + receipt migration 1002 implemented. Fake result/timeline/signed recording, replay/concurrency/conflict, module isolation, auth, rollback and native-path regression verified locally. Actual provider-to-n8n relay graph and recording upload handoff pending; no live call. |
| M13-04 | Retry schedule in n8n (5 min, 1 hour, next day, max 4), each retry re-checks contact decision | automation-map; DECISIONS DC-TBD | M13-01 | Test with fake clock. No retry after opt-out or booking. | M | Sonnet | yes | 36 | todo |  |
| M13-05 | Booking through Cal.com from the call, relayed to portal | automation-map; DECISIONS DC-TBD | M13-03 | Fake booking appears on the lead and moves the deal stage. | M | Sonnet | yes | 33 | todo |  |
| M13-06 | Fix deal-to-booked rule (`booked` vs `Estimate Booked`) | automation-map; DECISIONS DC-TBD | none | Regression test. | S | Sonnet | yes | 30 | done | F-33 Estimate Booked fix verified 2026-11-01: focused PostgreSQL 16 suite passed 6/6, including tenant isolation and replay. Local only; CI not run. |
| M13-07 | New-lead alert and hot-lead alert by email | automation-map; DECISIONS DC-TBD | M13-01 | Fake lead sends one email. No duplicate. | S | Sonnet | yes | 36 | todo |  |
| M13-08 | Opt-out and STOP handling end to end | automation-map; DECISIONS DC-TBD | M12-06 | Fake STOP stops all further sends, logged with reason. | M | Opus | yes | 33 | todo |  |
| M13-09 | M13 gate: full fake run, lead to call to booking to report data | automation-map; DECISIONS DC-TBD | M13-01, M13-03, M13-04, M13-05, M13-07, M13-08 | Abdullah's yes. Real provider test calls need a separate yes. | S | Haiku | yes | 37 | todo |  |
| M13-10 | Replace the Retell outbound-speed-to-lead n8n workflow with the ElevenLabs lead chain (same Alex, same agent role). The old workflow stays inactive until the new one passes, then is archived only with Abdullah's yes. Nora and Emily are not touched. | automation-map B4; DECISIONS DC-TBD-07 | M13-09 | Side-by-side fake-lead run gives the same outcomes on the new chain; old workflow confirmed inactive; no live n8n or Retell write without a yes | M | Sonnet | yes | 38 | todo |  |

### M14 Follow-up sequences, reminders, reviews

| ID | Title | Implements | Depends | Acceptance | Size | Model | Parallel | Wave | Status | Resume notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M14-01 | Sequence steps in n8n (SMS and email) with the contact decision before each send | automation-map; DECISIONS DC-TBD | M13-09 | Test: steps fire in order, stop on reply or opt-out. SMS stays off until A2P. | L | Sonnet | yes | 38 | todo |  |
| M14-02 | Appointment reminders (24h, 2h) | automation-map; DECISIONS DC-TBD | M13-05 | Fake appointment sends two reminders. | M | Sonnet | yes | 34 | todo |  |
| M14-03 | No-show recovery | automation-map; DECISIONS DC-TBD | M14-02 | No-show triggers one recovery message and a task. | M | Sonnet | yes | 35 | todo |  |
| M14-04 | Portal "payment received" event, Paid button and 2-hour review-request timer | automation-map; DECISIONS DC-TBD | M13-09 | Fake payment starts a timer; message is queued 2 hours later; duplicate payment does not double-send. | M | Sonnet | yes | 38 | todo |  |
| M14-06 | n8n review-request workflow: email now, text after A2P, contact decision before each send | automation-map; DECISIONS DC-TBD | M14-04, M12-06 | Fake run sends the email at 2 hours; opted-out contact gets nothing. Text path stays off until A2P. | M | Sonnet | yes | 39 | todo |  |
| M14-07 | First two invoicing adapters in n8n (systems chosen with Abdullah once a client's system is known; Stripe test mode is the default first) | automation-map; DECISIONS DC-TBD | M14-04 | Fake paid invoice triggers the portal event. No real client account is touched without a yes. | L | Sonnet | yes | 39 | todo |  |
| M14-08 | Retire portal-side sending: turn off the portal's own sequence, text-back, reactivation and reminder sends (module flags off), then remove that code once the n8n versions pass. Keep the tables and records. | automation-map B3, B7, B13; DECISIONS DC-TBD-08 | M14-05, M14-06, M12-07 | Only n8n sends in a fake-data run; portal worker queues for these sends are gone; history and records still readable; deletion of code needs Abdullah's yes | M | Sonnet | yes | 40 | todo |  |
| M14-05 | Missed-call text-back, after-hours reply, reactivation moved or kept | automation-map; DECISIONS DC-TBD | M14-01 | Parity with existing portal behavior. | M | Sonnet | yes | 39 | todo |  |

### M15 Reporting and alerts

| ID | Title | Implements | Depends | Acceptance | Size | Model | Parallel | Wave | Status | Resume notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M15-01 | n8n schedule that triggers daily metrics per tenant | automation-map; DECISIONS DC-TBD | M13-09 | Metrics rows appear for fake tenants each day. | S | Sonnet | yes | 38 | todo |  |
| M15-02 | Weekly client email from n8n (counts, bookings, link to portal) | automation-map; DECISIONS DC-TBD | M15-01 | Fake tenant gets one email with correct numbers. | M | Sonnet | yes | 39 | todo |  |
| M15-03 | Monthly report scheduling | automation-map; DECISIONS DC-TBD | M15-01 | Report generated for a fake tenant. | S | Sonnet | yes | 39 | todo |  |
| M15-04 | Error alerts for failed n8n workflows to email | automation-map; DECISIONS DC-TBD | M12-01 | Forced failure sends one alert. | S | Sonnet | yes | 31 | blocked | Deferred by Abdullah 2026-11-01 with all n8n automation work. Existing local formatter preserved; no workflow graph/import/activation. |
| M15-05 | SMS alert to Abdullah (blocked until A2P) | automation-map; DECISIONS DC-TBD | M15-04 | Test with fake number only. | S | Sonnet | yes | 32 | todo |  |

### M16 Kynetic agency tenant: leads, dialer, pipeline

| ID | Title | Implements | Depends | Acceptance | Size | Model | Parallel | Wave | Status | Resume notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M16-01 | Create Kynetic as its own tenant (synthetic data first) | automation-map; DECISIONS DC-TBD | M12-01 (synthetic portal-only sequencing override 2026-11-01) | Isolation test with a client tenant. | M | Opus | yes | 35 | done | Synthetic agency registry/setup implemented, with outbound disabled, paused Alex, no invites/memberships/secrets. PostgreSQL isolation/concurrency/rollback/admin checks pass. No live tenant created; local verification only, CI pending. Commits: 51bacd8. |
| M16-02 | Lead sources inbound vs outbound; outbound split by channel (cold call, SMS, email, DM) | automation-map; DECISIONS DC-TBD | M16-01 | Filters and counts correct on seeded data. | M | Sonnet | yes | 36 | done | Synthetic manual source entry, inbound/outbound channel filters and counts implemented at /admin/agency. Atomic contact/deal creation emits no lead.created and stores no consent; latest 50 shown, totals over all live agency leads. Integration/browser verified; CI pending. Commits: 51bacd8, 54cd21c. |
| M16-03 | Human dialer queue: next lead, script, DNC flag, one-tap outcome log | automation-map; DECISIONS DC-TBD | M16-02 | Seeded run: DNC lead is never shown. Outcome saved with time. | L | Sonnet | yes | 37 | done | Synthetic human queue/script/history and one-click immutable outcomes built at /admin/agency/dialer. DNC/current-state checks on both selection and save; double-submit idempotency. First-pass only, no callback scheduling. Local unit/integration/browser verified; CI pending. Commits: e5847b4, d5d7db2, daf8c41. |
| M16-04 | Campaigns | automation-map; DECISIONS DC-TBD | M16-02 | Create, assign leads, see results. | M | Sonnet | yes | 37 | done | Campaign create/assign, guarded queue filter and manual outcome summaries built at /admin/agency/campaigns. Idempotent assignment and tenant FKs. Includes prior member history, not attribution. Local integration/browser verified; CI pending. Commits: d5d7db2, daf8c41. |
| M16-05 | Agency pipeline stages (confirmed: New, Contacted, Interested, Proposal Sent, Won, Lost, Nurture) | automation-map; DECISIONS DC-TBD | M16-01 | Stages editable, moves logged. | M | Sonnet | yes | 36 | done | Seven approved agency stages seeded; rename and deal moves reuse existing audited CRM services. Client pipelines unchanged; foreign IDs rejected. Integration/browser verified; CI pending. Commits: 51bacd8, 54cd21c. |
| M16-06 | Never-dial list guard (AM-1 Roofing, FL, OK, DNC) in the dialer | automation-map; DECISIONS DC-TBD | M16-03 | Test: blocked numbers cannot be logged as called. | S | Opus | yes | 38 | done | Shipped with M16-03. AM-1 identity/known protected number, FL/OK, DNC/phone opt-outs, missing/conflicting state and non-synthetic numbers excluded/rechecked. Tests prove blocked records cannot create call logs, including stale DNC. No actual dial/provider request. Commits: e5847b4, d5d7db2. |

### M17 Proposals, onboarding, billing

| ID | Title | Implements | Depends | Acceptance | Size | Model | Parallel | Wave | Status | Resume notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M17-01 | Proposal builder (draft, never auto-sent; Problem, Agentic Solution, Roadmap, ROI) | automation-map; DECISIONS DC-TBD | M16-05 | Draft saved and rendered. | M | Sonnet | yes | 37 | done | Internal per-deal four-section draft editor/preview, revision conflicts and safe text rendering verified locally by unit/integration/browser tests. No sends, pricing or stage changes; CI pending. Commits: 892f2fe, 1bebdfa. |
| M17-02 | Price plans as data | automation-map; DECISIONS DC-TBD | M17-01 | Both price models loadable; no hard-coded price. | M | Sonnet | yes | 38 | todo |  |
| M17-03 | Client onboarding checklist and tenant creation from a won deal (no live provider calls) | automation-map; DECISIONS DC-TBD | M17-01, M12-05 | Fake client created end to end. | L | Sonnet | yes | 38 | todo |  |
| M17-06 | Auto-created Alex demo when a client profile is created (copy a template agent with the client's name; demo number only reachable by Abdullah; real provider calls need his yes; never touches Nora or Emily) | automation-map; DECISIONS DC-TBD | M13-02, M17-03 | Fake client profile creates a stub demo agent record and shows a test link. No live write. | L | Opus | yes | 39 | todo |  |
| M17-04 | Stripe draft invoices from n8n (needs Abdullah's yes before any real Stripe write) | automation-map; DECISIONS DC-TBD | M17-02 | Stripe test mode only. Draft created and logged. | L | Sonnet | yes | 39 | todo |  |
| M17-05 | Payment received and dunning (test mode) | automation-map; DECISIONS DC-TBD | M17-04 | Fake failed payment starts dunning. | M | Sonnet | yes | 40 | todo |  |

### M18 Backup, digest, cleanup

| ID | Title | Implements | Depends | Acceptance | Size | Model | Parallel | Wave | Status | Resume notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M18-01 | Twenty one-way backup of Kynetic data and tenant summaries (no personal data) | automation-map; DECISIONS DC-TBD | M12-02 | Test proves no client personal data in the payload. Writes need Abdullah's yes. | L | Opus | yes | 32 | todo |  |
| M18-02 | Daily digest to Abdullah | automation-map; DECISIONS DC-TBD | M15-01 | Fake data digest arrives. | S | Sonnet | yes | 39 | todo |  |
| M18-03 | Twilio click-to-call dialer (later, only after A2P and volume) | automation-map; DECISIONS DC-TBD | M16-03 | Deferred. | L | Opus | yes | 38 | todo |  |
| M18-04 | Update docs, progress, known issues | automation-map; DECISIONS DC-TBD | all | Docs match what was built. | S | Haiku | no | 42 | todo |  |
| M18-05 | Delete the retired `portal/` folder and update `CLAUDE.md`, `KYNETIC_CONTEXT.md` and the system map. Needs Abdullah's yes; first record the fate of `/api/ingest/results` (M10-07). | M10-07; KYNETIC_CONTEXT | none | No code, workflow or tool references `portal/` or `/api/ingest`; docs point to `crm/`; history keeps the old code | S | Haiku | yes | 30 | blocked | No deletion approval or M10-07 legacy ingest fate recorded. Referrer/cutover inventory: docs/audit-M12-M20.md. portal/ preserved. |

### M19 Client-side completeness (added Nov 1 from the gap check)

| ID | Title | Implements | Depends | Acceptance | Size | Model | Parallel | Wave | Status | Resume notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M19-01 | Ad spend and cost-per-lead on the client dashboard (Meta spend pulled by n8n, stored by portal) | automation-map; DECISIONS DC-TBD | M13-09 | Fake spend plus fake leads give correct cost per lead per week. | M | Sonnet | yes | 38 | todo |  |
| M19-02 | Alex usage and cost tracking per tenant, with a monthly spend cap that pauses calls | automation-map; DECISIONS DC-TBD | M13-03, M12-04 | Fake usage over the cap pauses new calls and alerts Abdullah. | M | Opus | yes | 33 | todo |  |
| M19-03 | Recording-disclosure check on every call (opener present in transcript, flag if missing) | automation-map; DECISIONS DC-TBD | M13-03 | Fake transcript without the disclosure is flagged on the call and counted in the report. | S | Sonnet | yes | 33 | todo |  |
| M19-04 | Client offboarding: stop all sends, export their data, mark tenant inactive | automation-map; DECISIONS DC-TBD | M12-06 | Fake tenant cancelled; no further sends; export contains only that tenant. | M | Opus | yes | 33 | todo |  |
| M19-05 | Client staff roles and invites recheck against the new flows (built in M8; verify only) | automation-map; DECISIONS DC-TBD | M13-09 | Role tests still pass with n8n-written data. | S | Sonnet | yes | 38 | todo |  |

### M20 Agency completeness (added Nov 1 from the gap check)

| ID | Title | Implements | Depends | Acceptance | Size | Model | Parallel | Wave | Status | Resume notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M20-01 | Lead sourcing import into outbound lists (Meta Ad Library and Maps results through n8n) | automation-map; DECISIONS DC-TBD | M16-02 | Seeded results import once, dedupe, never import AM-1 Roofing or FL/OK. | M | Sonnet | yes | 37 | todo |  |
| M20-02 | Outbound email and DM tracking (human-sent; portal logs and checks DNC; no automated sends, per D-007) | automation-map; DECISIONS DC-TBD | M16-02 | Logged message appears on lead; DNC lead blocked. | M | Sonnet | yes | 37 | todo |  |
| M20-03 | Contracts and e-sign tracking (draft, sent, signed; provider chosen by Abdullah) | automation-map; DECISIONS DC-TBD | M17-01 | Status moves and links to the deal. No real send without a yes. | M | Sonnet | yes | 38 | todo |  |
| M20-04 | Revenue and expenses view for Kynetic | automation-map; DECISIONS DC-TBD | M17-05 | Seeded invoices and expenses give correct monthly totals. | M | Sonnet | no | 41 | todo |  |
| M20-05 | Client health score and renewal alerts | automation-map; DECISIONS DC-TBD | M15-01 | Fake low-activity client triggers one alert. | M | Sonnet | yes | 39 | todo |  |
| M20-06 | Support requests from clients | automation-map; DECISIONS DC-TBD | M16-01 | Client submits, Abdullah sees it, status tracked. | M | Sonnet | yes | 36 | todo |  |
| M20-07 | Referrals and case-study tracking | automation-map; DECISIONS DC-TBD | M17-03 | Referral linked to a won deal; case-study status per client. | S | Haiku | yes | 39 | todo |  |




### Build order for M12 to M20

**Portal-first update (Abdullah, 2026-11-01):** Skip n8n automation work for now. Build independent portal features against local/synthetic fixtures. M16-01 may start without the deferred M12-08 automation gate for this synthetic, outbound-disabled workspace only; M16-02 and M16-05 then follow M16-01. n8n gates remain open for later integration/go-live. Login/auth work stays last.

**Sequencing update (Abdullah, 2026-11-01):** Defer remaining user-facing login/auth implementation, provider setup and polish until after the feature waves. Existing login, server authorization, tenant isolation, service-token authentication and webhook verification stay enforced throughout development. Use synthetic authenticated fixtures for feature verification. The final login/auth pass must finish before go-live; this changes work order, not release security requirements.

Waves 30 and up continue after the existing 29. A task may start when every dependency is `done`. Tasks in the same wave with Parallel = yes can run in separate threads. Anything that needs a live provider, deploy, DNS change or write to Retell, Twenty, Notion or Stripe waits for Abdullah's specific yes, whatever the wave.

| Wave | Tasks | Notes |
| --- | --- | --- |
| 30 | M12-01, M13-06, M18-05 | |
| 31 | M12-02, M12-03, M12-05, M13-02, M15-04 | |
| 32 | M12-04, M12-06, M13-03, M15-05, M18-01 | |
| 33 | M12-07, M13-05, M13-08, M19-02, M19-03, M19-04 | |
| 34 | M12-08, M14-02 | |
| 35 | M13-01, M14-03, M16-01 | |
| 36 | M13-04, M13-07, M16-02, M16-05, M20-06 | |
| 37 | M13-09, M16-03, M16-04, M17-01, M20-01, M20-02 | |
| 38 | M13-10, M14-01, M14-04, M15-01, M16-06, M17-02, M17-03, M18-03, M19-01, M19-05, M20-03 | |
| 39 | M14-06, M14-07, M14-05, M15-02, M15-03, M17-06, M17-04, M18-02, M20-05, M20-07 | |
| 40 | M14-08, M17-05 | |
| 41 | M20-04 | |
| 42 | M18-04 | |

How a new thread uses this: read this section and the rows for the wave it is taking, then the Implements docs (`docs/automation-map.md`, DECISIONS DC-TBD entries, ARCHITECTURE "Proposed 2026-10-31", SECURITY 3.1a, PRD "Proposed additions"), analyze what each task needs, build it on `work` with its acceptance tests, update the row, and stop at any live-system step.

## Open items that can block tasks
These come from `docs/DECISIONS.md` (Still UNRESOLVED and approved gap-check items).
- Delivery date: no task is blocked, but the plan cannot be dated until Abdullah gives it.
- Gap-check items GP-01 to GP-12 are approved for v1 (DECISIONS DC-047); no task is blocked on them.
- Twilio A2P approval gates going live with SMS (M4-08, M7-07, M7-08), not building them against fakes.
- Counsel answers gate the state rule table and consent wording (M4-07). Build to the decided defaults with the table as versioned config.
- ElevenLabs paid plan and phone import gate real calls (M4-01 live check, M10-08), not the adapter.
- F-97 connectors and OPM vendors are not planned until chosen.
- M12 to M20 (proposed): counsel has not confirmed that n8n making the consent decision (DC-TBD-08) meets TCPA and state rules; M12-06 and M12-07 are built against the decided defaults and the real go-live waits for counsel.
- M12 to M20: which two invoicing systems come first (M14-07) needs Abdullah, once a client's system is known.
- M12 to M20: whether the current lead webhook accepts every lead-source shape, and what the `backup.run` job does, are not confirmed; M12-01 and M18-01 check them first.
- M12 to M20: Twilio A2P gates every text step (M14-01, M14-04, M14-06, M15-05).
- Not in M12 to M20: the M10 leftovers (Cloudflare/TLS lock-down, CI secret scanning, human screen-reader pass). They stay under M10-01, M10-04 and M10-05.
- Coastal Roofing tenant setup is on hold until Abdullah says go and is not a task here.

## M0 gate resume notes (2026-10-26)

Branch `m0/gate` combines every M0 PR (#47 to #71) and is the base to build M1 on until the stack is merged. Combined results: 105 unit, 244 integration, 15 Playwright E2E, `bun run check`, `bun run build` all pass.

- **Merge order.** The M0 PRs are stacked and share files. Merge them in task order; expect conflicts in `crm/drizzle/meta/_journal.json` (keep every entry, sort by tag, renumber `idx`, keep `when` increasing), `docs/DECISIONS.md` and `docs/BUILD_PLAN.md` (keep both sides). Merging `m0/gate` itself avoids this.
- **Migration numbers** used: 0000 to 0006, 0010, 0012, 0013, 0014, 0015. 0007 to 0009 and 0011 were reserved and not needed. Gaps are harmless. Next free: 0016.
- **DC numbers** used: DC-055 to DC-060, DC-062, DC-064, DC-066 to DC-069. DC-061, DC-063 and DC-065 were not used. Next free: DC-070.
- **Not verified anywhere:** `docker compose up`, live Google OAuth, real email delivery (call `setMagicLinkSender` with the M0-19 adapter at boot), the worker container under compose, pg-boss behind PgBouncer, and signed-in E2E (no sign-in fixture yet, so the signed-in redirect, `/accept-terms` axe check and signed-in shell axe check are untested).
- **Open follow-ups:** call `audit()` for M0-22 secret writes and the M0-16 manual consent entry; M0-16 uses channel `phone_call` where SECURITY.md says "voice" (DC-062); M0-25 copy is placeholder text.
- **Needs from Abdullah before live use:** `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, and an email provider key.

