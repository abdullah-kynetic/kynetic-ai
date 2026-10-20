#!/bin/sh
# Runs DB migrations as the owner role, then starts the app WITHOUT the owner credentials
# in its environment (the runtime only ever talks to Postgres as portal_app).
set -eu
if [ "${SKIP_MIGRATIONS:-0}" != "1" ]; then
  if [ -z "${DATABASE_OWNER_URL:-}" ]; then
    echo "[entrypoint] DATABASE_OWNER_URL not set; refusing to start without migrations" >&2
    exit 1
  fi
  tries=0
  until node /app/scripts/migrate.mjs; do
    tries=$((tries + 1))
    if [ "$tries" -ge 10 ]; then echo "[entrypoint] migrations failed" >&2; exit 1; fi
    echo "[entrypoint] migrate failed (attempt $tries), retrying in 3s" >&2
    sleep 3
  done
fi
unset DATABASE_OWNER_URL POSTGRES_PASSWORD PORTAL_OWNER_PASSWORD PORTAL_APP_PASSWORD
exec "$@"
