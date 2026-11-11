# M12–M20 audit and wave 30 delivery

> Historical audit. The current app is `crm/`; the retired `portal/` app and
> its deployment path are not operational references.

> **Superseded as a status source (2026-11-09).** Current plan and status: Twenty ROADMAP note `7bfdcb7e` and `docs/STATUS.md`. Kept as technical/historical detail; do not treat any checklist below as current.

**Order recorded 2026-11-01 (historical; the banner above wins):** n8n automations remain deferred. M16-01 through M16-06 are implemented locally, including the synthetic human dialer, never-dial guards and campaigns. Latest increment passed build/typecheck, 425 unit, 63 integration and two mobile/browser accessibility scenarios. Next portal task: proposal drafts. No real agency migration or live provider operation is implied; login/auth work stays last.

**Latest progress (2026-11-01):** M13-06 database regression now passes; M12-01 technical review complete. Wave 31 local implementation completed M12-03, M12-05 and M13-02. M12-02 awaits explicit supersede confirmation; M15-04 formatter is tested but workflow validation is blocked by connector errors. Current evidence is in BUILD_PLAN, TESTING and progress; the original audit below records the earlier baseline.

**Wave 32 update:** send-state/contact-policy readers and normalized call-result API are implemented and locally tested (402 unit, 107 integration). M12-04/M12-06/M13-03 remain in-progress for actual n8n graphs/parity/recording ingestion; see TESTING and the current contract for limits.

2026-10-31 (America/Los_Angeles). Baseline: `3ff1685` on `origin/main`, including merged PR #122. Local `work` was fast-forwarded from `1651451`; main was not modified. Source inspection and local checks only; no live-system state was queried. This report does not certify deployment readiness.

## What is already implemented

The build plan's M12–M20 rows were all todo at baseline. Several prerequisites exist under earlier milestones; they must be reused rather than rebuilt. Existing code does not prove the new n8n flows are complete.

| Area / tasks affected | Source evidence | Audit result |
| --- | --- | --- |
| Intake/dedupe, M12-01, M13-01 | `crm/src/server/leads/{intake,payload,signature}.ts`, `tests/integration/lead-intake.test.ts` | Signed normalized intake, tenant-scoped dedupe, transactional contact/deal/consent creation exist. Raw source adapters not proven; acknowledgement means queued, not processed. |
| Service auth/events, M12-01/03 | `server/service-auth`, `server/integrations/n8n.ts`, `tests/integration/n8n-events-m7.test.ts` | Tenant bearer auth and signed lead/stage/call event delivery exist. Contact-decision and send-state routes do not. |
| Voice, M13-02/03 | `server/adapters/voice/{elevenlabs,retell,fake}.ts`, `server/calls/{provider,process}.ts`, `tests/unit/provider-mode.test.ts` | Both real adapters already exist; stub is supported. Map's “Retell is not built” is a target direction, not present repo state. No n8n-normalized result relay is implemented. |
| Booking, M13-05/06 | `server/appointments`, `app/api/appointments`, `server/automations/rules.ts` | Portal booking exists; Cal.com synchronization is unverified. Stage rule incorrectly used Booked rather than Estimate Booked. Fixed in this wave. |
| Safety, M12-04/06/07, M13-08 | `server/outbound/gate.ts`, `server/consent`, `server/messaging`, `server/admin/operations-tools.ts` | Portal consent/DNC/quiet hours/caps, kill switch and native STOP handling exist. n8n replacement, parity and relay tests do not. Preserve portal enforcement. |
| Sequences/upsells, M14 | `server/automations/{worker,after-hours,missed-call-textback,reactivation}.ts`, `server/outbound/sequences.ts` | Portal step execution and sends exist. “Sequences have no steps, nothing sends” in the map is stale as a repo-wide claim. Inactive n8n replacements and retirement remain unbuilt. |
| Metrics/reports, M15 | `server/metrics/daily.ts`, `server/reports/worker.ts`, `server/worker.ts` | Math and job handlers exist. No recurring daily metrics/monthly report schedule in worker; proposed n8n scheduling and weekly email remain unbuilt. |
| Backups, M18-01 | `server/worker.ts`, `server/admin/backups.ts` | backup.run is registered and scheduled for nightly encrypted DB backup and monthly scratch restore. It is not a Twenty summary export. No live run checked. |
| Disclosure, M19-03 | `server/calls/process.ts`, `server/compliance/state-rules.ts` | Transcript disclosure checks already exist (DC-116). Relay/report acceptance is still needed. Counsel review remains outstanding. |
| Admin, M12-05, M17-03, M19-05 | `server/admin`, `server/leads/intake.ts` | Onboarding, roles/invites and a secret-issuance helper exist. Webhook-secret admin screen and new-flow role verification remain. |
| Agency/new completeness, M16–M20 | Existing tenant CRM/import/billing/report services | Reusable primitives exist; agency dialer/campaign/proposal/payment/expense/support/referral flows are not established by this audit. All task-specific acceptance remains pending. |

Read `portal-n8n-contract.md` for each map row's owner, implemented endpoint or explicitly reserved target endpoint, transport differences, retry and idempotency rules. Map assertions about 22 inactive workflows or a live voice adapter are not verified here. Historical docs also describe an active outbound workflow: do not assume either is current.

## Next tasks by wave

This follows the Build order table, not milestone number order. Completion still requires each row's dependencies and acceptance. Local build authorization does not approve a locked-decision supersede or a live action.

| Wave | Tasks / intended build |
| --- | --- |
| 30 | M12-01 contract drafted; M13-06 stage fix + regression written; M18-05 retirement blocked (see below). |
| 31 | M12-02 record explicit supersede confirmation; M12-03 contact-decision log endpoint; M12-05 secret admin UI (code only, no real secret issuance); M13-02 reuse/verify existing ElevenLabs stub switch; M15-04 inactive error-alert workflow with fake email. |
| 32 | M12-04 send-state read; M12-06 shared may-I-contact workflow; M13-03 result relay; M15-05 fake SMS alert; M18-01 PII-free backup export. |
| 33 | M12-07 parity; M13-05 Cal sync; M13-08 STOP relay; M19-02 usage caps; M19-03 disclosure/report validation; M19-04 offboarding. |
| 34 | M12-08 owner safety gate; M14-02 reminders. |
| 35 | M13-01 fake lead chain; M14-03 no-show; M16-01 synthetic agency tenant. |
| 36 | M13-04 retries; M13-07 lead alerts; M16-02 sources; M16-05 agency stages; M20-06 support. |
| 37 | M13-09 fake-chain gate; M16-03 dialer; M16-04 campaigns; M17-01 proposal drafts; M20-01 source import; M20-02 manual outreach logging. |
| 38 | M13-10 old workflow replacement; M14-01 steps; M14-04 payments/timer; M15-01 metrics schedule; M16-06 never-dial guard; M17-02 prices; M17-03 won-deal onboarding; M18-03 deferred click-to-call; M19-01 ad spend; M19-05 role recheck; M20-03 contract tracking. |
| 39 | M14-06 reviews; M14-07 invoice adapters; M14-05 follow-up replacements; M15-02 weekly reports; M15-03 monthly trigger; M17-06 demo stub; M17-04 Stripe drafts (fake/test-only); M18-02 digest; M20-05 health alerts; M20-07 referrals. |
| 40 | M14-08 portal sender retirement only after parity/replacements and deletion approval; M17-05 payment/dunning. |
| 41 | M20-04 agency revenue/expenses. |
| 42 | M18-04 final documentation reconciliation. |

M12-01 requires owner review before dependent tasks are called ready. M12-02 and M12-08 retain their explicit confirmation gates. No real DC numbers assigned. The proposed supersedes have not been silently applied to SECURITY or DECISIONS. M10 launch leftovers remain outside this build wave.

## M18-05 retirement review

Deletion is blocked by M10-07's unresolved legacy API fate and the task's specific deletion approval. No portal files were deleted. Current referrers include `CLAUDE.md`, `KYNETIC_CONTEXT.md`, `portal/N8N.md`, `docs/map/processes/deploy-portal.md`, and map objects `portal-ingest-api`, `portal-deploy`, `portal-tenancy-rls` (plus other portal map cards). The server-side deploy path historically copies portal/ from main; deleting source alone does not retire the running app or its senders.

Before deletion: identify external ingest senders and the installed deploy consumer read-only; choose migrate-to-CRM or retire for `/api/ingest/results`; record the exact field mapping, data-retention/export decision and cutover/rollback plan in M10-07; obtain specific approval for deletion/live changes. Then update all referrers together and verify no code/workflow/tool consumer remains. External consumers have not been checked. An internal search alone cannot establish safe retirement.

## Verification in this session

Bun was absent from PATH. Commands ran from crm/ using temporary npm cache `/tmp/kynetic-npm-cache` and `npm exec --package=bun -- bun` (Bun 1.4.4); no repo dependency/lockfile change.

- `bun run typecheck`: passed.
- `bun run test`: 51 files, 392 tests passed; fake provider/unit coverage only.
- `bun run lint`: failed on existing untouched `src/components/kbar/index.tsx:80` (set-state-in-effect) and `src/app/admin/backups/page.tsx:26` (noninteractive tabindex), plus warnings. Neither error is in the wave's changes.
- `bun run format:check`: failed on 61 files, including the pre-existing unformatted integration file edited here. No repo-wide reformat performed.
- Focused `bun run test:integration -- tests/integration/m7-module-acceptance.test.ts`: setup failed because TEST_DATABASE_ADMIN_URL is unset; six tests skipped, including the new regression. No PostgreSQL client/server is installed. This is not a regression pass.
- CI, build, browser tests, n8n execution, live adapters, deployment, live isolation and backup/restore were not run.

M13-06 code is implemented but acceptance is not complete until its focused PostgreSQL regression passes. M12-01 is drafted, awaiting review. No new M12–M20 task is labeled acceptance-complete based only on source inspection. Next work is the focused database regression and contract review, then eligible wave 31 tasks. No push, merge to main, deploy, provider call, activation or real secret access occurred.
