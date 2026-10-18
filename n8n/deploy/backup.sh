#!/bin/bash
# Nightly n8n backup. Installed as /usr/local/sbin/n8n-backup.sh (root, via /etc/cron.d/n8n-backup).
# One age-encrypted archive per run (database dump + n8n data + .env, which holds N8N_ENCRYPTION_KEY).
# Only the PUBLIC age key lives on the server; the private key is kept by Abdullah, so a stolen server or
# bucket cannot read the archive. If rclone remote "n8n-offsite" exists, the archive is copied off-server.
set -euo pipefail
umask 077
B=/var/backups/n8n
TS=$(date +%Y%m%d-%H%M)
RECIP=/opt/n8n/backup-recipient.txt
mkdir -p $B
T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT
docker exec n8n-n8n-db-1 pg_dump -U n8n -Fc n8n > $T/n8n.dump
cp /opt/n8n/.env $T/env
tar -czf $T/n8n-data.tar.gz -C /opt/n8n n8n-data
tar -cf - -C $T n8n.dump env n8n-data.tar.gz | age -R $RECIP -o $B/n8n-$TS.tar.age
find $B -type f -name 'n8n-*.tar.age' -mtime +14 -delete
if rclone listremotes 2>/dev/null | grep -q '^n8n-offsite:'; then
  rclone copy $B/n8n-$TS.tar.age n8n-offsite:n8n-backups/ --quiet
  echo "$(date -Is) offsite copy ok"
else
  echo "$(date -Is) WARNING: no n8n-offsite rclone remote, backup is on this server only"
fi
echo "$(date -Is) backup ok: n8n-$TS.tar.age ($(du -h $B/n8n-$TS.tar.age | cut -f1))"
