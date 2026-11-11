---
type: process
status: verified
consumes: [portal-new-deploy]
produces: [portal-new-deploy]
verified_on: 2026-11-11
verified_at: main
---

# deploy-portal

Ship an approved `main` commit of `crm/` to `/opt/portal-new`.

## Input -> Movement -> Output
Input: an approved `main` commit. Movement: `portal-new-deploy` updates the current stack, runs its reviewed release steps, health-checks, and rolls back on failure. Output: the approved CRM revision is live.

## Steps (`crm/deploy/portal-new/portal-new-deploy`)
1. Select an approved `main` commit.
2. Run the server-side backup, build, migration, and app/worker switch steps.
3. Wait for `/api/health`; roll back if unhealthy.

## If you change this
- **Hits:** [[portal-deploy]] and `crm/deploy/portal-new/README.md`. Deployment still requires explicit approval.
