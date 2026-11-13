# Phase 3: Client portal features (about 4 to 5 days)

Goal: a client can manage their leads, messages, bookings, reviews and documents without staff help.

## Scope

- Core CRM gap 3 (F-47 in the spec, Later): send a text or email from a contact page with a compose box, and a reply view. Built and tested against the fake providers. It cannot send for real until Twilio text approval (KI-003) and counsel sign-off on consent wording (KI-002) are done.
- Review requests that actually send, through the consent gate (KI-030). Fake providers until live.
- Support alerts by email (KI-029), off by default behind a flag.
- Usage page: clients see usage, and cost only if Abdullah decides so (KI-022, KI-032).
- Terms gate stays off until counsel approves the wording (KI-026).
- Polish of the dashboard, pipeline, contacts and documents screens (spacing, empty states, mobile), driven by browser screenshots at 390 px and desktop.

## Acceptance checks

| ID | Check | Proof |
|---|---|---|
| P3-1 | A message sent from a contact goes through consent, quiet hours and DNC, is logged, and shows on the timeline | integration test with the fake provider |
| P3-2 | A contact with an opt-out or DNC cannot be messaged, and the UI says why | integration and browser tests |
| P3-3 | A STOP reply revokes consent and stops further messages | existing STOP tests extended |
| P3-4 | Review requests are queued, gated and logged, and only run when the flag is on | integration test |
| P3-5 | Support email is off unless both the server flag and the setting are on | unit test |
| P3-6 | No send happens while `OUTBOUND_ENABLED=false` or `PROVIDER_MODE=stub` | existing outbound tests extended |
| P3-7 | Screens pass the accessibility scan at 390 px and desktop; screenshots reviewed | browser test and screenshots |

## Needs a yes

Deploy; setting any flag live; turning on any real provider.

## Needs a decision

- Do clients see dollar cost on the Usage page? (Recommendation: no.)
- Wording for terms and consent (counsel).

## Steps

Work these in order. Tick each `- [ ]` as `- [x]` in the same commit that finishes the step. A new thread resumes at the first unticked step. For every step: finish it, test it, commit, push, then move on (see `PROTOCOL.md`). A STOP step waits for Abdullah's yes; do the steps after it that do not depend on it.

- [x] **P3-S1.** Compose box and reply view on the contact page (fake providers).
  - Test: Integration test: sent message passes consent, quiet hours and DNC, is logged, shows on the timeline
  - Commit: "Send text or email from a contact"
  - Covers: P3-1
- [x] **P3-S2.** Show why a contact cannot be messaged (opt-out, DNC).
  - Test: Integration and browser tests
  - Commit: "Explain blocked messages in the compose box"
  - Covers: P3-2
- [x] **P3-S3.** Extend STOP-reply tests: consent revoked, no further messages.
  - Test: Extended existing tests
  - Commit: "Extend STOP reply tests"
  - Covers: P3-3
- [x] **P3-S4.** Review requests queued, gated, logged, and only when the flag is on.
  - Test: Integration test
  - Commit: "Send review requests through the consent gate"
  - Covers: P3-4
- [x] **P3-S5.** Support alert email, off unless the server flag and the setting are both on.
  - Test: Unit test
  - Commit: "Add support alert email behind two flags"
  - Covers: P3-5
- [x] **P3-S6.** Extend outbound tests: no send while `OUTBOUND_ENABLED=false` or `PROVIDER_MODE=stub`.
  - Test: Extended existing tests
  - Commit: "Extend outbound off tests"
  - Covers: P3-6
- [x] **P3-S7.** Usage page: show usage; cost only if decided (default hidden).
  - Test: Integration test
  - Commit: "Hide cost on the client Usage page by default"
  - Covers: -
- [x] **P3-S8.** Polish dashboard, pipeline, contacts and documents (spacing, empty states, mobile); review screenshots at 390 px and desktop.
  - Test: `bun run verify:e2e`; screenshots reviewed
  - Commit: "Polish client screens"
  - Covers: P3-7
- [ ] **P3-S9.** Open PR; record in the build log. Deploy needs a yes.
  - Test: CI green
  - Commit: "Record phase 3 in the build log"
  - Covers: -
