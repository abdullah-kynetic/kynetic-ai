#!/usr/bin/env bash
# DEV runtime configuration/start only. Reuses the deployed source; never runs a production helper.
set -euo pipefail
umask 077
[ "$(id -u)" = 0 ] || exit 1
upload="${1:?missing runtime upload}"
helper_revision="${2:?missing helper revision}"
[[ "$helper_revision" =~ ^[0-9a-f]{40}$ ]] || exit 1
[[ "$upload" =~ ^/tmp/kynetic-dev-runtime\.[a-zA-Z0-9]+$ ]] || exit 1
root=/opt/kynetic-dev-portal
state=/var/lib/kynetic-dev-portal
[ -d "$state" ] && [ -f "$state/dev.env" ] && [ ! -L "$state/dev.env" ] || exit 1
exec 9>"$state/deploy.lock"
flock -n 9 || { echo 'Another DEV operation is running.' >&2; exit 1; }
revision="$(cat "$state/deployed-revision")"
[[ "$revision" =~ ^[0-9a-f]{40}$ ]] || exit 1
release="$root/releases/$revision"
[ "$(readlink -f "$root/current")" = "$release" ] || { echo 'DEV release mismatch; no change made.' >&2; exit 1; }
[ -f "$release/crm/deploy/dev/compose.yml" ] || exit 1
docker_local() { env -u DOCKER_HOST -u DOCKER_CONTEXT -u DOCKER_TLS -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH docker --host=unix:///var/run/docker.sock "$@"; }
base=(compose --project-name kynetic-dev-portal --env-file "$state/dev.env" -f "$release/crm/deploy/dev/compose.yml")
app="$(docker_local "${base[@]}" ps -q app)"
[ -n "$app" ] && [ "$(docker_local inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$app")" = kynetic-dev-portal ] || exit 1
# The prompt is on the SSH TTY, not in command arguments or logs. No cloud phone fallback.
read -r -s -p 'TEST_PHONE (your own test number in E.164, input hidden): ' TEST_PHONE </dev/tty
printf '\n'
[[ "$TEST_PHONE" =~ ^\+[1-9][0-9]{7,14}$ ]] || { echo 'Invalid TEST_PHONE; no configuration changed.' >&2; exit 1; }
export TEST_PHONE
install -m 644 "$upload/crm/src/server/leads/dev-runtime-worker.ts" "$state/dev-runtime-worker.ts"
install -m 644 "$upload/crm/src/server/leads/dev-runtime-smoke.ts" "$state/dev-runtime-smoke.ts"
python3 "$upload/scripts/dev-runtime/config.py"
compose() { docker_local "${base[@]}" -f "$state/runtime-override.json" "$@"; }
log="$state/runtime-$revision.log"
run_private() { "$@" 2>&1 | python3 "$release/crm/deploy/dev/redact-log.py" "$state/dev.env" "$log"; }
trap 'echo "DEV runtime operation failed; private diagnostic log: $log. Do not paste secrets." >&2' ERR
# Build only the restricted tools targets from the existing release. App source/image is not rebuilt.
run_private compose --profile verify build worker runtime-smoke verify-step3
run_private compose --profile verify run --rm --no-deps verify-step3
echo 'PASS DEV_RUNTIME_DATABASE synthetic guard and rollback gate verification'
run_private compose up -d --no-deps --no-build --force-recreate --wait --wait-timeout 180 app worker
[ "$(curl -q -sS -o /dev/null -w '%{http_code}' --max-time 20 http://127.0.0.1:3031/api/health)" = 200 ]
[ "$(curl -q -sS -o /dev/null -w '%{http_code}' --max-time 20 http://127.0.0.1:3031/admin)" = 401 ]
echo 'PASS DEV_SYNTHETIC_WORKER healthy; sender adapters absent; outbound disabled'
run_private compose --profile verify run --rm --no-deps runtime-smoke
echo 'PASS DEV_SIGNED_RUNTIME intake accepted/duplicate; worker processed; kill switch deferred; calls/SMS 0; no live test authorized'
printf '%s\n' "$helper_revision" > "$state/runtime-helper-revision"
printf 'UNCHANGED_DEPLOYED_REVISION=%s\nRUNTIME_HELPER_REVISION=%s\n' "$revision" "$helper_revision"
echo 'Production services, live Alex, n8n activation and Twenty were not changed.'
