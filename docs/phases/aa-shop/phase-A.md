# Phase A: Foundation

Goal: the switch, the sidebar, the data layer, the shared UI pieces and the sample-data tool. After this phase a shop client sees the five-group sidebar and empty shop pages. Nothing else changes for other clients.

## Acceptance checks

| ID | Check | Proof |
|---|---|---|
| A-1 | `shop_ops` is a module key. With it off, every shop route and server read returns 403 and the nav hides the entries. With it on they work. | unit and integration tests |
| A-2 | The only migration in the track adds one `module_catalog` row for `shop_ops`, and is idempotent | migration test |
| A-3 | Auto body industry stages are: New lead, Quoted, Waiting on insurance, Parts ordered, In repair and paint, Ready for pickup, Picked up (won), Lost. A deal entering Quoted enrolls in quote follow-up | unit test (extends `systems-templates.test.ts`) plus automation test |
| A-4 | Auto body custom fields (vehicle year, make, model, payment type, insurer, claim number, estimate amount, drop-off date, tech) can be ensured idempotently for a tenant | integration test |
| A-5 | A shop client sees five sidebar groups; every other client's sidebar is byte-for-byte unchanged | unit test on `visibleNavGroups` and nav config |
| A-6 | Shop read functions return real rows when present and empty results otherwise, never throw on an empty tenant, and never cross tenants | integration test, two-tenant fixture |
| A-7 | Sample data seeder is dry-run by default, tags every row `aa-shop-demo-v1`, never touches a tenant without the module, and the remove command deletes exactly that batch | integration test |
| A-8 | Demo-data banner shows whenever any tagged row is present, and not otherwise | browser test |

## Steps

- [x] **A-S1.** Add `shop_ops` to `MODULE_KEYS`, the module catalog copy and the admin module toggle. One migration adds the `module_catalog` row. Route and nav gating use the existing `requireModule` and `module` fields.
  - Test: unit, integration gating test, migration test
  - Commit: "Add the shop operations module"
  - Covers: A-1, A-2
- [x] **A-S2.** Auto body industry: rename stages as in A-3 (the stage must be named exactly `Quoted`; `crm/src/server/automations/worker.ts` matches that name). Update `AUTO_BODY_STAGES` and its tests.
  - Test: unit test; automation test that a deal moved into Quoted starts `quote_followup`
  - Commit: "Name the auto body quote stage Quoted"
  - Covers: A-3
- [x] **A-S3.** An idempotent function that ensures the auto body custom fields exist for a tenant. Not run live.
  - Test: integration test
  - Commit: "Add auto body custom fields helper"
  - Covers: A-4
- [ ] **A-S4.** Shop sidebar: when `shop_ops` is on, the client nav is the five groups from `README.md`. Group and item config lives beside `area-nav.ts`.
  - Test: unit test comparing a non-shop tenant's nav to today's
  - Commit: "Show the shop sidebar for shop clients"
  - Covers: A-5
- [ ] **A-S5.** Shop data layer in `crm/src/server/shop/`: typed read functions for jobs by stage, quotes, follow-up runs, insurance deals and supplements (empty until backend), team by owner, money in (won deals) and money out (empty), customers with totals, away settings (default off). Each reads through `withTenant` and requires the module.
  - Test: integration test with two tenants
  - Commit: "Add the shop data layer"
  - Covers: A-6
- [ ] **A-S6.** Sample data seeder and remover, modeled on `demo-clients.ts`: `bun run db:seed:shop-demo` (dry-run unless `--apply`) and `bun run db:remove:shop-demo`. Realistic Dallas names, fake 555 numbers, tickets $200 to $6K out-of-pocket and $1.2K to $22K insurance, tagged `aa-shop-demo-v1`. Never run against a live database by this track.
  - Test: integration test
  - Commit: "Add shop sample data seed and remove commands"
  - Covers: A-7
- [ ] **A-S7.** Shared pieces: shop page container, stat tiles reuse, the "Demo data" banner, the disabled-action-with-note pattern ("Turns on when this is connected"), empty-state wrapper. Phone layout checked at 390 px.
  - Test: browser test, screenshots reviewed
  - Commit: "Add shared shop page components"
  - Covers: A-8

## Needs a yes

Everything in `LIVE-STEPS.md`. This phase runs none of it.
