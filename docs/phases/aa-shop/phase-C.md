# Phase C: Shop floor (Jobs board, Quotes with Follow-ups, Insurance, Team)

Goal: the pages that run the day in the shop.

## Acceptance checks

| ID | Check | Proof |
|---|---|---|
| C-1 | Jobs board shows the eight auto body stages as columns, car cards (year, make, model, customer, tech, days in shop, amount, payment type), drag between columns and an arrow-button move that works by keyboard and on a phone | browser test |
| C-2 | Moving a card records the move and shows a "Status text sent (demo)" style note only as a disabled preview. No text is sent | integration test: no outbound row created |
| C-3 | Quotes lists deals in the Quoted stage with amount, payment type, age, a close rate from won over quoted, and a Follow-ups tab showing each run's steps, sent or pending, replies, and stopped reason | integration and browser tests |
| C-4 | Insurance shows deals waiting on insurance and a supplement table (empty state until records exist) with disabled add action | browser test |
| C-5 | Team groups open deals by owner and shows a paint queue from the In repair and paint stage | integration and browser test |
| C-6 | Non-shop pipeline page is unchanged | existing tests |

## Steps

- [x] **C-S1.** Jobs board: restyle Pipeline for shop clients with car cards (from deal fields and the auto body custom fields), drag and arrow-button move.
  - Test: browser test for both move methods; integration test that a move writes a stage change and no outbound row
  - Commit: "Add the shop jobs board"
  - Covers: C-1, C-2, C-6
- [ ] **C-S2.** Quotes list with close rate.
  - Test: integration test for close rate; browser test
  - Commit: "Add shop quotes"
  - Covers: C-3
- [ ] **C-S3.** Follow-ups tab on Quotes from automation runs and steps.
  - Test: browser test with a seeded run
  - Commit: "Add follow-ups tab to quotes"
  - Covers: C-3
- [ ] **C-S4.** Insurance page.
  - Test: browser test
  - Commit: "Add the shop insurance page"
  - Covers: C-4
- [ ] **C-S5.** Team page.
  - Test: integration and browser tests
  - Commit: "Add the shop team page"
  - Covers: C-5
- [ ] **C-S6.** Phase pass at both widths, both themes, accessibility scan.
  - Test: `bun run verify:e2e`; screenshots reviewed
  - Commit: "Polish the shop floor pages"
  - Covers: C-1 to C-6

## Needs a yes

Nothing in this phase.
