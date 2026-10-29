#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
BOOTSTRAP="$ROOT/deploy/db/bootstrap-roles.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

cat >"$TMP/psql" <<'STUB'
#!/usr/bin/env bash
python3 - "$CAPTURE_FILE" "$@" <<'PY'
import json, sys
with open(sys.argv[1], "w", encoding="utf-8") as f:
    json.dump(sys.argv[2:], f)
PY
STUB
chmod +x "$TMP/psql"
export PSQL_BIN="$TMP/psql" CAPTURE_FILE="$TMP/args.json"
export EXPECTED_SQL="$ROOT/deploy/db/bootstrap.sql"
export DATABASE_URL_SUPERUSER='postgres://postgres:synthetic@127.0.0.1:55432/kynetic'
export OWNER_PW="owner-'quoted';\$-back\\slash@-space test"
export APP_PW="app-'quoted';\$-back\\slash@-space test"
export WORKER_PW="worker-'quoted';\$-back\\slash@-space test"
export AUTH_PW="auth-'quoted';\$-back\\slash@-space test"
export BACKUP_PW="backup-'quoted';\$-back\\slash@-space test"

bash "$BOOTSTRAP"
python3 - "$CAPTURE_FILE" <<'PY'
import json, os, sys
args = json.load(open(sys.argv[1], encoding="utf-8"))
expected = [
    os.environ["DATABASE_URL_SUPERUSER"], "-q",
    "-v", "owner_pw=" + os.environ["OWNER_PW"],
    "-v", "app_pw=" + os.environ["APP_PW"],
    "-v", "worker_pw=" + os.environ["WORKER_PW"],
    "-v", "auth_pw=" + os.environ["AUTH_PW"],
    "-v", "backup_pw=" + os.environ["BACKUP_PW"],
    "-f", os.environ["EXPECTED_SQL"]
]
assert args == expected, "psql arguments did not preserve the supplied values"
PY

rm -f "$CAPTURE_FILE"
if OWNER_PW='' bash "$BOOTSTRAP" 2>/dev/null; then
  echo 'expected empty password to fail' >&2
  exit 1
fi
test ! -e "$CAPTURE_FILE"

if grep -Eq '(^|[;&|[:space:]])sed[[:space:]]' "$BOOTSTRAP"; then
  echo 'bootstrap wrapper must not parse credentials with sed' >&2
  exit 1
fi
echo 'bootstrap role wrapper tests passed'
