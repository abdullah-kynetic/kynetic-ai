#!/usr/bin/env bash
# Run on the Mac from this repository. SSH uses your normal config/agent or an env key.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
[ "$(git branch --show-current)" = dev/codex-setup ] || { echo 'Checkout dev/codex-setup first.' >&2; exit 1; }
# Local edits are left untouched; the upload below contains only committed HEAD files.
command -v ssh >/dev/null
host="${PORTAL_DEPLOY_HOST:-}"
user="${PORTAL_DEPLOY_USER:-}"
[ -n "$host" ] || read -r -p 'VPS SSH hostname (or SSH config alias): ' host
[ -n "$user" ] || read -r -p 'VPS SSH user (blank uses SSH config): ' user
[[ "$host" =~ ^[a-zA-Z0-9_.:-]+$ ]] || { echo 'Invalid SSH hostname.' >&2; exit 1; }
[[ "$user" =~ ^[a-zA-Z0-9_-]*$ ]] || { echo 'Invalid SSH user.' >&2; exit 1; }
ssh_opts=(-o StrictHostKeyChecking=ask)
key_file=''
cleanup() { [ -z "$key_file" ] || rm -f "$key_file"; }
trap cleanup EXIT
if [ -n "${PORTAL_DEPLOY_SSH_KEY:-}" ]; then
  key_file="$(mktemp)"
  chmod 600 "$key_file"
  printf '%s\n' "$PORTAL_DEPLOY_SSH_KEY" > "$key_file"
  ssh_opts+=(-i "$key_file" -o IdentitiesOnly=yes)
fi
[ -z "$user" ] || ssh_opts+=(-l "$user")
revision="$(git rev-parse HEAD)"
# Only tracked branch files are sent; local .env files never leave the Mac.
remote_dir="$(ssh "${ssh_opts[@]}" "$host" 'umask 077; mktemp -d /tmp/kynetic-dev-upload.XXXXXXXX')"
[[ "$remote_dir" =~ ^/tmp/kynetic-dev-upload\.[a-zA-Z0-9]+$ ]] || { echo 'Unexpected remote staging path.' >&2; exit 1; }
git archive HEAD crm scripts/deploy-dev-server.sh | ssh "${ssh_opts[@]}" "$host" "tar -xf - -C '$remote_dir'"
# A TTY permits sudo authentication. No production deploy helper is used.
ssh -t "${ssh_opts[@]}" "$host" "sudo bash '$remote_dir/scripts/deploy-dev-server.sh' '$remote_dir' '$revision'"
# Wait for automatic HTTPS certificate issuance, then require the same final 200 as check 0.7.
curl --fail --silent --show-error --location --output /dev/null --max-time 30 \
  --retry 12 --retry-all-errors --retry-delay 5 https://dev.kyneticai.com/
code="$(curl --location --silent --show-error --output /dev/null --write-out '%{http_code}' --max-time 60 https://dev.kyneticai.com/)"
[ "$code" = 200 ] || { echo "FAIL 0.7 public HTTPS returned $code" >&2; exit 1; }
printf 'PASS 0.7 https://dev.kyneticai.com/ HTTP 200 (verified from Mac)\nDEPLOYED_REVISION=%s\n' "$revision"
