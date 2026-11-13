# Load the roadmap archive on the server

Fills the `archive_*` tables behind `/admin/archive` (phase 2, migration `1090_staff_archive`). Needs a yes from Abdullah. Safe to repeat: rows are keyed on the Twenty id, so a second run leaves the same counts.

## Why it is not `docker exec` in the app

The app image is `node:22-slim` standalone and has no `bun`. The importer is TypeScript and runs in the `tools` image (`kynetic-portal-tools:<tag>`), the same image `portal-new-deploy seed` uses. It has `bun`, `node_modules`, `src/` and `drizzle/`. It does not contain `docs/`, so the roadmap folder is mounted in.

## Deploy facts that matter

- `portal-new-deploy deploy <sha>` builds app, worker and tools, runs migrations, switches app and worker, health checks. It never runs the import.
- Migrations are forward-only. `rollback` restores the previous app and worker images, not the database. After a rollback, `1090_staff_archive` stays applied. The old app ignores the new tables, so this is harmless, and the next deploy skips an already applied migration.
- `deploy` refuses a commit whose `/opt/portal-new/src-<tag>` folder already exists. A deploy that succeeded and was then rolled back leaves that folder, so redeploy a new commit (a later `main` merge), not the same sha.
- An import failure must not trigger a rollback. The import is a separate step after the deploy and the health check, and the app is fine without archive rows (the pages show "No notes match").

## Steps (each is a server change; one yes covers the run)

1. Copy `docs/roadmap/` from the checked-out commit to the server, for example `/opt/portal-new/roadmap` (notes/, tasks.md, records.json, and attachments/ if the five files exist).
2. Run the importer as a one-off container on the portal network, with the database credentials from `runtime.env` (values are not printed):

```
docker run --rm --network portal-new_default --env-file /opt/portal-new/runtime.env \
  -v /opt/portal-new/roadmap:/roadmap:ro --entrypoint sh kynetic-portal-tools:<tag> -c \
  'cd /app && DATABASE_URL_SEED="postgres://$POSTGRES_USER:$POSTGRES_PASSWORD@postgres:5432/$POSTGRES_DB" bun src/server/archive/import-cli.ts /roadmap'
```

`<tag>` is the first 7 characters of the deployed commit. It prints one JSON line. Expected counts today: 120 notes, 63 tasks, 5 attachments, 5 records. The `POSTGRES_USER` connection bypasses row-level security, the same way `seed` does.
3. Check: `/admin/archive/notes` lists notes when signed in as staff; a client user gets 403.

## Attachments

The five attachment files are not in the repo. Until they are in `roadmap/attachments/` on the server and the importer runs again, the Attachments tab shows "File not copied in yet". Uploading them needs the storage settings in `runtime.env` (`STORAGE_BUCKET` is currently `kynetic-portal-test`, which should become `kynetic-portal-files` first, see KI-034 and STATUS).
