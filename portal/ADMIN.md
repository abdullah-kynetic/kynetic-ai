# Admin guide

All commands that touch the server run as `ubuntu@40.160.150.91`. The stack lives in `/opt/portal`; containers are `portal-portal-app-1` and `portal-portal-db-1`.

## Create an admin (first time, or a new admin)

```bash
ssh ubuntu@40.160.150.91
sudo docker exec portal-portal-app-1 node /app/scripts/create-admin.mjs someone@kyneticai.com "Name" /tmp/invite.txt
sudo docker exec portal-portal-app-1 cat /tmp/invite.txt; sudo docker exec portal-portal-app-1 rm /tmp/invite.txt
```

Open the printed link (valid 7 days), choose a password (12+ characters), sign in, and you'll be sent to `/mfa/setup` to scan the QR code with an authenticator app. Admin pages stay locked until MFA is enabled. Re-running the command for the same email issues a fresh invite (use it for a lost password). A lost authenticator needs a manual DB reset: set `totp_enabled=false, totp_secret_enc=null` for that user.

## Add a client

Admin → **New client** → name, status, plan, included minutes (default 1,200). A kickoff → build → testing → go-live timeline is created automatically. Fill in the other tabs: **Profile**, **Contacts**, **Scope**, **Timeline**.

## Invite a client user

Client → **Users** → email (+ optional name) → **Send invite**. The invitee gets a link (valid 7 days) to set a password. Until `RESEND_API_KEY` is set, the email is only logged: run `sudo docker logs portal-portal-app-1 | grep -A3 "email:stub"` and send the link yourself. **Resend invite** reissues it. **Disable** signs the user out immediately.

## Upload a document

Client → **Documents** → drag a file in (PDF, images, Office docs, CSV, ZIP, up to 25 MB), optionally set a category. The client sees it under Documents as "Kynetic". Delete removes the file too.

## View results

Client → **Results** shows exactly what the client sees: speed-to-lead, leads, calls, bookings, minutes vs included, daily table. Data arrives from n8n (see [N8N.md](N8N.md)).

## Ingest API keys (generate, rotate, revoke)

Client → **Ingest keys** → **Generate key**. The full key (`kp_<prefix>_<secret>`) is shown **once**; paste it into n8n credentials. To rotate: generate a new key, update n8n, confirm **Last used** moves on the new key, then **Revoke** the old one. Only a SHA-256 hash is stored.

## Backups and restore

A nightly job (02:30 server time) writes `/var/backups/portal/db/*.dump` (pg_dump custom format) and `/var/backups/portal/uploads/*.tar.gz`, keeping 14 days (log: `/var/log/portal-backup.log`). Manual run: `sudo /usr/local/sbin/portal-backup.sh`. Restore a dump into the running DB (destructive, stop the app first):

```bash
cd /opt/portal && sudo docker compose stop portal-app
sudo docker exec -i portal-portal-db-1 pg_restore -U postgres -d portal --clean --if-exists < /var/backups/portal/db/portal-YYYYMMDD-HHMM.dump
sudo docker compose start portal-app
```

Uploads: `sudo tar -xzf /var/backups/portal/uploads/uploads-*.tar.gz -C /opt/portal` (then `sudo chown -R 1001:1001 /opt/portal/uploads`). Each run also copies `/opt/portal/.env` to `/var/backups/portal/env/` (the DB is unusable for admin MFA without `ENCRYPTION_KEY`). Backups are on the same server; copy them off-box (for example to R2) before relying on them for disaster recovery.

## Where secrets live

`/opt/portal/.env` (chmod 600, never in git) holds every secret. To set Resend or R2 keys, edit it and run `cd /opt/portal && sudo docker compose up -d portal-app`. Rotating `AUTH_SECRET` signs everyone out; do **not** change `ENCRYPTION_KEY` without re-enrolling admin MFA (it encrypts the TOTP secrets).

## Redeploy

From the Mac, in `portal/`: `./deploy/deploy.sh`. Migrations run automatically on container start. Run `npm test` first.

By the deploy bot (merged commits on `main` only, with tests, a health check and automatic rollback): see `deploy/BOT_DEPLOY.md`. Note that `deploy.sh` copies the local folder, while the bot path deploys exactly what is on `main`.
