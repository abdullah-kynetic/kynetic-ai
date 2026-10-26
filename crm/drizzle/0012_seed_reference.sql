-- M0-26: global reference seed. Module catalog, module prices and automation templates
-- (DATABASE.md "Seed data"). Not tenant data and no real client data. Safe to re-run: every insert
-- is ON CONFLICT DO NOTHING, so rows edited later by an admin are never overwritten.
-- Prices are USD cents, read as monthly main figure and setup in the parenthetical. The reading is
-- unconfirmed for billing use (DATABASE.md contradiction 6); the admin UI shows these as reference only.

-- The owner is subject to FORCE ROW LEVEL SECURITY and no policy names it, so FORCE is lifted on the
-- three tables for this migration's transaction and put back at the end. Policies and grants are untouched.
ALTER TABLE module_catalog NO FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE module_prices NO FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE automation_templates NO FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
INSERT INTO module_catalog (module_key, label, always_on) VALUES
  ('platform', 'Platform', true),
  ('alex_core', 'Alex speed-to-lead', false),
  ('quote_followup', 'Quote follow-up', false),
  ('after_hours', 'After-hours answering', false),
  ('missed_call_textback', 'Missed-call text-back', false),
  ('reactivation', 'Old-lead reactivation', false),
  ('opm', 'Online presence management', false),
  ('followup_bundle', 'Follow-up bundle', false),
  ('crm', 'CRM', false)
ON CONFLICT (module_key) DO NOTHING;
--> statement-breakpoint
INSERT INTO module_prices (module_key, tier, level, setup_cents, monthly_cents, one_time_cents) VALUES
  ('alex_core', 'T1', '', 1000000, 250000, NULL),
  ('alex_core', 'T2', '', 1500000, 350000, NULL),
  ('alex_core', 'T3', '', 2000000, 500000, NULL),
  ('quote_followup', 'T1', '', 300000, 100000, NULL),
  ('quote_followup', 'T2', '', 450000, 150000, NULL),
  ('quote_followup', 'T3', '', 600000, 250000, NULL),
  ('after_hours', 'T1', '', 200000, 75000, NULL),
  ('after_hours', 'T2', '', 300000, 100000, NULL),
  ('after_hours', 'T3', '', 400000, 150000, NULL),
  ('missed_call_textback', 'T1', '', 75000, 30000, NULL),
  ('missed_call_textback', 'T2', '', 100000, 40000, NULL),
  ('missed_call_textback', 'T3', '', 150000, 50000, NULL),
  ('reactivation', 'T1', '', NULL, NULL, 400000),
  ('reactivation', 'T2', '', NULL, NULL, 600000),
  ('reactivation', 'T3', '', NULL, NULL, 900000),
  ('opm', 'T1', '', 250000, 100000, NULL),
  ('opm', 'T2', '', 350000, 150000, NULL),
  ('opm', 'T3', '', 500000, 200000, NULL),
  ('followup_bundle', 'T1', '', 450000, 160000, NULL),
  ('followup_bundle', 'T2', '', 650000, 240000, NULL),
  ('followup_bundle', 'T3', '', 900000, 380000, NULL),
  ('crm', 'ALL', 'lite', 100000, 50000, NULL),
  ('crm', 'ALL', 'full', 200000, 75000, NULL)
ON CONFLICT (module_key, tier, level) DO NOTHING;
--> statement-breakpoint
INSERT INTO automation_templates (key, module_key, label) VALUES
  ('speed_to_lead', 'alex_core', 'Speed to lead'),
  ('reactivation', 'reactivation', 'Old-lead reactivation'),
  ('quote_followup', 'quote_followup', 'Quote follow-up'),
  ('appointment_reminders', 'alex_core', 'Appointment reminders'),
  ('no_show_recovery', 'alex_core', 'No-show recovery'),
  ('missed_call_textback', 'missed_call_textback', 'Missed-call text-back')
ON CONFLICT (key) DO NOTHING;
--> statement-breakpoint
ALTER TABLE module_catalog FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE module_prices FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE automation_templates FORCE ROW LEVEL SECURITY;
