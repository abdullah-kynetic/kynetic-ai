# Phase 6: Automations and the Alex chain (about 7 to 9 days, last)

Goal: lead in, Alex calls, a real slot is booked, follow-up goes out, and a client can edit their own automations.

Background: only a dev-only chain exists in code (it refuses to run in production). n8n templates are Code-node simulations ending in a test-only sink. No ElevenLabs, Cal.com or portal credential exists in n8n. Nothing in `crm/` references Cal.com (KI-027). The portal runs with `PROVIDER_MODE=stub` and `OUTBOUND_ENABLED=false`.

## Scope

- Demo-client end-to-end test in stub mode (lead, call, booking, follow-up text, dashboard and admin views), added to CI. Reuse the pieces of `dev-runtime-smoke` and `tests/e2e` before deleting the dev chain.
- Remove the dev-only chain once the test replaces it.
- n8n, built inactive: credentials for ElevenLabs, Cal.com and the portal service token; one booking workflow (ElevenLabs tool call, Cal.com availability and booking, then the portal's booking and call-result endpoints with signature check); a signature check on Front Door; an error alert with a recipient.
- Calendar sync with Cal.com (KI-027).
- Editable automations in the portal (KI-028): cadence and copy, versioned, validated by schema and the compliance gate, a person approves a change.
- Onboarding automation for a new client.
- One live test to Abdullah's own phone only, then outbound off again.

## Acceptance checks

| ID | Check | Proof |
|---|---|---|
| P6-1 | The demo-client test passes in CI from a clean database | CI run |
| P6-2 | Webhooks reject a bad or missing signature | integration tests |
| P6-3 | A booking made through the workflow shows as an appointment and on the client dashboard | demo-client test |
| P6-4 | The follow-up message is blocked by consent, quiet hours or DNC when it should be | integration test |
| P6-5 | An edited automation is versioned, validated and audited, and an invalid edit is refused | integration test |
| P6-6 | No workflow is active in n8n until activation is approved | n8n listing in the report |
| P6-7 | One real call from lead to a booked Cal.com slot on Abdullah's phone, then outbound is switched off | evidence after the live yes |

## Needs a yes

Each n8n credential and change; activating any workflow; `PROVIDER_MODE=live`, `ELEVENLABS_LIVE_ENABLED` and `OUTBOUND_ENABLED` for the test window; ElevenLabs plan and number import; anything that dials or texts. Never dial the AM-1 Roofing number. No Florida or Oklahoma owners. Nora, Emily, Retell agent tools and the live Alex agent stay untouched.

## Needs a decision

- The portal owns consent, quiet hours and DNC; n8n only asks it (recommended).
- Follow-up sequences run in the portal worker, not n8n (recommended).
- Whether the receptionist is in the first package (recommended: no).
- Counsel sign-off on calling, recording and consent wording (KI-002) before any real prospect contact.

## Steps

Work these in order. Tick each `- [ ]` as `- [x]` in the same commit that finishes the step. A new thread resumes at the first unticked step. For every step: finish it, test it, commit, push, then move on (see `PROTOCOL.md`). A STOP step waits for Abdullah's yes; do the steps after it that do not depend on it.

- [x] **P6-S1.** Demo-client end-to-end test in stub mode (lead, call, booking, follow-up text, dashboard and admin views), reusing `dev-runtime-smoke` and `tests/e2e`.
  - Test: Passes from a clean database in CI
  - Commit: "Add the demo client end-to-end test"
  - Covers: P6-1, P6-3
- [x] **P6-S2.** Webhook signature rejection tests (bad or missing signature).
  - Test: Integration tests
  - Commit: "Test webhook signature rejection"
  - Covers: P6-2
- [x] **P6-S3.** Follow-up blocked by consent, quiet hours or DNC.
  - Test: Integration test
  - Commit: "Test follow-up gating"
  - Covers: P6-4
- [x] **P6-S4.** Remove the dev-only chain once the test replaces it.
  - Test: `bun run verify:e2e`
  - Commit: "Remove the dev-only chain"
  - Covers: -
- [ ] **P6-S5.** Calendar sync with Cal.com (KI-027) against a fake.
  - Test: Integration test
  - Commit: "Add Cal.com calendar sync"
  - Covers: -
- [ ] **P6-S6.** Editable automations: versioned, validated by schema and the compliance gate, approved by a person, audited.
  - Test: Integration tests: valid edit versioned and audited, invalid edit refused
  - Commit: "Add editable automations"
  - Covers: P6-5
- [ ] **P6-S7.** Onboarding automation for a new client.
  - Test: Test
  - Commit: "Add onboarding automation"
  - Covers: -
- [ ] **P6-S8.** n8n, built inactive, each credential and change with its own yes: credentials, one booking workflow, signature check, error alert.
  - Test: n8n listing shows nothing active
  - Commit: "Record the n8n workflow export"
  - Covers: P6-6
- [ ] **P6-S9.** Open PR; record in the build log. STOP for yes: live test to Abdullah's phone only, then outbound off.
  - Test: Evidence
  - Commit: "Record phase 6 in the build log"
  - Covers: P6-7
