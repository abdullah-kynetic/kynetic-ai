#!/usr/bin/env bash
# Alert checks (ARCHITECTURE "Monitoring and alerting"). Run every minute by cron or a systemd timer on the VPS:
#   alerts.sh run    evaluate every check, send one email per new problem (repeat every ALERT_REPEAT_MIN) and one on recovery
#   alerts.sh test   send a test alert through the real channel (proves the path works)
# Channel: email through Resend. Config comes from $ALERT_ENV (default /opt/kynetic-crm/alerts.env, mode 600,
# keys RESEND_API_KEY, ALERT_TO, ALERT_FROM). Message bodies and PII are never put in an alert.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/kynetic-crm}"
STATE_DIR="${ALERT_STATE_DIR:-$APP_DIR/state/alerts}"
ALERT_ENV="${ALERT_ENV:-$APP_DIR/alerts.env}"
ALERT_REPEAT_MIN="${ALERT_REPEAT_MIN:-360}"
CERT_FILE="${CERT_FILE:-$APP_DIR/certs/origin.pem}"
DISK_PATHS="${DISK_PATHS:-/}"
DISK_LIMIT="${DISK_LIMIT:-80}"
BACKUP_MAX_HOURS="${BACKUP_MAX_HOURS:-26}"
# Off until the first backup job exists (M8b); an empty backup_runs table would otherwise alert forever.
BACKUP_ALERT_ENABLED="${BACKUP_ALERT_ENABLED:-false}"
mkdir -p "$STATE_DIR"

compose() { docker compose -f "$APP_DIR/compose.yml" --env-file "$APP_DIR/.env" "$@"; }
now() { date +%s; }

# shellcheck disable=SC1090
[ -f "$ALERT_ENV" ] && . "$ALERT_ENV"

send() { # send <subject> <text>
  local subject="$1" text="$2"
  if [ "${ALERT_DRY_RUN:-0}" = 1 ]; then echo "ALERT: $subject - $text"; return 0; fi
  : "${RESEND_API_KEY:?missing RESEND_API_KEY in $ALERT_ENV}" "${ALERT_TO:?missing ALERT_TO}" "${ALERT_FROM:?missing ALERT_FROM}"
  curl -fsS https://api.resend.com/emails \
    -H "Authorization: Bearer $RESEND_API_KEY" -H 'Content-Type: application/json' \
    -d "$(printf '{"from":"%s","to":["%s"],"subject":"%s","text":"%s"}' "$ALERT_FROM" "$ALERT_TO" "$subject" "$text")" >/dev/null
}

psql_q() { compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atq' <<<"$1"; }

# state: <name>.fails = consecutive failing runs; <name>.sent = epoch of the last alert while open
report() { # report <name> <fail-needed> <ok|bad> <message>
  local name="$1" need="$2" status="$3" msg="$4" f="$STATE_DIR/$1.fails" s="$STATE_DIR/$1.sent" n last
  if [ "$status" = ok ]; then
    if [ -f "$s" ]; then send "[kynetic-crm] recovered: $name" "$name is back to normal."; rm -f "$s"; fi
    rm -f "$f"; return 0
  fi
  n=$(($(cat "$f" 2>/dev/null || echo 0) + 1)); echo "$n" >"$f"
  [ "$n" -ge "$need" ] || return 0
  last="$(cat "$s" 2>/dev/null || echo 0)"
  if [ $(($(now) - last)) -ge $((ALERT_REPEAT_MIN * 60)) ]; then
    send "[kynetic-crm] ALERT: $name" "$msg"; now >"$s"
  fi
}

check_health() {
  if compose exec -T app node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1
  then report health 2 ok ""; else report health 2 bad "/api/health failed 2 checks in a row (database or queue)."; fi
}

check_disk() {
  local p use bad=""
  for p in $DISK_PATHS; do
    use="$(df -P "$p" | awk 'NR==2{gsub("%","",$5); print $5}')"
    [ "${use:-0}" -le "$DISK_LIMIT" ] || bad="$bad $p=${use}%"
  done
  if [ -z "$bad" ]; then report disk 1 ok ""; else report disk 1 bad "Disk above ${DISK_LIMIT}%:$bad"; fi
}

check_cert() {
  if [ ! -f "$CERT_FILE" ]; then report certificate 1 bad "Origin certificate missing at $CERT_FILE."; return; fi
  if openssl x509 -checkend $((14 * 86400)) -noout -in "$CERT_FILE" >/dev/null
  then report certificate 1 ok ""; else report certificate 1 bad "Origin certificate expires within 14 days (or already has)."; fi
}

check_queue() {
  local age failed
  age="$(psql_q "select coalesce(extract(epoch from now()-min(created_on)),0)::int from pgboss.job where state in ('created','retry') and start_after <= now()")" || { report queue 1 bad "Could not query the job queue."; return; }
  report queue 1 ok ""
  if [ "${age:-0}" -gt 600 ]; then report queue-age 1 bad "Oldest queued job is ${age}s old (limit 600s)."; else report queue-age 1 ok ""; fi
  failed="$(psql_q "select count(*) from pgboss.job where state='failed' and completed_on > now() - interval '15 minutes'")" || return 0
  if [ "${failed:-0}" -gt 5 ]; then report failed-jobs 1 bad "$failed jobs failed in the last 15 minutes (limit 5)."; else report failed-jobs 1 ok ""; fi
}

check_backup() {
  [ "$BACKUP_ALERT_ENABLED" = true ] || return 0
  local h
  h="$(psql_q "select coalesce(extract(epoch from now()-max(finished_at))/3600,9999)::int from backup_runs where status='ok' and kind in ('nightly','manual')")" || { report backup 1 bad "Could not read backup_runs."; return; }
  if [ "${h:-9999}" -gt "$BACKUP_MAX_HOURS" ]; then report backup 1 bad "Newest good backup is ${h}h old (limit ${BACKUP_MAX_HOURS}h)."; else report backup 1 ok ""; fi
}

check_5xx() {
  local total bad
  total="$(compose logs --since 5m caddy 2>/dev/null | grep -c '"status":' || true)"
  bad="$(compose logs --since 5m caddy 2>/dev/null | grep -c '"status":5' || true)"
  if [ "${total:-0}" -ge 20 ] && [ $((bad * 100)) -gt $((total * 2)) ]
  then report errors-5xx 1 bad "5xx rate is $bad of $total requests in the last 5 minutes (limit 2%)."; else report errors-5xx 1 ok ""; fi
}

# Not wired yet, so they never claim to be green: webhook signature failures (needs the M4 webhook handlers to
# store rejects) and the Twilio / voice provider error spike (needs F-62 integration status). Tracked in the README.

case "${1:-}" in
  run)
    check_health; check_disk; check_cert; check_queue; check_backup; check_5xx
    ;;
  test)
    send "[kynetic-crm] TEST alert" "This is a test of the alert channel from $(hostname). No action needed."
    echo "test alert sent"
    ;;
  *) echo "usage: alerts.sh {run|test}" >&2; exit 2 ;;
esac
