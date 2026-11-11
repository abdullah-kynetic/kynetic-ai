---
type: object
cluster: portal
universe: live
status: verified
entity: crm/src/server/db/
verified_on: 2026-11-11
verified_at: main migration 1019
---

# Portal tenancy (withScope + RLS)

Tenant-scoped database access in `crm/` uses the current server authorization and Postgres RLS model. Tenant identity is never accepted from an untrusted client payload.

## Shape
- RLS and tenant policies are maintained by the current `crm/drizzle/` migrations and server data-access layer.
- Current tests cover tenant access, permissions, service tokens, and protected routes under `crm/tests/`.

## If you change this
- **Hits:** current tenant policies, `crm/drizzle/`, `crm/tests/`, and [[portal-ingest-api]].
- Production verification is tracked separately in current release evidence.

## See
- `crm/src/server/db/`
