#!/usr/bin/env bash
# Local synthetic verification only. No deployment or provider API checks.
set -euo pipefail
cd "$(dirname "$0")/../.."
# Local synthetic checks only. Portal work branches off main. This script does not deploy.
command -v bun >/dev/null || { echo 'Install Bun before running agency checks.' >&2; exit 1; }
command -v psql >/dev/null || { echo 'Install the PostgreSQL client before running agency checks.' >&2; exit 1; }
python3 - <<'PY'
import os,sys,urllib.parse
u=urllib.parse.urlparse(os.environ.get('TEST_DATABASE_ADMIN_URL',''))
if u.scheme not in ('postgres','postgresql') or u.hostname not in ('127.0.0.1','localhost','::1') or u.path != '/postgres':
    sys.exit('Set TEST_DATABASE_ADMIN_URL to the postgres maintenance database on a disposable LOCAL PostgreSQL cluster. No remote database is accepted.')
PY
export PROVIDER_MODE=stub OUTBOUND_ENABLED=false ELEVENLABS_LIVE_ENABLED=false DEV_PERSONA_SWITCHING=false
for step in 7 8 9 10 11 12; do bash scripts/checks/run.sh "$step"; done
(
 cd crm
 bun run typecheck
 bun run lint
 bun run test
 bun run test:integration tests/integration/agency*.test.ts tests/integration/demo-client-e2e.test.ts
 SKIP_ENV_VALIDATION=1 bun run build
 if [[ "${AGENCY_BROWSER_CHECKS:-0}" == 1 ]]; then
  bun run test:e2e tests/e2e/agency-roadmap.spec.ts --workers=1
 fi
)
echo 'PASS agency local verification; live sends/Stripe/deployed DEV verification remain separate.'
