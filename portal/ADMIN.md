# Admin guide

All commands that touch the server run as `ubuntu@40.160.150.91`. The stack lives in `/opt/portal`; containers are `portal-portal-app-1` and `portal-portal-db-1`.

## Create an admin (first time, or a new admin)

```bash
ssh ubuntu@40.160.150.91
sudo docker exec portal-portal-app-1 node /app/scripts/create-admin.mjs someone@kyneticai.com "Name" /tmp/invite.txt
sudo docker exec portal-portal-app-1 cat /tmp/invite.txt; sudo docker exec portal-portal-app-1 rm /tmp/invite.txt
```

Open the printed link (valid 7 days), choose a password (12+ characters), sign in, and you'll be sent to `/mfa/setup` to scan the QR code with an authenticator app. Admin pages stay locked until MFA is enabled. Re-running the command for the same email issues a fresh invite (use it for a lost password). If you lose both the authenticator and the recovery codes, the last resort is a manual DB reset: set `totp_enabled=false, totp_secret_enc=null` for that user and delete their rows in `recovery_codes`.

## Add a client

Admin → **New client** → name, status, plan, included minutes (default 1,200). A kickoff → build → testing → go-live timeline is created automatically. Fill in the other tabs: **Profile**, **Contacts**, **Scope**, **Timeline**.

## How people get in (invite-only)

There is no sign-up page. An account exists only because an admin created it, and every route except sign-in, reset and invite requires a session. A stranger who types an email gets the same generic answer as a real user, so nothing leaks about who has access.

1. You invite someone (below). They get a one-time link valid for 7 days.
2. They open it, enter their name, and choose their own password (12+ characters; passwords found in known data breaches are refused). They are then signed in automatically (a new admin lands on the authenticator setup page first, then the recovery codes, then the admin area). Password resets are different: they always end at the sign-in page.
3. After that they sign in with email + password, an emailed sign-in link, or, once Google is switched on, "Continue with Google".
4. "Forgot password?" on the sign-in page emails a 30-minute reset link and signs out their other devices. They get an email whenever their password changes.

## Invite a client user

Client → **Users** → email (+ optional name) → **Send invite**. The row shows when the link expires. The invitee gets a link (valid 7 days) to set a password. Until `RESEND_API_KEY` is set, the email is only logged: run `sudo docker logs portal-portal-app-1 | grep -A3 "email:stub"` and send the link yourself. Per-user buttons on the Users tab:

| Button | What it does |
|---|---|
| Resend invite | Issues a fresh invite link (for users who haven't set a password yet) |
| Cancel invite | Deletes a pending user and kills the link (refused if they already have a password) |
| Send reset link | Emails a password-reset link to someone who already has a password. You never see or set their password |
| Change email | Moves their login to a new address, signs them out everywhere, and emails the old address |
| Disable / Enable | Blocks sign-in and ends their sessions immediately |
| Remove | Permanently deletes the user (documents they uploaded stay with the client) |

Every one of these is written to the activity log on the admin home page.

## Admin sign-in, recovery codes and Google

Admins sign in with password + a 6-digit authenticator code. Google sign-in is for **client** users only; admins stay on password + authenticator so MFA can't be skipped.

**Remember this device.** At the code step, tick "Remember this device for 30 days" to skip the authenticator code on that browser. The password is still required every time. The trust is revoked automatically if the password is changed or reset, or if the authenticator is re-enrolled. Recovery-code sign-ins never create it. Admin sessions still end after 12 hours, so you only re-enter the password.

**Recovery codes.** When you turn on two-factor you are shown 10 one-time recovery codes. Save them (password manager). If your authenticator is lost, type a recovery code into the "Authenticator or recovery code" box at sign-in instead of the 6 digits. Each works once. Using one emails you and is logged. Account page → **Recovery codes** shows how many are left and generates a new set (asks for your password; old codes stop working).

**Turning on Google sign-in (optional, free):**
1. console.cloud.google.com → create/select a project → **APIs & Services → OAuth consent screen**: choose External, app name "Kynetic Portal", your support email, no extra scopes (email/profile/openid only).
2. **APIs & Services → Credentials → Create credentials → OAuth client ID → Web application**. Add the authorized redirect URI `https://portal.kyneticai.com/api/auth/callback/google`.
3. Copy the Client ID and Client secret. On your Mac run `ssh -t ubuntu@40.160.150.91 /opt/portal/set-secrets.sh`, press Enter through the Resend/R2 prompts, and paste the two Google values at the Google prompts.
4. The "Continue with Google" button then appears on the sign-in page. It only lets in an invited client whose Google email is verified and matches an existing account. Anyone else sees "That Google account hasn't been invited". Nobody is ever auto-created.

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
