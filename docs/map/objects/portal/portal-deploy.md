---
type: object
cluster: portal
universe: live
status: verified
entity: portal/deploy/portal-deploy.sh
verified_on: 2026-10-22
verified_at: cbb5046 (source files unchanged since 67763e6)
---

# Portal deploy

Server-side script (installed on the VPS as `/usr/local/sbin/portal-deploy`). Deploys only a full commit sha that is an ancestor of `origin/main` (`portal-deploy.sh:59`), rsyncs the whole `portal/` folder over `/opt/portal/src` with `--delete` (`:74`), copies only `docker-compose.yml` out of it (`:75`), builds, restarts `portal-app`, health-checks, and rolls back on failure.

## Shape
- Only these env keys can be set through it: `ALLOWED_KEYS` (`:18`: Resend, R2, Google).
- The deploy scripts themselves are **not** updated by a deploy: `/usr/local/sbin/portal-deploy*` and `set-secrets.sh` are separate server copies.
- Trigger: a forced-command `deploy` key runs `portal-deploy-entry.sh`. The thing that holds that key (bot or GitHub Action) is not in this repo (no `.github/`).

## If you change this
- **Hits:** `portal/deploy/BOT_DEPLOY.md`, D-022, KI-010. Any file under `portal/` that reaches `main` ships to the server on the next deploy, including docs and `CONTEXT.md` files.
- **Does not hit:** Twenty, n8n, Retell.
- **Outside the tree:** the VPS copies of the scripts; the deploy trigger.

## See
- `portal/deploy/portal-deploy.sh`, `portal/deploy/BOT_DEPLOY.md`
