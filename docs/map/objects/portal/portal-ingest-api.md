---
type: object
cluster: portal
universe: live
status: verified
entity: portal/src/app/api/ingest/results/route.ts
verified_on: 2026-10-22
verified_at: cbb5046 (source files unchanged since 67763e6)
---

# Portal results ingest

`POST /api/ingest/results`: n8n pushes one row per client per day; the Bearer key alone decides the client.

## Shape (`route.ts`)
- IP rate limit 120/min (`:30`), key format `kp_<8>_<20+>` (`:21`, `:32`), key lookup by prefix under `withScope({role:"system"})` then hash compare (`:35-39`), per-key limit 60/min (`:40`), 256 KB cap, optional HMAC header, strict zod body with `.strict()` so `client_id` is rejected, 1-400 rows.
- Upsert on (client, date) under `withScope({role:"ingest", clientId})` (`:59`); writes an audit row.

## Connected to
- **joins:** [[portal-tenancy-rls]] (scope roles), table `daily_results`, `ingest_keys` (`portal/src/lib/db/schema.ts`), docs `portal/N8N.md`.
- **Outside the tree:** nothing in the repo or in the n8n backup posts to this URL (`grep api/ingest n8n/` is empty). Whatever feeds it, if anything, is not saved here.

## If you change this
- **Hits:** `portal/N8N.md` payload table, tests in `portal/tests/`, the sender workflow, the client Results page.
- **Does not hit:** Twenty, Retell (the portal has no calls to either; "n8n" and "Twenty" appear only as UI text/schema comments).

## See
- `portal/src/app/api/ingest/results/route.ts`
