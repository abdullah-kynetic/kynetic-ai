# Preview environments

Per branch: its own Postgres, roles, migrations and the synthetic seed (`demo-a`, `demo-b`,
`demo-sales`). No provider keys, `OUTBOUND_ENABLED=false`, throwaway secrets generated per preview.
Spec: ARCHITECTURE "Preview environments"; TESTING "Preview environment".

- `compose.yml`: postgres, `prepare` (roles, migrate, seed, then `preview:check`), app, worker.
  App and worker start only if `prepare` exits 0. `preview:check` exits 1 when the database holds
  any tenant that is not a seed tenant, so a preview can never start on real data.
- `preview.sh`: `up`, `down`, `list`, `slug`. Refuses a third live preview (`MAX_PREVIEWS`, default 2).
  `down` removes volumes, so the database is destroyed with the preview.
- `remote.sh`: forced command for the CI deploy key. Accepts only `up <branch>` or `down <branch>`.
- `edge.Caddyfile`: one host-level Caddy for `*.preview.kyneticai.com`, routing by hostname to the
  container aliased with the branch slug.
- `.github/workflows/crm-preview.yml`: deploys on PR open or push, tears down when the PR closes
  (merged or not). Skipped until the repository variable `PREVIEW_ENABLED` is `true`.

## One-time server setup (needs Abdullah's yes; nothing here has been run)
1. Cloudflare holds the `kyneticai.com` zone (ARCHITECTURE "Domain, DNS", pending question 9).
2. DNS `*.preview` proxied to the VPS; Cloudflare Access policy on `*.preview.kyneticai.com`.
3. Cloudflare Origin CA cert and key at `/etc/caddy/origin.pem` and `origin.key`.
4. Start the edge Caddy on the `kynetic-preview-edge` network with `edge.Caddyfile`.
5. Install `remote.sh` and `preview.sh` side by side on the server; add the CI public key to
   `authorized_keys` with `command="…/remote.sh",restrict`.
6. Set the four repository secrets named in the workflow, then `PREVIEW_ENABLED=true`.

A preview builds the branch's own Dockerfile, so only same-repo branches deploy (forks are skipped).
Not verified here: `docker compose up` (no Docker daemon in the build sandbox, 2026-10-26); only
`docker compose config`, the guard test and the slug test were run.
