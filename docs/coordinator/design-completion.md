# Portal design completion running log

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
