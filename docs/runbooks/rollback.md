# Rollback

A rollback puts the previous app and worker images back. It does not undo database migrations. If a migration caused the problem, a rollback may not be enough; see "When the database is the problem" below.

## When a deploy fails its health check

Nothing to do first. `portal-new-deploy deploy` rolls the app and worker back itself and logs `rolled back to <old>`. Verify:

```sh
ssh kynetic-vps "sudo /usr/local/sbin/portal-new-deploy status"
```

Expect the old tag and `health=200`. If the log says `rollback health check ALSO failed`, go to [incident.md](incident.md) now.

## When a deploy passed its health check but is wrong

Needs Abdullah's yes (it restarts the live app and worker).

```sh
ssh kynetic-vps "sudo /usr/local/sbin/portal-new-deploy rollback"
```

It copies the compose file saved just before the last deploy (`/opt/portal-new/compose.rollback-last.yml`) back into place, keeps the replaced one as `compose.before-rollback.yml`, and restarts only the app and worker. Then check `/api/health` returns 200 with `worker: ok`.

Only one step back is saved as `rollback-last`. Older tags are kept as `compose.rollback-<tag>.yml` in `/opt/portal-new`; to go further back, copy that file over `compose.yml` and run `docker compose -p portal-new --env-file runtime.env -f compose.yml up -d --no-deps app worker`. Never add `--remove-orphans`. Ask first.

## When the database is the problem

The new code may have run a migration the old code cannot read, or a bad migration changed data.

1. Stop sending anything: turn on the admin outbound pause in `/admin/operations` (it only adds a block; `OUTBOUND_ENABLED=false` already stops everything while it is false).
2. Do not run a restore on your own. Take a fresh dump first (the deploy tool does this on the next deploy; for now `docker exec portal-new-postgres-1 sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc'` to a file under `/var/backups`).
3. Follow [restore.md](restore.md). Restoring over the live database loses everything written since the dump, so it needs Abdullah's yes that names the dump file and the time it was taken.
4. A forward fix (a new migration and a deploy) is often safer than a restore. Say so when asking.

## Legacy portal

The pre-cutover portal containers and the `portal_portal-db-data` volume are kept. The steps to restore the old Caddy route are in `crm/deploy/prod/README.md` ("Restore the legacy portal"). That is a last resort and also needs a yes.
