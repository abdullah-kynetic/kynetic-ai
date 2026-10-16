#!/usr/bin/env bash
# Replace Docmost with BookStack (client portal) on the OVH VPS, same domain.
# Usage: sudo bash install.sh <domain>      e.g. sudo bash install.sh docs.kyneticai.com
# Docmost is stopped and disabled but its data is kept. Safe to re-run.
set -euo pipefail

DOMAIN="${1:?usage: sudo bash install.sh <domain>}"
BOOKSTACK_TAG="v26.09.1-ls288"
MARIADB_TAG="11.4"
DIR=/opt/bookstack
PORT=3011
CADDYFILE=/etc/caddy/Caddyfile
ADMIN_EMAIL="abdullah@kyneticai.com"
ADMIN_NAME="Abdullah Ahmed"

say() { printf '\n== %s\n' "$*"; }
die() { printf '\nSTOPPED: %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "run with sudo"
systemctl is-active --quiet caddy || die "Caddy is not running."
grep -qE "^[[:space:]]*$DOMAIN[[:space:]]*\{" "$CADDYFILE" || die "$DOMAIN is not in $CADDYFILE."
if ss -ltn | grep -q "127.0.0.1:$PORT " && ! docker ps --format '{{.Names}}' | grep -qx bookstack; then
  die "port $PORT is already used by something else."
fi

say "Files in $DIR"
install -d -m 750 "$DIR"
if [ ! -f "$DIR/.env" ]; then
  umask 077
  cat > "$DIR/.env" <<ENV
BOOKSTACK_TAG=$BOOKSTACK_TAG
MARIADB_TAG=$MARIADB_TAG
APP_URL=https://$DOMAIN
APP_KEY=base64:$(openssl rand -base64 32)
DB_PASSWORD=$(openssl rand -hex 24)
DB_ROOT_PASSWORD=$(openssl rand -hex 24)
ENV
  umask 022
  echo "created .env with new secrets"
else
  sed -i "s|^BOOKSTACK_TAG=.*|BOOKSTACK_TAG=$BOOKSTACK_TAG|; s|^APP_URL=.*|APP_URL=https://$DOMAIN|" "$DIR/.env"
  echo "kept existing .env secrets"
fi
chmod 600 "$DIR/.env"

cat > "$DIR/docker-compose.yml" <<YML
# BookStack client portal. Own MariaDB; nothing is shared with Twenty.
name: bookstack
services:
  bookstack:
    image: lscr.io/linuxserver/bookstack:\${BOOKSTACK_TAG}
    container_name: bookstack
    depends_on:
      db:
        condition: service_healthy
    environment:
      PUID: "1000"
      PGID: "1000"
      TZ: America/Los_Angeles
      APP_URL: \${APP_URL}
      APP_KEY: \${APP_KEY}
      DB_HOST: db
      DB_PORT: "3306"
      DB_DATABASE: bookstack
      DB_USERNAME: bookstack
      DB_PASSWORD: \${DB_PASSWORD}
    ports:
      - "127.0.0.1:$PORT:80"
    volumes:
      - config:/config
    mem_limit: 768m
    restart: unless-stopped
  db:
    image: mariadb:\${MARIADB_TAG}
    container_name: bookstack-db
    environment:
      MARIADB_ROOT_PASSWORD: \${DB_ROOT_PASSWORD}
      MARIADB_DATABASE: bookstack
      MARIADB_USER: bookstack
      MARIADB_PASSWORD: \${DB_PASSWORD}
    healthcheck:
      test: ["CMD", "healthcheck.sh", "--connect", "--innodb_initialized"]
      interval: 10s
      timeout: 5s
      retries: 12
    volumes:
      - db_data:/var/lib/mysql
    mem_limit: 512m
    restart: unless-stopped
volumes:
  config:
  db_data:
YML

cat > /etc/systemd/system/bookstack.service <<'UNIT'
[Unit]
Description=BookStack client portal (docker compose in /opt/bookstack)
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/bookstack
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=300

[Install]
WantedBy=multi-user.target
UNIT

say "Start BookStack (not public yet)"
cd "$DIR"
docker compose pull || die "could not pull images."
systemctl daemon-reload
systemctl enable --now bookstack.service
code=000
for i in $(seq 1 72); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/login" || true)
  [ "$code" = "200" ] && break
  sleep 5
done
[ "$code" = "200" ] || { docker compose logs --tail 60 bookstack; die "BookStack did not come up on 127.0.0.1:$PORT."; }
echo "BookStack answers locally (HTTP $code)"

say "Secure the admin account before going public"
PWFILE="$DIR/admin-password.txt"
if [ ! -s "$PWFILE" ]; then
  out=$(docker exec bookstack php /app/www/artisan bookstack:create-admin --initial --generate-password \
        --email="$ADMIN_EMAIL" --name="$ADMIN_NAME" --no-interaction 2>&1) \
    || die "could not set the admin account: $out"
  umask 077; printf '%s\n' "$(printf '%s\n' "$out" | tail -1)" > "$PWFILE"; umask 022
  chmod 600 "$PWFILE"
  echo "admin is $ADMIN_EMAIL; password saved to $PWFILE (root only)"
else
  echo "admin already set; password file kept"
fi

say "Stop Docmost (data kept)"
if systemctl list-unit-files docmost.service >/dev/null 2>&1 && [ -f /opt/docmost/docker-compose.yml ]; then
  systemctl disable --now docmost.service 2>/dev/null || true
  (cd /opt/docmost && docker compose stop) || true
  rm -f /etc/cron.d/docmost-backup
  echo "Docmost stopped and disabled; its volumes and /var/backups/docmost are untouched"
else
  echo "Docmost not found, skipping"
fi

say "Point $DOMAIN at BookStack"
if grep -q "reverse_proxy 127.0.0.1:$PORT" "$CADDYFILE"; then
  echo "Caddy already points at port $PORT"
else
  cp -a "$CADDYFILE" "$CADDYFILE.bak-$(date +%Y%m%d%H%M%S)"
  sed -i "s|reverse_proxy 127.0.0.1:3010|reverse_proxy 127.0.0.1:$PORT|" "$CADDYFILE"
  if ! caddy validate --config "$CADDYFILE" --adapter caddyfile >/dev/null 2>&1; then
    cp -a "$(ls -t "$CADDYFILE".bak-* | head -1)" "$CADDYFILE"
    die "Caddy rejected the change; the old Caddyfile was restored."
  fi
  systemctl reload caddy
fi
code=000
for i in $(seq 1 24); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "https://$DOMAIN/login" || true)
  [ "$code" = "200" ] && break
  sleep 5
done
echo "https://$DOMAIN/login answers with HTTP $code"
echo "Twenty (crm.kyneticai.com) answers with HTTP $(curl -s -o /dev/null -w '%{http_code}' https://crm.kyneticai.com/ || true)"

say "Nightly backup"
cat > /usr/local/sbin/bookstack-backup.sh <<'BK'
#!/usr/bin/env bash
# Nightly BookStack backup: database dump + uploads/config, kept 14 days locally.
set -euo pipefail
OUT=/var/backups/bookstack
STAMP=$(date +%Y%m%d-%H%M%S)
install -d -m 700 "$OUT"
docker exec bookstack-db sh -c 'exec mariadb-dump -uroot -p"$MARIADB_ROOT_PASSWORD" --single-transaction bookstack' \
  | gzip > "$OUT/bookstack-db-$STAMP.sql.gz"
docker run --rm -v bookstack_config:/data:ro -v "$OUT":/out alpine \
  tar czf "/out/bookstack-files-$STAMP.tar.gz" -C /data .
find "$OUT" -type f -mtime +14 -delete
#OFFSITE#
BK
chmod 700 /usr/local/sbin/bookstack-backup.sh
echo '20 2 * * * root /usr/local/sbin/bookstack-backup.sh >> /var/log/bookstack-backup.log 2>&1' > /etc/cron.d/bookstack-backup
/usr/local/sbin/bookstack-backup.sh
ls -lh /var/backups/bookstack

say "Restore test (scratch database, deleted afterwards)"
latest=$(ls -t /var/backups/bookstack/bookstack-db-*.sql.gz | head -1)
sqlroot() { docker exec -i bookstack-db sh -c 'exec mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" "$@"' sh "$@"; }
sqlroot -e 'DROP DATABASE IF EXISTS restore_test; CREATE DATABASE restore_test'
gunzip -c "$latest" | sqlroot restore_test
tables=$(sqlroot -N -e "select count(*) from information_schema.tables where table_schema='restore_test'")
sqlroot -e 'DROP DATABASE restore_test'
[ "${tables:-0}" -gt 0 ] || die "restore test failed: no tables restored."
echo "restore test OK: $tables tables restored from $(basename "$latest")"

say "Done"
docker stats --no-stream --format '{{.Name}}\t{{.MemUsage}}'
free -h | head -2
echo "Log in at https://$DOMAIN as $ADMIN_EMAIL. Get the password with: sudo cat $PWFILE"
