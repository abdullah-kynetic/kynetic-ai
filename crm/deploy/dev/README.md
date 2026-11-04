# Dedicated dev portal

From the Mac checkout on `dev/codex-setup`, run `bash scripts/deploy-dev.sh` after pulling.
The script uses `PORTAL_DEPLOY_HOST`, `PORTAL_DEPLOY_USER` and, if supplied,
`PORTAL_DEPLOY_SSH_KEY` from the environment. Without host/user it prompts for those
non-secret selectors and uses normal SSH configuration/agent keys. Never paste a key
into a command. The VPS account needs sudo; the SSH connection requests a terminal.

Uncommitted Mac edits are neither deployed nor changed. The tracked revision is streamed over SSH into a private staging directory. The server
script runs as root, stores immutable releases under `/opt/kynetic-dev-portal/releases/`,
and keeps generated credentials outside the repository in
`/var/lib/kynetic-dev-portal/dev.env` (mode 600). Repeated deployments retain credentials
and data. It never invokes a production deploy script or changes a production database.

Compose project `kynetic-dev-portal` has its own PostgreSQL 17 container, network, roles
and persistent named volume. It bootstraps, migrates, seeds synthetic tenants and runs
the existing synthetic-only guard before starting the app. Port 3031 binds only to
loopback; an unrelated listener causes refusal. App provider mode is `stub`, outbound
is false, ElevenLabs live mode is false, and no provider credentials are forwarded.
The worker is defined but deliberately not started for the setup check.

Requires existing Docker Compose v2, Python 3, curl, flock, and host systemd Caddy.
No packages, firewall rules, DNS records, Cloudflare settings or production containers
are changed. The server appends a managed `dev.kyneticai.com` block to the existing
host Caddyfile, retaining all existing text. Automatic HTTPS uses Caddy's normal
certificate issuance; DNS must point to this server and HTTPS/ACME must be reachable.
An existing unmanaged dev route, edited managed route, nonstandard Caddy installation,
or concurrent Caddyfile edit causes refusal. Caddy validates before replacement and
reloads after the dev app is healthy; reload failure restores the previous config.
A Caddy reload applies the added dev route to the shared listener; it does not restart
Caddy or change the existing `portal.kyneticai.com` block.

Build/bootstrap diagnostics are redacted against generated credentials before being
written to a root-only log. The script prints only non-secret status messages.
A failed build leaves the previous app running. Failed initialization never starts the
app. A failed app health check leaves the existing Caddy routing unchanged; a failed
redeploy may require rerunning the prior revision to restore the dev app.

Success ends with `PASS 0.7 https://dev.kyneticai.com/ HTTP 200 (verified from Mac)`
and `DEPLOYED_REVISION=<40-character commit>`. The Mac follows the app's redirects,
matching the urllib behavior in check 0.7. Return these status lines to Codex as VPS
handoff evidence; Codex must not claim that its network-restricted executor reached
this host. No step is marked complete until that evidence arrives.
