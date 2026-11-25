#!/usr/bin/env bash
# Writes /opt/mcp-server/mcp.env on the VPS from your own terminal. Run it where `ssh kynetic-vps` works:
#   bash mcp/deploy/write-env.sh              first time: writes all four variables, makes a new access token
#   bash mcp/deploy/write-env.sh --key-only   later: replaces ONLY the admin key and keeps the access token
# It asks for the admin key (hidden) and sends it over ssh into a root-only file. Nothing is printed except
# the file's mode, owner and size. Never paste the key anywhere else. --key-only keeps your connector address.
set -euo pipefail
MODE="${1:-}"
HOST="${2:-kynetic-vps}"
read -rsp 'Admin key (kad_...): ' K
echo
if ! [[ "$K" =~ ^kad_[0-9a-f]{16}_[0-9a-f]{64}$ ]]; then
  echo 'That is not a valid admin key. Nothing was written.' >&2
  exit 1
fi
if [[ "$MODE" == "--key-only" ]]; then
  # Replace only the admin key line; every other line (including the access token) stays as it is.
  printf '%s\n' "$K" |
    ssh "$HOST" 'sudo sh -c "umask 077; read -r NEWKEY; f=/opt/mcp-server/mcp.env; test -f \$f || { echo no mcp.env >&2; exit 1; }; grep -v \"^KYNETIC_MCP_ADMIN_KEY=\" \$f > \$f.new; printf \"KYNETIC_MCP_ADMIN_KEY=%s\n\" \"\$NEWKEY\" >> \$f.new; mv \$f.new \$f; stat -c \"%a %U %s\" \$f"'
else
  T="$(openssl rand -hex 32)"
  printf 'KYNETIC_PORTAL_URL=https://portal.kyneticai.com\nKYNETIC_MCP_ADMIN_KEY=%s\nKYNETIC_MCP_ACCESS_TOKEN=%s\nKYNETIC_MCP_ALLOW_PATH_TOKEN=1\n' "$K" "$T" |
    ssh "$HOST" 'sudo install -d -m 700 /opt/mcp-server && sudo sh -c "umask 077; cat > /opt/mcp-server/mcp.env" && sudo stat -c "%a %U %s" /opt/mcp-server/mcp.env'
  unset T
fi
unset K
