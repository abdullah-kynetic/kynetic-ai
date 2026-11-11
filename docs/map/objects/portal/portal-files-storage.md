---
type: object
cluster: portal
universe: live
status: verified
entity: crm/src/server/adapters/storage/
verified_on: 2026-11-11
verified_at: main migration 1019
---

# Portal files

Files are tenant-scoped and served through the current `crm/` document routes. Storage uses the configured storage adapter; document access remains permission-checked and tenant-scoped.

## If you change this
- **Hits:** current document routes, storage adapters, deployment configuration, [[portal-tenancy-rls]].
