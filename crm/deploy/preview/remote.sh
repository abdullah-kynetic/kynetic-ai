#!/usr/bin/env bash
# Forced command for the preview deploy key (authorized_keys: command="/path/remote.sh",restrict).
# Accepts only "up <branch>" (crm/ tarball on stdin) or "down <branch>". Install this file on the
# server by hand; do not run it from a PR tree.
set -euo pipefail

STATE_DIR="${PREVIEW_STATE_DIR:-$HOME/.kynetic-previews}"
read -r action branch extra <<<"${SSH_ORIGINAL_COMMAND:-}"
[ -z "${extra:-}" ] && printf '%s' "${branch:-}" | grep -Eq '^[A-Za-z0-9._/-]{1,100}$' || {
  echo "bad request" >&2
  exit 2
}

# The slug logic lives in preview.sh; reuse the installed copy so the tree key is stable.
slug="$(bash "$(dirname "${BASH_SOURCE[0]}")/preview.sh" slug "$branch")"
tree="$STATE_DIR/src/$slug"

case "$action" in
  up)
    rm -rf "$tree" && mkdir -p "$tree"
    tar -xzf - -C "$tree"
    exec bash "$tree/deploy/preview/preview.sh" up "$branch"
    ;;
  down)
    if [ -d "$tree" ]; then
      bash "$tree/deploy/preview/preview.sh" down "$branch"
      rm -rf "$tree"
    else
      echo "no preview for $branch"
    fi
    ;;
  *)
    echo "bad request" >&2
    exit 2
    ;;
esac
