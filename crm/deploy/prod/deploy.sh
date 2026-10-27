#!/usr/bin/env bash
# Production deploy and rollback (ARCHITECTURE "Deploy"; same restricted pattern as portal-deploy, D-022).
#   deploy.sh deploy <tag>   pull the tag, migrate as the owner role, start it, health check, roll back on failure
#   deploy.sh rollback       redeploy the previous tag
#   deploy.sh status         print current and previous tags
# <tag> is a commit-tagged image built by CI. Nothing is built here. Production deploys happen only after
# Abdullah's yes (AGENTS "Live systems and deploys"). Secrets stay in $APP_DIR/.env and are never printed.
set -euo pipefail
umask 077

APP_DIR="${APP_DIR:-/opt/kynetic-crm}"
STATE_DIR="${STATE_DIR:-$APP_DIR/state}"
export IMAGE_REPO="${IMAGE_REPO:-ghcr.io/abdullah-kynetic/kynetic-crm}"
HEALTH_TRIES="${HEALTH_TRIES:-30}"
HEALTH_SLEEP="${HEALTH_SLEEP:-5}"
LOG="${DEPLOY_LOG:-$APP_DIR/deploy.log}"

log() { echo "[crm-deploy] $*"; echo "$(date -Is) $*" >>"$LOG" 2>/dev/null || true; }
die() { log "ERROR: $*"; exit 1; }

compose() { docker compose -f "$APP_DIR/compose.yml" --env-file "$APP_DIR/.env" "$@"; }
valid_tag() { [[ "$1" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$ ]]; }
read_state() { [ -f "$STATE_DIR/$1" ] && cat "$STATE_DIR/$1" || true; }

healthy() {
  local i
  for ((i = 1; i <= HEALTH_TRIES; i++)); do
    if compose exec -T app node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
      return 0
    fi
    sleep "$HEALTH_SLEEP"
  done
  return 1
}

start_tag() {
  IMAGE_TAG="$1" compose up -d --remove-orphans app worker caddy kuma postgres
}

cmd="${1:-}"
tag="${2:-}"
mkdir -p "$STATE_DIR"

case "$cmd" in
  status)
    echo "current=$(read_state current) previous=$(read_state previous)"
    exit 0
    ;;
  deploy | rollback) ;;
  *) echo "usage: deploy.sh {deploy <tag>|rollback|status}" >&2; exit 2 ;;
esac

exec 9>"$STATE_DIR/deploy.lock"
flock -n 9 || die "another deploy is running"

current="$(read_state current)"
previous="$(read_state previous)"

if [ "$cmd" = rollback ]; then
  [ -n "$previous" ] || die "no previous tag recorded"
  tag="$previous"
fi
[ -n "$tag" ] && valid_tag "$tag" || die "bad tag"
[ "$tag" != "$current" ] || [ "$cmd" = rollback ] || die "tag $tag is already live"

log "$cmd: ${current:-none} -> $tag"

if [ "$cmd" = deploy ]; then
  for svc in app worker tools; do
    docker pull "$IMAGE_REPO/$svc:$tag" >/dev/null || die "cannot pull $svc:$tag"
  done
  # Additive migrations first: the previous image keeps working against the new schema.
  IMAGE_TAG="$tag" compose --profile tools run --rm migrate || die "migration failed; nothing was started"
fi

if start_tag "$tag" && healthy; then
  if [ "$cmd" = deploy ]; then
    [ -z "$current" ] || echo "$current" >"$STATE_DIR/previous"
    echo "$tag" >"$STATE_DIR/current"
  else
    echo "$current" >"$STATE_DIR/previous"
    echo "$tag" >"$STATE_DIR/current"
  fi
  log "healthy: $tag is live"
  exit 0
fi

log "health check failed for $tag"
if [ -n "$current" ] && [ "$tag" != "$current" ]; then
  log "rolling back to $current"
  start_tag "$current" && healthy && die "rolled back to $current after failed $cmd of $tag"
  die "rollback to $current also unhealthy; investigate on the server"
fi
die "$tag unhealthy and there is no earlier tag to return to"
