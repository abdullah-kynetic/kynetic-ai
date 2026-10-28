# Production server setup (M10-05)

Runbook for the production Compose project on the OVH VPS. Source: `docs/ARCHITECTURE.md` "Server and deployment
setup", "Domain, DNS and email domain" and "Monitoring and alerting"; decision DC-084. Everything here is files and
scripts only. **Nothing has been run on the server**: each step below changes a live system and needs Abdullah's yes
first (AGENTS "Live systems and deploys").

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
5. **Database roles**: once, start `postgres` and run `../db/bootstrap.sql` as the superuser with owner, app, worker, auth and dedicated backup role passwords as psql variables, then `ALTER DATABASE ... OWNER TO kynetic_owner` (same as `../preview/compose.yml` `prepare`). Grant `CONNECT` and `SELECT` on all current and default future tables/sequences to `kynetic_backup`; never grant write, BYPASSRLS, or SUPERUSER. `DATABASE_URL_BACKUP` must use this role and `BACKUP_ENCRYPTION_KEY` is escrowed separately from bucket credentials.
6. **Deploy key**: add the CI/Abdullah SSH key to the deploy user with `command="/usr/local/sbin/crm-deploy-entry",restrict`. Install `deploy-entry.sh` there by hand (root-owned).
7. **Images**: Abdullah sets repository variable `IMAGE_PUSH_ENABLED=true`; merged `main` then publishes `ghcr.io/abdullah-kynetic/kynetic-crm/{app,worker,tools}:<commit>`. The server needs a read-only GHCR token (`docker login`).
8. **Alerts**: cron `* * * * * /opt/kynetic-crm/monitor/alerts.sh run`. Then `alerts.sh test` to prove the email path.
9. **Uptime**: in Uptime Kuma (SSH tunnel to `127.0.0.1:3001`) add an HTTPS monitor on `https://portal.kyneticai.com/api/health` every 60 s with email notification, and, as the external check, a free hosted monitor on the same URL.
10. **Sentry**: free-tier project with message bodies and PII scrubbed. Needs the DSN and an app change that M0 did not include (Sentry was removed with the starter), so it is not part of this task.

## Go-live rehearsal (acceptance: health green, alert test fires, deploy and rollback rehearsed)

On the server, with two real tags A and B: `deploy.sh deploy A`, confirm `https://portal.kyneticai.com/api/health` is 200, `alerts.sh test` arrives, `deploy.sh deploy B`, `deploy.sh rollback` (back to A), then deploy a tag whose app is deliberately unhealthy and confirm it returns to the last good tag. `tests/rehearse.sh` has already rehearsed this logic against stubs; the server run is still owed.

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
