# Operations runbooks

Every procedure here that touches the server, a bucket, a provider or a client's data needs Abdullah's explicit yes on that exact step first (`CLAUDE.md` hard rules). Reading status is always fine. Run server commands from the Mac with `ssh kynetic-vps "<command>"`, one command per call. Cloud sessions cannot reach port 22.

| Runbook | Use it when |
|---|---|
| [deploy.md](deploy.md) | Shipping a `main` commit to portal.kyneticai.com |
| [rollback.md](rollback.md) | A deploy went bad, or the last good app and worker images must come back |
| [restore.md](restore.md) | The database must be recovered, or the restore drill is due |
| [incident.md](incident.md) | Something may have leaked, sent wrongly, or broken for clients |
| [offboarding.md](offboarding.md) | A client leaves |
| [monitoring.md](monitoring.md) | An alert fired, or alert settings need checking |
| [demo-clients-seed.md](demo-clients-seed.md) | Loading or removing the demo workspaces |

Facts these runbooks lean on, each checked against the code on 2026-11-13:

- The live stack is `/opt/portal-new` (postgres, app, worker). The app listens on `127.0.0.1:3021`; host Caddy is outside the project.
- Deploy tooling is `crm/deploy/portal-new/portal-new-deploy`, installed at `/usr/local/sbin/portal-new-deploy`.
- Migrations only go forward. A rollback restores app and worker images, never the database.
- `PROVIDER_MODE=stub` and `OUTBOUND_ENABLED=false` are the live values at the time of writing. Nothing here changes them.
