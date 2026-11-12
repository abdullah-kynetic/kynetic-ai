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
