#!/bin/bash
# Nightly backup of the portal DB and uploads. Installed as /usr/local/sbin/portal-backup.sh (root, via /etc/cron.d/portal-backup).
set -euo pipefail
umask 077
B=/var/backups/portal
TS=$(date +%Y%m%d-%H%M)
mkdir -p $B/db $B/uploads
docker exec portal-portal-db-1 pg_dump -U postgres -Fc portal > $B/db/portal-$TS.dump
tar -czf $B/uploads/uploads-$TS.tar.gz -C /opt/portal uploads
find $B/db $B/uploads -type f -mtime +14 -delete
echo "$(date -Is) backup ok: portal-$TS.dump ($(du -h $B/db/portal-$TS.dump | cut -f1))"
