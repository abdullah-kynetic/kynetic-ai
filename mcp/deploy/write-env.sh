#!/usr/bin/env bash
# Writes /opt/mcp-server/mcp.env on the VPS from your own terminal. Run it where `ssh kynetic-vps` works:
#   bash mcp/deploy/write-env.sh
# It asks for the admin key (hidden), makes the access token, and sends both over ssh into a root-only file.
# Nothing is printed except the file's mode, owner and size. Never paste the key anywhere else.
set -euo pipefail
HOST="${1:-kynetic-vps}"
read -rsp 'Admin key (kad_...): ' K
echo
if ! [[ "$K" =~ ^kad_[0-9a-f]{16}_[0-9a-f]{64}$ ]]; then
  echo 'That is not a valid admin key. Nothing was written.' >&2
  exit 1
fi
T="$(openssl rand -hex 32)"
printf 'KYNETIC_PORTAL_URL=https://portal.kyneticai.com\nKYNETIC_MCP_ADMIN_KEY=%s\nKYNETIC_MCP_ACCESS_TOKEN=%s\nKYNETIC_MCP_ALLOW_PATH_TOKEN=1\n' "$K" "$T" |
  ssh "$HOST" 'sudo install -d -m 700 /opt/mcp-server && sudo sh -c "umask 077; cat > /opt/mcp-server/mcp.env" && sudo stat -c "%a %U %s" /opt/mcp-server/mcp.env'
unset K T
