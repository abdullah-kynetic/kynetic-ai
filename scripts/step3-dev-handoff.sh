#!/usr/bin/env bash
# Run on the Mac. Deploy only the isolated dev stack, then verify its new signed intake route.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
bash scripts/deploy-dev.sh
# No signature or valid tenant: this must reject before parsing/storing a lead or queuing a call.
status="$(curl -q --silent --show-error --output /dev/null --write-out '%{http_code}' \
  --max-time 30 --request POST --header 'Content-Type: application/json' --data '{}' \
  https://dev.kyneticai.com/api/hooks/leads/dev/00000000-0000-4000-8000-000000000000)"
[ "$status" = 401 ] || { echo "FAIL DEV_INTAKE_UNSIGNED HTTP $status (expected 401)" >&2; exit 1; }
echo 'PASS DEV_INTAKE_UNSIGNED HTTP 401; unsigned intake rejected; no provider test performed'
