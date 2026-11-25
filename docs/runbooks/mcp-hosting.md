# Host the MCP server (mcp.kyneticai.com)

Server: `mcp/http.ts` (web transport in `mcp/http-handler.ts`). It forwards each tool call to the portal's
`/api/service/*` routes. Needs the portal deployed with migration 1096 and `SERVICE_API_OWNER_EMAIL` set first.
Every step below is a live change and needs Abdullah's yes on that change.

## Credentials (two different secrets)

- `KYNETIC_MCP_ADMIN_KEY`: the `kad_...` key issued at `/admin/api-keys`. Stays in the server env file only.
  Lock it to the VPS public address when issuing it.
- `KYNETIC_MCP_ACCESS_TOKEN`: what a caller presents (`Authorization: Bearer ...`). 32+ characters, not the
  admin key. Generate with `openssl rand -hex 32`.
- `KYNETIC_MCP_ALLOW_PATH_TOKEN=1` (optional, default off): also accepts `https://mcp.kyneticai.com/mcp/<token>`
  for clients that cannot send headers. The token then sits in the URL, so keep the Caddy log off (snippet does).

## Steps

1. DNS (Cloudflare): `mcp` A record to the VPS address, proxied.
2. Create `/opt/mcp-server/mcp.env` (mode 600 root) from your own terminal: `bash mcp/deploy/write-env.sh`. It asks
   for the admin key (hidden) and writes the variables above plus `KYNETIC_PORTAL_URL=https://portal.kyneticai.com`
   over ssh. Run it as a script, not pasted lines: a pasted `read` swallows the next line.
3. Copy the code: `git archive <full sha>:mcp | ssh kynetic-vps "tar -x -C /opt/mcp-server/app"`; copy
   `mcp/deploy/compose.yml` to `/opt/mcp-server/compose.yml`.
4. `docker compose -f /opt/mcp-server/compose.yml up -d`.
5. Add `mcp/deploy/Caddyfile.snippet` to the VPS Caddyfile, validate, reload.
6. Check: `curl https://mcp.kyneticai.com/health` is 200; without the token `POST /mcp` is 401; with it,
   `tools/list` returns the tools.

## Lock or rotate the admin key

Allowed addresses are set only when a key is issued; an existing key cannot be edited. To lock the key to the VPS:

1. Issue a new key at `/admin/api-keys` with allowed addresses `40.160.150.91`.
2. `bash mcp/deploy/write-env.sh --key-only` replaces only the admin key in `mcp.env` and keeps the access token, so the
   connector address does not change.
3. `ssh kynetic-vps "sudo docker compose -f /opt/mcp-server/compose.yml up -d --force-recreate"` (the container reads the env file at start).
4. Re-run a platform call (for example `list_platform_clients`). If it returns 401, the portal did not see the VPS address:
   restore the old key (or issue one with no addresses) and investigate.
5. Revoke the old key only after step 4 works.

## Connect Claude

- Claude Code: `claude mcp add --transport http kynetic https://mcp.kyneticai.com/mcp --header "Authorization: Bearer <token>"`.
- Claude on the web or phone: custom connectors there cannot send a header. Use the path-token URL (enable the
  flag), or build OAuth (not built).

## Rollback

`docker compose -f /opt/mcp-server/compose.yml down`, remove the Caddy block, reload. The portal is unaffected.
