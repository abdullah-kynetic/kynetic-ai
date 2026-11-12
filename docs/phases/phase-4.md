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
