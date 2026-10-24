---
type: object
cluster: portal
universe: live
status: verified
entity: portal/src/lib/db/scoped.ts
verified_on: 2026-10-22
verified_at: cbb5046 (source files unchanged since 67763e6)
---

# Portal tenancy (withScope + RLS)

Every DB access runs in `withScope(scope, fn)`, which opens a transaction and sets `app.role`, `app.client_id`, `app.user_id` as transaction-local settings that the RLS policies read (`scoped.ts:21-32`). Scopes: admin, client, ingest, system.

## Shape
- RLS forced on tables via `portal/drizzle/0001_rls.sql:20`. Callers must also filter `client_id` explicitly (`scoped.ts` comment).
- Static tests assert guards by reading source text: admin actions start with `await requireAdmin()`, client pages call `requireClient()`, client data functions take no `clientId` argument (`portal/tests/static-guards.test.ts`).
- 13 tables in `schema.ts` (clients, business_profiles, contacts, scope_items, milestones, users, documents, daily_results, ingest_keys, auth_tokens, recovery_codes, rate_limits, audit_log).

## If you change this
- **Hits:** every route using `withScope`, `0001_rls.sql`, `portal/tests/rls.test.ts` and `isolation/`, [[portal-ingest-api]].
- **Does not hit:** auth hashing/MFA modules in `src/lib/auth/` (they call into scope but are separate).
- Not verified here: that the live Postgres matches these policies; the manual A/B isolation test is still open (KI-006).

## See
- `portal/src/lib/db/scoped.ts`
