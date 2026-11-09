#!/usr/bin/env bash
# Compatibility alias. DEV deploys are retired; this exits with the same refusal as deploy-dev.sh.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
exec bash scripts/deploy-dev.sh
