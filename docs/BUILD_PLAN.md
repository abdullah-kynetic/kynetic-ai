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
| M4-09 | Resend adapter, webhook, bounce and complaint suppression | PRD F-30, F-35 | M0-28 | Bounce marks the address; shows in integration health data | M | Sonnet | yes | 12 | done | [PR #74](https://github.com/abdullah-kynetic/kynetic-ai/pull/74). Migration 0019, DC-077. |
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
| M10-01 | Security review against the SEC checklist; fix findings | SEC Appendix A and 7 | M9-14, M7-11, M8b-08 | Review checklist signed; no open high findings | L | Opus | no | 27 | blocked | Local source/runbook review, tenant/role/token/rate-limit/webhook suites and browser secret-response check pass. Final checklist sign-off depends on M8b-08 and production-like/live configuration evidence, both unavailable under current local-only constraints. |
| M10-02 | Load test and set numeric limits | ARCH Operations Scale; PRD decision 13 | M9-12 | p95 targets met; limits recorded in ARCH | M | Sonnet | yes | 17 | done | 100 synthetic searches over 10,000 contacts passed at concurrency 20 (p95 75.2ms) and 100 (p95 218.1ms) using the app-equivalent pool max=10. EXPLAIN confirms phone-fragment trigram index; combined search sequential scan measured 17.9ms. Production capacity remains unverified. |
| M10-03 | Restore drill on the production-like stack | ARCH Operations; T restore drill | M8b-05 | Scratch restore passes isolation tests | M | Opus | yes | 17 | blocked | Actual encrypted dump and scratch restore with tenant check and cleanup pass on disposable PostgreSQL. Production-like stack validation is blocked by unavailable Docker; remote backup storage requires separate explicit authorization. |
| M10-04 | WCAG 2.2 AA audit: axe plus manual keyboard and screen-reader pass | DS Accessibility; PRD decision 13 | M9-12 | No AA failures on daily-use pages | M | Sonnet | yes | 17 | blocked | Automated axe WCAG 2.2 AA scans pass on six owner and four admin pages; keyboard focus checks pass on contacts, appointments and tasks. Remaining screen-reader and full keyboard interaction acceptance requires manual human review. |
| M10-05 | Production server setup: compose project, Cloudflare, Caddy, deploy script, monitoring and alerts | ARCH Server and deployment setup, Monitoring | M0-27, M0-28 | Health check green; alert test fires; deploy and rollback rehearsed | L | Opus | yes | 12 | blocked | Abdullah approved legacy portal replacement on 2026-10-28. Read-only VPS inventory confirmed `/etc/caddy/Caddyfile` owns ports 80/443 and routes `portal.kyneticai.com` to legacy `127.0.0.1:3020`; the new stack's documented Caddy also binds web ports, so deployment stopped before backup or mutation per instruction. Legacy compose declares `portal-db`, `portal-app`, and named volume `portal-db-data`; `/opt/portal/.env` contains these names only: APP_URL, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, AUTH_SECRET, AUTH_URL, DATABASE_OWNER_URL, DATABASE_URL, EMAIL_FROM, ENCRYPTION_KEY, FILE_SIGNING_SECRET, MAX_UPLOAD_MB, PORTAL_APP_PASSWORD, PORTAL_OWNER_PASSWORD, POSTGRES_PASSWORD, R2_ACCESS_KEY_ID, R2_ACCOUNT_ID, R2_BUCKET, R2_SECRET_ACCESS_KEY, RESEND_API_KEY, UPLOAD_DIR. Existing Twenty/n8n/Kien containers were observed running and left untouched. Backup/restore, container stop/move, new-stack deployment, health/migrations, rehearsal, restore drill and rollback note remain unrun. Resolve Caddy integration/port ownership before resuming. Inventory commit: pending. |
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

## Open items that can block tasks
These come from `docs/DECISIONS.md` (Still UNRESOLVED and approved gap-check items).
- Delivery date: no task is blocked, but the plan cannot be dated until Abdullah gives it.
- Gap-check items GP-01 to GP-12 are approved for v1 (DECISIONS DC-047); no task is blocked on them.
- Twilio A2P approval gates going live with SMS (M4-08, M7-07, M7-08), not building them against fakes.
- Counsel answers gate the state rule table and consent wording (M4-07). Build to the decided defaults with the table as versioned config.
- ElevenLabs paid plan and phone import gate real calls (M4-01 live check, M10-08), not the adapter.
- F-97 connectors and OPM vendors are not planned until chosen.

## M0 gate resume notes (2026-10-26)

Branch `m0/gate` combines every M0 PR (#47 to #71) and is the base to build M1 on until the stack is merged. Combined results: 105 unit, 244 integration, 15 Playwright E2E, `bun run check`, `bun run build` all pass.

- **Merge order.** The M0 PRs are stacked and share files. Merge them in task order; expect conflicts in `crm/drizzle/meta/_journal.json` (keep every entry, sort by tag, renumber `idx`, keep `when` increasing), `docs/DECISIONS.md` and `docs/BUILD_PLAN.md` (keep both sides). Merging `m0/gate` itself avoids this.
- **Migration numbers** used: 0000 to 0006, 0010, 0012, 0013, 0014, 0015. 0007 to 0009 and 0011 were reserved and not needed. Gaps are harmless. Next free: 0016.
- **DC numbers** used: DC-055 to DC-060, DC-062, DC-064, DC-066 to DC-069. DC-061, DC-063 and DC-065 were not used. Next free: DC-070.
- **Not verified anywhere:** `docker compose up`, live Google OAuth, real email delivery (call `setMagicLinkSender` with the M0-19 adapter at boot), the worker container under compose, pg-boss behind PgBouncer, and signed-in E2E (no sign-in fixture yet, so the signed-in redirect, `/accept-terms` axe check and signed-in shell axe check are untested).
- **Open follow-ups:** call `audit()` for M0-22 secret writes and the M0-16 manual consent entry; M0-16 uses channel `phone_call` where SECURITY.md says "voice" (DC-062); M0-25 copy is placeholder text.
- **Needs from Abdullah before live use:** `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, and an email provider key.

