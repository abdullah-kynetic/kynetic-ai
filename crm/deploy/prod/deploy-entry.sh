#!/usr/bin/env bash
# Forced command for the CI deploy key (authorized_keys: command="/usr/local/sbin/crm-deploy-entry",restrict).
# Accepts only "deploy <tag>", "rollback" or "status" and nothing else. Install by hand; never from a PR tree.
set -euo pipefail
read -r action tag extra <<<"${SSH_ORIGINAL_COMMAND:-}"
[ -z "${extra:-}" ] || { echo "bad request" >&2; exit 2; }
case "$action" in
  deploy) [[ "${tag:-}" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$ ]] || { echo "bad request" >&2; exit 2; }
          exec "${CRM_DEPLOY:-/opt/kynetic-crm/deploy.sh}" deploy "$tag" ;;
  rollback | status) exec "${CRM_DEPLOY:-/opt/kynetic-crm/deploy.sh}" "$action" ;;
  *) echo "bad request" >&2; exit 2 ;;
esac
