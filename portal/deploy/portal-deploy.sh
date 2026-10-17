#!/bin/bash
# Server-side portal deploy. Installed as /usr/local/sbin/portal-deploy (root-owned, 0755).
# Called through sudo by the forced SSH command of the `deploy` user (portal-deploy-entry), which is what the
# GitHub Action connects as. Reads KEY=VALUE lines on stdin: REF=<40-hex commit on main> plus optional allowed
# secrets (see ALLOWED_KEYS). Empty values are ignored, so a missing GitHub secret never wipes a server value.
# Steps: pull the commit -> sync into /opt/portal/src -> update .env -> build -> restart portal-app only ->
# health check -> roll back to the previous image and .env if it is not healthy.
set -euo pipefail
umask 077

APP=/opt/portal
REPO_DIR=$APP/repo
ENV_FILE=$APP/.env
KEY_DIR=/etc/portal-deploy
REPO_URL=git@github.com:abdullah-kynetic/kynetic-ai.git
LOG=/var/log/portal-deploy.log
BACKUP_DIR=/var/backups/portal/env
ALLOWED_KEYS="RESEND_API_KEY EMAIL_FROM R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BUCKET"
HEALTH_URL=http://127.0.0.1:3020/api/health

log() { echo "[portal-deploy] $*"; echo "$(date -Is) $*" >> "$LOG"; }
die() { log "ERROR: $*"; exit 1; }

exec 9>/var/lock/portal-deploy.lock
flock -n 9 || die "another deploy is running"

REF=""
declare -A NEWENV=()
if [ ! -t 0 ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    [ -z "$line" ] && continue
    key=${line%%=*}
    val=${line#*=}
    [ "$key" = "$line" ] && die "bad input line (no '=')"
    if [ "$key" = "REF" ]; then REF=$val; continue; fi
    case " $ALLOWED_KEYS " in *" $key "*) ;; *) die "key not allowed: $key" ;; esac
    [ -z "$val" ] && continue
    # No quotes, backslashes, $, backticks or control characters: this goes into a docker env_file.
    if [[ "$val" == *[\"\'\\\$\`]* ]] || [[ "$val" =~ [[:cntrl:]] ]]; then die "unsafe characters in $key"; fi
    NEWENV[$key]=$val
  done
fi

export GIT_SSH_COMMAND="ssh -i $KEY_DIR/github_deploy_key -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=$KEY_DIR/known_hosts"
if [ ! -d "$REPO_DIR/.git" ]; then
  log "first run: cloning repo"
  git clone -q --no-checkout "$REPO_URL" "$REPO_DIR"
fi
cd "$REPO_DIR"
if [ "${DEPLOY_ALLOW_ANY_REF:-0}" = "1" ]; then   # root-only escape hatch for tests; the deploy user cannot set it
  git fetch -q origin '+refs/heads/*:refs/remotes/origin/*'
else
  git fetch -q origin '+refs/heads/main:refs/remotes/origin/main'
fi
[ -z "$REF" ] && REF=$(git rev-parse origin/main)
[[ "$REF" =~ ^[0-9a-f]{40}$ ]] || die "REF must be a full 40-character commit hash"
git cat-file -e "$REF^{commit}" 2>/dev/null || die "commit $REF not found on GitHub"
if [ "${DEPLOY_ALLOW_ANY_REF:-0}" != "1" ]; then
  git merge-base --is-ancestor "$REF" origin/main || die "commit $REF is not on main"
fi
git checkout -q --force "$REF"
log "deploying ${REF:0:7}"

PREV_OK=0
if docker image inspect kynetic-portal:latest >/dev/null 2>&1; then
  docker tag kynetic-portal:latest kynetic-portal:previous
  PREV_OK=1
fi
mkdir -p "$BACKUP_DIR"
STAMP=$(date +%Y%m%d-%H%M%S)
cp -p "$ENV_FILE" "$BACKUP_DIR/env-predeploy-$STAMP.bak"
cp -p "$APP/docker-compose.yml" "$APP/docker-compose.yml.prev"

rsync -a --delete --chown=ubuntu:ubuntu "$REPO_DIR/portal/" "$APP/src/"
cp "$APP/src/deploy/docker-compose.yml" "$APP/docker-compose.yml"

if [ "${#NEWENV[@]}" -gt 0 ]; then
  TMP=$(mktemp)
  cp "$ENV_FILE" "$TMP"
  for key in "${!NEWENV[@]}"; do
    if grep -q "^$key=" "$TMP"; then
      grep -v "^$key=" "$TMP" > "$TMP.n"; mv "$TMP.n" "$TMP"
    fi
    printf '%s=%s\n' "$key" "${NEWENV[$key]}" >> "$TMP"
  done
  install -m 600 -o ubuntu -g ubuntu "$TMP" "$ENV_FILE"
  rm -f "$TMP"
  log "updated env keys: ${!NEWENV[*]}"
fi

healthy() {
  for _ in $(seq 1 40); do
    curl -fsS "$HEALTH_URL" >/dev/null 2>&1 && return 0
    sleep 3
  done
  return 1
}

cd "$APP"
if docker compose build portal-app </dev/null >/tmp/portal-build.log 2>&1 && docker compose up -d --no-deps portal-app </dev/null >/dev/null 2>&1 && healthy; then
  log "deploy OK ${REF:0:7}"
  docker image prune -f >/dev/null 2>&1 || true
  curl -fsS "$HEALTH_URL"; echo
  exit 0
fi

log "deploy FAILED ${REF:0:7}; last build/app log lines follow, then rolling back"
tail -n 15 /tmp/portal-build.log || true
docker logs --tail 15 portal-portal-app-1 2>&1 || true
install -m 600 -o ubuntu -g ubuntu "$BACKUP_DIR/env-predeploy-$STAMP.bak" "$ENV_FILE"
cp "$APP/docker-compose.yml.prev" "$APP/docker-compose.yml"
if [ "$PREV_OK" = "1" ]; then
  docker tag kynetic-portal:previous kynetic-portal:latest
  docker compose up -d --no-build --no-deps portal-app </dev/null >/dev/null 2>&1 || true
  if healthy; then die "deploy failed; rolled back to the previous version, which is healthy"; fi
fi
die "deploy failed AND the rollback is not healthy: check 'sudo docker logs portal-portal-app-1'"
