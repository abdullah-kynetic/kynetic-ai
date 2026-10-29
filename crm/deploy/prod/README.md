# Production server setup (M10-05)

Runbook for the production Compose project on the OVH VPS. Source: `docs/ARCHITECTURE.md` "Server and deployment
setup", "Domain, DNS and email domain" and "Monitoring and alerting"; decision DC-084. The approved portal replacement
has been run on the VPS as recorded below. Do not repeat live-system changes without approval (AGENTS "Live systems and
deploys").

## What is here

| File | Purpose |
| --- | --- |
| `compose.yml` | Project `kynetic-crm`: `postgres` (own host-path volume), `migrate` (one-shot), `app`, `worker`, `caddy`, `kuma` (uptime dashboard, loopback only). Images come from GHCR by commit tag. Docker log rotation 10 MB x 5. |
| `Caddyfile` | TLS from a Cloudflare Origin CA certificate, JSON access log, trusts Cloudflare ranges. |
| `deploy.sh` | `deploy <tag>`, `rollback`, `status`. Pulls, migrates as the owner role, starts, health checks, rolls back on failure. |
| `deploy-entry.sh` | SSH forced command that allows only those three verbs. |
| `host/host-setup.sh` | ufw, sshd (key only, no root), fail2ban, unattended security updates. |
| `host/update-cloudflare-ips.sh` | Opens 443 only to Cloudflare ranges and refreshes the Caddy trusted list. |
| `monitor/alerts.sh` | `run` (every minute) and `test`. Email through Resend. |
| `tests/rehearse.sh` | Rehearses deploy, failed health check, failed migration, rollback, forced command and alerts against stubs. Runs in CI. |
| `../../../.github/workflows/crm-image.yml` | Builds and pushes images to GHCR on main. Off until `IMAGE_PUSH_ENABLED=true`. |

## One-time setup (each step needs Abdullah's yes)

1. **DNS to Cloudflare** (pending question 9; GP-07). Move the `kyneticai.com` nameservers to Cloudflare after recreating the Squarespace records, so the site keeps working. Then add `portal` (proxied) pointing at the VPS.
2. **Host hardening**: copy `host/` to the server and run `host-setup.sh`, then `update-cloudflare-ips.sh`. Keep a second SSH session open. Add `update-cloudflare-ips.sh` to root's monthly cron.
3. **Layout**: create `/opt/kynetic-crm` owned by the deploy user and copy in `compose.yml`, `Caddyfile`, `deploy.sh`, `monitor/alerts.sh`. Create `.env` (mode 600) from `../env.example` plus `DATABASE_URL_WORKER`, `DATABASE_URL_MIGRATE` (owner role), `IMAGE_REPO`, `SITE_ADDRESS` (`portal.kyneticai.com`), `PGDATA_HOST_PATH`. Create `alerts.env` (mode 600) with `RESEND_API_KEY`, `ALERT_TO`, `ALERT_FROM`. Never commit either.
4. **Origin certificate**: create a Cloudflare Origin CA certificate for `portal.kyneticai.com`, save as `/opt/kynetic-crm/certs/origin.pem` and `origin.key` (mode 600). Set Cloudflare SSL mode to Full (strict).
5. **Database roles**: once, start `postgres`, set `DATABASE_URL_SUPERUSER`, `OWNER_PW`, `APP_PW`, `WORKER_PW`, `AUTH_PW` and `BACKUP_PW` in the server process environment, then run `../db/bootstrap-roles.sh`. It rejects missing/empty values before connecting and passes passwords as psql variables; SQL uses psql's quoted `:'var'` interpolation rather than shell/SQL concatenation. Then set the database owner to `kynetic_owner`. The bootstrap sets `kynetic_backup` to `NOSUPERUSER NOCREATEROLE BYPASSRLS CREATEDB`: BYPASSRLS is required for `pg_dump` against FORCE-RLS tables and CREATEDB is required for its isolated scratch restore. Neither is granted to app or worker. Migrations 0062 and 0063 grant database CONNECT, schema usage, and read-only SELECT on existing/future objects in `public` and `drizzle`; `setupJobs` covers pg-boss objects. Do not grant table writes. `DATABASE_URL_BACKUP` must use this role and `BACKUP_ENCRYPTION_KEY` is escrowed separately from bucket credentials.
6. **Deploy key**: add the CI/Abdullah SSH key to the deploy user with `command="/usr/local/sbin/crm-deploy-entry",restrict`. Install `deploy-entry.sh` there by hand (root-owned).
7. **Images**: Abdullah sets repository variable `IMAGE_PUSH_ENABLED=true`; merged `main` then publishes `ghcr.io/abdullah-kynetic/kynetic-crm/{app,worker,tools}:<commit>`. The server needs a read-only GHCR token (`docker login`).
8. **Alerts**: cron `* * * * * /opt/kynetic-crm/monitor/alerts.sh run`. Then `alerts.sh test` to prove the email path.
9. **Uptime**: in Uptime Kuma (SSH tunnel to `127.0.0.1:3001`) add an HTTPS monitor on `https://portal.kyneticai.com/api/health` every 60 s with email notification, and, as the external check, a free hosted monitor on the same URL.
10. **Sentry**: free-tier project with message bodies and PII scrubbed. Needs the DSN and an app change that M0 did not include (Sentry was removed with the starter), so it is not part of this task.

## Go-live rehearsal (acceptance: health green, alert test fires, deploy and rollback rehearsed)

On the server, with two real tags A and B: `deploy.sh deploy A`, confirm `https://portal.kyneticai.com/api/health` is 200, `alerts.sh test` arrives, `deploy.sh deploy B`, `deploy.sh rollback` (back to A), then deploy a tag whose app is deliberately unhealthy and confirm it returns to the last good tag. `tests/rehearse.sh` has already rehearsed this logic against stubs; the server run is still owed.

## Approved portal replacement and rollback (2026-10-29)

The approved stack is isolated at `/opt/portal-new`; it contains only `postgres`, `app`, and `worker`, and publishes the
app on `127.0.0.1:3021`. Host Caddy remains in place and only the `portal.kyneticai.com` route points to port 3021.
Twenty, n8n, and Kien containers were not changed. The old portal containers are stopped, not removed, and the
`portal_portal-db-data` volume is retained. The live portal and the three neighboring service health URLs returned 200.
The test stack uses only the `kynetic-portal-test` bucket, stub providers, and outbound disabled.

### Restore the legacy portal

The verified legacy files are in `/var/backups/portal-legacy-20261028T231704Z/`; the pre-cutover host Caddyfile is
`/var/backups/portal-caddy-swap-20261029T024426Z/Caddyfile` (root-owned, mode 0644 when installed). The normal rollback
uses the retained legacy database volume and does not restore or delete database files:

```sh
sudo docker start portal-portal-db-1 portal-portal-app-1
curl --fail --show-error http://127.0.0.1:3020/api/health
sudo install -o root -g root -m 0644 \
  /var/backups/portal-caddy-swap-20261029T024426Z/Caddyfile /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
sudo systemctl reload caddy
curl --fail --show-error https://portal.kyneticai.com/api/health
```

Only proceed with the Caddy restore after the legacy loopback health check passes. The backup includes the original
route to `127.0.0.1:3020`. Keep the old containers and volume until the replacement has passed its operational
acceptance period.

### Roll back the new app/worker image pair

The VPS image switch rehearsal built commit `15457d0`, started that app and worker, observed app health `ok`, a running
worker, and zero restarts, then restored the saved `4f104ff` compose and repeated those checks. This affects only the
portal-new app and worker; it does not change Postgres, Caddy, or other Compose projects. The saved compose is
`/opt/portal-new/compose.rollback-4f104ff.yml`:

```sh
sudo cp /opt/portal-new/compose.rollback-4f104ff.yml /opt/portal-new/compose.yml
sudo docker compose -p portal-new --env-file /opt/portal-new/runtime.env \
  -f /opt/portal-new/compose.yml up -d app worker
curl --fail --show-error http://127.0.0.1:3021/api/health
sudo docker inspect -f '{{.Name}} {{.Config.Image}} {{.State.Status}} {{.RestartCount}}' \
  portal-new-app-1 portal-new-worker-1
```

Never use `--remove-orphans`; do not include Caddy or Kuma in this Compose project. A synthetic encrypted R2 backup
was also downloaded, decrypted, restored into a scratch PostgreSQL database, checked for tenant RLS isolation, and
cleaned up. Its object and temporary database were removed. This restore drill does not validate recovery of client
data or use either production bucket.

The full M10-05 gate remains blocked: the approved scope excludes Resend and real email, so the production alert email
test has not been sent. DNS, real providers, pilot onboarding, and client-data import remain unapproved and untested.

## Alert coverage

| Alert (ARCHITECTURE) | Status |
| --- | --- |
| Health failing 2 checks in a row | `alerts.sh` |
| Oldest queued job older than 10 minutes | `alerts.sh` (reads `pgboss.job`) |
| More than 5 failed jobs in 15 minutes | `alerts.sh` |
| Newest backup older than 26 hours | `alerts.sh`, off until `BACKUP_ALERT_ENABLED=true` (first backup job is M8b; an empty `backup_runs` would alert forever) |
| Disk above 80% | `alerts.sh` |
| Certificate within 14 days of expiry | `alerts.sh` (origin certificate) |
| 5xx above 2% for 5 minutes | `alerts.sh` (Caddy access log, ignored under 20 requests) |
| More than 20 webhook signature failures in 10 minutes | **Not wired.** Rejected webhooks are not stored yet; wire it when M4 adds the handlers. |
| Twilio or voice provider error spike | **Not wired.** Needs F-62 integration status (M8). |

## Known limits

- `/api/health` still reports `queue: not_configured` (the route predates pg-boss); the queue alerts above read the database directly. Changing the route belongs to a shared-contract owner, so it is untouched here.
- Docker publishes container ports around ufw. Only 80, 443 and loopback 3001 are published, so this is acceptable; the Cloudflare-only rule for 443 is enforced by ufw only if you add the `DOCKER-USER` rule below, which this task has not tested:
  `iptables -I DOCKER-USER -p tcp --dport 443 ! -s <cloudflare range> -j DROP` (one per range, via the update script in a later change).
- Base images are tags, not digests.
