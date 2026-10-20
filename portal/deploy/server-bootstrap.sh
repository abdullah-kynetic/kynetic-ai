#!/bin/bash
# Idempotent. Run ON the server as a sudo-capable user: creates /opt/portal and a random-secret .env (chmod 600).
set -euo pipefail
D=/opt/portal
sudo mkdir -p $D/src $D/uploads
sudo chown -R "$USER":"$USER" $D
# Uploads are written by uid 1001 inside the container.
sudo chown 1001:1001 $D/uploads && sudo chmod 700 $D/uploads
if [ ! -f $D/.env ]; then
  umask 077
  rnd() { openssl rand -hex 24; }
  PG=$(rnd); OWN=$(rnd); APP=$(rnd)
  cat > $D/.env <<ENV
POSTGRES_PASSWORD=$PG
PORTAL_OWNER_PASSWORD=$OWN
PORTAL_APP_PASSWORD=$APP
DATABASE_URL=postgres://portal_app:$APP@portal-db:5432/portal
DATABASE_OWNER_URL=postgres://portal_owner:$OWN@portal-db:5432/portal
APP_URL=https://portal.kyneticai.com
AUTH_URL=https://portal.kyneticai.com
AUTH_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -base64 32)
FILE_SIGNING_SECRET=$(openssl rand -hex 32)
UPLOAD_DIR=/data/uploads
MAX_UPLOAD_MB=25
RESEND_API_KEY=
EMAIL_FROM=Kynetic AI <portal@kyneticai.com>
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
ENV
  chmod 600 $D/.env
  echo "[bootstrap] generated $D/.env (not displayed)"
else
  echo "[bootstrap] $D/.env already exists — left untouched"
fi
