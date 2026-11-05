#!/usr/bin/env bash
# Usage: scripts/checks/run.sh <step 0-6|all>
set -euo pipefail
cd "$(dirname "$0")/../.."
exec python3 scripts/checks/checks.py "${@:-all}"
