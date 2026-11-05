#!/usr/bin/env bash
# Read-only check 1.7, executed on the Mac because Codex cannot reach this host.
set -euo pipefail
portal='https://portal.kyneticai.com'
# Use no session cookies or authorization headers. Print only status codes, never page content.
root_status="$(curl -q --location --silent --show-error --output /dev/null --write-out '%{http_code}' --max-time 60 "$portal/")"
admin_status="$(curl -q --location --silent --show-error --output /dev/null --write-out '%{http_code}' --max-time 60 "$portal/admin")"
printf 'CHECK 1.7 root HTTP %s; unauthenticated /admin HTTP %s\n' "$root_status" "$admin_status"
if [[ "$root_status" =~ ^(200|302|307)$ ]] && [[ "$admin_status" =~ ^[2345][0-9][0-9]$ ]] && [ "$admin_status" != 200 ]; then
  echo 'PASS 1.7 real portal up; unauthenticated /admin does not return 200 (verified from Mac)'
else
  echo 'FAIL 1.7 real portal unavailable or unauthenticated /admin returns 200; no server changes made'
  exit 1
fi
