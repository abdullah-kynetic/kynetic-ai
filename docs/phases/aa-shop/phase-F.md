# Phase F: Control and finish

## Acceptance checks

| ID | Check | Proof |
|---|---|---|
| F-1 | Away mode shows a date range, a daily summary preview, and alert rules. Turning it on is stored as a setting only. Nothing is sent | integration and browser tests |
| F-2 | Connections lists QuickBooks, Audatex, Parts Trader, calendar, phone line and Google with honest status ("Phase 2, needs your access"), all read-only | browser test |
| F-3 | Settings and Help are reachable from the Control group; every old URL still works | browser test |
| F-4 | Whole product: every shop page loads with the module on, 403s with it off, passes the accessibility scan at 390 px and 1440 px in light and dark, and has a designed empty state | `bun run verify:e2e` plus screenshots |
| F-5 | No shop page sends anything: with outbound flags off or on, no outbound row is created by any shop action | integration test across all shop actions |
| F-6 | `FINAL-REPORT.md` and `LIVE-STEPS.md` are complete | file check |

## Steps

- [x] **F-S1.** Away mode page and its settings read and write (setting only).
  - Test: integration and browser tests
  - Commit: "Add shop away mode"
  - Covers: F-1
- [x] **F-S2.** Connections page.
  - Test: browser test
  - Commit: "Add shop connections"
  - Covers: F-2
- [x] **F-S3.** Regroup Settings and Help into Control; redirects and old URLs checked.
  - Test: browser test
  - Commit: "Group settings and help under Control"
  - Covers: F-3
- [x] **F-S4.** Whole-product pass: every page, both widths, both themes, module on and off, empty and sample-data states. Fix everything found, retest.
  - Test: `bun run verify:e2e`; screenshots reviewed
  - Commit: "Final polish for the shop pages"
  - Covers: F-4
- [x] **F-S5.** Outbound-off test across every shop action.
  - Test: integration test
  - Commit: "Test that shop actions never send"
  - Covers: F-5
- [ ] **F-S6.** Write `FINAL-REPORT.md` from `../REPORT-TEMPLATE.md` and finish `LIVE-STEPS.md`.
  - Test: file check
  - Commit: "Write the AA shop final report"
  - Covers: F-6

## Needs a yes

`LIVE-STEPS.md`, all of it, once, at the end.
