# Restore from backup

There are two kinds of backup. Know which one you hold.

| Kind | Where | Made by | Format |
|---|---|---|---|
| Pre-deploy and pre-seed dump | `/var/backups/portal-new-<label>-<time>.dump` on the VPS, mode 600 | `portal-new-deploy` | `pg_dump -Fc`, not encrypted |
| Nightly, manual and monthly restore-test backup | R2 object `backups/kynetic-crm/<date>/<kind>-<id>.dump.enc` | the worker (`backup.run`, 02:00 nightly, 03:00 on the 1st for the restore test) | `pg_dump -Fc`, AES-256-GCM encrypted with `BACKUP_ENCRYPTION_KEY` |

The worker keeps the newest 30 daily and 12 monthly objects. The portal's `/admin/backups` page lists every run with its status and whether the restore test passed.

**Known state (KI-034, 2026-11-12):** every worker backup so far failed (`pg_dump` 15 against Postgres 16) and the worker's `STORAGE_BUCKET` points at the test bucket. Until a fixed worker image is deployed and one manual backup shows `ok` with `restoreTestPassed`, the only real recovery points are the pre-deploy dumps. Check `/admin/backups` before relying on R2.

## The rule

Never restore into the live database to "see what happens". Restore into a scratch database first, check it, and only then decide. A restore over the live database discards everything written after the dump and needs Abdullah's yes naming the file, the dump time and the data that will be lost.

## 1. Get a plain dump file

Pre-deploy dump: already plain. Copy the path.

R2 backup: download the object (Cloudflare dashboard or a tool Abdullah approves), then decrypt it with the key from `/opt/portal-new/runtime.env`. Do not print the key.

```sh
cd crm
BACKUP_ENCRYPTION_KEY="$(…read from the env file, not typed into history…)" \
  bun scripts/decrypt-backup.ts <downloaded>.dump.enc <out>.dump
```

The script refuses a wrong key or a damaged file (authenticated encryption) and never prints the key.

## 2. Restore into a scratch database

On the VPS, using the running Postgres container. Choose a name that cannot be mistaken for production.

```sh
docker cp <out>.dump portal-new-postgres-1:/tmp/restore.dump
docker exec portal-new-postgres-1 sh -c 'createdb -U "$POSTGRES_USER" --template template0 restore_scratch'
docker exec portal-new-postgres-1 sh -c 'pg_restore -U "$POSTGRES_USER" --exit-on-error --no-owner --no-privileges -d restore_scratch /tmp/restore.dump'
```

## 3. Check it

Same checks the worker's restore test makes (`crm/src/server/admin/backups.ts`):

- `select count(*) from information_schema.tables where table_schema='public'` is at least 20.
- `contacts`, `deals`, `consents` and `tenant_documents` all exist.
- Row counts for `tenants`, `contacts`, `calls` look like the live system on the day of the dump.
- Tenant isolation holds: as the app role, with `app.tenant_id` set to client A, a contact of client B returns 0 rows.

## 4. Clean up

```sh
docker exec portal-new-postgres-1 sh -c 'dropdb -U "$POSTGRES_USER" --if-exists restore_scratch; rm -f /tmp/restore.dump'
```

Delete the plain `.dump` copy you made when you are done. It holds client data.

## Restoring over live (only with a yes)

1. Pause outbound in `/admin/operations`.
2. Take a fresh dump (see [rollback.md](rollback.md)).
3. Stop the app and worker only: `docker compose -p portal-new --env-file /opt/portal-new/runtime.env -f /opt/portal-new/compose.yml stop app worker`.
4. Restore into a new database, check it as above, then rename databases (`ALTER DATABASE … RENAME`) so the old one stays as a fallback. Do not drop it the same day.
5. Start the app and worker, check `/api/health`, and list what was lost (anything written between the dump and now) for the owners affected.
6. Record it in `docs/known-issues.md`.

## The drill (phase 4 check P4-4)

Run steps 1 to 4 once with the newest good backup, and write the date, the file used, the checks and the time taken at the bottom of this file. The drill needs Abdullah's yes because it touches the server.

| Date | Backup used | Result | Time taken |
|---|---|---|---|
| (not run yet) | | | |
