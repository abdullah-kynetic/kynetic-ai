# Testing

Kynetic Client CRM & Portal. Target path in the build repo: `docs/TESTING.md`.

Source order: `DECISIONS_locked.md` (Oct 25, 2026) wins over `SPEC_client_crm_portal.md`. `PRD.md` supplies the F-IDs (F-01 to F-106) and the milestone and module tags. Anything in none of these is marked `Decided 2026-10-25 (recommended option: ...)` or, if it needs outside information, `UNRESOLVED`. Commands not verified in a running repo are marked `Not configured`.

Status of this document: draft. The M0 gate (M0-28, 2026-10-26) ran the M0 suites on branch `m0/gate`: 105 unit, 244 integration, 15 Playwright E2E, `bun run check` and `bun run build` all pass. M1-09 was completed on 2026-10-28 on the current work branch: focused M1 integration suites, build checks and 20 Playwright E2E tests pass. Not exercised anywhere yet: live Google sign-in, real email delivery, and `docker compose up`.

---

## Goals and scope

What must work before the first founding client goes live (PRD success measures, spec v1 success):

- **Tenant isolation (F-72, F-12, F-15, F-37).** A user of tenant A cannot read or write tenant B through the API, the UI or direct SQL as the app role. Release-blocking. Target: 0 cross-tenant reads or writes, 100% pass.
- **Module gating (F-70 and every upsell feature F-79 to F-85).** With a module off, the server refuses its routes and actions (403), its jobs no-op, its UI is absent, and its data is kept. Release-blocking. Target: 0 successful calls to a disabled module's routes, tested per module.
- **Webhook idempotency (F-77, F-76, F-89).** A replayed event produces one effect. Target: replay of the same event 10 times produces 1 effect.
- **Consent and STOP (F-74, F-32, F-81, F-82).** No call or SMS without a consent basis. STOP revokes consent and stops sequences. Quiet hours are honored.
- **Dashboard and report accuracy (F-01, F-02, F-03, F-49).** Numbers equal seeded fixture expectations exactly.
- **Onboarding (F-55).** Under 30 seconds from submit to a working tenant, with no partial tenant on failure.
- **Onboarding import (F-90 to F-94, F-96).** 1,000 rows with column mapping import successfully; a dry run writes nothing; undo removes a whole batch; imports start no outreach; admin-only; tenant-scoped.
- **Backups (F-63).** Nightly job succeeds and the monthly restore drill passes before the pilot.
- **Security (F-71, F-73, F-87).** Google sign-in, role checks on every action, provider keys never sent to the browser, rate limits on login, webhooks and API.
- **Mobile (F-44).** No horizontal scroll at 390px, touch targets 44px minimum on daily-use pages.

Out of v1 test scope (Later or Skip in the PRD; tests exist only to prove absence for Skip items):

- Later, not tested in v1: F-04, F-09, F-11, F-18, F-21, F-23, F-25, F-29, F-40, F-45, F-46, F-47, F-48, F-50, F-51, F-56, F-59, F-64 to F-69, F-95, F-97.
- Skip, absence check only: F-13 (no conditional or computed fields), F-34 (no workflow builder), F-52 (no starter chat or AI demo routes).

Performance and accessibility targets are PRD decisions, not sourced numbers. Approved by Abdullah on 2026-10-25 (PRD decision 13):

- Accessibility: WCAG 2.2 AA on every page (`Decided 2026-10-25 (recommended option approved: WCAG 2.2 AA)`).
- Mobile LCP: at or under 2.5 s at the 75th percentile on seeded data (`Decided 2026-10-25 (recommended option approved)`).
- API list reads: p95 under 500 ms with 10,000 contacts (`Decided 2026-10-25 (recommended option approved)`).
- Global search: p95 under 500 ms (F-37, `Decided 2026-10-25 (recommended option approved)`).

---

## Test layers

- **Unit:** business rules and validation with no database or network.
  - Health score formula and thresholds (F-54). Weights are equal 20% each (PRD decision 10).
  - Money stored as `value_cents` (F-14: $12,500 stores as 1250000).
  - Lost stage requires a lost reason (F-14).
  - Phone normalization for duplicate detection (F-07). The normalization rule is `Decided 2026-10-25 (recommended option approved: E.164)`.
  - HTML sanitization of note bodies (F-22).
  - Consent state machine: none, granted, revoked (F-74).
  - Module-flag guard logic (F-70), including the followup_bundle expansion (F-84).
  - Webhook signature verification (F-76, F-77).
  - Health chip color thresholds (F-54).
- **Integration:** API, database and service boundaries against a real Postgres 16 with the app non-owner role. Providers are fakes (see Fixtures).
  - RLS on every tenant table (F-72). Run as the app role, never the owner.
  - Route and server-action guards for roles (F-73) and modules (F-70).
  - Webhook pipeline: store in `webhook_events`, unique on (source, external_id), job queue, retry (F-77).
  - Lead webhook to contact, deal and Alex trigger (F-76).
  - Booking API against business hours (F-78).
  - Audit log helper and append-only enforcement (F-60).
  - Migrations applied to an empty database and to a seeded database.
  - Automations and sequences run through the job queue against fake providers (F-31 to F-33, F-79 to F-82).
- **End-to-end:** browser tests (Playwright) of the eight PRD user journeys.
  - Journey 1: lead to booked estimate (fake Alex call).
  - Journey 2: owner checks results and flags a call.
  - Journey 3: staff works the pipeline, including failed-drag rollback.
  - Journey 4: onboarding in under 30 seconds (F-55).
  - Journey 5: view-as with banner and refused write.
  - Journey 6: module toggle on and off, with UI and API both checked.
  - Journey 7: STOP reply (fake Twilio inbound).
  - Journey 8: monthly ROI report generated and emailed (fake Resend).
  - Plus the milestone acceptance tests in the matrix.
- **Manual:** cases automation does not cover.
  - Visual review at 390px and desktop, light and dark theme.
  - Screen reader pass on the contact page, kanban and call detail (WCAG 2.2 AA recommended option).
  - Keyboard-only pass on the kanban and the bell popover.
  - Monthly backup restore drill (F-63, M10). Run by hand; see Fixtures and environments.
  - Live provider test calls and SMS, only to numbers Abdullah owns and only after his yes on each live action. Blocked for SMS until the Twilio A2P campaign is approved (project memory, Oct 22, 2026: sends fail with error 30034).

Rule for every layer: a test must never send a real SMS, email or call to a real number. Use the fakes in Fixtures.

---

## Acceptance test matrix

Format: each row is one test. The first column carries the F-ID, milestone and module from the PRD. Milestones are the spec's M0 to M10. Module keys are exactly: `platform`, `alex_core`, `quote_followup`, `after_hours`, `missed_call_textback`, `reactivation`, `opm`, `followup_bundle`, `crm` (lite or full).

Test names in code must cite the F-ID (for example `F-72: tenant A cannot read tenant B contacts via API`).

### Milestone acceptance tests (spec section 10)

| Feature/risk | Scenario | Expected result | Layer | Status |
| --- | --- | --- | --- | --- |
| F-72 (M0, platform) | Tenant A user reads tenant B contact by ID through the API | 404 or empty result; no tenant B data in any response | Integration | Not run |
| F-72 (M0, platform) | Same read run as the app role in SQL with `app.tenant_id` set to tenant A | Zero rows for tenant B | Integration | Pass (2026-10-26, m0/gate) |
| F-71 (M0, platform) | Login with Google as a user with a membership | Lands in own tenant | E2E | Not run |
| F-71 (M0, platform) | Login with Google as a user with no membership | Access refused; no session with tenant | Integration | Pass (2026-10-26, m0/gate) |
| F-71 (M0, platform) | Static search for Clerk imports, packages and env vars | None remain | Unit (static) | Not run |
| F-74 (M0 consent service; M4 enforces, platform) | `canContact` with no consent row, then with a revoked consent | Returns false both times; `recordConsent` and `revokeConsent` write rows | Unit | Pass (2026-10-26, m0/gate) |
| notify() (M0, platform) | `notify` writes a `notifications` row for the target user only | Other users cannot read it | Integration | Pass (2026-10-26, m0/gate) |
| F-20 and F-22 notification path (M0 `notify`, M3, crm) | Overdue task and @mention each notify the right user | One row per recipient; delivered through `notify` | Integration | M3-04 overdue-task path passes (2026-10-28, `tests/integration/task-due.test.ts`); @mention passes (2026-10-26, M3-03) |
| M0 CI and preview (platform) | Preview deploys from CI; shell and empty states render with no seed data and no console errors | Preview URL serves the shell | E2E | Not run |
| F-07 (M1, crm) | Create a contact with a phone already on contact P | Duplicate warning shows and offers merge | E2E | Pass (2026-10-28): signed-in owner fixture and merge journey in `tests/e2e/merge.spec.ts`; duplicate detection and panel behavior remain covered by `tests/integration/contacts.test.ts` |
| F-07 (M1, crm) | Merge two contacts | Deals, notes and activities move to the survivor; loser soft-removed; audit row written | Integration | Pass (2026-10-28, M1-08, `tests/integration/contacts.test.ts`) |
| F-12 (M1, crm) | Custom field "Roof type" select: filter, table and CSV import | Value shows in table, filters, and CSV import accepts it | E2E | Partly run (2026-10-28): signed-in settings screen and seeded field render in `tests/e2e/m1.spec.ts`; field validation/filter coverage passes in `tests/integration/custom-fields.test.ts`; CSV import remains M9 |
| F-08 (M1, crm) | Assign owner to 20 selected contacts | All 20 updated in one audited operation | Integration | Pass (2026-10-26, M1-07, `contacts-bulk.test.ts`) |
| F-14 (M2, crm) | Save a deal in Lost without a lost reason | Save refused, message names the field | Integration | Pass (2026-10-26, M2-01) |
| F-16 (M2, crm) | Drag a card from Contacted to Qualified, then reload | Card stays in Qualified; column totals updated | E2E | Not run (no signed-in E2E fixture yet). Move, order, totals and `deal.stage_changed` covered by integration (`pipeline-board.test.ts`, M2-02) and unit (`pipeline-board-state.test.ts`) tests, which Pass 2026-10-26 |
| F-12 (M1, crm) | Each type (text, number, money, date, select, multi-select, checkbox) given a valid and an invalid value; unknown key | Valid saved, invalid and unknown refused | Unit, Integration | Run (`tests/unit/custom-fields.test.ts`, `tests/integration/custom-fields.test.ts`) |
| F-85 (M1, crm) | Lite tenant calls any custom field function or saves a custom value | 403 MODULE_DISABLED, nothing written | Integration | Run |
| F-16 (M2, crm) | Server rejects a drag | Card rolls back; error toast | E2E | Not run |
| F-16 (M2, crm) | Undo within toast window after a drag | Previous stage restored | E2E | Not run |
| F-19 (M3, crm) | Any write to a covered entity | `activities` row created and shown on timeline; actor shown | Integration | Pass |
| F-20 (M3, crm) | Task past due and incomplete | Under Overdue; assignee gets notification | Integration | Pass (2026-10-28): grouping, completion undo, tenant-day grouping, module gating and isolation in `tasks.test.ts`; delayed job and idempotent notification in `task-due.test.ts` |
| F-76 (M4, alex_core) | Duplicate lead webhook (same source and external id) | Second call is a no-op; one contact, one deal | Integration | Pass (2026-10-26, M4-04; replayed 10 times) |
| F-74 (M4, alex_core) | STOP inbound SMS (fake Twilio) | Consent revoked; confirmation on timeline; no further SMS or calls | Integration | Passing (M4-08, tests/integration/twilio-sms.test.ts) |
| F-77 (M4, platform) | Same Retell or ElevenLabs call-ended event (same source and external id) replayed 10 times | One effect (one call row, one timeline entry) | Integration | Pass (`call-end.test.ts`) |
| F-77 (M4, platform) | Same external id arriving from a different source | Not a duplicate; processed as its own event (uniqueness is on source and external id) | Integration | Pass (`call-end.test.ts`) |
| F-26 (M4, alex_core) | Fake call-ended webhook with outcome "booked" | Test call lands on timeline; green Booked chip | E2E | Not run |
| F-78 (M5, alex_core) | Booking request inside business hours | Appointment created, status scheduled | Integration | Not run |
| F-78 (M5, alex_core) | Booking request outside business hours | API refuses; Alex offers another time | Integration | Not run |
| F-01 (M6, alex_core) | Dashboard on seeded fixture | Each card equals fixture expected value exactly | E2E | Not run |
| F-02 (M6, alex_core) | Line and bar charts on two-month fixture | Totals equal fixture totals | Integration | Not run |
| F-49 (M6, alex_core) | Monthly ROI report, full month of fixture data | Report totals equal dashboard totals for the same range | Integration | Not run |
| F-32 (M7, per template) | Sequence in progress; contact replies | Remaining steps cancel; run status "stopped_reply" | Integration | Pass (2026-10-28, `tests/integration/automation-retries-m7.test.ts`; tenant A reply stops only A's run, tenant B remains active) |
| F-32 (M7, per template) | Module disabled; active run delivers | Run stops before provider call | Integration | Pass (2026-10-28, `tests/integration/automation-retries-m7.test.ts`; synthetic PostgreSQL and fake SMS) |
| F-32 (M7, per template) | Transient provider error followed by queue redelivery | Run remains active, then completes once | Integration | Pass (2026-10-28, `tests/integration/automation-retries-m7.test.ts`; synthetic PostgreSQL and fake SMS) |
| F-32 (M7, per template) | Quiet-hour block and early duplicate delivery | Run due time advances; early delivery sends nothing | Integration | Pass (2026-10-28, `tests/integration/automation-retries-m7.test.ts`; synthetic PostgreSQL and fake SMS) |
| F-33 (M7, platform) | Deal marked Won; event delivered twice | One owner notification and one fake email despite retry | Integration | Pass (2026-10-28, `tests/integration/m7-module-acceptance.test.ts`) |
| F-55 (M8, platform) | Complete onboarding form | Tenant, invite, pipeline, automations, Alex draft exist within 30 s; audited | E2E | Partly run: integration covers tenant, invite, modules, pipeline, Alex draft and audit in under 30 s; the page is not exercised in a browser (no sign-in fixture). Default automations are M7 |
| F-57 (M8, platform) | View-as started by admin | Banner shown; writes refused; `audit_log` has impersonator and tenant | E2E | Not run (no signed-in fixture). Audit rows with impersonator and tenant, and refused writes, pass as integration in `tests/integration/view-as.test.ts` (M8a-04) |
| F-90 (M9, platform) | Admin uploads CSV with unusual headers, maps columns, previews and commits | Preview is shown before commit; saved mapping pre-fills the next file from that source | E2E | Pass for upload/mapping/preview/commit UI interaction (2026-10-28, `tests/e2e/m9-import.spec.ts`; API responses are synthetic route fixtures); saved mapping persistence remains unimplemented |
| F-90 (M9, platform) | Oversize, binary, malformed and over-limit CSV | Refused before storage write | Integration | Pass (2026-10-28, `tests/integration/import-workflow-m9.test.ts`; XLSX remains refused pending safe archive inspection) |
| F-90 (M9, platform) | XLSX/XLSM intake while archive inspection is unavailable | Refused with `xlsx_not_available` before private storage write | Integration | Pass (2026-10-28, `tests/integration/import-workflow-m9.test.ts`; synthetic ZIP signatures and no storage objects created) |
| F-91 (M9, platform) | 1,000-row file with 50 bad rows and 30 duplicates, dry run | Report shows 50 failed with reasons, 30 duplicates; zero rows written | Integration | Not run |
| F-91 (M9, platform) | Same number in two phone formats | Treated as a duplicate (E.164) | Integration | Pass (2026-10-28, `tests/integration/import-workflow-m9.test.ts`) |
| F-91 (M9, platform) | Commit without a successful dry run for the same file and mapping | Refused | Integration | Pass (2026-10-28, `tests/integration/import-workflow-m9.test.ts`) |
| F-92 (M9, platform) | Commit a batch | Every record has `import_batch_id`, `imported_source`, `external_id`; visible only to that tenant | Integration | Contact-only pass: `tests/integration/import-workflow-m9.test.ts`; company/deal/note imports and 500-row scale not run |
| F-92 (M9, platform) | Deal row with an open quote | Deal in the mapped stage; value stored in cents | Integration | Not run |
| F-92 (M9, platform) | Worker interruption injected after one company row | Batch `failed`; completed record listed and undoable | Integration | Pass (2026-10-28, `tests/integration/import-workflow-m9.test.ts`; injected interruption produces failed batch, ledger row and successful undo) |
| F-92 (M9, platform) | Import companies, deals/open quotes and linked notes | All carry source, batch and external ID; no outreach; batch undo removes each | Integration | Pass for synthetic company/deal/note commit metadata, linked note parent, and undo (2026-10-28, `tests/integration/import-workflow-m9.test.ts`); infrastructure failure after partial writes remains unverified |
| F-93 (M9, platform) | Undo a committed batch | Records gone from lists and search; history shows undone with who and when; audited | E2E | Not run |
| F-93 (M9, platform) | Undo when one record was edited after import | Record listed and not removed | Integration | Pass (2026-10-28, `tests/integration/import-workflow-m9.test.ts`; edited synthetic contact is returned in `skipped` and stays active) |
| F-94 (M9, platform) | Admin imports on tenant A's page | All records in tenant A; `audit_log` has the admin as actor | Integration | Service-level pass for tenant A writes/admin audit actor: `tests/integration/import-workflow-m9.test.ts`; HTTP role matrix not run |
| F-94 (M9, platform) | VA and client owner call the import endpoints | 403 | Integration | Not run |
| F-94 (M9, platform) | Import file used with another tenant's id in the request | Refused; nothing written to either tenant | Integration | Not run |
| F-96 (M9, platform) | Commit 500 contacts | No call or SMS started; no `lead.created`; no sequence enrolled | Integration | Not run |
| F-96 (M9 and M7, platform) | Reactivation includes imported contacts without consent evidence | Blocked and logged by `canContact` | Integration | Not run |
| F-96 (M9, platform) | Import with mapped consent date and source | Consent record with source `import` exists | Integration | Not run |
| F-96 (M9 and M4, platform) | Imported contact in quiet hours with consent | Send deferred | Integration | Not run |
| F-38 (M9, crm) | Export a view containing a cell starting with `=` | Cell neutralized | Unit | Pass: `tests/unit/export-csv.test.ts`; tenant filters, audit and permission tests pass in `tests/integration/export-m9.test.ts` |
| F-39 (M9, platform) | Set logo, color and name for tenant | Visible on every page for that tenant; other tenant unaffected | E2E | Partial: integration (save, audit, other tenant untouched, bad file, low contrast, owner only) and unit (color table, logo rules) pass (2026-10-26, m9-08); E2E Not run |
| F-63 (M10, platform) | Monthly restore drill | Drill passes (see Release criteria); result and date shown on backups page | Manual | Local disposable PostgreSQL encrypted dump/restore, contact RLS check and scratch cleanup pass (`tests/integration/backups-m8b.test.ts`, 2026-10-28); production-like host drill not run |
| F-88 (M10, platform) | Fresh production database and demo tenant | Production holds only the pilot tenant's real data; demo tenant is synthetic only; no migration script exists | Integration | Not run |

### Features: client side (F-01 to F-52)

| Feature/risk | Scenario | Expected result | Layer | Status |
| --- | --- | --- | --- | --- |
| F-01 (M6, alex_core) | Owner picks date range on seeded tenant | Every card shows value, baseline and trend; values equal fixture | E2E | Not run |
| F-01 (M6, alex_core) | Tenant with no data | Cards show zero and empty-state next action | E2E | Not run |
| F-02 (M6, alex_core) | Range change over two months | Chart points and bars match fixture totals | Integration | Not run |
| F-02 (M6, alex_core) | Activity created | Appears in feed within one refresh | E2E | Not run |
| F-03 (M6, alex_core) | Target N bookings, start date set | Progress shows booked/N and days remaining | Unit | Not run |
| F-03 (M6, alex_core) | No target set | Tracker hidden; admin sees prompt to set one | E2E | Not run |
| F-05 (M1, crm) | 1,000 contacts; filter by status and source | Only matches show; pasted URL reproduces view | E2E | Partly run (2026-10-26, M1-02): integration covers the filters (`tests/integration/contacts-list.test.ts`), unit covers URL parsing (`tests/unit/contacts-list-params.test.ts`), and a hand-run Playwright check against a seeded session confirmed filters, search, sort, hidden columns and paging survive reload and a pasted URL, with cards and no horizontal scroll at 390px. The automated E2E needs the signed-in fixture, not built yet |
| F-05 (M1, platform) | 10,000 contacts; every list shape the page issues | p95 under 500 ms | Integration | Pass (2026-10-26, M1-02): p95 66 ms locally |
| F-05 (M1, crm) | Staff user lists contacts | Only own tenant's rows | Integration | Pass (2026-10-26, M1-01) |
| F-06 (M1, crm) | Contact with a deal, a call and a note | All sections render; consent status matches latest `consents` row | E2E | Not run |
| F-07 (M1, crm) | Two contacts share an email | Duplicate detection on email as well as phone | Integration | Pass (2026-10-26, M1-01) |
| F-08 (M1, crm) | Staff without bulk-delete permission | Delete hidden in UI; server refuses | Integration | Pass (2026-10-26, M1-07; server refusal tested, UI hiding by `bulkCapabilities`) |
| F-10 (M1, crm) | Company with 3 contacts and 2 deals | Roll-ups and totals correct | Integration | Pass (M1-05, `crm/tests/integration/companies.test.ts`) |
| F-12 (M1, crm) | Tenant B reads tenant A field definitions | Zero rows (API and SQL) | Integration | Run (`custom-fields.test.ts`) |
| F-14 (M2, crm) | $12,500 value entered | `value_cents` = 1250000; displays as $12,500 | Unit | Pass (2026-10-26, M2-01) |
| F-15 (M2, crm) | Add spouse to deal with role | Role on deal and deal on contact page; cross-tenant link refused | Integration | Pass (`deal-contacts.test.ts`; lite and no-crm tenants get 403) |
| F-16 (M2, crm) | Server rejects a drag; undo within toast | Rollback and error toast; undo restores previous stage | E2E | Not run |
| F-17 (M2, crm) | New tenant | Eight default stages exist | Integration | Pass (2026-10-26, M2-01) |
| F-17 (M2, crm) | Delete stage that has deals | Owner must pick target stage; Won and Lost flagged | Integration | Pass (2026-10-26, M2-05) |
| F-22 (M3, crm) | Note mentions a teammate; note pinned | Teammate notified; pinned note sorts first | Integration | Pass (2026-10-26, M3-03) |
| F-22 (M3, crm) | Note body with a script tag | Sanitized on save | Unit | Pass (2026-10-26, M3-03) |
| F-17, F-43 (M2, crm) | Rename, reorder, add a stage; tenant without `crm` Lite; staff; other tenant | Deals keep their stage; MODULE_DISABLED writes nothing; staff FORBIDDEN; cross-tenant 404; all changes audited | Integration | Pass (2026-10-26, M2-05) |
| F-24 (M5, alex_core) | Alex booking inside hours | Appears on the right day, status scheduled | Integration | Not run |
| F-24 (M5, alex_core) | Staff reschedules; staff enters time outside hours | Timeline records reschedule; UI warns on out-of-hours time | E2E | Not run |
| F-26 (M4, alex_core) | Call with outcome "booked" | Green Booked chip; contact link; outcome and date filters work | E2E | Not run (filters, tenant-timezone dates, paging and isolation covered by `calls-list.test.ts`; chip tones by `calls-list-format.test.ts`) |
| F-26 (M4, alex_core) | List 10,000 calls with and without filters | p95 under 500 ms | Integration | Pass (`calls-list.test.ts`) |
| F-27 (M4, alex_core) | Open call with recording and transcript | Player, transcript, summary and fields render | E2E | Not run |
| F-27 (M4, alex_core) | Mint a recording URL as the owner, as another tenant's owner, and as a user with no membership | Signed 5-minute URL; 404; 403; object key never returned | Integration | Pass (`call-end.test.ts`) |
| F-27 (M4, alex_core) | Recording URL after expiry | Expired signed URL refused | Integration | Adapter part written, passing locally (M4-03, `tests/unit/storage/r2.test.ts`: 5-minute expiry, wrong tenant 404, SigV4 vector); real route test waits for M4-11 |
| F-27 (M4, alex_core) | Staff without call access requests call | Refused server-side | Integration | Not run |
| F-30 (M4, platform) | Resend bounced, complained and delivered events (fake and signed fixtures) | Message status updates; bounce suppresses the address; complaint also opts the contact out of email; integration health shows `email` degraded | Integration | Pass (M4-09: `tests/integration/resend-events.test.ts`, `tests/unit/adapters/resend.test.ts`) |
| F-30 (M4, platform) | Twilio delivered callback for automation SMS (fake) | Log and timeline status update | Integration | Passing (M4-08, tests/integration/twilio-sms.test.ts) |
| F-30 (M4, platform) | Failed SMS callback (fake) | Error text shows; counted in integration health | Integration | Passing (M4-08, tests/integration/twilio-sms.test.ts) |
| F-28 (M4, alex_core) | Owner flags a call with reason | `calls.flagged` true; review item exists; audit row written | Integration | Covered: crm/tests/integration/call-detail.test.ts |
| F-30 (M4, platform) | Messages log lists both channels, filters, pages, isolates tenants, refuses with no messaging module | Newest first; error text on failed rows; other tenant invisible; `MODULE_DISABLED` | Integration | Passing (M4-12, tests/integration/message-log.test.ts) |
| F-31 (M7, per template) | `quote_followup` module off | Template hidden; API refuses enablement | Integration | Pass (2026-10-28, `tests/integration/m7-module-acceptance.test.ts`) |
| F-31 (M7, per template) | Module on; deal enters Quoted | Step 1 scheduled; disabling stops active runs | Integration | Pass (2026-10-28, `tests/integration/m7-module-acceptance.test.ts`) |
| F-35 (M7, platform) | New lead | Bell count +1; email sent per preference; open marks read | E2E | Integration pass (2026-10-26, M7-04); signed-in E2E Not run (no sign-in fixture) |
| F-35 (M7, platform) | User A requests notifications of user B | Refused | Integration | Pass (2026-10-26, M7-04) |
| F-37 (M9, crm) | Phone fragment on 10,000-contact seeded tenant | Matching contact returned; p95 under 500 ms (decided, recommended option) | Integration | Pass: `tests/integration/search-m9.test.ts` (10,000 synthetic contacts; 20 searches; tenant-scoped) |
| F-37 (M9, crm) | Tenant A searches for tenant B's record | Zero results | Integration | Pass: `tests/integration/search-m9.test.ts` (10,000 synthetic contacts; rerun 2026-10-28) |
| F-37 (M9, crm) | Cmd+K phone-fragment search | Matching contact appears and opens | E2E | Prior local run passed; rerun 2026-10-28 blocked because Playwright's test PostgreSQL endpoint at 127.0.0.1:5432 was unavailable |
| F-38 (M9, crm) | Filtered CSV export | Download honors filters and is audited | E2E | Prior local run passed; rerun 2026-10-28 blocked because Playwright's test PostgreSQL endpoint at 127.0.0.1:5432 was unavailable |
| F-38 (M9, crm) | Staff without export permission | Export hidden; server refuses | Integration | Pass: `tests/integration/export-m9.test.ts` (owner permission and CRM Full gating; staff denied); Playwright visibility not run |
| F-41 (M9, platform) | Staff opens team settings | Refused (403) | Integration | Pass (M9-09, `business-settings.test.ts`) |
| F-42 (M9, alex_core) | Owner pauses Alex | No outbound calls start for tenant; dashboard shows "Paused"; raw prompt absent from every response | Integration | Not run |
| F-43 (M9, crm) | Create tag, apply it, filter by it | Works end to end | E2E | Create, apply, count, rename, merge, delete: integration pass (2026-10-26, M9-11); signed-in E2E and contact-list filter by tag Not run (list filter is M1-02) |
| F-43 (M9, crm) | Tag settings as staff; tenant without `crm`; duplicate tag name | FORBIDDEN; MODULE_DISABLED; duplicate refused ignoring case | Integration | Pass (2026-10-26, M9-11) |
| F-36 (M9, platform) | Turn email off for one type, then raise that type; other users and other types | No email for that user and type; the bell still lists it; others unaffected; owner-wide notices skip only opted-out owners | Integration | Pass (2026-10-26, M9-11) |
| F-44 (M9, platform) | 390px viewport on daily-use pages | No horizontal scroll; touch targets at least 44px; tap-to-call uses `tel:` link | E2E and Manual | Pass for no horizontal overflow and ≥44×44px controls across dashboard, contacts, appointments, tasks and documents, plus contact phone `tel:` link dimensions/URI (`tests/e2e/m9-search-export.spec.ts`, 2026-10-28); no visual device review |
| F-49 (M6, alex_core) | Report delivery fails (fake Resend) | Retry runs; failure shown in integration health | Integration | Not run |
| F-13 (Skip) | Look for conditional or computed field code and routes | None exist | Unit (static) | Not run |
| F-34 (Skip) | Look for a visual workflow builder route | None exists | E2E | Not run |
| F-52 (Skip, M0 removal) | Request starter chat and AI demo routes | Routes absent (404) | Integration | Not run |

### Features: admin side (F-53 to F-69)

| Feature/risk | Scenario | Expected result | Layer | Status |
| --- | --- | --- | --- | --- |
| F-53 (M8, platform) | Three tenants in All clients | Table correct, sorts work; client owner gets 403 | Integration | Not run |
| F-54 (M8, platform) | Fixture inputs | Score equals documented formula; chip matches thresholds | Unit | Not run |
| F-54 (M8, platform) | Thresholds not set | Default values apply and are shown in admin | E2E | Not run |
| F-55 (M8, platform) | Failure injected midway through onboarding | Nothing partially created | Integration | Pass (`tests/integration/admin-onboarding.test.ts`) |
| F-55 (M8, platform) | Duplicate slug or owner email | Rejected with clear message | Integration | Pass (`tests/integration/admin-onboarding.test.ts`) |
| F-57 (M8, platform) | Admin starts view-as, tries a write | Write refused unless explicitly escalated; banner visible | E2E | Not run |
| F-57 (M8, platform) | VA tries a write while impersonating | Refused and logged | Integration | Pass (`tests/integration/view-as.test.ts`, M8a-04) |
| F-58 (M8, alex_core) | Change Alex config | Saved; audited with before and after; VA cannot change prompts | Integration | Not run |
| F-58 (M8, alex_core) | Test call button with entered number | Starts a call to that number only (fake provider in CI) | Integration | Not run |
| F-60 (M0, platform) | Write, login, export, impersonation | One `audit_log` row each | Integration | Not run |
| F-60 (M0, platform) | UPDATE or DELETE on `audit_log` | Database refuses | Integration | Not run |
| F-61 (M8, platform) | Deactivate a user with an open session | Cannot sign in; session ends | Integration | Pass (2026-10-26, M8a-03; `tests/integration/admin-users.test.ts`) |
| F-61 (M8, platform) | VA tries to manage an admin | Refused | Integration | Pass (2026-10-26, M8a-03; `tests/integration/admin-users.test.ts`) |
| F-60 (M8a, platform) | Admin filters the viewer by tenant, user, action and date range | Only matching rows return; the end day is included | Integration | Passing (`crm/tests/integration/audit-viewer.test.ts`) |
| F-60 (M8a, platform) | VA reads the viewer; a client role calls it | VA reads; client refused by the app and by `audit_search` (42501); web role cannot select `audit_log` | Integration | Passing (`crm/tests/integration/audit-viewer.test.ts`) |
| F-60 (M8a, platform) | Filter input is not a UUID or a date | Rejected before any query | Unit | Passing (`crm/tests/unit/admin/audit-viewer.test.ts`) |
| F-62 (M8, platform) | Webhook failing | Error count rises; integration red; recovery returns to green | Integration | Not run |
| F-63 (M8b, platform) | Encrypted backup restore test | Real `pg_dump`, AES-256-GCM, storage readback, scratch `pg_restore`, schema and contact-level tenant RLS checks, and scratch cleanup | Integration | Pass (2026-10-28, `tests/integration/backups-m8b.test.ts`; disposable PostgreSQL 17 and fake storage) |
| F-63 (M8b, platform) | Retention prune | 30 daily and 12 monthly objects remain | Integration | Pass (2026-10-28, `tests/integration/backups-m8b.test.ts`; fake storage) |
| F-63 (M8b, platform) | Manual backup request | Admin request is audited and queued; VA request refused | Integration | Pass (2026-10-28, `tests/integration/backups-m8b.test.ts`; disposable PostgreSQL and pg-boss) |
| F-63 (M8b, platform) | Admin backup list | Admin and VA read through `admin_list_backup_runs()`; client DB role refused by the function | Integration | Pass (2026-10-28, `tests/integration/backups-m8b.test.ts`; disposable PostgreSQL) |
| F-63 (M8b, platform) | Backup status page renders restore result | Admin sees synthetic run status and restore result | E2E | Pass (2026-10-28, `tests/e2e/m8b-backups.spec.ts`; disposable PostgreSQL URLs explicitly set) |
| F-56, F-59, F-64 (Later) | Not in v1 | Out of scope | n/a | n/a |
| F-65 to F-69 (Later, Phase 2) | Not in v1 | Out of scope | n/a | n/a |

### Platform and module requirements (F-70 to F-97)

| Feature/risk | Scenario | Expected result | Layer | Status |
| --- | --- | --- | --- | --- |
| F-70 (M0, platform) | Module X off; call any X route or action directly | 403 `MODULE_DISABLED`; nothing written | Integration | Not run |
| F-70 (M0, platform) | Module X off, then on | X's data intact | Integration | Not run |
| F-70 (M0 and M8, platform) | Module toggled | `audit_log` row written | Integration | Pass: `tests/integration/admin-modules.test.ts` (M8a-06; Postgres 16, 2026-10-26) |
| F-73 (M0, platform) | Each role against each protected action | Matches the permission matrix in `SECURITY.md`; UI hides what role cannot do | Integration and E2E | Not run |
| F-74 (M4, alex_core) | No consent; Alex or automation tries to call or text | Blocked and logged | Integration | Passing for SMS (M4-08); calls in M4-01 |
| F-74 (M4, alex_core) | Contact in quiet hours (contact timezone) | Call or SMS deferred (fixed clock) | Integration | Pass (M4-06/M4-07, `tests/integration/outbound-call.test.ts`, incl. the Florida 20:00 state window; per-state table content still needs counsel) |
| F-75 (M4, alex_core) | Contact in a two-party-consent state | Call marked for review | Integration | Pass (M4-07, `tests/integration/outbound-call.test.ts`; state list is a versioned config, content needs counsel) |
| F-75 (M4, alex_core) | Call starts | Disclosure line in agent config and transcript | Integration | Pass (2026-10-26, M4-07: sent to the agent, `disclosure_given` set from the transcript; the live agent prompt is not edited) |
| F-76 (M4, alex_core) | Valid signed lead request | Contact and deal exist; Alex triggered | Integration | Pass for contact, deal, consent and `lead.created` (2026-10-26, M4-04); the call start is M4-06 |
| F-76 (M4, alex_core) | Bad token | 401; nothing written | Integration | Pass (2026-10-26, M4-04) |
| F-76 (M4, alex_core) | Rate-limit breach | 429 | Integration | Pass (2026-10-26, M4-04) |
| F-77 (M4, platform) | Bad signature on any provider webhook | Rejected before storage; no `webhook_events` row | Integration | Not run |
| F-77 (M4, platform) | Processing error | Job retries; error count rises | Integration | Not run |
| F-78 (M4, alex_core) | New lead with consent inside call window | Outbound call starts (fake provider) | Integration | Pass (2026-10-26, M4-06, `outbound-call.test.ts`) |
| F-78 (M4, alex_core) | Lead outside the call window, in quiet hours, or with no consent | No call; waits for the opening (or stops with a logged reason); never dials early | Integration | Pass (2026-10-26, M4-06) |
| F-78 (M4, alex_core) | Retry cadence on a fake clock, redelivered or concurrent attempt, reached lead | Attempts at the configured delays; one dial per attempt; stops once reached or at the daily cap | Integration | Pass (2026-10-26, M4-06) |
| F-79 (M7, quote_followup) | Module on; deal enters Quoted; duplicate stage event | One step scheduled and one active run | Integration | Pass (2026-10-28, `tests/integration/m7-module-acceptance.test.ts`) |
| F-79 (M7, quote_followup) | Module off | No run created | Integration | Pass (2026-10-28, `tests/integration/m7-module-acceptance.test.ts`) |
| F-79 (M7, quote_followup) | Reply during run | Run stops as `stopped_reply` | Integration | Pass (2026-10-28, `tests/integration/m7-module-acceptance.test.ts`) |
| F-80 (M4 and M7, after_hours) | Module on; inbound call after hours, event redelivered | One staff notification; call/contact are retained | Integration | Pass for subscriber notification/idempotency (2026-10-28, `tests/integration/m7-module-acceptance.test.ts`); M4 intake separately owns call/contact creation |
| F-80 (M4 and M7, after_hours) | Module off | Subscriber skipped | Integration | Pass (2026-10-28, `tests/integration/m7-module-acceptance.test.ts`) |
| F-81 (M7, missed_call_textback) | Module on; missed call from consented number | One SMS sent and logged (fake Twilio) | Integration | Pass (2026-10-28, `tests/integration/m7-module-acceptance.test.ts`) |
| F-81 (M7, missed_call_textback) | after_hours on | Text-back enabled with no separate charge flag | Unit | Pass (`tests/unit/modules.test.ts`; 2026-10-28 rerun) |
| F-81 (M7, missed_call_textback) | Missed call with no consent basis | No SMS | Integration | Pass (2026-10-28, `tests/integration/m7-module-acceptance.test.ts`) |
| F-82 (M7, reactivation) | Launch with mixed audience | Only consented contacts enter run | Integration | Pass (2026-10-28, `tests/integration/automation-retries-m7.test.ts`; no-consent imported record is blocked, consented record alone enrolls) |
| F-82 (M7, reactivation) | Module off; launch attempted | Refused with no batch/run written | Integration | Pass (2026-10-28, `tests/integration/automation-retries-m7.test.ts`) |
| F-83 (M11, opm) | Module on | Online Presence section and monthly report visible | E2E | Pass (2026-10-28, `tests/e2e/m11-presence.spec.ts`; enabled owner page and report section) |
| F-83 (M11, opm) | Module off | Section and routes absent (403) | Integration | Pass at service boundary (2026-10-28, `tests/integration/presence.test.ts`; module-off denial and retained data; route 403 is enforced by page guard but not separately requested over HTTP) |
| F-84 (M0 flag and M7, followup_bundle) | Bundle on | Member modules behave as enabled (recommended option: quote_followup, reactivation, missed_call_textback) | Unit and Integration | Pass (2026-10-28, `tests/integration/automation-retries-m7.test.ts`; verifies all four flags enabled and audited) |
| F-84 (M0 flag and M7, followup_bundle) | Bundle off | Only independently enabled modules remain | Integration | Pass (2026-10-28, `tests/integration/automation-retries-m7.test.ts`; verifies bundle and members disabled) |
| F-85 (M0 flag; M1 to M9 gating, crm) | No `crm` (Alex-only tenant) | Base portal works (leads, kanban, appointments, calls, reports); Lite and Full routes 403 and are absent from nav | E2E and Integration | Not run |
| F-85 (M0 flag; M1 to M9 gating, crm) | crm Lite | Companies, tasks, notes, stage settings available; Full-only surfaces hidden and their routes 403 | E2E and Integration | Not run |
| F-85 (M0 flag, crm) | Upgrade Lite to Full | Full surfaces appear; data intact | Integration | Not run |
| F-86 (M0 columns, M8 UI, platform) | Tenant created with plan and tier | Stored and shown in All clients | Integration | Pass: `tests/integration/admin-billing.test.ts` (M8a-07; Postgres 16, 2026-10-26) |
| F-86 (M8, platform) | Founding plan reference text | Shows $6,500 setup and 3 months then $1,500/mo (price decided, PRD decision 12) | E2E | Not run |
| F-87 (M0, platform) | Scan responses of a browser session | No provider key in any response | Integration | Not run |
| F-87 (M0, platform) | Burst of login, webhook and API requests | 429 once the limit is hit | Integration | Not run |
| F-89 (M7, platform) | Lead created and replayed | `lead.created` emitted once | Integration | Pass (2026-10-28, `tests/integration/lead-intake.test.ts`; duplicate external ID and webhook processing replay produce one event) |
| F-89 (M7, platform) | Service token scoped to tenant A used on tenant B through contact route | Own contact 200; tenant B contact 404 | Integration | Pass (2026-10-28, `tests/integration/service-tokens.test.ts`) |
| F-89 (M7, platform) | Missing token, insufficient scope, and revoked token on service contact route | Generic 401 | Integration | Pass (2026-10-28, `tests/integration/service-tokens.test.ts`) |
| F-89 (M7, platform) | Producer emits `lead.created` | n8n subscriber receives canonical event and sends a valid HMAC signature | Integration | Pass (2026-10-28, `tests/integration/n8n-events-m7.test.ts`; synthetic webhook endpoint, Postgres 17) |
| F-89 (M7, platform) | n8n returns 503 then succeeds on retry | Same event ID and valid stable HMAC on retry | Integration | Pass (2026-10-28, `tests/integration/n8n-events-m7.test.ts`; synthetic fetcher) |

### Cross-cutting risk rows

| Feature/risk | Scenario | Expected result | Layer | Status |
| --- | --- | --- | --- | --- |
| Permissions | Unauthorized caller on each protected endpoint | Access denied; no rows in the body | Integration | Not run |
| Isolation | Cross-tenant suite: every tenant table, read, update and delete as tenant A on tenant B IDs, via API, UI and SQL app role | 0 successes. Suite runs on every merge | Integration | Not run |
| Isolation | New tenant table added without `tenant_id` and RLS | CI fails the isolation check | Integration | Not run |
| Gating | For every module key, with module off, call every route and action | 0 successful calls | Integration | Not run |
| Gating | Tenant A turns a module off | Tenant B's flags and behavior unchanged | Integration | Not run |
| Gating | Module off; queued job for that module runs | Job no-ops; data retained | Integration | Not run |
| Idempotency | Same event (same source and external id) replayed 10 times: lead, call-ended, Twilio, Resend | 1 effect | Integration | Not run |
| Consent | STOP, then HELP, then a new Alex call attempt | STOP revokes; HELP responds; call blocked | Integration | Not run |
| Consent | Webhook processing fails during STOP | Contact blocked from sending until processed (fail closed) | Integration | Not run |
| Preview | Preview database after seed | Contains only seeded synthetic tenants; no real client data | Integration | Written, passing locally (M0-27, `preview-guard.test.ts`) |
| Secrets | Build output and logs | No provider key, `.env` value or token present | Manual (recommended option: CI grep) | Not run |
| Backups | Restore drill (see Release criteria) | Restored copy passes RLS and smoke tests | Manual | Not run |

### Module gating matrix

Every module must pass each column for release. Off means the tenant flag is false (F-70). A call to a route or action of a disabled module returns 403 with error code `MODULE_DISABLED` (SECURITY and DESIGN are being corrected from 404 to 403; these tests follow the corrected code).

| Module key | Routes and actions called while off | UI check while off | Jobs while off | Data kept when re-enabled |
| --- | --- | --- | --- | --- |
| `platform` | Not gated; always on | Not applicable | Not applicable | Not applicable |
| `alex_core` | Lead webhook, call start, booking API, Alex config, call logs, ROI report | Dashboard cards, call list, Alex settings absent | Call start, call-ended processing, report job no-op | Calls, dashboards inputs, appointments intact |
| `quote_followup` | Template enablement, sequence start | Template hidden | Quoted-stage run creation no-op | Sequence config intact |
| `after_hours` | Inbound after-hours routing | Settings for after hours absent | After-hours handler no-op | Call records intact |
| `missed_call_textback` | Text-back enablement and send | Template hidden | Missed-call SMS no-op | Logs intact |
| `reactivation` | Launch endpoint | Launch button absent | Campaign run no-op | Past campaigns intact |
| `opm` | Online Presence routes | Section and nav absent | Monthly OPM report no-op | Status records intact (PRD decision 7) |
| `followup_bundle` | Bundle enablement | Bundle toggle state reflects member flags | Member jobs follow member flags (decided, recommended option) | Member flags intact |
| `crm` Lite | Lite routes (no `crm`) and Full-only routes (`lite`), per PRD F-85 | Full-only surfaces absent | Not applicable | Full data kept on downgrade (Decided: data is kept, surfaces hidden) |
| `crm` Full | Not applicable | Not applicable | Not applicable | Not applicable |

Cross-module rules to test (release-blocking, recommended option wherever marked):

- `missed_call_textback` is free when `after_hours` is on (decisions, F-81). Test: enabling after_hours turns text-back on with no separate flag.
- `followup_bundle` enabling sets quote_followup, reactivation and missed_call_textback (`Decided 2026-10-25 (recommended option approved)`, PRD decision 7).
- `alex_core` off removes Alex from lead webhook, so a lead gets no call (F-76, F-78).

### Fixtures and environments

- **Synthetic users.** Kynetic admin, Kynetic VA, owner A, staff A, owner B, staff B. Emails use the reserved `example.test` domain. Names are fictional.
- **Synthetic tenants.** Tenant A and tenant B, with fictional business names. Each has baseline data captured at signup.
- **Seeded fixtures.**
  - Dashboard fixture: two months of leads, calls, contacts reached, bookings and revenue across all lead sources.
  - Search fixture: 10,000 contacts in one tenant (F-37).
  - Import fixtures (F-90 to F-96): 1,000-row CSV with mapped and duplicate rows, 50 bad rows, mixed phone formats, a consent column, an XLSX with formulas, and an open-jobs file. All fictional.
  - Phone numbers use fictional `555-01XX` style ranges.
- **Expected values.** Dashboard and report expected numbers are computed by hand, or by a script separate from the code under test. They are stored beside the fixture. Who writes them is `Decided 2026-10-25 (recommended option approved: the M6 thread writes them with the seed, and Abdullah signs off)`. The metric definitions for speed-to-lead, contact rate, booking rate and revenue recovered are in the PRD "Metric definitions" section (decided 2026-10-25).
- **External services (fakes).**
  - Retell and ElevenLabs: fake adapter that returns scripted call-ended events. ElevenLabs is primary and Retell the fallback (PRD decision 3).
  - Twilio: fake adapter for SMS send, status callbacks and inbound STOP and HELP. Real SMS is not tested until A2P approval; project memory (Oct 22, 2026) says sends fail with 30034.
  - Resend: fake adapter for delivered, bounced and complained events.
  - n8n: fake adapter for service-token calls and event emission.
  - Google sign-in: `Decided 2026-10-25 (recommended option approved: a test identity provider in CI; real Google only in manual checks)`.
- **Live provider tests.** Manual only. Each live action needs Abdullah's yes on that exact action. Only numbers Abdullah owns.
- **Database for tests.** Postgres 16, with the app role non-owner, as in production (`Decided 2026-10-25 (recommended option approved: a throwaway database per test run, created from migrations)`).
- **Reset and isolation.** Decided (recommended option): each test file starts from a fresh schema from migrations; each test runs in a transaction rolled back at the end. E2E uses a seed-and-reset helper that is not exposed in production.
- **Preview environment.** Per spec: preview per branch or PR, separate database, seed data only, no real client data. Deploys stay preview-only until Abdullah approves (locked rule). Decided (recommended option): the preview refuses to start if its database holds any tenant not marked as seed.
- **Restore drill environment.** A scratch host or container, separate from preview and production. `Decided 2026-10-25 (recommended option approved: restore the nightly encrypted dump there, run RLS and smoke tests, then destroy the copy)`. Whether a drill may use real client data is an open question (PRD open decision 9).

---

## Verified commands

No command has been run against this repo's CI in any source. Each line stays `Not configured` until M0 sets up CI and the command has run.

All run from `crm/` with bun (Node 22). Verified locally on 2026-10-26 (M0-02); CI workflow `.github/workflows/crm-ci.yml` runs them on every PR touching `crm/`.

- Production deploy scripts (M10-05): `bash deploy/prod/tests/rehearse.sh` from `crm/` (stubbed docker, curl, df and openssl; 25 checks covering deploy, failed health check, failed migration, rollback, forced command, alert test, de-duplication, recovery, disk and certificate). Also `bash -n` on every script passed locally (2026-10-28). The 25-check stubbed rehearsal passed locally (2026-10-28). Docker Compose config validation was not run because Docker CLI is unavailable; CI config validation and rehearsal on a real server remain owed.
- Lint: `bun run lint` (oxlint).
- Typecheck: `bun run typecheck`.
- Format check: `bun run format:check` (oxfmt).
- Unit tests (Vitest): `bun run test` (files in `crm/tests/unit/`).
- Integration tests (Vitest against Postgres): `bun run test:integration` (files in `crm/tests/integration/`, config `vitest.integration.config.ts`). Needs `TEST_DATABASE_ADMIN_URL`, a superuser URL of a throwaway Postgres 16; each test file creates and drops its own database (Decided 2026-10-26, M0-04). Verified locally against Postgres 16.15.
- End-to-end (Playwright): `bun run test:e2e` (builds first with `bun run build`; starts `bun run start`). Locally set `PLAYWRIGHT_CHROMIUM_PATH` if the Playwright browser is not installed.
- Accessibility scan: `@axe-core/playwright` is installed; the first axe tests came with the app shell (M0-23): the sign-in page in light and dark, run by `bun run test:e2e`. The base components (M0-24) are scanned in light and dark, with a dialog and an error toast open, on a test-only page `/dev/components` that answers 404 unless `COMPONENT_GALLERY=1` (set only in `playwright.config.ts`). The signed-in shell was checked with axe by hand (light, dark, 390px) during M0-23; its automated version needs a seeded session and arrives with the E2E seed helper (M0-26/M0-27).
- Build: `bun run build`.
- Load test: Not configured.
- Backup restore drill: Not configured.


---

## Release criteria

### Per-milestone merge gate

A milestone thread merges to main only when its tests pass and the CI checks above run. Rows list the spec's acceptance test and the features it covers.

| Milestone | Required tests | Feature IDs | Block-level suites |
| --- | --- | --- | --- |
| M0 Foundation | Tenant A cannot read tenant B via API or SQL; login works; CI green; preview deploys | F-52, F-60 (helper), F-70 (mechanism), F-71, F-72, F-73, F-85 (flag), F-86 (columns), F-87, F-84 (flag), F-74 (consent service), `notify()` service | Isolation, gating, secrets |
| M1 Contacts, companies, custom fields | CRUD end to end; custom field filters; dedupe catches same phone | F-05 to F-08, F-10, F-12, F-85 gating | Isolation, gating |
| M2 Deals and kanban | Drag persists; totals correct; rollback on failure | F-14 to F-17 | Isolation |
| M3 Activity, notes, tasks | Every write creates an activity; overdue task notifies | F-19, F-20, F-22 | Isolation |
| M4 Calls and messages (Alex) | Replayed webhook is a no-op; test call lands on timeline; STOP revokes consent | F-26 to F-28, F-30, F-74 to F-77, F-78 (call), F-80 (intake) | Isolation, gating, idempotency, consent |
| M5 Appointments calendar | Alex booking creates appointment within business hours only | F-24, F-78 (booking) | Gating |
| M6 Dashboard and reports | Numbers match seeded fixture | F-01 to F-03, F-49 | Accuracy |
| M7 Automations and notifications | Sequence stops on reply; won deal alert sent | F-31 to F-33, F-35, F-79 to F-82, F-84, F-89 | Gating, consent, idempotency |
| M8 Admin side | Onboarding under 30 s creates working tenant; impersonation logged | F-53 to F-58, F-60 (UI), F-61 to F-63, F-54 | Isolation, gating |
| M9 Search, onboarding import, export, branding, settings, mobile | Import 1,000 rows with mapping; dry run writes nothing; undo removes a batch; imports start no outreach; branding applies everywhere | F-37 to F-44, F-90 to F-94, F-96 | Isolation, consent, mobile |
| M10 Hardening and launch | Restore drill passes; pilot client live; load test; security review | F-63 (drill), F-88, all Must rows | All suites |

F-83 (opm) and F-48 belong to M11 (OPM), approved 2026-10-25 (PRD decision 6). Their tests attach to M11 and are gated there.

If Abdullah approves the ARCHITECTURE split, M8 divides into two gates. M8a covers F-55, F-57, F-60 (UI), F-61, and F-70 (admin UI), and needs only M0. M8b covers F-53, F-54, F-58, F-62 and F-63, and needs M4 and M6. The M8 rows above then move to whichever half owns them.

### Release (pilot) criteria

Before the first founding client goes live, every item below must hold on the production build:

1. Every Must row in the acceptance matrix has passed in CI or in the recorded manual run.
2. Cross-tenant suite: 0 cross-tenant reads or writes, 100% pass, release-blocking.
3. Module gating: 0 successful calls to a disabled module's routes, for every module key in the gating matrix.
4. Webhook idempotency: replay of the same event 10 times produces 1 effect, for every provider webhook.
5. Consent: no call or SMS without consent; STOP revokes and stops sequences; quiet-hour deferral holds.
6. Dashboard and monthly report numbers equal the seeded fixture expectations exactly.
7. Onboarding completes in under 30 seconds on the timestamps in `audit_log`, with no partial tenant on injected failure.
8. Import of 1,000 rows with mapping succeeds.
9. Monthly restore drill passed. Its result and date show on the backups page. Restore is verified with RLS and smoke tests.
10. Preview and staging contain only seeded data. Production contains only the pilot tenant's real data.
11. Mobile check at 390px passes on daily-use pages (no horizontal scroll, 44px targets).
12. Accessibility manual pass completed on contact page, kanban and call detail. WCAG 2.2 AA is the recommended option.
13. Load test result recorded against the 10,000-contact target (`Not configured`).
14. Abdullah has approved the deploy. Deploys are preview-only until then (locked rule).

Unresolved failure policy: `Decided 2026-10-25 (recommended option approved: a failure in the isolation, gating, idempotency, consent or secrets suites blocks merge and release. Any other failure blocks the milestone merge unless Abdullah accepts it in writing as a tracked issue. Owner: Abdullah.)`

Owner of release sign-off: Abdullah (PRD decision maker).

---

## Results

No executions recorded yet. All acceptance rows are `Not run`. No command is verified (see Verified commands). No regression tests exist yet.

Keep `Not run` distinct from `Passed`. Record each run here in this form:

- Date and commit:
- Command (`Not configured` until verified):
- Result (passed, failed, or skipped, with counts):
- Failures, with test name and F-ID:
- Untested limitations:

Regression policy: every important bug fix adds a regression test named with the F-ID it touches, before the fix merges.

### Gap-check rows (2026-10-25; approved for v1)

| ID, milestone, module | Scenario | Expected | Layer | Status |
| --- | --- | --- | --- | --- |
| F-99 (M8a, platform) | Admin enables a module | Price snapshot row created from `module_prices`; totals correct | Integration | Pass: `tests/integration/admin-billing.test.ts` (M8a-07; Postgres 16, 2026-10-26) |
| F-99 (M8a, platform) | `module_prices` changes later | Existing snapshots unchanged | Integration | Pass: `tests/integration/admin-billing.test.ts` (M8a-07; Postgres 16, 2026-10-26) |
| F-99 (M8a, platform) | Owner, staff and VA request the billing profile | 403 | Integration | Pass: `tests/integration/admin-billing.test.ts` (M8a-07; Postgres 16, 2026-10-26) |
| F-100 (M8a, platform) | New tenant with `alex_core` | Checklist created with the module's steps | Integration | Pass (`tests/integration/admin-onboarding.test.ts`) |
| F-100 (M8a, platform) | Owner opens the dashboard before go-live | Setup progress shows only `client_visible` steps; none after go-live | E2E | Not run in a browser; integration covers the data and the card query (`tests/integration/onboarding-checklist.test.ts`) |
| F-101 (M8b, platform) | Kill switch on, a call job runs | No call or text sent; job waits; resumes after off | Integration | Pass for calls (2026-10-26, M4-06); texts and the admin switch not run |
| F-100 (M8a, platform) | Owner or staff queries or updates internal steps | Internal rows invisible; no writes | Integration | Pass (`tests/integration/onboarding-checklist.test.ts`) |
| F-100 (M8a, platform) | Admin marks go-live with open steps; VA tries go-live | Refused; admin succeeds once all steps done or n/a, audited | Integration | Pass (`tests/integration/onboarding-checklist.test.ts`) |
| F-101 (M8b, platform) | Replay a failed webhook twice | Processed once | Integration | Not run |
| F-101 (M8b, platform) | Suspend a tenant | Its users cannot sign in; its jobs no-op | Integration | Not run |
| F-102 (M0, platform) | User has not accepted the current version | Redirect to acceptance; accepted once, not asked again | E2E | Partly run: integration covers pending, accept, not asked again, new version, RLS (`tests/integration/terms.test.ts`); E2E covers the signed-out redirect only. The signed-in redirect needs an E2E sign-in fixture, not built yet |
| F-103 (M9, platform) | Admin uploads PDF; owner downloads; another tenant's id | Signed URL; 404 | Integration | Pass (2026-10-28, `tests/integration/documents-m9.test.ts`; disposable PostgreSQL and FakeStorage, PDF-only validation, tenant-prefixed object, foreign tenant 404) |
| F-98 (M0, platform) | Staff account without TOTP | Reaches only enrolment; sign-in with TOTP works; reset by another admin is audited | E2E | Integration pass (M0-12, `staff-two-factor.test.ts`); E2E not run |
| F-85 (M0, crm) | Alex-only tenant opens Leads, Kanban, Appointments, Calls, Reports | All work; Companies, Tasks, Notes, Search, Export are absent and 403 | E2E | Not run |

---

## Open items

### Decisions closed (2026-10-25)

Abdullah approved these explicitly or told us to take the recommended option. Tests assert them.

1. Alex-only clients get the base portal; CRM Lite/Full are paid upsells: PRD decision 1 (gating matrix for `crm`).
2. Auth: Better-Auth, Google plus magic link (F-71); admin TOTP is in v1 (F-98, see its rows).
3. Voice: ElevenLabs primary, Retell fallback. The fake adapter implements both.
4. Drizzle, pg-boss, Resend confirmed.
5. No migration; clean launch. Import: `.csv`/`.xlsx`, 10 MB, 50,000 rows, skip duplicates by default with optional fill-blanks, undo lists records edited after import, admin-only, raw files deleted 30 days after commit.
6. Upsell backends in M7; OPM is M11; M8 is M8a/M8b. F-83 and F-48 tests attach to M11.
7. Follow-up bundle = quote_followup + reactivation + missed_call_textback; Reviews add-on is part of opm.
8. Client-editable Alex settings: pause and call hours.
9. Retention: recordings/transcripts 12 months, messages 24, audit 24, consent 5 years after revocation, webhook payloads 30 days.
10. Health score: five inputs at 20%, green >=70, yellow 40 to 69, red <40. Guarantee target on `tenants`.
11. Domain: portal.kyneticai.com.
12. Founding price: $6,500 setup + 3 months, then $1,500/mo (the $4,675 figure is dropped).
13. Performance and accessibility numbers as above (WCAG 2.2 AA).
14. D-007 governs Kynetic's own prospecting only.
15. Metric definitions: decided 2026-10-25 (PRD decision 15). Expected dashboard values are written by the M6 thread with the seed and signed off by Abdullah.
16. Quiet hours 08:00 to 21:00 lead-local; stricter state rules layered on top (F-74, F-75).
17. Duplicate phone/email normalisation: E.164 phones, lower-cased emails (F-07).
18. Missed-call text-back is sent only to callers with consent or a permitted basis recorded by the compliance gate (F-81).
19. Restore drill uses synthetic data in a scratch environment, never real client data.
20. Google sign-in is tested manually in v1; CI uses a fake identity provider.

### UNRESOLVED (needs outside information)

- Delivery date.
- State calling and recording rule table and consent wording (counsel); F-74/F-75 state-specific cases wait on it.
- Twilio A2P approval; live SMS tests wait on it.
- F-97 connectors and OPM vendors (no tests until chosen).

### Contradictions found (all resolved)

1. **Founding price.** Resolved: $6,500 setup plus 3 months then $1,500/mo (locked decisions win; D-017's $4,675 is dropped).
2. **Auth library.** Resolved: Better-Auth.
3. **Voice provider.** Resolved: ElevenLabs primary, Retell fallback. The D-number is assigned by Abdullah in the repo decision log.
4. **Reviews.** Resolved: part of opm (F-48).
5. **Twenty.** Resolved: Twenty push is Later, not v1; client data never goes into Twenty. If one is built later, a test must prove no client personal data leaves for Twenty.
6. **Client edits to Alex settings.** Resolved: pause and call hours only (F-42).
7. **Preview wording.** Not a true conflict; a per-PR preview is not a production deploy. Tests treat both as preview.
8. **Accessibility and performance.** The spec gives 44px touch targets only; the PRD adds WCAG 2.2 AA, LCP and p95 numbers, approved.

### Items this document does not decide

- No test command is verified, so all are `Not configured`.
- Nothing has been run. No pass is recorded.
- No real provider call or SMS is covered by an automated test.
