#!/bin/bash
# Run from the Mac, from the portal/ folder: ./deploy/deploy.sh   (SERVER=ubuntu@40.160.150.91 by default)
set -euo pipefail
SERVER=${SERVER:-ubuntu@40.160.150.91}
cd "$(dirname "$0")/.."
rsync -az --delete --exclude node_modules --exclude '.next*' --exclude .data --exclude '.env*' --exclude '*.log' --exclude tsconfig.tsbuildinfo ./ "$SERVER:/opt/portal/src/"
ssh "$SERVER" 'cp /opt/portal/src/deploy/docker-compose.yml /opt/portal/docker-compose.yml && cd /opt/portal && sudo docker compose build && sudo docker compose up -d'
for i in $(seq 1 40); do
  if ssh "$SERVER" 'curl -fsS http://127.0.0.1:3020/api/health' >/dev/null 2>&1; then echo "healthy"; exit 0; fi
  sleep 3
done
echo "portal did not become healthy" >&2; exit 1
