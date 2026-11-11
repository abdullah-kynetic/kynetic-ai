---
type: object
cluster: portal
universe: live
status: verified
entity: crm/src/app/api/service/call-results/route.ts
verified_on: 2026-11-11
verified_at: main migration 1019
---

# CRM service results

The retired `POST /api/ingest/results` endpoint is not part of the current app. Current service result handling lives under `crm/` and uses the current tenant/service-token controls.

## Current direction
- Use the current `crm/` service routes and tenant-scoped service tokens.
- Do not revive the retired endpoint or old ingest-key contract.

## Connected to
- **joins:** [[portal-tenancy-rls]], current CRM service-token and tenant policies.

## If you change this
- **Hits:** current CRM service routes, tests, and any explicitly approved n8n integration.

## See
- `crm/src/app/api/service/call-results/route.ts`
