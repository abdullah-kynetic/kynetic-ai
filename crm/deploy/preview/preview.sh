#!/usr/bin/env bash
# Preview environments on the VPS (ARCHITECTURE "Preview environments"; M0-27).
#   preview.sh slug <branch>   print the DNS-safe slug for a branch
#   preview.sh up <branch>     create or update that branch's preview (max two alive)
#   preview.sh down <branch>   tear it down, volumes included
#   preview.sh list            list live previews
# Secrets are generated per preview and kept in a mode-600 file outside the repo; never printed.
set -euo pipefail

MAX_PREVIEWS="${MAX_PREVIEWS:-2}"
STATE_DIR="${PREVIEW_STATE_DIR:-$HOME/.kynetic-previews}"
PREVIEW_DOMAIN="${PREVIEW_DOMAIN:-preview.kyneticai.com}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

slugify() {
  # Lowercase, non-alphanumerics to '-', trim, cap at 40 chars plus an 6-char hash so long
  # or colliding branch names stay unique and DNS-safe.
  local raw="$1" base hash
  base="$(printf '%s' "$raw" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//' | cut -c1-40 | sed -E 's/-+$//')"
  hash="$(printf '%s' "$raw" | sha256sum | cut -c1-6)"
  printf '%s-%s' "${base:-branch}" "$hash"
}

project_of() { printf 'kynetic-preview-%s' "$(slugify "$1")"; }

live_projects() {
  docker ps --filter 'label=com.kynetic.preview=true' --format '{{.Label "com.docker.compose.project"}}' | sort -u
}

secret() { head -c 32 /dev/urandom | base64 | tr -d '/+=\n' | cut -c1-40; }

write_env() {
  local file="$1" slug="$2"
  umask 077
  cat >"$file" <<ENV
PREVIEW_SLUG=${slug}
APP_BASE_URL=https://${slug}.${PREVIEW_DOMAIN}
PG_SUPER_PW=$(secret)
OWNER_PW=$(secret)
APP_PW=$(secret)
WORKER_PW=$(secret)
BACKUP_PW=$(secret)
BETTER_AUTH_SECRET=$(secret)$(secret)
APP_ENCRYPTION_KEY=$(secret)$(secret)
BACKUP_ENCRYPTION_KEY=$(secret)$(secret)
ENV
}

cmd="${1:-}"
branch="${2:-}"
case "$cmd" in
  slug)
    slugify "$branch"
    echo
    ;;
  up)
    [ -n "$branch" ] || { echo "usage: preview.sh up <branch>" >&2; exit 2; }
    slug="$(slugify "$branch")"
    project="kynetic-preview-${slug}"
    if ! live_projects | grep -qx "$project"; then
      if [ "$(live_projects | grep -c .)" -ge "$MAX_PREVIEWS" ]; then
        echo "Refused: $MAX_PREVIEWS previews already alive. Tear one down first." >&2
        exit 3
      fi
    fi
    docker network inspect kynetic-preview-edge >/dev/null 2>&1 || docker network create kynetic-preview-edge >/dev/null
    mkdir -p "$STATE_DIR"
    env_file="$STATE_DIR/${slug}.env"
    [ -f "$env_file" ] || write_env "$env_file" "$slug"
    COMPOSE_PROJECT_NAME="$project" docker compose -f "$HERE/compose.yml" --env-file "$env_file" up -d --build --wait
    echo "preview up: https://${slug}.${PREVIEW_DOMAIN}"
    ;;
  down)
    [ -n "$branch" ] || { echo "usage: preview.sh down <branch>" >&2; exit 2; }
    slug="$(slugify "$branch")"
    env_file="$STATE_DIR/${slug}.env"
    if [ -f "$env_file" ]; then
      COMPOSE_PROJECT_NAME="kynetic-preview-${slug}" docker compose -f "$HERE/compose.yml" --env-file "$env_file" down -v --remove-orphans
      rm -f "$env_file"
    fi
    echo "preview down: ${slug}"
    ;;
  list)
    live_projects
    ;;
  *)
    echo "usage: preview.sh {slug|up|down|list} [branch]" >&2
    exit 2
    ;;
esac
