---
type: object
cluster: portal
universe: live
status: verified
entity: crm/deploy/portal-new/portal-new-deploy
verified_on: 2026-11-11
verified_at: main
---

# Portal deploy

Server-side `portal-new-deploy` deploys an approved `main` commit to the current `/opt/portal-new` stack. It builds or switches the CRM app and worker, runs the reviewed migration path, health-checks, and rolls back on failure. The old `portal-deploy` and `/opt/portal` path are retired.

## Shape
- The deploy tool is the server-side production switch; secrets are never committed or handled by documentation work.
- The current script and entrypoint are in `crm/deploy/portal-new/`.

## If you change this
- **Hits:** `crm/deploy/portal-new/README.md`, current release notes, and the production approval gate.
- **Does not hit:** Twenty, n8n, Retell.
- **Outside the tree:** the VPS copies of the scripts; the deploy trigger.

## See
- `crm/deploy/portal-new/portal-new-deploy`, `crm/deploy/portal-new/README.md`
