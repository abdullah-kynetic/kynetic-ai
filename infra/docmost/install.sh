#!/usr/bin/env bash
# Install Docmost (client portal) on the OVH VPS next to Twenty.
# Usage: sudo bash install.sh <domain>      e.g. sudo bash install.sh docs.kyneticai.com
# Safe to re-run: existing secrets in /opt/docmost/.env are kept.
set -euo pipefail

DOMAIN="${1:?usage: sudo bash install.sh <domain>}"
VPS_IP="40.160.150.91"
DOCMOST_VERSION="0.96.0"
DIR=/opt/docmost
CADDYFILE=/etc/caddy/Caddyfile
MIN_MEM_KB=$((2 * 1024 * 1024))   # 2 GB available with Twenty running
MIN_DISK_KB=$((15 * 1024 * 1024)) # 15 GB free on /

say() { printf '\n== %s\n' "$*"; }
die() { printf '\nSTOPPED: %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "run with sudo"

say "Checks"
mem=$(awk '/MemAvailable/{print $2}' /proc/meminfo)
disk=$(df -Pk / | awk 'NR==2{print $4}')
echo "RAM available: $((mem / 1024)) MB, disk free: $((disk / 1024 / 1024)) GB"
[ "$mem" -ge "$MIN_MEM_KB" ] || die "less than 2 GB RAM available. Twenty + Docmost would be too tight. Nothing was installed."
[ "$disk" -ge "$MIN_DISK_KB" ] || die "less than 15 GB disk free. Nothing was installed."
if ss -ltn | grep -q '127.0.0.1:3010 ' && ! docker ps --format '{{.Names}}' | grep -qx docmost; then
  die "port 3010 is already used by something else."
fi
systemctl is-active --quiet caddy || die "Caddy is not running as a systemd service."
[ -f "$CADDYFILE" ] || die "$CADDYFILE not found."
resolved=$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk 'NR==1{print $1}' || true)
[ "$resolved" = "$VPS_IP" ] || die "$DOMAIN resolves to '${resolved:-nothing}', not $VPS_IP. Fix the DNS A record first."

say "Files in $DIR"
install -d -m 750 "$DIR"
if [ ! -f "$DIR/.env" ]; then
  umask 077
  cat > "$DIR/.env" <<ENV
DOCMOST_VERSION=$DOCMOST_VERSION
APP_URL=https://$DOMAIN
APP_SECRET=$(openssl rand -hex 32)
DB_PASSWORD=$(openssl rand -hex 24)
ENV
  umask 022
  echo "created .env with new secrets"
else
  sed -i "s|^DOCMOST_VERSION=.*|DOCMOST_VERSION=$DOCMOST_VERSION|; s|^APP_URL=.*|APP_URL=https://$DOMAIN|" "$DIR/.env"
  echo "kept existing .env secrets"
fi
chmod 600 "$DIR/.env"

cat > "$DIR/docker-compose.yml" <<'YML'
# Docmost client portal. Own Postgres and Redis; nothing is shared with Twenty.
name: docmost
services:
  docmost:
    image: docmost/docmost:${DOCMOST_VERSION}
    container_name: docmost
    depends_on: [db, redis]
    environment:
      APP_URL: ${APP_URL}
      APP_SECRET: ${APP_SECRET}
      DATABASE_URL: postgresql://docmost:${DB_PASSWORD}@db:5432/docmost
      REDIS_URL: redis://redis:6379
    ports:
      - "127.0.0.1:3010:3000"   # Twenty owns 3000; only Caddy reaches Docmost
    volumes:
      - docmost:/app/data/storage
    mem_limit: 1536m
    restart: unless-stopped
  db:
    image: postgres:18
    container_name: docmost-db
    environment:
      POSTGRES_DB: docmost
      POSTGRES_USER: docmost
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - db_data:/var/lib/postgresql
    mem_limit: 768m
    restart: unless-stopped
  redis:
    image: redis:8
    container_name: docmost-redis
    command: ["redis-server", "--appendonly", "yes", "--maxmemory-policy", "noeviction"]
    volumes:
      - redis_data:/data
    mem_limit: 256m
    restart: unless-stopped
volumes:
  docmost:
  db_data:
  redis_data:
YML

cat > /etc/systemd/system/docmost.service <<'UNIT'
[Unit]
Description=Docmost client portal (docker compose in /opt/docmost)
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/docmost
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=300

[Install]
WantedBy=multi-user.target
UNIT

say "Start Docmost"
cd "$DIR"
docker compose pull || die "could not pull images (is docmost/docmost:$DOCMOST_VERSION a valid tag?)"
systemctl daemon-reload
systemctl enable --now docmost.service
for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3010/ || true)
  [ "$code" != "000" ] && [ "$code" -lt 500 ] && break
  sleep 5
done
[ "$code" != "000" ] && [ "$code" -lt 500 ] || { docker compose logs --tail 50 docmost; die "Docmost did not come up on 127.0.0.1:3010."; }
echo "Docmost answers locally (HTTP $code)"

say "Caddy"
if grep -qE "^[[:space:]]*$DOMAIN[[:space:]]*\{" "$CADDYFILE"; then
  echo "$DOMAIN already in $CADDYFILE, left as is"
else
  cp -a "$CADDYFILE" "$CADDYFILE.bak-$(date +%Y%m%d%H%M%S)"
  printf '\n%s {\n\treverse_proxy 127.0.0.1:3010\n}\n' "$DOMAIN" >> "$CADDYFILE"
  if ! caddy validate --config "$CADDYFILE" --adapter caddyfile >/dev/null 2>&1; then
    cp -a "$(ls -t "$CADDYFILE".bak-* | head -1)" "$CADDYFILE"
    die "Caddy rejected the new block; the old Caddyfile was restored. Twenty is untouched."
  fi
  systemctl reload caddy
fi
for i in $(seq 1 24); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "https://$DOMAIN/" || true)
  [ "$code" != "000" ] && [ "$code" -lt 500 ] && break
  sleep 5
done
echo "https://$DOMAIN answers with HTTP $code"
crm=$(curl -s -o /dev/null -w '%{http_code}' https://crm.kyneticai.com/ || true)
echo "Twenty (crm.kyneticai.com) still answers with HTTP $crm"

say "Nightly backup"
cat > /usr/local/sbin/docmost-backup.sh <<'BK'
#!/usr/bin/env bash
# Nightly Docmost backup: database dump + uploaded files, kept 14 days locally.
set -euo pipefail
OUT=/var/backups/docmost
STAMP=$(date +%Y%m%d-%H%M%S)
install -d -m 700 "$OUT"
docker exec docmost-db pg_dump -U docmost -Fc docmost > "$OUT/docmost-db-$STAMP.dump"
docker run --rm -v docmost_docmost:/data:ro -v "$OUT":/out alpine \
  tar czf "/out/docmost-files-$STAMP.tar.gz" -C /data .
find "$OUT" -type f -mtime +14 -delete
#OFFSITE#
BK
chmod 700 /usr/local/sbin/docmost-backup.sh
echo '20 2 * * * root /usr/local/sbin/docmost-backup.sh >> /var/log/docmost-backup.log 2>&1' > /etc/cron.d/docmost-backup
/usr/local/sbin/docmost-backup.sh
ls -lh /var/backups/docmost

say "Restore test (scratch database, deleted afterwards)"
latest=$(ls -t /var/backups/docmost/docmost-db-*.dump | head -1)
docker exec docmost-db psql -U docmost -d postgres -qc 'DROP DATABASE IF EXISTS restore_test' -c 'CREATE DATABASE restore_test'
docker exec -i docmost-db pg_restore -U docmost -d restore_test --no-owner < "$latest" || echo "(pg_restore reported warnings)"
tables=$(docker exec docmost-db psql -U docmost -d restore_test -tAc "select count(*) from information_schema.tables where table_schema='public'")
docker exec docmost-db psql -U docmost -d postgres -qc 'DROP DATABASE restore_test'
[ "${tables:-0}" -gt 0 ] || die "restore test failed: no tables restored."
echo "restore test OK: $tables tables restored from $(basename "$latest")"

say "Done"
docker stats --no-stream --format '{{.Name}}\t{{.MemUsage}}'
free -h | head -2
echo "Open https://$DOMAIN/ to create the admin account."
