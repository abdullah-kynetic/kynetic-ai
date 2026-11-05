#!/usr/bin/env bash
# Run on the Mac from this repository. SSH uses your normal config/agent or an env key.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
[ "$(git branch --show-current)" = dev/codex-setup ] || { echo 'Checkout dev/codex-setup first.' >&2; exit 1; }
# Local edits are left untouched; the upload below contains only committed HEAD files.
command -v ssh >/dev/null
# Production deploy users/keys are forced-command credentials, unsuitable for dev setup.
if [ -f "$HOME/.ssh/config" ]; then
  echo 'SSH aliases configured on this Mac:'
  awk 'tolower($1) == "host" {for (i=2;i<=NF;i++) if ($i !~ /[*?!]/) print "  " $i}' "$HOME/.ssh/config"
fi
host="${DEV_DEPLOY_SSH_HOST:-}"
user="${DEV_DEPLOY_SSH_USER:-}"
identity="${DEV_DEPLOY_SSH_IDENTITY_FILE:-}"
if [ -z "$host" ]; then
  read -r -p 'VPS SSH hostname or alias [40.160.150.91]: ' host
  host="${host:-40.160.150.91}"
fi
if [ -z "$user" ]; then
  read -r -p 'VPS admin SSH user [ubuntu] (- uses SSH config): ' user
  user="${user:-ubuntu}"
fi
[ "$user" != - ] || user=''
case "$user" in
  portalnew-deploy|deploy) echo 'This is a restricted production deploy account. Use your VPS admin login.' >&2; exit 1 ;;
esac
[[ "$host" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$ ]] || { echo 'Invalid SSH hostname.' >&2; exit 1; }
[[ "$user" =~ ^[a-zA-Z0-9_-]*$ ]] || { echo 'Invalid SSH user.' >&2; exit 1; }
if [ -z "$identity" ]; then
  read -r -p 'Existing SSH private key FILE path (blank uses SSH agent/config; never paste key contents): ' identity
fi
ssh_opts=(-o StrictHostKeyChecking=ask)
if [ -n "$identity" ]; then
  case "$identity" in '~/'*) identity="$HOME/${identity:2}" ;; esac
  [ -f "$identity" ] || { echo 'SSH key file not found.' >&2; exit 1; }
  ssh_opts+=(-i "$identity" -o IdentitiesOnly=yes)
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
