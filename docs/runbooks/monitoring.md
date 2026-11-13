# Monitoring and alerts

Rules live in `crm/src/server/monitoring/rules.ts` (one function, `evaluateRules`, one unit test per rule). They run in two places that share one notice per rule per six hours, so running both never double-sends:

1. The worker, every five minutes (`monitor.check`). Covers everything except a dead worker.
2. The host check `portal-monitor` (cron, every five minutes), which runs the same code from the tools image **outside** the worker. This is the one that catches a dead worker.

## The rules

| Rule | Fires when | First thing to do |
|---|---|---|
| `worker_heartbeat` | No worker heartbeat row, or the last beat is older than 180 seconds (the worker beats every 30) | `ssh kynetic-vps "docker ps"` and the worker's logs. Restart only the worker with Abdullah's yes: `docker compose -p portal-new --env-file /opt/portal-new/runtime.env -f /opt/portal-new/compose.yml up -d --no-deps worker`. `/api/health` is also 503 while it is down. |
| `failed_jobs` | More than 5 jobs ended `failed` in 15 minutes | `/admin/operations` shows the failed-job notices; the worker log names the queue (never the payload). |
| `queue_age` | The oldest job that is ready to run is more than 600 seconds old | Usually a dead or stuck worker. Check `worker_heartbeat` first. |
| `backup_failed` | The newest finished nightly or manual backup failed and no good one finished since | `/admin/backups` and the `error` on the run. KI-034 is the known cause today (pg_dump version, wrong bucket). |
| `backup_stale` | No good backup in 26 hours, or none ever | Same as above. This fires immediately on a system that has never completed a backup, which is true until KI-034 is fixed. That is accurate, not a false alarm. |
| `disk` | The data disk is more than 80% full | Find what grew (`docker system df`, `/var/backups`). Old pre-deploy dumps in `/var/backups` are the usual cause; deleting them is a yes. |

Health (`/api/health` not 200) is not in this list on purpose: if the database is down, nothing can record a notice. Use an external HTTPS monitor on `https://portal.kyneticai.com/api/health` (Uptime Kuma or a free hosted one; `crm/deploy/prod/README.md` step 9).

## Where an alert shows up

- An in-app notice on `/admin/operations`, titled `Alert: <what>`. Always on.
- An email to the staff admins when `ADMIN_ALERT_EMAIL_ENABLED=true` in `/opt/portal-new/runtime.env`. Off by default; turning it on needs real email configured and is a yes.
- The host check prints `ALERT <rule> (new|already sent): <detail>` and exits 1, so its cron log shows every run.

No alert contains a message body, a phone number, an email address or a secret: only counts, ages and percentages.

## Turning it on (needs Abdullah's yes: server change)

1. Deploy a commit that contains migration `1060_ops_alert_kind` ([deploy.md](deploy.md)). From then on the worker runs the check by itself and notices appear.
2. Install the host check: copy `crm/deploy/portal-new/monitor/portal-monitor` to `/usr/local/sbin/portal-monitor` (mode 0755) and add the cron line shown in the script header. Run it once by hand and read the output.
3. Choose the email destination and turn on `ADMIN_ALERT_EMAIL_ENABLED`. The destination is every staff admin address in the portal; nothing else is configurable.
4. **Proof for phase check P4-5, three alerts reach Abdullah:**
   - Dead worker: with a yes, stop the worker for 4 minutes (`docker compose … stop worker`), run `portal-monitor`, confirm the notice (and email), start the worker, confirm `/api/health` returns 200.
   - Failed backup: `/admin/backups` lists a failed run, and the `backup_failed` notice exists. (Today KI-034 already produces this.)
   - Failed job: the existing failed-job notice (`Job failed: <queue>`), which the worker raises when a job exhausts its retries.

   Record the dates and what arrived below.

| Date | Alert | Where it arrived | Notes |
|---|---|---|---|
| (not run yet) | | | |

## Tuning

Thresholds are constants in `DEFAULT_THRESHOLDS` in `rules.ts` (180 s, 5 jobs, 600 s, 26 h, 80%). Change them in code with a test, not on the server.

## Older script

`crm/deploy/prod/monitor/alerts.sh` is the first-generation shell check for the unused `/opt/kynetic-crm` layout (Resend email, certificate and 5xx checks). It is not what the live stack uses. Do not run both against the live stack.
