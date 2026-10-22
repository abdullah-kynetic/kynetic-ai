---
type: object
cluster: portal
universe: live
status: verified
entity: portal/src/lib/storage/index.ts
verified_on: 2026-10-22
verified_at: 5888b13 (source unchanged since 67763e6)
---

# Portal files

Files are stored under server-generated keys `<clientId>/<uuid>` and the key regex rejects anything else (`storage/index.ts`). Downloads go only through `GET /api/files/[id]`: needs a session, a valid signed link bound to that user, MFA setup done for admins, and a tenant-scoped document lookup; every failure is a 404; headers force `nosniff`, `no-store`, sandbox CSP (`api/files/[id]/route.ts:18-40`). Storage is local disk until all four R2 variables are set.

## If you change this
- **Hits:** `api/documents` upload route, `FILE_SIGNING_SECRET`, R2 settings in deploy `ALLOWED_KEYS`, [[portal-tenancy-rls]].
