# AA shop track final report (2026-11-25)

**Result:** ready to ship to main, not deployed. All six phases (A to F) are built and tested. Nothing was deployed and no live system was touched. Going live needs the steps in `LIVE-STEPS.md`, each with a yes.

## Acceptance checks

Proof files are under `crm/tests/integration`, `crm/tests/unit` and `crm/tests/e2e` (browser). Screenshots at 1440 and 390 px, light and dark, are in `docs/phases/aa-shop/shots/`.

| ID | Check | Proof | Result |
|---|---|---|---|
| A-1 | `shop_ops` module gates every shop route and read | shop-ops-module.test.ts, shop-foundation.spec.ts | pass |
| A-2 | One idempotent migration (1097) adds the `shop_ops` catalog row | shop-ops-module.test.ts | pass |
| A-3 | Auto body stages and quote follow-up enrollment on Quoted | auto-body-stages.test.ts, systems-templates.test.ts | pass |
| A-4 | Auto body custom fields ensure idempotently | auto-body-fields.test.ts | pass |
| A-5 | Shop client sees five sidebar groups; other clients' nav unchanged | shop-nav.test.ts | pass |
| A-6 | Shop reads return real rows, empty results on an empty tenant, never cross tenants | shop-data-layer.test.ts (two tenants) | pass |
| A-7 | Seeder is dry-run by default, tags `aa-shop-demo-v1`, remove deletes exactly that batch | shop-demo-seed.test.ts | pass |
| A-8 | Demo-data banner shows only when tagged rows exist | shop-foundation.spec.ts | pass |
| B-1 | Today numbers, Needs you, Running without you from real queries | shop-front-desk.spec.ts, shop-today.test.ts | pass |
| B-2 | Leads with source chips, detail, photos area, walk-in creates a real contact and job | shop-front-desk.spec.ts | pass |
| B-3 | Calls and texts, receptionist rules read-only, Where is my car preview | shop-front-desk.spec.ts | pass |
| B-4 | Calendar types, reminder badge, readable at 390 px | shop-front-desk.spec.ts | pass |
| B-5 | Non-shop clients see unchanged pages | existing suites | pass |
| C-1 | Jobs board: eight stages, car cards, drag and keyboard/phone menu move | shop-floor.spec.ts, shop-jobs-move.test.ts | pass |
| C-2 | Moving a card sends nothing; status text is a disabled preview | shop-jobs-move.test.ts | pass |
| C-3 | Quotes list, close rate, follow-ups tab | shop-floor.spec.ts | pass |
| C-4 | Insurance waiting list and supplements empty state, disabled add | shop-floor.spec.ts | pass |
| C-5 | Team by owner and paint queue | shop-floor.spec.ts | pass |
| C-6 | Non-shop pipeline unchanged | existing pipeline specs | pass |
| D-1 | Weekly report numbers and 8-week chart with text alternative | shop-report.test.ts, shop-money.spec.ts, shop-week-start.test.ts | pass |
| D-2 | Money in and out; money out empty state, no invented figure | shop-money.spec.ts | pass |
| D-3 | Documents in the Money group, unchanged | shop-money.spec.ts | pass |
| D-4 | Weekly email control disabled unless both flags on | shop-weekly-email.test.ts | pass |
| E-1 | Customers, search, bring-back preview with disabled Send | shop-customers.spec.ts | pass |
| E-2 | Reviews with drafted replies; Approve records in portal and posts nothing | shop-reputation.test.ts, shop-customers.spec.ts | pass |
| E-3 | Every customer gets the Google link, no star filtering | shop-review-request-wording.test.ts | pass |
| E-4 | Get found listings and post drafts | shop-customers.spec.ts | pass |
| E-5 | Referrals regrouped, unchanged | existing suites | pass |
| F-1 | Away mode saved as a setting only | shop-no-send.test.ts, shop-control.spec.ts | pass |
| F-2 | Connections honest read-only rows | shop-control.spec.ts | pass |
| F-3 | Settings and Help under Control, old URLs still work | shop-control.spec.ts | pass |
| F-4 | All 15 pages load with module on, 403 with it off, axe clean at 390 and 1440, light and dark, designed empty states | shop-control.spec.ts and every shop spec (axe, overflow, 44 px targets) | pass |
| F-5 | No shop action creates an outbound row, flags off or on | shop-no-send.test.ts | pass |
| F-6 | This report and LIVE-STEPS.md complete | file check | pass |

## Verify

Full local run at the end of phase B (typecheck, lint, format, unit, integration 549 s, deploy scripts, production build all pass). After that, each phase ran its own tests locally and the full CI on its PR:

| PR | Phase | CI `check` | CI `e2e` |
|---|---|---|---|
| #259 | A | pass | pass |
| #260 | B | pass | pass |
| #261 | C | pass | pass |
| #262 | D | pass | pass |
| #263 | E | pass | pass |
| #264 | F | pass | pass |

CI run links are on each PR at https://github.com/abdullah-kynetic/kynetic-ai/pulls.

## What changed

- PRs #259 to #264, all merged with merge commits (final main commit 009e9d0916b45e7419fe647b1ddd717d95ca12dc).
- One migration: 1097, adds the `shop_ops` row to `module_catalog`. No new tables.
- 15 shop pages under `/dashboard/shop/*`: Today, Leads, Calls and texts, Calendar, Jobs, Quotes, Insurance, Team, Report, Money, Customers, Reviews, Get found, Away mode, Connections.
- Shop data layer in `crm/src/server/shop/`, shared UI in `crm/src/components/shop/`, sample-data seeder and remove CLI (`db:seed:shop-demo`, `db:remove:shop-demo`).
- Fix to the shared kanban board: the Move to stage menu crashed under Base UI, now fixed for every client.
- Fix to the clients-board drag specs, which broke when extra shop tenants pushed a card out of view.

## Decisions made in the loop (also in PROGRESS.md)

- Shop routes live under `/dashboard/shop/*`.
- Walk-in creates a contact and a job, not a lead event, so nothing is dialed or texted.
- Review replies and away mode are stored as Online presence records, because tenant columns are read-only for the client role and no tables were allowed.
- Quote age uses `updated_at`.
- Supplements and expenses are empty states with disabled add buttons.

## Not verified

- Anything on the live portal: nothing was deployed, so migration 1097, the module switch, the template, fields and sample data are untested against live.
- Real providers: QuickBooks, Audatex, Parts Trader, Google reviews and posting, calendar sync, outbound email and text. All are shown as not connected or disabled.
- Module-off shop routes return HTTP 200 with a 403 screen, not a true 403 status (framework limitation here).
- Background worker and event dispatch effects were not exercised.
- Time zone edges (daylight saving) in week boundaries.
- Auto body custom fields have no CLI or screen; step 6 in `LIVE-STEPS.md` uses the MCP tool, untested against live.

## Blocked items

None. No step hit the five-attempt limit.

## Live steps that need a yes

See `LIVE-STEPS.md`: migration check, pre-deploy dump, deploy, module on, Auto body template, nine fields, optional sample data, final check.

## Open questions

None blocking.
