# Phase 4: Hardening (about 4 to 5 days)

Goal: the portal is safe and operable at 10 to 25 clients, and a new client can be created and live in a day.

## Scope

- Accessibility pass to WCAG 2.2 AA on every client and admin page.
- Security review of auth, sessions, service tokens, webhook signatures, file access and the staff email-code login (KI-033).
- Load test of the main list and search paths, with the 500 ms p95 target (DC-033) measured on a quiet machine.
- Runbooks: deploy, rollback, restore from backup, incident, offboarding.
- Monitoring and alerts: worker heartbeat, failed jobs, backup failure, disk, health.
- Client onboarding in one step (create client, owner invite, defaults) with an end-to-end test.

## Acceptance checks

| ID | Check | Proof |
|---|---|---|
| P4-1 | No serious or critical accessibility violations on any page | browser accessibility scan across all routes |
| P4-2 | Security review findings are fixed or recorded with a reason | review notes in the report |
| P4-3 | Contact search p95 under 500 ms at 100 concurrent on a quiet machine | `load-m10` run without the CI override |
| P4-4 | A documented restore drill succeeds into a scratch database | evidence from the server, after a yes |
| P4-5 | An alert reaches Abdullah for a dead worker, a failed backup and a failed job | test alert evidence after a yes |
| P4-6 | A new client can be created and sign in within a day, following the runbook | end-to-end test plus a dated dry run |

## Needs a yes

Deploy; alert destinations; any server change; the restore drill.

## Needs a decision

Whether staff may keep the email-code login once real client data is in the system (KI-033).

## Steps

Work these in order. Tick each `- [ ]` as `- [x]` in the same commit that finishes the step. A new thread resumes at the first unticked step. For every step: finish it, test it, commit, push, then move on (see `PROTOCOL.md`). A STOP step waits for Abdullah's yes; do the steps after it that do not depend on it.

- [ ] **P4-S1.** Accessibility pass to WCAG 2.2 AA on every client and admin page.
  - Test: Browser scan across all routes, no serious or critical
  - Commit: "Fix accessibility violations"
  - Covers: P4-1
- [ ] **P4-S2.** Security review of auth, sessions, service tokens, webhook signatures, file access and the staff email-code login; fix or record each finding.
  - Test: Review notes in `docs/`
  - Commit: "Record the phase 4 security review and fixes"
  - Covers: P4-2
- [ ] **P4-S3.** Load test contact search and list paths on a quiet machine (500 ms p95 target).
  - Test: `load-m10` without the CI override
  - Commit: "Record the load test result"
  - Covers: P4-3
- [x] **P4-S4.** Runbooks: deploy, rollback, restore from backup, incident, offboarding.
  - Test: Read-through; rehearsal script still passes
  - Commit: "Add operations runbooks"
  - Covers: -
- [ ] **P4-S5.** Monitoring and alerts: worker heartbeat, failed jobs, backup failure, disk, health.
  - Test: Unit and integration tests for each alert rule
  - Commit: "Add monitoring alert rules"
  - Covers: P4-5
- [ ] **P4-S6.** One-step client onboarding: create client, owner invite, defaults.
  - Test: End-to-end test
  - Commit: "Add one-step client onboarding"
  - Covers: P4-6
- [ ] **P4-S7.** Open PR; record in the build log.
  - Test: CI green
  - Commit: "Record phase 4 in the build log"
  - Covers: -
- [ ] **P4-S8.** STOP for yes: deploy, alert destinations, restore drill into a scratch database, test alert.
  - Test: Server evidence
  - Commit: (none)
  - Covers: P4-4, P4-5
