#!/usr/bin/env bash
# Compatibility alias. The single final DEV deploy script now includes gate and HTTP verification.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
exec bash scripts/deploy-dev.sh
