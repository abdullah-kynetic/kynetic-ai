# Phase 0: Safety net (about 2 days)

Goal: backups work and can be restored, and the portal can say what is running and whether its worker is alive.

Background: nightly backups have all failed because the worker image carries Postgres 15 tools against a Postgres 16 database (KI-034, from open PR #162). Storage points at `kynetic-portal-test`. `/api/health` hardcodes `queue: 'not_configured'` and does not report the deployed commit.

## Scope

- Land PR #162 (Postgres 16 client in the worker image, Twenty archive, source-of-truth docs). Review its diff first.
- Add `better-call` to `crm/package.json` as a direct dependency (`src/server/auth/email-otp.ts` imports it).
- `/api/health`: report the build commit and the worker's last heartbeat, and return 503 when the heartbeat is stale.
- Make the production worker's boot survive one missing provider (a missing ElevenLabs key must not stop backups and reports), while staying fail-closed for calls.

## Acceptance checks

| ID | Check | Proof |
|---|---|---|
| P0-1 | `better-call` is a direct dependency and the lockfile is current | `bun install --frozen-lockfile` passes in CI |
| P0-2 | Health reports the commit SHA | new test in `crm/tests/unit` for the health route |
| P0-3 | Health reports the worker heartbeat and returns 503 when it is older than the limit | new integration test |
| P0-4 | A missing provider key does not stop the worker's backup, report and digest jobs, and calls still refuse to run | new test around `src/server/worker.ts` boot |
| P0-5 | The worker image builds with `pg_dump` 16 | CI image build (`crm-image`); not verifiable locally with no Docker |
| P0-6 | A manual backup succeeds and restores into a scratch database | evidence from the server, after the yes below |

## Needs a yes (each its own change)

1. Deploy the new worker image.
2. Switch `STORAGE_BUCKET` from `kynetic-portal-test` to `kynetic-portal-files`.
3. Turn on the backup failure alert.
4. Run one manual backup and one restore test.

## Needs a decision

None.

## Not in this phase

Anything about Alex, n8n, Cal.com or AI.

## Steps

Work these in order. Tick each `- [ ]` as `- [x]` in the same commit that finishes the step. A new thread resumes at the first unticked step. For every step: finish it, test it, commit, push, then move on (see `PROTOCOL.md`). A STOP step waits for Abdullah's yes; do the steps after it that do not depend on it.

- [x] **P0-S1.** PR #162 was reviewed and merged by Abdullah on 2026-11-13 (merge commit b16e7259).
  - Test: CI green on the PR; `git log` shows the merge
  - Commit: "Merge PR #162"
  - Covers: (covers P0-5 image build via CI)
- [x] **P0-S2.** Add `better-call` as a direct dependency and refresh the lockfile.
  - Test: `bun install --frozen-lockfile`, then `bun run verify:quick`
  - Commit: "Add better-call as a direct dependency"
  - Covers: P0-1
- [ ] **P0-S3.** Health route reports the build commit SHA (read from a build-time env var, `unknown` when unset).
  - Test: Unit test for the route
  - Commit: "Report the build commit in /api/health"
  - Covers: P0-2
- [ ] **P0-S4.** Health route reads the worker heartbeat and returns 503 when it is older than the limit.
  - Test: Integration test: fresh heartbeat 200, stale 503, missing 503
  - Commit: "Report worker heartbeat in /api/health"
  - Covers: P0-3
- [ ] **P0-S5.** Worker boot survives one missing provider key for backup, report and digest jobs, and call jobs still refuse to run.
  - Test: Test around `src/server/worker.ts` boot with a key missing
  - Commit: "Keep worker jobs running when one provider is missing"
  - Covers: P0-4
- [ ] **P0-S6.** Run the full check and open the PR for phase 0 code.
  - Test: `bun run verify`; CI green incl. `crm-image` (pg_dump 16)
  - Commit: (PR, no commit)
  - Covers: P0-5
- [ ] **P0-S7.** Record in `docs/progress.md` and `docs/known-issues.md` (KI-034 status).
  - Test: Read the diff
  - Commit: "Record phase 0 in the build log"
  - Covers: -
- [ ] **P0-S8.** STOP for yes, each its own change: deploy the worker image; switch `STORAGE_BUCKET`; turn on the backup alert; run one backup and one restore test.
  - Test: Evidence from the server per step
  - Commit: (none; evidence goes in the report)
  - Covers: P0-6
