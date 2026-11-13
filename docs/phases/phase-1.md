# Phase 1: Clean, switch and core CRM (about 5 days)

Goal: one current set of docs, Twenty no longer written to, and the core CRM complete enough that a client can manage their leads.

## Scope

**Clean and switch**
- Deploy `main` including the staff email login (live is behind `main`).
- Correct `docs/STATUS.md`, KI-013 and KI-017 with the dated anonymous probe: `/api/health` 200, `/admin` 401, `/dashboard` redirects to sign-in.
- Remove the 36 unused files and 11 unused dependencies that `knip` reports, in a separate commit (keep `scripts/emergency-reset-staff-totp.ts` and `src/server/worker.ts`).
- Merge or close the stale PRs (#113, #134, #136, #145, #151, #155) and archive the retired DEV scripts and `docs/codex/`. PR #136 holds the only copy of the live site's source: merge it or the site has no source on `main`. Closing or merging each PR needs Abdullah's say.
- Export the remaining Twenty records and the 5 attachments that the API did not export (needs SSH from a session that can reach the server).
- Point the website contact form at the portal's signed lead endpoint (a live n8n change).

**Core CRM gaps** (checked against `docs/PRD.md` F-05 to F-52 by reading code on 2026-11-12)
- Gap 1, F-12 (Must): custom field values can be entered and edited on the contact, company and deal record, for every client. Today they can be defined and filtered in the list, but `features/custom-fields/custom-fields-section.tsx` is unused, there is no input in the panel, and the list only shows them for clients on the retired CRM Full level.
- Gap 2, F-95 (Later in the spec, moved up): a client can import their own CSV or Excel lead list from the dashboard, with the same dry run, consent handling and audit as the staff import in `src/server/imports/`.

## Acceptance checks

| ID | Check | Proof |
|---|---|---|
| P1-1 | `docs/STATUS.md`, KI-013 and KI-017 match the live probe, with the date | diff plus a dated curl result in the report |
| P1-2 | `knip` reports no unused files or dependencies, apart from the kept entry points | `bunx knip` output in the report |
| P1-3 | Custom field values can be set, shown and filtered for a contact, a company and a deal, and tenant B never sees tenant A's definitions | new integration test plus browser test |
| P1-4 | Custom fields show for every client regardless of the old CRM level | new test |
| P1-5 | A client user can upload a CSV or Excel file, see a dry run, commit it, and sees only their own tenant's rows; duplicates and invalid phones are reported; opt-outs and consent follow the existing import rules | new integration and browser tests |
| P1-6 | A client cannot import into another tenant, and the action is in the audit log | new integration test |
| P1-7 | New pages pass the accessibility scan at 390 px and desktop | browser test |
| P1-8 | Twenty export is complete: attachments and records are in the archive location | listing of the files in the report |
| P1-9 | The contact form posts to the portal and a test lead appears in a demo tenant | evidence after the live yes |

## Needs a yes

Deploy; each server action; each PR merge or close; the contact form change in n8n; any Twenty read that needs credentials.

## Needs a decision

None. The consent rules for client import follow the existing staff import.

## Not in this phase

Send text or email from a contact (phase 3), calendar sync (phase 6), the archive viewer (phase 2).

## Steps

Work these in order. Tick each `- [ ]` as `- [x]` in the same commit that finishes the step. A new thread resumes at the first unticked step. For every step: finish it, test it, commit, push, then move on (see `PROTOCOL.md`). A STOP step waits for Abdullah's yes; do the steps after it that do not depend on it.

- [x] **P1-S1.** Probe the live site anonymously (`/api/health`, `/admin`, `/dashboard`) and correct `docs/STATUS.md`, KI-013 and KI-017 with the date.
  - Test: Curl output pasted in the report
  - Commit: "Correct STATUS and KI-013/KI-017 from the live probe"
  - Covers: P1-1
- [x] **P1-S2.** Remove the unused files and dependencies that `knip` reports (keep `scripts/emergency-reset-staff-totp.ts` and `src/server/worker.ts`).
  - Test: `bunx knip` clean; `bun run verify`
  - Commit: "Remove unused files and dependencies"
  - Covers: P1-2
- [x] **P1-S3.** Custom field values on contact, company and deal records: wire in `features/custom-fields/custom-fields-section.tsx`, add inputs and save.
  - Test: Integration test (set, show, filter, tenant isolation) and a browser test
  - Commit: "Edit custom field values on records"
  - Covers: P1-3
- [x] **P1-S4.** Show custom fields for every client, not only the retired CRM Full level (list gate in `app/dashboard/contacts/page.tsx`).
  - Test: Test for a client without the old level
  - Commit: "Show custom fields for all clients"
  - Covers: P1-4
- [x] **P1-S5.** Client CSV/Excel import: upload, dry run, commit, reusing `src/server/imports/` rules and audit.
  - Test: Integration test plus browser test
  - Commit: "Add client self-serve lead import"
  - Covers: P1-5
- [x] **P1-S6.** Tenant guard and audit for client import.
  - Test: Integration test: cross-tenant refused, audit row written
  - Commit: "Block cross-tenant import and audit it"
  - Covers: P1-6
- [x] **P1-S7.** Accessibility scan and 390 px check for the new pages.
  - Test: Browser test; `bun run verify:e2e`
  - Commit: "Add accessibility tests for new CRM pages"
  - Covers: P1-7
- [x] **P1-S8.** Open the PR, watch CI, fix what it finds, merge when green. Record in the build log.
  - Test: CI green
  - Commit: "Record phase 1 in the build log"
  - Covers: -
- [x] **P1-S9.** (Abdullah delegated the yes to the coordinator, 2026-11-13.) STOP for Abdullah's say on each: merge or close stale PRs #113, #134, #136, #145, #151, #155 (#136 holds the site source); archive retired DEV scripts and `docs/codex/`; deploy main.
  - Test: Evidence per action
  - Commit: "Archive retired DEV scripts and docs/codex"
  - Covers: -
- [ ] **P1-S10.** (Portal side and rollback backup done; the Twenty export and the live n8n switch wait for the Mac Codex prompt in /mnt/project-files/phase1/.) STOP for yes: export the remaining Twenty records and 5 attachments (needs SSH from a session that reaches the server); point the contact form at the portal lead endpoint (live n8n change).
  - Test: File listing; test lead in a demo tenant
  - Commit: "Add remaining Twenty export to the archive"
  - Covers: P1-8, P1-9
