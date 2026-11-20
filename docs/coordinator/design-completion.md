# Portal design completion running log

## Phase 3 in progress — synthetic browser fixture

Sales rollback is now browser-tested: a forced failed action shows an error and returns the synthetic card to its original stage. Persistence and rollback passed 2/2 in Chromium; commit `566b4ba3`. The other Phase 3 dashboards and their tests remain unfinished, and the full Phase 3 verify has not been run.

Sales drag persistence now passes in Chromium (1/1) with the isolated synthetic seed. The original test navigated before its creation action completed; it now waits for the newly created prospect, and drives the pointer sensor explicitly. Commit `25495602`. Rollback remains unverified. Clients Kanban, Prospecting tables and funnel, Money dashboard and client dashboards remain open; no Phase 3 full verify has been run.

Commit `37ead5b0` seeds the synthetic agency using a separate disposable database connection. The demo seed initializes Drizzle on its connection, which interfered with later postgres-js JSON parameters when the browser fixture reused that connection; isolating it allows archive import and the remaining fixture setup to complete. Typecheck passed. The Sales board browser test reached the board but failed to find the newly created “Board Prospect”; drag persistence and rollback remain unverified. This is one failed test attempt after fixing fixture setup, not a completed Phase 3 gate. Clients, Prospecting, Money and client area dashboards remain unfinished. Full verify has not been run for Phase 3.

## Phase 2 navigation — 2026-11-19

**Baseline on `759b21a9`:** The requested full `bun run verify` completed with typecheck, lint, formatting, 666/666 unit tests, deploy-script rehearsal, and production build passing. Integration finished with 1,012 passed, 2 skipped, and exactly the 11 accepted inherited M7 failures in `automation-retries-m7.test.ts` (6) and `m7-module-acceptance.test.ts` (5). Both suites also fail on `origin/work`; they were not changed or weakened. The run used disposable local PostgreSQL and `PROVIDER_MODE=stub OUTBOUND_ENABLED=false`.

**Navigation checklist:**

- [x] Admin sidebar has six area links; client sidebar has six; VA sidebar has four. Browser tests count the rendered links for each role and visit every destination.
- [x] Shared `AreaLayout` gives each area with sub-pages a horizontally scrolling tab bar with an active state. Browser tests visit every admin, client, and VA Help tab and require HTTP 200.
- [x] Removed the old Agency landing page and its ten-link tab strip. Prospecting owns the synthetic overview. Inbox, Compose, Proposals, and Contracts live under Sales; Campaigns and Human dialer under Prospecting; Finance and Billing under Money; Operations under Clients. Proposal detail and preview have Sales routes.
- [x] Added permanent HTTP 301 redirects for moved admin and client paths, including detail URLs. The browser test requests every configured legacy route without following redirects and checks the destination. The new map is in `docs/redesign/NAV.md`.
- [x] Area tabs render a helpful first-visit state without the old “create the agency workspace first” instruction. No provider or production writes were made.

**Pushed commits:** `5c52a200` (retire Agency catch-all), `8474f605` (route moves, redirects, navigation tests and map), `99f294e7` (VA Help area), `8835f1d3` (repository formatting), `60e56a34` (unit expectations for new URLs). The final navigation Chromium suite passed 5/5 on disposable synthetic fixtures. Targeted unit retry passed 17/17 after four old-path expectations in three test files were updated; the initial full run on `8835f1d3` had caught those four branch-caused failures and was stopped during integration. The final full verify on `60e56a34` completed: typecheck, lint, formatting, 666/666 unit tests, deploy-script rehearsal, and production build passed. Integration had 1,012 passed, 2 skipped, and exactly the same 11 accepted M7 failures as baseline. Under the requested acceptance criterion, Phase 2 is complete.

Phase 3 dashboards and drag persistence remain outside this phase. The Scraped, Half-enriched, and Fully enriched tabs currently show first-visit states; their lead tables belong to Phase 3.

## Verify failure comparison against `origin/work` — 2026-11-19

The last **complete** `bun run verify` before the lifecycle schema declaration had 666/666 unit tests passing and 12 integration failures (1,011 passing, 2 skipped). Typecheck, lint, format, deploy rehearsal, and build passed. The earlier interrupted run had also shown four isolation and one baseline failure; it did not produce a complete integration result. Reproduction used disposable PostgreSQL with `PROVIDER_MODE=stub OUTBOUND_ENABLED=false` and no live provider calls.

**Caused by `t3/design-finish` migration 1092 (fixed and pushed):** `baseline-ops` table list (1); `isolation` RLS policy, tenant A/B seed rows, cross-tenant write, and read-only write checks (4); `schema-drift` Drizzle table declaration (1). The two baseline/isolation files passed 26/26 on `origin/work`, and schema-drift passed 1/1 there. On the design branch, the lifecycle policy, synthetic rows, and database documentation were added in `cfe90950`; the Drizzle schema declaration was added in `19117f94`. The three affected files then passed 27/27 together. No production migration was applied.

**Also fail on `origin/work` (11, unchanged files):** `m7-module-acceptance` fails F-79 quoted-stage enrollment, F-80 after-hours notification, F-81 missed-call fake SMS, F-33 booking stage move, and F-33 deal-won alert (5). `automation-retries-m7` fails replying-contact stop, booking stop, consent-filtered reactivation, disabled-template stop, transient retry, and quiet-hour deferral (6). The same two files failed 11/13 both on `origin/work` and `t3/design-finish`. They set `OUTBOUND_ENABLED=true` inside the tests while the required `PROVIDER_MODE=stub` validator rejects that combination; the deal-won test additionally encounters a duplicate subscriber after an earlier failed test. These inherited failures were not hidden or weakened.

The requested **single** Alex view-as retry used the ready synthetic client fixture and passed 1/1. It opened no live client record. After `19117f94`, `bun run verify:quick` passed typecheck, lint, format, and 666/666 unit tests; production build also passed. Full verify has not been rerun after that declaration; the affected branch regression files were verified individually, so a final full-gate pass is not claimed.

## Phase 1 follow-up — 2026-11-19

The previously unverified Alex view-as state is now fixed and browser-tested. During a synthetic staff view-as session, Alex and Branding show a clean read-only Settings state with no edit controls. Their server actions also resolve the view-as cookie and refuse writes. Commits: `4f3ae68d`, `1235c097`. A staff browser sweep now visits all nine Settings routes and checks that protected edit controls are hidden (`4e897424`). Alex server validation and Branding color validation show visible errors (`e841b241`); formatting follow-up is `9a7b466a`.

Final focused checks on `9a7b466a`: Settings Chromium suite **13/13 passed**; Alex and backup integration files **12/12 passed** on disposable PostgreSQL; `bun run verify:quick` passed typecheck, lint, format, and **666/666 unit tests**. Production build passed on the preceding behavior-identical source revision. The nine-page dark desktop render check and 390/1280 overflow check are included in the 13 browser tests. The Alex pause action remains DB-only; `backups-m8b.test.ts` retains its `30_000` ms timeout.

**Full `bun run verify` remains blocked, so Phase 1 is not marked fully complete under the original gate.** An isolated run of `baseline-ops.test.ts` and `isolation.test.ts` produced 5 failures and 21 passes: migration 1092 added `client_lifecycle` without a DATABASE.md entry, an RLS policy, or tenant A/B seed rows. The user explicitly paused Sales board/migration 1092 work, so these were diagnosed without editing that migration. Separately, `m7-module-acceptance.test.ts` and `automation-retries-m7.test.ts` set `OUTBOUND_ENABLED=true` internally, which conflicts with the required `PROVIDER_MODE=stub` and `OUTBOUND_ENABLED=false` environment. Their 11 failures were observed in the earlier full run; they were not rerun with outbound enabled. No provider or production call was made. This is a verification gate blocker outside the Settings implementation, not a passing full gate.

## Phase 1 Settings audit — 2026-11-19

Sales board and migration 1092 were committed and pushed as WIP (`c8e5d7b0`) before resuming Settings. The Sales synthetic-prospect browser test timed out during workspace setup; board drag persistence is unverified and that work was not continued.

All nine Settings routes were rendered at desktop width 1280 in dark mode and visually reviewed from local Playwright captures. The Account tab had no active state on Business settings; fixed in `a0eeec9c`. Staff saw Automation enable/disable controls; fixed in `ebb8d25d`. Business, Notifications, Branding, and Alex now restore the latest saved values when Cancel is pressed (`fc7b74c9`, `379bbd4d`, `daf11909`, `44b95f53`). Branding name/color saves now work without object-storage configuration when no logo changes. The admin menu accessibility label and repository formatting fixes are `bb709fd8` and `76c2b77c`.

The Settings browser suite passed 11/11 on the final revision, including all nine dark desktop pages, permission states, error feedback, save/cancel and pause persistence. Alex has a visible pause checkbox. Its server action writes only `alex_configs.paused`, `call_windows`, and audit metadata, with no provider call. `alex-configs.test.ts` checks that provider, agent reference, voice, prompt, greeting, and other fields remain unchanged. It and `backups-m8b.test.ts` passed 12/12 together against disposable PostgreSQL with `PROVIDER_MODE=stub` and `OUTBOUND_ENABLED=false`. The backup test timeout is `30_000` ms at line 77.

Alex view-as permission UX remains **unverified**. Three browser attempts failed while setting up the synthetic view-as fixture: the first chosen client had no View as button, the second navigation raced the redirect, and the available active synthetic client has `alex_core` disabled. The proxy enforces read-only view-as writes, but the Alex page/action do not independently render a read-only fallback. No live client record was used. Under the three-attempt rule this check was stopped and the exploratory edit was reverted.

The final `bun run verify` passed typecheck, lint, format, 666/666 unit tests, deploy-script rehearsal, and build. Integration reported failures in `m7-module-acceptance` (5), `automation-retries-m7` (6), `baseline-ops` (1), and `isolation` (4). The integration process was interrupted after 183 seconds without a complete summary, so no complete integration result is claimed. The M7 tests set `OUTBOUND_ENABLED=true` internally, conflicting with this run's required `OUTBOUND_ENABLED=false`. The new 1092 `client_lifecycle` table is a likely cause of the schema/isolation failures; that Sales WIP is paused by request and was not changed. The 12 focused Alex/backup integration tests passed. Phase 1 remains **not fully verified** because the full gate failed and the view-as check was stopped.

## Saved WIP — Sales board and migration 1092

The uncommitted Sales board, its server action, the `1092_client_lifecycle` migration, and the Sales browser spec were saved together as WIP. The targeted Sales browser test failed while setting up its synthetic prospect: after clicking “Create synthetic agency workspace,” `/admin/prospecting` still showed the creation prompt, so the test timed out waiting for the Name field. The board drag and persistence path has **not** been verified. No production migration was run. This WIP is paused while Phase 1 Settings is audited.

## Design-finish baseline — 2026-11-19

The requested `~/code/kai-design` directory is absent in this environment, so work continues in the existing clean-code `t3/design-finish` worktree. That worktree has pre-existing modified screenshots under `docs/screenshots/`; they are preserved and excluded from design-finish commits. `bun install --frozen-lockfile` made no changes. Baseline `PROVIDER_MODE=stub OUTBOUND_ENABLED=false bun run verify` passed typecheck, lint, formatting, 663 unit tests, deploy-script rehearsal, and production build. Integration was **BLOCKED** because no PostgreSQL 16 server was reachable on the configured local port. This failure predates edits in this run. No full verification pass is claimed.

2026-11-19. Branch `t3/design-completion` starts at `614b7e40` (origin/main). No deploy or PR is authorized here.

## Recovered sequence and scope

Git and `docs/redesign/` show design system (#191), shell (#192), Today, Clients (#197), Prospecting (#201), Sales (#203), and Money (#205, design position 7). Evidence exists for positions 2–7. Position 8 is Settings per the task. No authoritative list of later positions was found; the inventory below is a route audit, not a claim about the original sequence. Honcho search was queried; its separate synthesis request returned HTTP 503.

Settings candidates: `/dashboard/settings` redirects to business; `/dashboard/settings/business`, `/team`, `/branding`, `/pipeline`, `/tags`, `/notifications`, `/automations`, `/custom-fields`, and `/alex`. Client navigation groups most under Settings; Alex is separately listed. Admin navigation instead groups `/admin/templates` and `/admin/operations` under Build and `/admin/users`, `/admin/backups`, `/admin/archive`, `/admin/audit` under System. The exact intended boundary of position 8 is therefore uncertain; start with client Settings, and classify other pages only after inspecting existing design work.

Remaining route families to inventory against completed work: other client dashboard pages and details, admin Build/System/support/client detail subpages, sign-in/onboarding and shared states. Audit intake/report UI belongs to the audit agent; MCP and its tests belong to the MCP agent. Do not edit those or shared contracts without parent approval.

## Acceptance and ownership

For each changed route preserve existing server guards, tenant and module boundaries, form names/actions, validation and behavior. Apply the existing `DESIGN.md` tokens and page patterns. Verify light/dark where supported, 390/1280 widths, keyboard focus, accessible labels and contrast, long values, overflow, loading/error/empty/dense states, synthetic save/error and permission/module-disabled cases. Capture before/after local synthetic browser evidence. Run documented build, typecheck, lint, unit and integration checks; record exact final commit CI separately. No schema, provider, consent, billing, messaging, auth or live-data changes.

Owned files are the Settings route and component files under `crm/src/app/dashboard/settings/`, route-specific tests/evidence, and this log. Shared shell, tokens and server contracts are out of scope. Later batches must name their files here before editing. Docs alignment follows page work.

The custom-field manager at `crm/src/features/custom-fields/custom-fields-manager.tsx` is used by the Settings route and is included for a presentation-only mobile row fix; its actions and server types remain untouched.

## Status

The older `docs/ui/AGENCY-DESIGN.md` describes a historical agency pass and conflicts with the newer root `DESIGN.md` on typography; use the newer redesign contract for this sequence.

### Settings first pass (in progress)

Nine client settings routes use a Settings-local redesign header; business hours have responsive rows and token-based cards, and team member names no longer collapse on mobile. Authorization, module checks, form actions and server logic are unchanged. Before/after synthetic captures at 390 and 1280 are in `docs/redesign/pr-8/`, plus a dark mobile business capture. Mobile review exposed cramped custom-field rows in the separate feature component; that component is not yet changed. The remaining Settings forms need a fuller polish and state review; this is not completion of position 8.

Local build, typecheck and lint passed; unit suite passed 663 tests on retry after one worker timed out during parallel load. Browser checks passed 4/4: route overflow, mocked business save/error, dark/focus and CRM-disabled pipeline. Full integration is running. Permission-denied browser coverage, exhaustive dark/desktop visual inspection, all form error states, CI for the final commit, and remaining pages/docs remain open. Local tests use an isolated `/tmp` PostgreSQL 16 cluster and synthetic provider stubs; no production database was used.

The custom-field row now gives the label a full mobile line. Build, typecheck, lint, 663 unit tests and the four Settings browser checks passed after this change. The updated mobile capture is `docs/redesign/pr-8/after-custom-fields-390.png`; full integration remains in progress.

The Settings browser suite now also checks that an unauthenticated visitor is redirected to sign-in (5/5 passed). A full integration run has reported a backup/restore test timeout and is still running; no integration pass is claimed.

Notification preferences now use a readable card/list and labels for existing notification kinds. Build, typecheck, lint and 663 unit tests passed; Settings browser checks passed 6/6 including a mocked notification save failure. The updated before/after captures are in `docs/redesign/pr-8/`.

### Escalation — 2026-11-19

Stop after two failures on the same check, per task. The full integration run finished with 1022 passed, 2 skipped, and one failure: `tests/integration/backups-m8b.test.ts`, `F-63 encrypted database backup and restore drill > runs a real pg_dump, encrypts it, uploads it, restores to scratch, verifies tenant schema and removes scratch`, timed out at 5000 ms. An isolated retry of that file also timed out at 5000 ms (4 passed, 1 failed). Both used the disposable local PostgreSQL 16 cluster on 127.0.0.1:55432 with extracted client/server binaries. The timeout was not increased and the test was not changed. Escalate to the Coordinator for one-model-up investigation; no integration-green claim is made.

A final presentation-only alignment of the Alex pause checkbox is saved as WIP: build, typecheck, lint and 663 unit tests passed with it, but browser review and final-commit CI are pending. Settings and all later pages/docs remain unfinished. Branch pushes have no GitHub workflow runs, so CI evidence is absent. No migrations or production changes.

### Resume on `t3/design-finish` — 2026-11-19

Created the branch in the prepared checkout from the pushed `41cc83ea`. Honcho confirmed the handoff and the two prior timeouts. The inherited 5-second test and all assertions passed with a disposable PostgreSQL 16 diagnostic: real `pg_restore` with session-only `synchronous_commit=off` completed in 2.665 seconds, and all five tests passed. The earlier local run used synchronous commits; the result implicates local WAL flush latency, though no per-command timing was recorded for the earlier runs. The diagnostic changes crash durability for the restore session only. It retains real dump, encryption, upload, restore, isolation, and cleanup checks. No configuration or test changes are committed, and CI with default PostgreSQL settings remains unverified.

Settings follow-up aligns the permission and module fallback with the same page header, puts Branding fields in a Settings card, and uses the existing staff test identity for direct-route permission checks. Server guards, submissions, and module checks are preserved. Files are the Settings routes and forms plus the Playwright fixture server and Settings spec.

The first full integration attempt returned 1,011 passed, 12 failed, and 2 skipped. The backup drill passed with the local diagnostic; failures were in the demo seed (the extracted PostgreSQL was missing its LLVM dependency) and two automation suites (the inherited shell-level `PROVIDER_MODE=stub` conflicted with their synthetic outbound flag). The retry uses the missing local runtime library and a clean subprocess environment with no provider credentials. The browser server still explicitly sets stub mode and disables outbound. T3 Preview reported missing `libnspr4.so`, `libnss3.so`, `libnssutil3.so`, and `libasound.so.2`. Local Playwright uses the previously extracted libraries.

The next unit owns the legacy route wrappers under the client dashboard and admin Build/System/support/client detail groups, except Audit. It also owns the opt-in layout in `crm/src/components/layout/page-container.tsx`, the corresponding browser spec, and the design sequence notes. Existing redesign batches keep their headers. The public sign-in frame retains the typography exception in `DESIGN.md`.

The Settings follow-up passed all seven Chromium checks. The nine routes fit at 390px and 1280px. Synthetic staff can read Business settings with disabled inputs, cannot access team management, and sees the owner-only Branding message without the form. Reviewed the refreshed Branding, Alex, and dark Business captures, including keyboard focus on the time zone field. Branding and Alex screenshots in `docs/redesign/pr-8` reflect the resumed implementation.

The first remaining-page Chromium run passed the 12 route layouts at both sizes. Its backup UI check expected an empty history, but the fixture intentionally seeds a successful restore. The trace showed the recorded restore and the admin-only button. The corrected test checks the seeded restore result, focus, and VA permissions. Business settings now also exercise a real local form save and reload, then restore the fixture value.

The remaining-page unit adopts the redesigned header and content wrapper on 49 routes plus the dashboard loading state. Build/System cards and tables use the portal surfaces. Backup history keeps its scroll region keyboard-focusable and wraps long object keys. No form actions, authorization, loaders, or route behavior changed. The retained browser captures are in `docs/redesign/portal-pages`. Added the redesign sequence index and marked the older agency brief historical.

Local production build, TypeScript, lint (warnings, zero errors), formatting, and all 663 unit tests passed. All 10 design checks passed in Chromium, including 21 Settings and portal routes measured at 390px and 1280px, dark mode, a persisted Business-settings save and reload, error feedback, staff and VA access, and the backup history focus region. Visual review sampled the captured Settings, Leads, Support, Backups and Template library screens. The full integration retry and full browser suite are tracked separately.

The first full Chromium run had 129 passed, 6 skipped, and 2 failed. The Users page exceeded the 1280px viewport by 24px after other tests added synthetic invitations, and axe flagged dark-mode links on Sign in and Sign-in help at both widths. The follow-up scopes the Users table to its own labeled, scrollable card with wrappable identity cells. Public access links use the card foreground while retaining their destinations, form behavior, and the existing sign-in typography. This unit owns `admin/users/page.tsx`, `sign-in/help/page.tsx`, and `components/auth/sign-in-form.tsx`.

Both failed browser checks passed on targeted retry against the refreshed production build. The full integration retry passed 1,023 tests with 2 existing gated R2 skips. That full run used the `pg_restore` session diagnostic described above; the restore subprocess took 2.126 seconds. It used the unmodified integration sources and no provider credentials. This establishes functional coverage on disposable Postgres and leaves default-durability timing and GitHub CI unverified.
