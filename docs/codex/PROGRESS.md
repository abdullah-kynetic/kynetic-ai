# Codex progress (steps 0–6)

> Technical log only. Not the business roadmap and not an active checklist. Current direction is `docs/STATUS.md`. As of 2026-11-09 PST the portal code line is `main` and the separate DEV environment is retired until after go-live. `docs/codex/COMPLETION-PLAN.md` is historical evidence, not the plan. Do not tick the boxes below as the next business step.

Tick a step only when a task has explicitly resumed that historical check and `scripts/checks/run.sh <n>` has no FAIL. Note SKIPs.

Updated **2026-11-06**, America/Los_Angeles. The table below is a historical evidence index. It is not an active checklist. The operating order is `docs/STATUS.md`. Old steps 0–12 and milestones are historical evidence IDs.

| New step | Current status | Evidence limit / next verification |
| --- | --- | --- |
| 1 Baseline audit | PARTIAL | Documentation mapped; current code/evidence reconciliation remains |
| 2 Security/access | PARTIAL | Verified-session implementation and historical tests; real accounts/roles/2FA and current regression unverified |
| 3 Runtime/recovery | PARTIAL | DEV deployment output exists; latest UI, worker/TEST_PHONE readiness, restore/rollback and actual clocks unverified |
| 4 Lead intake/safety | PARTIAL | Local synthetic chain/gates and DEV denial output; signed deployed runtime not confirmed |
| 5 Agency sales workflow | PARTIAL | Agency leads/manual logging/campaigns exist; requested stages/Kanban, repeated attempts/callbacks incomplete or unverified |
| 6 Communications/booking | PARTIAL | Draft/stub workflows and provider foundations; real agency dispatch, booking tools and calendar reservation unverified/incomplete |
| 7 Metrics/reporting | PARTIAL | Local rates/schedules exist; manual/native reconciliation and stored agency report artifact gaps remain |
| 8 Contracts/billing/delivery | PARTIAL | Draft proposals/billing/ops and native client primitives; contract lifecycle, real Stripe and end-to-end delivery unverified/incomplete |
| 9 End-to-end acceptance | PARTIAL | Historical browser/synthetic tests cover a subset; full journeys/manual accessibility/live tests outstanding |
| 10 Production release | BLOCKED | Dependencies/readiness and explicit release approval outstanding |

## Recorded evidence — no app tests rerun in this documentation task

- Implementation/audit reference: `1eb4b8e`; prior status synchronization: `c290951`; remaining-work report/upload: `f5ce33b`.
- Last confirmed DEV revision: `c34b11aa359c933410bfec5522d9ced32cdc3e7e`, user-supplied Mac output in [vps-evidence.json](vps-evidence.json). Reports health/auth/unsigned rejection and gate blocking with provider requests 0, not full authenticated feature/runtime acceptance.
- Latest recorded local suite: 527 unit PASS; three Chromium journeys PASS; agency checks 13 PASS / 0 FAIL / two manual SKIP; build/typecheck/lint pass with warnings. These are historical scoped results, not newly observed or universal acceptance.
- [Full Codex history](PROGRESS-HISTORY.md): original bytes preserved after a navigation banner, including failures, approvals, handoffs, acceptance limits and test dates. Historical three-failure stops are not erased/reset by new numbering.
- [DEV provider readiness](dev-live-test-readiness.json), [resource inventory](dev-resources.json), [notification inventory](dev-notification-resources.json): original dated observations, not a current refresh. No newer evidence clears worker/TEST_PHONE blockers or proves booking tools.
- [Approved synthetic Twenty evidence](step3-twenty-evidence.json), [dry run](step3-twenty-dry-run.json), [write journal](step3-twenty-write-state.json): four prior approved operations only; no renewed write permission.
- [Historical November 6 report](REMAINING-WORK.md), [Twenty upload evidence](remaining-work-twenty-evidence.json): prior report and attachment preserved. No Twenty write/read/synchronization in this cleanup.
- [Agency test/screen guide](AGENCY-REVIEW.md), [testing history](../TESTING.md), [security review](../security-review-M10-01.md), [accessibility review](../a11y-review-M10-04.md): reuse scoped evidence, audit against current requirements.
- blocked-step3-booking.patch and blocked-step7.patch are historical artifacts, not instructions to reapply or proof of current failures.

## Current action boundary

This consolidation is documentation only: no implementation, app test run, external probe/test, deployment, messages, provider/CRM writes or workflow activation. Main, .github/, protected resources, source/scripts/migrations/fixtures/configuration/lockfiles and unrelated untracked portal/ remain untouched.

Next execution action is the baseline reconciliation specified in the active plan. VPS work still requires push, committed Mac script, stop and Abdullah's output. All live/external-action approvals and the same-check three-failure stop remain in force. New step numbers do not change scripts/checks/run.sh IDs.

## Documentation consolidation validation — 2026-11-06

- New active checklist: ten scoped steps in COMPLETION-PLAN.md, each with dependency/reuse, missing implementation versus missing verification, acceptance/evidence, environment/approval gates and honest status. Steps 1–9 PARTIAL; production BLOCKED. No requirement marked newly VERIFIED by editing docs.
- Traceability: all 188 historical BUILD_PLAN task rows, all 21 November 6 remaining-work sections, former Codex 0–12, all 31 automation-map IDs and every PRD Later/Skip row accounted for; additional old business-plan/audit/known-issue requirements and screenshot-derived text retained. Proposed 13–22 numbering was not located in the inspected repository; no invented history.
- Local documentation validation PASS: 91 local Markdown file links resolve; git diff --check clean; all changes are Markdown only; all commits have required author/committer and no coauthor trailers. Exact original PROGRESS.md bytes survive after the history banner. AGENTS hard rules/env map are unchanged. Historical document bodies are preserved; only navigation/status banners added, with the UI entry link updated.
- Small complete commits cover individual acceptance sections, traceability groups and document redirects. Commit series begins 64affef after f5ce33b; this validation record completes the consolidation. No force push, PR or main merge.
- No source, scripts, migrations, configuration, fixtures, tests, lockfiles, evidence JSON, .github/ or protected build changed. No file deleted. The unrelated untracked portal/ remains untouched. Historical plans are marked in place; only the full Codex progress log is additionally preserved in PROGRESS-HISTORY.md so PROGRESS.md can be concise.
- No implementation, app tests, external service/DEV probes, provider/CRM/Notion writes, deployment, activation, DNS, calls/messages/bookings/charges. The previous Twenty Markdown attachment remains unchanged; its original hash describes the uploaded pre-banner file, not a new synchronization.
- Unresolved conflicts: retry cadence, orchestration/consent ownership, historical fixed prices versus per-deal terms, stage migration, Twenty sync direction, legacy ingest/sender retirement and conflicting historical readiness claims. Safe current constraints and decision gates are explicit in the active plan; nothing is silently weakened.
- Next execution action only: reconcile current code/evidence for new step 1, then identify the smallest authorized security/runtime/safety increment. Implementation has not begun in this task.
