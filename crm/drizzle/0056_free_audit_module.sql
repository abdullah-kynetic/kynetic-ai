-- Audit intake is independently gated and must not require alex_core.
ALTER TABLE module_catalog DROP CONSTRAINT IF EXISTS module_catalog_module_key_check;
ALTER TABLE module_catalog ADD CONSTRAINT module_catalog_module_key_check CHECK
  (module_key = ANY (ARRAY['platform','alex_core','free_audit','quote_followup','after_hours','missed_call_textback','reactivation','opm','followup_bundle','crm']));
INSERT INTO module_catalog (module_key, label, always_on)
VALUES ('free_audit', 'Free instant audit', false)
ON CONFLICT (module_key) DO NOTHING;
