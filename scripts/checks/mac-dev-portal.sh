#!/usr/bin/env bash
# Run the identical dev-only 1.7 HTTP probe from the Mac. No deployment or server changes.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
exec python3 - <<'PY'
import os
import sys
sys.path.insert(0, 'scripts/checks')
from portal_check import check_dev_portal
try:
    passed, root, admin = check_dev_portal(os.environ.get('DEV_PORTAL_URL', 'https://dev.kyneticai.com'))
except ValueError as error:
    print('FAIL 1.7', error)
    sys.exit(1)
print(('PASS' if passed else 'FAIL') + f' 1.7 DEV-only Mac HTTP evidence: root {root}, /admin {admin}; no deployment performed')
sys.exit(0 if passed else 1)
PY
