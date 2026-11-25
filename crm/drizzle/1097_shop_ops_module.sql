-- AA shop track (A-S1): the `shop_ops` module. Additive and idempotent: widens the module_key check and
-- adds one module_catalog row. No prices, no tenant is switched on by this migration.
-- module_catalog is under FORCE ROW LEVEL SECURITY with no policy for the owner, so FORCE is lifted for
-- this transaction and put back, the same way 0012_seed_reference did.
ALTER TABLE module_catalog NO FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE module_catalog DROP CONSTRAINT IF EXISTS module_catalog_module_key_check;
--> statement-breakpoint
ALTER TABLE module_catalog ADD CONSTRAINT module_catalog_module_key_check CHECK (module_key IN (
  'platform','alex_core','quote_followup','after_hours','missed_call_textback',
  'reactivation','opm','followup_bundle','crm','shop_ops'));
--> statement-breakpoint
INSERT INTO module_catalog (module_key, label, always_on) VALUES
  ('shop_ops', 'Shop operations', false)
ON CONFLICT (module_key) DO NOTHING;
--> statement-breakpoint
ALTER TABLE module_catalog FORCE ROW LEVEL SECURITY;
