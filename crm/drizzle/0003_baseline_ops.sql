-- M0-07: baseline part C. Calls, messages, consent, webhooks, integrations, Alex config, service tokens,
-- appointments, metrics, reports, automations, notifications and imports (DATABASE.md), with RLS.

CREATE TABLE calls (                                                    -- F-26, F-27, F-28; provider generic
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  contact_id uuid,
  deal_id uuid,
  provider text NOT NULL,                                               -- adapter registry validates values; no CHECK
  provider_call_id text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  duration_s integer CHECK (duration_s >= 0),
  outcome text CHECK (outcome IN ('booked','qualified','not_interested','voicemail','no_answer','transferred','dnc','other')),
  sentiment text CHECK (sentiment IN ('positive','neutral','negative','unknown')),
  disclosure_given boolean NOT NULL DEFAULT false,                      -- spec s8: recording disclosure at start
  disclosure_version text,                                              -- SECURITY C10: disclosure text version used
  recording_key text,                                                   -- R2 object key; NULL = provider-hosted only
  recording_provider_url text,
  transcript text,
  transcript_segments jsonb,
  summary text,
  extracted jsonb NOT NULL DEFAULT '{}',                                -- extracted fields, F-27
  cost_cents integer CHECK (cost_cents >= 0),                           -- F-29 Later; stored from day one
  purge_after timestamptz,                                              -- retention (PRD decision 9)
  flagged boolean NOT NULL DEFAULT false,                               -- F-28
  flagged_by uuid,
  flagged_at timestamptz,
  flag_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider, provider_call_id),                       -- webhook idempotency backstop
  UNIQUE (tenant_id, id),
  CHECK (ended_at IS NULL OR ended_at >= started_at),
  CHECK (NOT flagged OR flagged_at IS NOT NULL),
  FOREIGN KEY (tenant_id, contact_id) REFERENCES contacts (tenant_id, id) ON DELETE SET NULL (contact_id),
  FOREIGN KEY (tenant_id, deal_id) REFERENCES deals (tenant_id, id) ON DELETE SET NULL (deal_id)
);
--> statement-breakpoint
CREATE INDEX calls_list_idx ON calls (tenant_id, started_at DESC);
--> statement-breakpoint
CREATE INDEX calls_contact_idx ON calls (tenant_id, contact_id, started_at DESC);
--> statement-breakpoint
CREATE INDEX calls_outcome_idx ON calls (tenant_id, outcome, started_at DESC);
--> statement-breakpoint
CREATE INDEX calls_flagged_idx ON calls (started_at) WHERE flagged;
--> statement-breakpoint
CREATE TABLE messages (                                                 -- F-30
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  contact_id uuid,
  deal_id uuid,
  channel text NOT NULL CHECK (channel IN ('sms','email')),
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  actor_type text NOT NULL CHECK (actor_type IN ('alex','automation','user','system')),
  actor_id uuid,
  from_address text NOT NULL,
  to_address text NOT NULL,
  subject text,
  body text NOT NULL DEFAULT '',
  provider text,
  provider_message_id text,
  status text NOT NULL CHECK (status IN ('queued','sent','delivered','failed','bounced','complained','received')),
  error_code text,
  error_message text,
  sent_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, provider, provider_message_id),
  FOREIGN KEY (tenant_id, contact_id) REFERENCES contacts (tenant_id, id) ON DELETE SET NULL (contact_id),
  FOREIGN KEY (tenant_id, deal_id) REFERENCES deals (tenant_id, id) ON DELETE SET NULL (deal_id)
);
--> statement-breakpoint
CREATE INDEX messages_contact_idx ON messages (tenant_id, contact_id, created_at DESC);
--> statement-breakpoint
CREATE INDEX messages_status_idx ON messages (tenant_id, status) WHERE status IN ('failed','bounced');
--> statement-breakpoint
CREATE TABLE consents (                                                 -- spec s8 TCPA; F-32 STOP
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  contact_id uuid NOT NULL,
  channel text NOT NULL CHECK (channel IN ('phone_call','sms','email')),
  kind text NOT NULL CHECK (kind IN ('express_written','opt_out','dnc')),
  source text NOT NULL,                                                 -- 'form', 'sms_keyword', 'call', 'import', 'staff'
  captured_text text,                                                   -- exact consent wording shown (D-007 wording on forms)
  wording_version text,                                                 -- SECURITY C10: version id of captured_text
  ip inet,
  captured_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, contact_id) REFERENCES contacts (tenant_id, id) ON DELETE RESTRICT
);
--> statement-breakpoint
-- The latest row per (contact, channel) is the current state. Writes are append-only; a revocation sets revoked_at, it never deletes.
CREATE INDEX consents_current_idx ON consents (tenant_id, contact_id, channel, captured_at DESC);
--> statement-breakpoint
CREATE TABLE dnc_entries (                                              -- SECURITY C10: per-tenant do-not-call list
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  e164 text NOT NULL CHECK (e164 ~ '^\+[1-9][0-9]{7,14}$'),
  contact_id uuid,
  source text NOT NULL,                                                 -- 'opt_out', 'import', 'staff'; external DNC lookup: Not configured
  added_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  FOREIGN KEY (tenant_id, contact_id) REFERENCES contacts (tenant_id, id) ON DELETE SET NULL (contact_id)
);
--> statement-breakpoint
CREATE UNIQUE INDEX dnc_entries_active_uq ON dnc_entries (tenant_id, e164) WHERE removed_at IS NULL;
--> statement-breakpoint
CREATE TABLE webhook_events (                                           -- spec s6: signature verified, idempotent, retried
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  external_id text NOT NULL,
  tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT,            -- NULL until resolved; set at intake when the route knows the tenant
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz,
  last_error text,
  UNIQUE (source, external_id)
);
--> statement-breakpoint
CREATE INDEX webhook_events_pending_idx ON webhook_events (next_attempt_at) WHERE processed_at IS NULL;
--> statement-breakpoint
CREATE INDEX webhook_events_tenant_idx ON webhook_events (tenant_id, received_at DESC);
--> statement-breakpoint
CREATE TABLE integrations (                                             -- F-62
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('voice','sms','email','automation','calendar','lead_intake')),
  status text NOT NULL DEFAULT 'ok' CHECK (status IN ('ok','degraded','error','disabled')),
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error text,
  error_count integer NOT NULL DEFAULT 0 CHECK (error_count >= 0),
  UNIQUE (tenant_id, kind)
);
--> statement-breakpoint
CREATE TABLE phone_numbers (                                            -- routing for inbound calls and texts
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  e164 text NOT NULL UNIQUE CHECK (e164 ~ '^\+[1-9][0-9]{7,14}$'),      -- global: an inbound number maps to one tenant
  provider text NOT NULL,
  provider_sid text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('voice','sms','voice_sms')),
  a2p_status text NOT NULL DEFAULT 'not_registered',                    -- F-62 Twilio A2P status; values: not_registered, pending, approved, rejected
  released_at timestamptz,
  UNIQUE (tenant_id, id),
  UNIQUE (provider, provider_sid)
);
--> statement-breakpoint
CREATE TABLE alex_configs (                                             -- F-58, F-42
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE RESTRICT,
  provider text NOT NULL,                                               -- adapter registry; generic
  agent_ref text,
  voice text,
  prompt_version integer NOT NULL DEFAULT 1 CHECK (prompt_version >= 1),
  greeting text,
  questions jsonb NOT NULL DEFAULT '[]',
  booking_rules jsonb NOT NULL DEFAULT '{}',
  call_windows jsonb NOT NULL DEFAULT '{}',
  retry jsonb NOT NULL DEFAULT '{}',
  transfer_number_e164 text CHECK (transfer_number_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  paused boolean NOT NULL DEFAULT false,                                -- F-42: owner may pause
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE alex_prompts (                                             -- F-58 raw prompt; never shown to owners
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  version integer NOT NULL CHECK (version >= 1),
  body text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, version)
);
--> statement-breakpoint
CREATE UNIQUE INDEX alex_prompts_one_active ON alex_prompts (tenant_id) WHERE is_active;
--> statement-breakpoint
CREATE TABLE service_tokens (                                               -- lead intake (spec s6) and n8n service tokens (F-89)
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  prefix text NOT NULL UNIQUE,
  key_hash text NOT NULL,
  label text NOT NULL,
  scopes text[] NOT NULL DEFAULT '{}',
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id)
);
--> statement-breakpoint
CREATE INDEX service_tokens_tenant_idx ON service_tokens (tenant_id);
--> statement-breakpoint
CREATE TABLE appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  contact_id uuid,
  deal_id uuid,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  address jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','no_show','cancelled')),
  booked_by text NOT NULL CHECK (booked_by IN ('user','alex','automation','client_portal')),
  external_event_id text,                                              -- F-25 Later
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  CHECK (ends_at > starts_at),
  FOREIGN KEY (tenant_id, contact_id) REFERENCES contacts (tenant_id, id) ON DELETE SET NULL (contact_id),
  FOREIGN KEY (tenant_id, deal_id) REFERENCES deals (tenant_id, id) ON DELETE SET NULL (deal_id)
);
--> statement-breakpoint
CREATE INDEX appointments_calendar_idx ON appointments (tenant_id, starts_at) WHERE status <> 'cancelled';
--> statement-breakpoint
CREATE UNIQUE INDEX appointments_external_uq ON appointments (tenant_id, external_event_id) WHERE external_event_id IS NOT NULL;
--> statement-breakpoint
-- Business-hours enforcement for Alex bookings (M5 acceptance) is in the booking API against tenants.business_hours; not a DB constraint.

CREATE TABLE metrics_daily (                                            -- rebuilt idempotently per day
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  day date NOT NULL,
  leads integer NOT NULL DEFAULT 0 CHECK (leads >= 0),
  calls integer NOT NULL DEFAULT 0 CHECK (calls >= 0),
  contacts_reached integer NOT NULL DEFAULT 0 CHECK (contacts_reached >= 0),
  estimates_booked integer NOT NULL DEFAULT 0 CHECK (estimates_booked >= 0),
  booked_value_cents bigint NOT NULL DEFAULT 0,
  won_revenue_cents bigint NOT NULL DEFAULT 0,                          -- "revenue recovered" per PRD Metric definitions (Won deal value with an Alex call or booking)
  avg_speed_to_lead_s numeric(10,2),
  speed_to_lead_samples integer NOT NULL DEFAULT 0,
  computed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, day)
);
--> statement-breakpoint
CREATE TABLE reports (                                                  -- F-49
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('monthly_roi')),
  period_start date NOT NULL,
  status text NOT NULL CHECK (status IN ('queued','ready','sent','failed')),
  storage_key text,
  sent_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, kind, period_start),
  UNIQUE (tenant_id, id)
);
--> statement-breakpoint
CREATE TABLE automation_templates (                                     -- global seed; not tenant data
  key text PRIMARY KEY CHECK (key IN ('speed_to_lead','reactivation','quote_followup','appointment_reminders','no_show_recovery','missed_call_textback')),
  module_key text REFERENCES module_catalog(module_key),                 -- NULL only for templates not tied to a module
  label text NOT NULL
);
--> statement-breakpoint
CREATE TABLE automations (                                              -- F-31 templates and F-32 sequences
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('template','sequence')),
  template_key text REFERENCES automation_templates(key),
  name text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  CHECK ((kind = 'template') = (template_key IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX automations_one_template ON automations (tenant_id, template_key) WHERE kind = 'template';
--> statement-breakpoint
CREATE TABLE automation_steps (                                         -- sequences: SMS, email or call with delays
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  automation_id uuid NOT NULL,
  position integer NOT NULL CHECK (position >= 1),
  channel text NOT NULL CHECK (channel IN ('sms','email','call')),
  delay_minutes integer NOT NULL DEFAULT 0 CHECK (delay_minutes >= 0),
  subject text,
  body text NOT NULL DEFAULT '',
  UNIQUE (automation_id, position),
  FOREIGN KEY (tenant_id, automation_id) REFERENCES automations (tenant_id, id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE automation_runs (                                          -- one contact moving through one automation
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  automation_id uuid NOT NULL,
  contact_id uuid NOT NULL,
  deal_id uuid,
  current_step integer NOT NULL DEFAULT 1 CHECK (current_step >= 1),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','stopped_reply','stopped_booked','stopped_won_lost','stopped_manual','stopped_module_off','failed')),
  stop_reason text,
  next_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  CHECK (status <> 'active' OR next_run_at IS NOT NULL),
  FOREIGN KEY (tenant_id, automation_id) REFERENCES automations (tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, contact_id) REFERENCES contacts (tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, deal_id) REFERENCES deals (tenant_id, id) ON DELETE SET NULL (deal_id)
);
--> statement-breakpoint
-- The worker's due scan is cross-tenant and uses the partial index below.
CREATE INDEX automation_runs_due_idx ON automation_runs (next_run_at) WHERE status = 'active';
--> statement-breakpoint
CREATE INDEX automation_runs_contact_idx ON automation_runs (tenant_id, contact_id, status);
--> statement-breakpoint
CREATE TABLE notifications (                                            -- F-35
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  user_id uuid,                                                         -- NULL = every owner of the tenant
  kind text NOT NULL CHECK (kind IN ('new_lead','booked','task_due','report_ready','action_needed','deal_won','hot_lead')),
  title text NOT NULL,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, user_id) REFERENCES memberships (tenant_id, user_id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX notifications_unread_idx ON notifications (tenant_id, user_id, created_at DESC) WHERE read_at IS NULL;
--> statement-breakpoint
CREATE TABLE import_batches (                                           -- F-90 to F-94: one row per upload; dry runs and commits share the row
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  entity text NOT NULL CHECK (entity IN ('contact','company','deal','note')),
  imported_source text NOT NULL,                                        -- where the data came from: 'csv_other', 'jobber', 'servicetitan', 'housecall_pro', 'hubspot', 'sheets_export', free label; connectors are Later (F-97)
  source_label text,                                                    -- admin's note, e.g. "Acme CRM export Oct 2026"
  file_name text NOT NULL,
  file_type text NOT NULL CHECK (file_type IN ('csv','xlsx')),
  file_key text,                                                        -- private storage key under the tenant prefix; raw file deleted after retention (recommended option: 30 days after commit)
  file_sha256 text,
  file_size_bytes integer CHECK (file_size_bytes >= 0),
  mapping jsonb NOT NULL DEFAULT '{}',
  duplicate_rule text NOT NULL DEFAULT 'skip' CHECK (duplicate_rule IN ('skip','fill_empty')),   -- F-91 recommended option
  status text NOT NULL DEFAULT 'uploaded' CHECK (status IN
    ('uploaded','mapped','dry_run_ok','dry_run_failed','running','done','failed','undone')),
  rows_total integer NOT NULL DEFAULT 0 CHECK (rows_total >= 0),
  rows_ok integer NOT NULL DEFAULT 0 CHECK (rows_ok >= 0),
  rows_failed integer NOT NULL DEFAULT 0 CHECK (rows_failed >= 0),
  rows_duplicate integer NOT NULL DEFAULT 0 CHECK (rows_duplicate >= 0),
  report jsonb NOT NULL DEFAULT '{}',                                   -- dry-run report: counts and the first 200 row errors (row number, reason)
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,              -- the admin who ran it (F-94)
  committed_at timestamptz,
  undone_at timestamptz,
  undone_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id)
);
--> statement-breakpoint
CREATE INDEX import_batches_tenant_idx ON import_batches (tenant_id, created_at DESC);
--> statement-breakpoint
CREATE TABLE import_batch_records (                                     -- F-93 undo: what each batch created or merged into
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  batch_id uuid NOT NULL,
  entity text NOT NULL CHECK (entity IN ('contact','company','deal','note','consent')),
  record_id uuid NOT NULL,                                              -- polymorphic; no FK so undo can run after soft-delete
  action text NOT NULL CHECK (action IN ('created','filled_empty')),
  prior_values jsonb,                                                   -- for filled_empty: the empty values to restore on undo
  FOREIGN KEY (tenant_id, batch_id) REFERENCES import_batches (tenant_id, id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX import_batch_records_batch_idx ON import_batch_records (tenant_id, batch_id);
--> statement-breakpoint
-- F-92 source tagging. Added to the existing tables in the baseline migration (shown here together).
ALTER TABLE contacts  ADD COLUMN imported_source text, ADD COLUMN import_batch_id uuid, ADD COLUMN external_id text;
--> statement-breakpoint
ALTER TABLE companies ADD COLUMN imported_source text, ADD COLUMN import_batch_id uuid, ADD COLUMN external_id text;
--> statement-breakpoint
ALTER TABLE deals     ADD COLUMN imported_source text, ADD COLUMN import_batch_id uuid, ADD COLUMN external_id text;
--> statement-breakpoint
ALTER TABLE notes     ADD COLUMN imported_source text, ADD COLUMN import_batch_id uuid, ADD COLUMN external_id text;
--> statement-breakpoint
ALTER TABLE contacts  ADD FOREIGN KEY (tenant_id, import_batch_id) REFERENCES import_batches (tenant_id, id) ON DELETE SET NULL (import_batch_id);
--> statement-breakpoint
ALTER TABLE companies ADD FOREIGN KEY (tenant_id, import_batch_id) REFERENCES import_batches (tenant_id, id) ON DELETE SET NULL (import_batch_id);
--> statement-breakpoint
ALTER TABLE deals     ADD FOREIGN KEY (tenant_id, import_batch_id) REFERENCES import_batches (tenant_id, id) ON DELETE SET NULL (import_batch_id);
--> statement-breakpoint
ALTER TABLE notes     ADD FOREIGN KEY (tenant_id, import_batch_id) REFERENCES import_batches (tenant_id, id) ON DELETE SET NULL (import_batch_id);
--> statement-breakpoint
CREATE UNIQUE INDEX contacts_external_uq  ON contacts  (tenant_id, imported_source, external_id) WHERE external_id IS NOT NULL AND deleted_at IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX companies_external_uq ON companies (tenant_id, imported_source, external_id) WHERE external_id IS NOT NULL AND deleted_at IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX deals_external_uq     ON deals     (tenant_id, imported_source, external_id) WHERE external_id IS NOT NULL AND deleted_at IS NULL;
--> statement-breakpoint
CREATE INDEX contacts_import_batch_idx ON contacts (tenant_id, import_batch_id) WHERE import_batch_id IS NOT NULL;
--> statement-breakpoint
SELECT app_enable_tenant_rls(t) FROM unnest(ARRAY[
  'calls','messages','consents','dnc_entries','integrations','phone_numbers','alex_configs','alex_prompts',
  'service_tokens','appointments','metrics_daily','reports','automations','automation_steps','automation_runs',
  'notifications','import_batches','import_batch_records'
]::regclass[]) AS t;
--> statement-breakpoint
-- alex_prompts: admin role only, inside tenant context. The raw prompt is never shown to owners.
DROP POLICY tenant_select ON alex_prompts;
--> statement-breakpoint
DROP POLICY tenant_insert ON alex_prompts;
--> statement-breakpoint
DROP POLICY tenant_update ON alex_prompts;
--> statement-breakpoint
DROP POLICY tenant_delete ON alex_prompts;
--> statement-breakpoint
CREATE POLICY alex_prompts_admin ON alex_prompts FOR ALL TO kynetic_app, kynetic_worker
  USING (tenant_id = app_tenant_id() AND app_role() = 'admin')
  WITH CHECK (tenant_id = app_tenant_id() AND app_role() = 'admin' AND NOT app_read_only());
--> statement-breakpoint
-- consents: append only for the runtime. Corrections are new rows.
REVOKE UPDATE, DELETE ON consents FROM kynetic_app, kynetic_worker;
--> statement-breakpoint
-- webhook_events: intake inserts; worker reads and updates. Tenant health is read from integrations.
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE webhook_events FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON webhook_events FROM kynetic_app;
--> statement-breakpoint
GRANT INSERT ON webhook_events TO kynetic_app;
--> statement-breakpoint
CREATE POLICY webhook_events_intake ON webhook_events FOR INSERT TO kynetic_app WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY webhook_events_worker ON webhook_events FOR ALL TO kynetic_worker USING (true) WITH CHECK (true);
--> statement-breakpoint
-- Due automation scan is cross-tenant and worker-only.
CREATE POLICY automation_runs_worker ON automation_runs FOR ALL TO kynetic_worker USING (true) WITH CHECK (true);
--> statement-breakpoint
-- automation_templates: global seed, read-only reference data (same treatment as module_catalog).
ALTER TABLE automation_templates ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE automation_templates FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE ON automation_templates FROM kynetic_app, kynetic_worker;
--> statement-breakpoint
CREATE POLICY automation_templates_read ON automation_templates FOR SELECT TO kynetic_app, kynetic_worker USING (true);
