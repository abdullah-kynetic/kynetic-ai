# Phase E: Customers and reputation (Customers, Reviews, Get found, Referrals)

## Acceptance checks

| ID | Check | Proof |
|---|---|---|
| E-1 | Customers shows past customers with last job, total spent from won deals, and review status, with search, and a Bring back preview that shows the email text with a disabled Send | integration and browser tests |
| E-2 | Reviews shows the rating summary, recent reviews, the review request list, and AI-drafted replies with Approve. Approve marks the draft approved in the portal and posts nothing | browser test |
| E-3 | The request wording and the page copy say every customer gets the Google link. There is no star filtering anywhere in the shop UI | test on page copy and on the request function |
| E-4 | Get found shows the listings checklist and post drafts from the Online presence records | browser test |
| E-5 | Referrals is regrouped with no other change | existing tests |

## Steps

- [ ] **E-S1.** Customers page with totals and review status.
  - Test: integration test for totals; browser test
  - Commit: "Add shop customers"
  - Covers: E-1
- [ ] **E-S2.** Bring back old customers preview (no send).
  - Test: browser test: Send is disabled
  - Commit: "Add bring-back preview"
  - Covers: E-1
- [ ] **E-S3.** Reviews shop variant: summary, list, request list, drafted replies with Approve.
  - Test: browser test
  - Commit: "Add shop reviews"
  - Covers: E-2, E-3
- [ ] **E-S4.** Get found from presence records.
  - Test: browser test
  - Commit: "Add shop get found"
  - Covers: E-4
- [ ] **E-S5.** Regroup Referrals; phase pass at both widths, both themes, accessibility scan.
  - Test: `bun run verify:e2e`; screenshots reviewed
  - Commit: "Polish the customer pages"
  - Covers: E-1 to E-5

## Needs a yes

Nothing in this phase.
