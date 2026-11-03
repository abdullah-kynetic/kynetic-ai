#!/usr/bin/env bash
# Create the Kynetic database roles with psql variables; never extract passwords from URLs.
set -euo pipefail

required=(DATABASE_URL_SUPERUSER OWNER_PW APP_PW WORKER_PW AUTH_PW BACKUP_PW)
for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    echo "bootstrap refused: $name must be non-empty" >&2
    exit 2
  fi
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"${PSQL_BIN:-psql}" "$DATABASE_URL_SUPERUSER" -q \
  -v "owner_pw=$OWNER_PW" \
  -v "app_pw=$APP_PW" \
  -v "worker_pw=$WORKER_PW" \
  -v "auth_pw=$AUTH_PW" \
  -v "backup_pw=$BACKUP_PW" \
  -f "$SCRIPT_DIR/bootstrap.sql"
