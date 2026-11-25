# AA shop loop progress

One dated line per finished step, failed fix attempt, or skipped step.

- 2026-11-25 A-S1 done: shop_ops module key, catalog copy, migration 1097 (check constraint + catalog row), admin toggles; tests shop-ops-module.test.ts; verify:quick pass. Live portal has 70 migrations, newest 1096, so 1097 is the one pending migration.
- 2026-11-25 A-S2 done: auto body stage renamed Estimate to Quoted. Found and fixed a real bug: applying the auto body stages to a default pipeline hit the unique stage-name constraint (standard stages already have 'Quoted' sixth), so applyStageDefaults now renames in two passes. Tests: auto-body-stages.test.ts, systems-templates unit.
- 2026-11-25 A-S3 done: ensureAutoBodyFields (src/server/shop/custom-fields.ts), nine deal fields, idempotent, leaves edited fields alone. Test auto-body-fields.test.ts.
