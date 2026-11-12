# PORTAL DATA SPEC 00: Index — demo client and admin data (exists vs missing)

_Twenty note `768fee94`, created 2026-11-10, updated 2026-11-10. Exported 2026-11-12._

> **Status:** PROPOSED spec, written Monday Nov 9, 2026. Every volume, rate, price and sample value below is **proposed example (mock) data, not real**. Nothing has been seeded into the portal. Seeding waits on Abdullah's decision: real vs synthetic demo leads. Sources: portal repo main 84332586 (PRs #143–#150 merged), read-only queries on the production portal DB (Nov 9, 2026, 6:40 PM PST), the Portal Blueprint page, and `portal-batches/PLAN.md`.

## Short answer
- **Done already:** the 13 demo client workspaces exist with real public business facts (name, niche, city, phone, website, ad count, 3 review snapshots), a generic 8-stage pipeline, and Alex/CRM switches. The Portal Blueprint lists every page and its data source.
- **Not done until now:** a per-client data sheet, a chart-vs-table guide for every field, and mock volumes. Those are the notes listed below.
- **Still to do:** generate and load the mock data. 0 leads, calls, appointments, deals, messages, tasks, automation runs, reports, support threads or users exist for any client, and the agency workspace does not exist. Loading waits on one decision: **real vs synthetic demo leads** (these 13 are real companies).

## Notes in this set (Twenty)
- PORTAL DATA SPEC 01: Demo clients — data every client page needs
- PORTAL DATA SPEC 02: Admin / agency side — data & display spec
- PORTAL DEMO CLIENT 01: Super Roofer LLC — data profile
- PORTAL DEMO CLIENT 02: DR Roofing & Construction — data profile
- PORTAL DEMO CLIENT 03: FairClaims Roofing & Construction — data profile
- PORTAL DEMO CLIENT 04: Fortbend Roofing Texas — data profile
- PORTAL DEMO CLIENT 05: Rodriguez Roofing — data profile
- PORTAL DEMO CLIENT 06: BlueWater Pools, LLC — data profile
- PORTAL DEMO CLIENT 07: Tidal Wave Custom Pools — data profile
- PORTAL DEMO CLIENT 08: Kelley Pools and Outdoor — data profile
- PORTAL DEMO CLIENT 09: Clarity Windows And Doors — data profile
- PORTAL DEMO CLIENT 10: Bridgewood Windows & Doors — data profile
- PORTAL DEMO CLIENT 11: Kitchens Alive LLC — data profile
- PORTAL DEMO CLIENT 12: Manta Construction Company — data profile
- PORTAL DEMO CLIENT 13: 123 Remodeling — data profile

## Recommended next step
1. Decide: mock activity under the 13 real names (labelled demo), or fictional look-alike tenants per niche (e.g., one remodeler, one pool builder, one window company, one roofer), keeping the 13 as clean prospect records. Recommended: fictional look-alikes for demos; keep real prospects empty.
2. Then a seeding script (extend `crm/src/server/db/seed/demo.ts`): deterministic, every row flagged `synthetic_demo`, removable in one step, run first on a preview database, then production with a backup, and the metrics rollup re-run for 90 days.
3. Create the agency workspace and its synthetic set at the same time.

Markdown copies on the Grok Bot box: `/workspace/portal-data-spec/`.

