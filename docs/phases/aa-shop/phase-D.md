# Phase D: Money (Weekly report, Money in and out, Documents)

## Acceptance checks

| ID | Check | Proof |
|---|---|---|
| D-1 | Weekly report shows cars done, money in, average ticket, insurance vs out-of-pocket split, calls answered, quotes sent, close rate and an 8-week bar chart, from real queries. The chart has a text alternative | integration and browser tests |
| D-2 | Money in and out shows money in from won deals and an empty state for money out with a disabled add action. No figure is invented | browser test |
| D-3 | Documents sits in the Money group with no other change | existing tests |
| D-4 | The weekly email control is visible but disabled unless both existing flags are on | unit test |

## Steps

- [x] **D-S1.** Weekly report shop variant from the data layer.
  - Test: integration test for each number; browser test
  - Commit: "Add the shop weekly report"
  - Covers: D-1
- [x] **D-S2.** Money in and out page.
  - Test: browser test
  - Commit: "Add shop money page"
  - Covers: D-2
- [x] **D-S3.** Regroup Documents under Money; show the weekly email control with its two-flag rule.
  - Test: unit test
  - Commit: "Group documents under Money"
  - Covers: D-3, D-4
- [x] **D-S4.** Phase pass at both widths, both themes, accessibility scan.
  - Test: `bun run verify:e2e`; screenshots reviewed
  - Commit: "Polish the money pages"
  - Covers: D-1 to D-4

## Needs a yes

Nothing in this phase.
