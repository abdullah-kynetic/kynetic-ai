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
