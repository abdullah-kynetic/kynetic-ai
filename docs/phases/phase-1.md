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
