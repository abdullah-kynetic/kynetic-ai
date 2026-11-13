# Deploy

Merging to `main` is not a deploy. A deploy needs Abdullah's yes naming the commit.

## Before you start

1. `git fetch origin` and pick the exact 40-character commit on `main`. CI must be green on it.
2. Read the commit's migrations in `crm/drizzle/`. They run before the switch and cannot be undone.
3. Check the live state (read-only):

   ```sh
   ssh kynetic-vps "sudo /usr/local/sbin/portal-new-deploy status"
   ```

   It prints the running containers, `health=200` and the current commit and tag. If health is not 200 now, stop and fix that first (see [incident.md](incident.md)).
4. Get the yes. State the commit, the migrations it contains, and that a database dump is taken automatically first.

## Deploy

From a clean checkout of that commit on the Mac:

```sh
git archive <sha>:crm | ssh kynetic-vps "sudo /usr/local/sbin/portal-new-deploy deploy <sha>"
```

What the tool does, in order: refuses a second run (lock), saves and checks the tar (no links, no absolute or `..` paths), writes `/var/backups/portal-new-pre-deploy-<tag>-<time>.dump`, saves the current compose file for rollback, builds the app, worker and tools images, runs migrations as the owner role, switches only the app and worker, then waits up to about 90 seconds for `/api/health`. If health fails it puts the previous images back by itself and exits 1. Migrations are not reversed.

If a migration fails, the app and worker are untouched and the exit is 1. Read `/var/log/portal-new-deploy.log`.

## After it says `deploy ok`

1. `https://portal.kyneticai.com/api/health` returns 200 with `"status":"ok"`, `database: ok` and `worker: ok`. A stale worker shows `worker: stale` and a 503 (the worker beats every 30 seconds and counts as dead after 180).
2. `portal-new-deploy status` shows the new tag and commit.
3. Confirm the pre-deploy dump exists and is not empty: `ssh kynetic-vps "ls -l /var/backups | tail -3"`.
4. Sign in as staff (Google plus authenticator) and open `/admin/operations`. No new failed-job notice.
5. Record the deploy in `docs/progress.md` and `docs/STATUS.md` (commit, date, migrations).

If any check fails, follow [rollback.md](rollback.md).

## What a deploy never touches

Caddy, DNS, Twenty, n8n, secrets, the Postgres data directory beyond migrations. It never uses `--remove-orphans`. It does not change `PROVIDER_MODE` or `OUTBOUND_ENABLED`; those live in `/opt/portal-new/runtime.env` and changing them is its own yes.
