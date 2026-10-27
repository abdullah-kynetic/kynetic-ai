#!/usr/bin/env bash
# Rehearsal of deploy, rollback and alerts against stub `docker`, `curl`, `df` and `openssl` (no Docker daemon
# or server needed, so it runs in CI). It proves the script logic; the real rehearsal on the VPS is a separate
# step in README "Go-live rehearsal". Usage: bash deploy/prod/tests/rehearse.sh
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROD="$(dirname "$HERE")"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
mkdir -p "$T/bin" "$T/app"
fails=0
ok() { echo "ok   - $1"; }
bad() { echo "FAIL - $1"; fails=$((fails + 1)); }
expect() { if eval "$2"; then ok "$1"; else bad "$1"; fi; }

# Stubs. Behaviour is steered by files in $T so each scenario can flip it.
cat >"$T/bin/docker" <<'STUB'
#!/usr/bin/env bash
echo "docker $*" >>"$STUB_LOG"
case "$*" in
  *"exec -T app node"*)  # health probe: healthy unless the live tag is in the sick list
    live="${IMAGE_TAG:-$(cat "$STUB_DIR/up" 2>/dev/null)}"
    [ "$(cat "$STUB_DIR/health" 2>/dev/null)" = down ] && exit 1
    grep -qx "$(cat "$STUB_DIR/up" 2>/dev/null)" "$STUB_DIR/sick" 2>/dev/null && exit 1; exit 0 ;;
  *"up -d"*) echo "$IMAGE_TAG" >"$STUB_DIR/up" ;;
  *"run --rm migrate"*) [ -f "$STUB_DIR/migrate_fails" ] && exit 1; exit 0 ;;
  *"pgboss.job"*|*"psql"*) cat >/dev/null; echo 0 ;;
  *"logs --since"*) : ;;
esac
exit 0
STUB
cat >"$T/bin/curl" <<'STUB'
#!/usr/bin/env bash
echo "curl $*" >>"$STUB_LOG"; exit 0
STUB
cat >"$T/bin/df" <<'STUB'
#!/usr/bin/env bash
printf 'Filesystem 1024-blocks Used Available Capacity Mounted\n/dev/x 100 %s 10 %s%% /\n' "${STUB_DISK:-40}" "${STUB_DISK:-40}"
STUB
cat >"$T/bin/openssl" <<'STUB'
#!/usr/bin/env bash
[ -f "$STUB_DIR/cert_expiring" ] && exit 1; exit 0
STUB
chmod +x "$T/bin/"*
export PATH="$T/bin:$PATH" STUB_DIR="$T" STUB_LOG="$T/calls.log"
export APP_DIR="$T/app" STATE_DIR="$T/app/state" HEALTH_TRIES=2 HEALTH_SLEEP=0 DEPLOY_LOG="$T/deploy.log"
: >"$T/app/.env"; : >"$T/app/compose.yml"; : >"$T/app/certs.pem"
: >"$STUB_LOG"

D="$PROD/deploy.sh"
reset() { : >"$STUB_LOG"; rm -f "$T"/{sick,migrate_fails,health}; }

echo "== deploy and rollback =="
bash "$D" deploy aaa111 >/dev/null 2>&1; expect "first deploy succeeds" "[ \"\$(cat $T/app/state/current)\" = aaa111 ]"
reset; bash "$D" deploy bbb222 >/dev/null 2>&1
expect "second deploy: current is new tag" "[ \"\$(cat $T/app/state/current)\" = bbb222 ]"
expect "second deploy: previous is old tag" "[ \"\$(cat $T/app/state/previous)\" = aaa111 ]"
expect "migration ran before the new containers started" "[ \$(grep -n 'run --rm migrate' $STUB_LOG | head -1 | cut -d: -f1) -lt \$(grep -n 'up -d' $STUB_LOG | head -1 | cut -d: -f1) ]"

reset; echo ccc333 >"$T/sick"; bash "$D" deploy ccc333 >/dev/null 2>&1; rc=$?
expect "unhealthy deploy exits non-zero" "[ $rc -ne 0 ]"
expect "unhealthy deploy: current unchanged" "[ \"\$(cat $T/app/state/current)\" = bbb222 ]"
expect "unhealthy deploy: previous tag brought back up" "[ \"\$(cat $T/up)\" = bbb222 ]"

reset; touch "$T/migrate_fails"; bash "$D" deploy ddd444 >/dev/null 2>&1; rc=$?
expect "failed migration exits non-zero" "[ $rc -ne 0 ]"
expect "failed migration starts nothing" "! grep -q 'up -d' $STUB_LOG"
expect "failed migration leaves current unchanged" "[ \"\$(cat $T/app/state/current)\" = bbb222 ]"

reset; bash "$D" rollback >/dev/null 2>&1
expect "rollback goes to the previous tag" "[ \"\$(cat $T/app/state/current)\" = aaa111 ]"
expect "rollback keeps the tag it left as previous" "[ \"\$(cat $T/app/state/previous)\" = bbb222 ]"

reset; bash "$D" deploy 'bad tag;rm -rf /' >/dev/null 2>&1; rc=$?
expect "malformed tag refused, nothing pulled" "[ $rc -ne 0 ] && ! grep -q 'docker pull' $STUB_LOG"
reset; bash "$D" deploy aaa111 >/dev/null 2>&1; rc=$?
expect "redeploying the live tag is refused" "[ $rc -ne 0 ]"

echo "== deploy-entry forced command =="
E="$PROD/deploy-entry.sh"
SSH_ORIGINAL_COMMAND='deploy aaa111; id' CRM_DEPLOY=/bin/true bash "$E" >/dev/null 2>&1; expect "entry refuses extra words" "[ $? -ne 0 ]"
SSH_ORIGINAL_COMMAND='bash' CRM_DEPLOY=/bin/true bash "$E" >/dev/null 2>&1; expect "entry refuses other commands" "[ $? -ne 0 ]"
SSH_ORIGINAL_COMMAND='rollback' CRM_DEPLOY=/bin/true bash "$E" >/dev/null 2>&1; expect "entry accepts rollback" "[ $? -eq 0 ]"

echo "== alerts =="
A="$PROD/monitor/alerts.sh"
export ALERT_STATE_DIR="$T/alerts" ALERT_ENV="$T/alerts.env" CERT_FILE="$T/app/certs.pem"
printf 'RESEND_API_KEY=re_test\nALERT_TO=ops@example.test\nALERT_FROM=alerts@mail.example.test\n' >"$ALERT_ENV"
reset; bash "$A" test >/dev/null 2>&1
expect "test alert goes to the Resend API" "grep -q 'curl .*api.resend.com/emails' $STUB_LOG && grep -q 'TEST alert' $STUB_LOG"

reset; bash "$A" run >/dev/null 2>&1
expect "healthy system sends nothing" "! grep -q api.resend.com $STUB_LOG"

reset; echo down >"$T/health"
bash "$A" run >/dev/null 2>&1
expect "one failed health check does not alert (needs 2)" "! grep -q api.resend.com $STUB_LOG"
bash "$A" run >/dev/null 2>&1
expect "second failed health check alerts" "grep -q 'ALERT: health' $STUB_LOG"
: >"$STUB_LOG"; bash "$A" run >/dev/null 2>&1
expect "a still-open alert is not resent" "! grep -q 'ALERT: health' $STUB_LOG"
rm -f "$T/health"; : >"$STUB_LOG"; bash "$A" run >/dev/null 2>&1
expect "recovery sends one email" "grep -q 'recovered: health' $STUB_LOG"

reset; STUB_DISK=85 bash "$A" run >/dev/null 2>&1
expect "disk above 80% alerts" "grep -q 'ALERT: disk' $STUB_LOG"
reset; touch "$T/cert_expiring"; bash "$A" run >/dev/null 2>&1
expect "certificate within 14 days alerts" "grep -q 'ALERT: certificate' $STUB_LOG"

echo
if [ "$fails" -eq 0 ]; then echo "all rehearsal checks passed"; else echo "$fails check(s) failed"; exit 1; fi
