# Phase 7: Admin side cleanup (about 3 to 4 days)

Goal: the admin side opens on what needs attention, groups its pages by how often they are used, and has one client list with tabs on each client. No page changes what it does; only where it is reached from changes.

The full reasoning, page table and menu are in `docs/plans/ADMIN-CLEANUP.md`. Read it first. This file turns it into steps and checks.

Background: 45 admin pages, 13 sidebar entries plus 10 hidden inside the Agency workspace, three separate client lists (All clients, Client portals, the old View as client page), eleven text links on each client page, and two different pages called "Operations". The Agency group is hidden from VAs by `src/app/admin/layout.tsx`. `PROVIDER_MODE=stub` and `OUTBOUND_ENABLED=false` are unchanged and nothing in this phase touches them.

## Scope

- Regroup `adminNavGroups` in `crm/src/config/nav-config.ts` into six entries: Today, Sales, Clients, Money, Build, System.
- One client list at `/admin/clients` with status, health and an "Open as client" button; `/admin` becomes the Today page; old addresses redirect.
- A tab bar on each client page; Offboard in a clearly marked danger area, admin only.
- The Today page: needs-you-now, sales today (admin only), clients needing attention, support, daily summary.
- Tidy: rename the two "Operations" pages so they differ, move the Agency alerts block to Today, hide (do not delete) the DEV blocks on Agency operations.
- Docs: update `docs/STATUS.md`, `docs/progress.md`, and `docs/plans/ADMIN-CLEANUP.md` status.

Out of scope: any migration or schema change, any change to what a page does, deleting a page, client-side (`/dashboard`) pages, design restyling, any server change, any deploy.

## Acceptance checks

| ID | Check | Proof |
|---|---|---|
| P7-1 | The admin sidebar shows exactly Today, Sales, Clients, Money, Build, System for an admin. A VA is shown only entries whose pages the VA can open today, and never one the page refuses. No admin loses a page they could reach before | unit test of the nav filter for both roles, plus the role table in the PR |
| P7-2 | `/admin/clients` lists every non-offboarded client with status and health; "Open as client" works for ready and demo clients and keeps read-only, audit and VA-reason rules; `/admin/portals` and `/admin/view-as` redirect there | e2e (admin and VA), existing view-as tests still pass |
| P7-3 | Each client page has tabs; every old client subpage address still loads; Offboard is refused to a VA exactly as before | e2e, existing offboard tests unchanged |
| P7-4 | `/admin` shows the five Today blocks to an admin and blocks 1, 3 and 4 only to a VA; admin-only data is not in a VA's response; an empty block says "Nothing needs you" | integration test of the data function (role gate) plus e2e for both roles |
| P7-5 | No two admin menu entries share a title; the DEV blocks on Agency operations are hidden, their data and routes untouched | unit test on titles, e2e on the page |
| P7-6 | Every admin address that existed before this phase still resolves (a page or a redirect), none returns 404 | e2e or integration test with the list of old addresses |
| P7-7 | The new and changed pages pass the accessibility scan, are loaded in a browser at 390 px, and screenshots were reviewed | scan in `phase-4-a11y-all-routes` pattern, screenshots in the report |
| P7-8 | `bun run verify:e2e` prints AUTOMATED CHECKS PASSED and CI is green | verify table, CI link |

## Needs a yes

Merging is not deploying. The deploy, and anything on the server, waits for Abdullah's yes. Removing (not hiding) the DEV blocks needs a yes and is not part of this phase.

## Needs a decision

Defaults used unless Abdullah says otherwise: Sales and Money stay admin-only (the Agency group is hidden from VAs today); Support requests live under Clients with an open count on Today; the DEV blocks are hidden, not deleted.

## Steps

Work these in order. Tick each `- [ ]` as `- [x]` in the same commit that finishes the step. A new thread resumes at the first unticked step. For every step: finish it, test it, commit, push, then move on (see `PROTOCOL.md`). Use `bun run verify:quick` after each step and `bun run verify:e2e` before the PR.

- [ ] **P7-S1.** Role table, then the menu regroup. First read each admin page and its server function and write a table of who can open it (admin, VA or both) into the PR body and the appendix of `docs/plans/ADMIN-CLEANUP.md`. Then regroup `adminNavGroups` into the six entries and filter by role so a VA never sees an entry its page refuses. Keep every page address.
  - Test: unit test of the nav filter for admin and VA; existing `lane-a-a0` Backups link test still passes (keep System expanded or update the test with a reason)
  - Commit: "Regroup the admin menu"
  - Covers: P7-1
- [ ] **P7-S2.** One client list at `/admin/clients` (status, health, Onboard button, "Open as client" reusing the existing start form). `/admin` redirects there for now. `/admin/portals` and `/admin/view-as` redirect. Update the three e2e tests that open `/admin` and expect "All clients" to open `/admin/clients`.
  - Test: e2e for admin and VA; existing view-as and onboarding tests pass
  - Commit: "Add one client list"
  - Covers: P7-2
- [ ] **P7-S3.** Tab bar on each client page (Overview, Systems, Alex, Reports, Documents, Billing, Setup with Checklist, Import, Webhooks, Tokens and Presence, and Offboard in a danger area for admins). Subpages keep their addresses.
  - Test: e2e that every tab loads; existing offboard tests unchanged
  - Commit: "Add tabs to the client page"
  - Covers: P7-3
- [ ] **P7-S4.** The Today page at `/admin`, built from the existing alert, job, dialer, health and support queries, with the role gate on the server. Remove the `/admin` redirect from S2.
  - Test: integration test of the data function for admin and VA; e2e for both
  - Commit: "Add the admin Today page"
  - Covers: P7-4
- [ ] **P7-S5.** Tidy: rename the two Operations pages (Build: "Jobs and integrations"; Agency: "Sales settings" or similar), move the Agency alerts block to Today, hide the DEV blocks on Agency operations. Update any e2e heading checks that change.
  - Test: unit test on unique titles; e2e on the changed pages
  - Commit: "Tidy admin page names"
  - Covers: P7-5
- [ ] **P7-S6.** Old-address test, accessibility scan and 390 px screenshots of Today, the client list and a client page with tabs, then docs: `docs/STATUS.md`, `docs/progress.md` (dated entry), the status line in `docs/plans/ADMIN-CLEANUP.md`, `docs/known-issues.md` only if something new was found.
  - Test: old-address test, accessibility scan, `bun run verify:e2e`
  - Commit: "Check old admin addresses and update docs"
  - Covers: P7-6, P7-7, P7-8
