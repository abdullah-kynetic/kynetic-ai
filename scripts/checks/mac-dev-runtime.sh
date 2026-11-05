#!/usr/bin/env bash
# Mac only: read DEV runtime metadata. Does not deploy, restart or enable anything.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
[ "$(git branch --show-current)" = dev/codex-setup ] || { echo 'Checkout dev/codex-setup first.' >&2; exit 1; }
host="${DEV_DEPLOY_SSH_HOST:-}"
user="${DEV_DEPLOY_SSH_USER:-}"
identity="${DEV_DEPLOY_SSH_IDENTITY_FILE:-}"
if [ -z "$host" ]; then read -r -p 'VPS SSH hostname or alias [40.160.150.91]: ' host; host="${host:-40.160.150.91}"; fi
if [ -z "$user" ]; then read -r -p 'VPS admin SSH user [ubuntu] (- uses SSH config): ' user; user="${user:-ubuntu}"; fi
[ "$user" != - ] || user=''
case "$user" in portalnew-deploy|deploy) echo 'Use your normal VPS admin SSH login.' >&2; exit 1 ;; esac
[[ "$host" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$ ]] && [[ "$user" =~ ^[a-zA-Z0-9_-]*$ ]] || exit 1
if [ -z "$identity" ]; then read -r -p 'Existing SSH private key FILE path (blank uses SSH agent/config): ' identity; fi
ssh_opts=(-o StrictHostKeyChecking=ask)
[ -z "$user" ] || ssh_opts+=(-l "$user")
if [ -n "$identity" ]; then
  case "$identity" in '~/'*) identity="$HOME/${identity:2}" ;; esac
  [ -f "$identity" ] || { echo 'SSH key file not found.' >&2; exit 1; }
  ssh_opts+=(-i "$identity" -o IdentitiesOnly=yes)
fi
remote_dir="$(ssh "${ssh_opts[@]}" "$host" 'umask 077; mktemp -d /tmp/kynetic-dev-readiness.XXXXXXXX')"
[[ "$remote_dir" =~ ^/tmp/kynetic-dev-readiness\.[a-zA-Z0-9]+$ ]] || exit 1
# Only this committed, credential-free diagnostic is uploaded; dev.env stays on the VPS.
git show HEAD:scripts/checks/dev-runtime-server.py | ssh "${ssh_opts[@]}" "$host" "umask 077; cat > '$remote_dir/check.py'"
ssh -t "${ssh_opts[@]}" "$host" "sudo python3 '$remote_dir/check.py'"
