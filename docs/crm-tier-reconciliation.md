# CRM Lite/Full reconciliation (2026-11-09)

Status: technical reference. Authority for what is sold: `docs/STATUS.md` (one configurable CRM; Lite and Full are not commercial tiers). Prices are out of scope here (D-023 is the dated pricing authority).

## Decision applied
`tenant_modules.level` (`''`, `lite`, `full`) stays as an **internal capability control**. It gates real features (custom fields, bulk actions, multi-contact deals, export, proposals = "full"; notes, tasks, companies, stages, tags = "lite"). Removing it would expose paid capabilities or break tenant permissions, so this pass does not.

## Changed (labels only, no behavior)
- Admin onboarding form (`crm/src/app/admin/clients/new/onboarding-form.tsx`): "CRM add-on / CRM Lite / CRM Full" now reads as an internal capability set.
- Admin modules panel (`.../modules/modules-panel.tsx`): option text "Lite/Full" now "Core/Extended capabilities (lite/full)", and the note no longer says "on top of the base portal".
- Option `value`s, ARIA labels, DB check constraints, gates and tests are unchanged.

## Inventory, left as is
- Schema: `crm/drizzle/0001_baseline_tenancy.sql` (`level` check), `0012_seed_reference.sql` (price row `('crm','ALL','lite',100000,50000)` = the 2026-10-25 menu, historical, not current pricing), `baseline.ts`.
- Code gates: `server/modules/*`, `config/nav-config.ts`, tasks, notes, stages, tags, custom-fields, contacts/bulk, proposals, export.
- Tests and fixtures use `lite`/`full` heavily (synthetic); unchanged.
- Docs: `docs/PRD.md` F-85 and `docs/SECURITY.md` line 572 still say "paid upsells"; PRD items 1 and 12 are already marked historical. SECURITY.md PRD-1 line should get the same label in a later docs pass.
- Twenty (read-only inspection): `opportunity.tier` SELECT has options `FOUNDING_4675` and `STANDARD_8500` (D-017 prices); a group-by on tier returned 0 groups, so no record uses it. `opportunity.services` (inactive field) has `CRM_AUTOMATION`. No Lite/Full options found in the opportunity metadata. Proposal: relabel or retire the tier options via the Twenty sync thread; no deletions.

## Production migration still needed (NOT applied)
None is required for correctness. If the flag is ever replaced by named capabilities (for example `tenant_modules.capabilities text[]`), do it as: add the column nullable, backfill `lite`/`full` into sets, dual-read, switch gates, then drop the check after one release. Build and test it on a branch with synthetic fixtures first. Also decide whether the seed price row in `0012` and `admin-billing` snapshots (`level` on billing) should stop implying a sold tier; billing snapshots touch money, so it needs Abdullah's decision.
