# Phase B: Front desk (Today, Leads, Calls and texts, Calendar)

Goal: the first group of pages, restyled or extended from what exists. All pages work on the sample data and show empty states without it. Every page works at 390 px and 1440 px, light and dark.

## Acceptance checks

| ID | Check | Proof |
|---|---|---|
| B-1 | Today shows cars in shop, drop-offs today, new leads, quotes waiting, money in this week, missed calls answered, a Needs you list and a Running without you list, from real queries | integration and browser tests |
| B-2 | Leads show source chips (AI receptionist call, missed-call text, website photo quote, walk-in, Google), status, a detail panel with summary and conversation, a photos area, and an Add walk-in action that creates a real lead | browser test |
| B-3 | Calls and texts shows the call log, message log, receptionist rules (read-only), and a "Where is my car?" preview that reads a job's stage | browser test |
| B-4 | Calendar shows drop-off, estimate and pickup types and a reminder badge per appointment; week view readable on a phone | browser test |
| B-5 | Existing non-shop clients see unchanged versions of these four pages | existing tests still pass, plus a render test per page |

## Steps

- [x] **B-S1.** Today: shop tiles, Needs you, Running without you. Shop variant of the dashboard behind the module check; non-shop dashboard untouched.
  - Test: integration test for each tile query; browser test; screenshots
  - Commit: "Add the shop Today page"
  - Covers: B-1, B-5
- [x] **B-S2.** Leads: source chips, status, detail panel (summary, conversation), photos area (empty state until storage exists), Add walk-in.
  - Test: browser test including creating a walk-in
  - Commit: "Add shop lead view and walk-in"
  - Covers: B-2, B-5
- [x] **B-S3.** Calls and texts: combined view over calls and messages, receptionist rules (read-only), Where is my car preview.
  - Test: browser test
  - Commit: "Add shop calls and texts"
  - Covers: B-3, B-5
- [x] **B-S4.** Calendar: appointment types, reminder badges, readable on a phone.
  - Test: browser test at 390 px
  - Commit: "Add shop calendar view"
  - Covers: B-4, B-5
- [x] **B-S5.** Phase pass: all four pages at both widths in both themes, accessibility scan clean, empty states reviewed.
  - Test: `bun run verify:e2e`; screenshots reviewed
  - Commit: "Polish the front desk pages"
  - Covers: B-1 to B-5

## Needs a yes

Nothing in this phase.
