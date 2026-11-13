# Phase 2: Archive viewer (about 2 days)

Goal: staff can find any old Twenty note, task, attachment or exported record inside the portal.

## Scope

- A staff-only admin section `Archive` behind the same sign-in as `/admin`.
- One-time import of `docs/roadmap/` (120 notes, 63 tasks, from PR #162), the 5 attachments, and the exported Twenty records into agency-level tables that no client can read (no client id, staff-only row-level security), with a migration.
- Pages: notes (search by title and text, filter by date and tag), tasks (status, due date, mapped step), attachments (download through the existing signed download path), and read-only tables for the exported records.
- Read-only. No edit, no delete, nothing written back to Twenty.

## Acceptance checks

| ID | Check | Proof |
|---|---|---|
| P2-1 | Import is repeatable: running it twice leaves the same row counts | integration test |
| P2-2 | A client user, and an anonymous request, cannot read any archive row or file | integration and browser tests |
| P2-3 | Search returns a known note by a phrase from its body | integration test |
| P2-4 | An attachment downloads through a signed link that expires | integration test |
| P2-5 | The migration enables forced row-level security on every new table | existing isolation test, extended for staff-only tables |
| P2-6 | Pages pass the accessibility scan and work at 390 px | browser test |

## Needs a yes

Deploy; applying the migration and running the import on the server.

## Needs a decision

None.

## Steps

Work these in order. Tick each `- [ ]` as `- [x]` in the same commit that finishes the step. A new thread resumes at the first unticked step. For every step: finish it, test it, commit, push, then move on (see `PROTOCOL.md`). A STOP step waits for Abdullah's yes; do the steps after it that do not depend on it.

- [x] **P2-S1.** Migration: agency-level archive tables (notes, tasks, attachments, records), no client id, staff-only, forced row-level security.
  - Test: Extended isolation test
  - Commit: "Add staff-only archive tables"
  - Covers: P2-5
- [x] **P2-S2.** Import script for `docs/roadmap/`, attachments and exported records; repeatable.
  - Test: Integration test: run twice, same row counts
  - Commit: "Add repeatable archive import"
  - Covers: P2-1
- [x] **P2-S3.** Server queries and search by title and text, with date, tag and status filters.
  - Test: Integration test finds a known note by a phrase from its body
  - Commit: "Add archive search queries"
  - Covers: P2-3
- [x] **P2-S4.** Admin pages: Notes, Tasks, Attachments, Records (read-only).
  - Test: Browser test loads each page
  - Commit: "Add archive pages to admin"
  - Covers: -
- [ ] **P2-S5.** Attachment download through the signed link that expires.
  - Test: Integration test: link works, then expires
  - Commit: "Add expiring attachment downloads"
  - Covers: P2-4
- [ ] **P2-S6.** Block clients and anonymous requests from every archive row and file.
  - Test: Integration and browser tests
  - Commit: "Test archive access is staff-only"
  - Covers: P2-2
- [ ] **P2-S7.** Accessibility scan and 390 px check; open PR; record in the build log.
  - Test: `bun run verify:e2e`; CI green
  - Commit: "Record phase 2 in the build log"
  - Covers: P2-6
- [ ] **P2-S8.** STOP for yes: deploy, apply the migration and run the import on the server.
  - Test: Row counts on the server
  - Commit: (none)
  - Covers: -
