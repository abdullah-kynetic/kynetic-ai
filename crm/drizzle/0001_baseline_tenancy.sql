-- M0-05: baseline part A. Tenancy, users, memberships, invitations, modules, secrets, audit,
-- terms, billing, onboarding and documents. DATABASE.md "Schema" and "Row-level security".
-- Tables for the CRM (M0-06) and calls/messages/etc. (M0-07) follow in 0002 and 0003.

CREATE TABLE tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{3,40}$'),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  status text NOT NULL DEFAULT 'onboarding' CHECK (status IN ('onboarding','active','suspended','offboarded')),
  plan text NOT NULL CHECK (plan IN ('founding','value')),
  pricing_tier text CHECK (pricing_tier IN ('T1','T2','T3')),
  avg_job_value_cents integer CHECK (avg_job_value_cents >= 0),
  timezone text NOT NULL,
  logo_url text,
  primary_color text CHECK (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  business_hours jsonb NOT NULL DEFAULT '{}',
  service_area jsonb NOT NULL DEFAULT '{}',
  services jsonb NOT NULL DEFAULT '[]',
  transfer_number_e164 text CHECK (transfer_number_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  recording_disclosure text,
  email_sender_name text,
  baseline jsonb NOT NULL DEFAULT '{}',
  guarantee_target_bookings integer CHECK (guarantee_target_bookings >= 0),
  guarantee_start_date date,
  go_live_at timestamptz,
  twenty_company_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL CHECK (email = lower(email)),
  name text,
  image text,
  kynetic_role text CHECK (kynetic_role IN ('admin','va')),
  two_factor_enabled boolean NOT NULL DEFAULT false,
  disabled_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX users_email_uq ON users (email);
--> statement-breakpoint
CREATE TABLE memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner','staff')),
  can_export boolean NOT NULL DEFAULT false,
  can_bulk_delete boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);
--> statement-breakpoint
CREATE INDEX memberships_user_idx ON memberships (user_id);
--> statement-breakpoint
CREATE TABLE invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  email text NOT NULL CHECK (email = lower(email)),
  role text NOT NULL CHECK (role IN ('owner','staff')),
  token_hash text NOT NULL UNIQUE,
  invited_by uuid REFERENCES users(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX invitations_tenant_idx ON invitations (tenant_id, created_at DESC);
--> statement-breakpoint
CREATE TABLE module_catalog (
  module_key text PRIMARY KEY CHECK (module_key IN (
    'platform','alex_core','quote_followup','after_hours','missed_call_textback',
    'reactivation','opm','followup_bundle','crm')),
  label text NOT NULL,
  always_on boolean NOT NULL DEFAULT false
);
--> statement-breakpoint
CREATE TABLE module_prices (
  module_key text NOT NULL REFERENCES module_catalog(module_key),
  tier text NOT NULL CHECK (tier IN ('T1','T2','T3','ALL')),
  level text NOT NULL DEFAULT '' CHECK (level IN ('','lite','full')),
  setup_cents integer CHECK (setup_cents >= 0),
  monthly_cents integer CHECK (monthly_cents >= 0),
  one_time_cents integer CHECK (one_time_cents >= 0),
  PRIMARY KEY (module_key, tier, level)
);
--> statement-breakpoint
CREATE TABLE tenant_modules (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  module_key text NOT NULL REFERENCES module_catalog(module_key),
  enabled boolean NOT NULL DEFAULT false,
  level text NOT NULL DEFAULT '' CHECK (level IN ('','lite','full')),
  config jsonb NOT NULL DEFAULT '{}',
  changed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, module_key),
  CHECK ((module_key = 'crm') = (level <> '')),
  CHECK (module_key <> 'platform' OR enabled)
);
--> statement-breakpoint
CREATE UNIQUE INDEX tenant_modules_one_crm_level ON tenant_modules (tenant_id) WHERE module_key = 'crm' AND enabled;
--> statement-breakpoint
CREATE TABLE tenant_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  provider text NOT NULL,
  name text NOT NULL,
  ciphertext bytea NOT NULL,
  nonce bytea NOT NULL,
  key_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  rotated_at timestamptz,
  UNIQUE (tenant_id, provider, name)
);
--> statement-breakpoint
CREATE INDEX tenant_secrets_tenant_idx ON tenant_secrets (tenant_id);
--> statement-breakpoint
CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  actor_user_id uuid,
  impersonator_user_id uuid,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text,
  before jsonb,
  after jsonb,
  ip inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX audit_tenant_time_idx ON audit_log (tenant_id, created_at DESC);
--> statement-breakpoint
CREATE INDEX audit_actor_time_idx ON audit_log (actor_user_id, created_at DESC);
--> statement-breakpoint
CREATE TABLE impersonation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  impersonator_user_id uuid NOT NULL,
  read_only boolean NOT NULL DEFAULT true,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  ip inet,
  user_agent text,
  CHECK (ended_at IS NULL OR ended_at >= started_at)
);
--> statement-breakpoint
CREATE INDEX impersonation_tenant_idx ON impersonation_sessions (tenant_id, started_at DESC);
--> statement-breakpoint
CREATE TABLE backup_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('nightly','manual','restore_test')),
  status text NOT NULL CHECK (status IN ('running','ok','failed')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  size_bytes bigint CHECK (size_bytes >= 0),
  sha256 text,
  offsite_key text,
  restore_test_passed boolean,
  error text
);
--> statement-breakpoint
CREATE INDEX backup_runs_time_idx ON backup_runs (started_at DESC);
--> statement-breakpoint
CREATE TABLE terms_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document text NOT NULL CHECK (document IN ('terms','privacy')),
  version text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  ip inet,
  UNIQUE (user_id, document, version)
);
--> statement-breakpoint
CREATE TABLE tenant_billing (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE RESTRICT,
  billing_start_date date,
  stripe_customer_id text,
  notes text,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE tenant_billing_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  module_key text NOT NULL REFERENCES module_catalog(module_key),
  level text NOT NULL DEFAULT '',
  setup_cents integer NOT NULL CHECK (setup_cents >= 0),
  monthly_cents integer NOT NULL CHECK (monthly_cents >= 0),
  discount_pct integer NOT NULL DEFAULT 0 CHECK (discount_pct BETWEEN 0 AND 100),
  snapshot_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);
--> statement-breakpoint
CREATE INDEX tenant_billing_modules_idx ON tenant_billing_modules (tenant_id, module_key);
--> statement-breakpoint
CREATE TABLE onboarding_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  step_key text NOT NULL,
  title text NOT NULL,
  module_key text,
  client_visible boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','doing','blocked','done','n/a')),
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  due_date date,
  done_at timestamptz,
  note text,
  UNIQUE (tenant_id, step_key)
);
--> statement-breakpoint
CREATE TABLE tenant_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('agreement','proposal','invoice','report','other')),
  title text NOT NULL,
  file_key text NOT NULL,
  uploaded_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX tenant_documents_idx ON tenant_documents (tenant_id, created_at DESC);
--> statement-breakpoint
-- Needs tenant_modules, so it lives here and not in 0000.
CREATE OR REPLACE FUNCTION app_module_enabled(p_key text) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM tenant_modules m
                 WHERE m.tenant_id = app_tenant_id() AND m.module_key = p_key AND m.enabled) $$;
--> statement-breakpoint
-- ---- Row-level security and privileges for the tables above ----
SELECT app_enable_tenant_rls(t) FROM unnest(ARRAY[
  'memberships','invitations','tenant_modules','tenant_secrets','impersonation_sessions',
  'tenant_billing','tenant_billing_modules','onboarding_steps','tenant_documents'
]::regclass[]) AS t;
--> statement-breakpoint
-- tenants: runtime sees its own row; column grants limit what can change.
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_row_select ON tenants FOR SELECT TO kynetic_app, kynetic_worker USING (id = app_tenant_id());
--> statement-breakpoint
CREATE POLICY tenant_row_update ON tenants FOR UPDATE TO kynetic_app
  USING (id = app_tenant_id() AND NOT app_read_only()) WITH CHECK (id = app_tenant_id() AND NOT app_read_only());
--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE ON tenants FROM kynetic_app, kynetic_worker;
--> statement-breakpoint
GRANT UPDATE (name, logo_url, primary_color, timezone, business_hours, service_area, services,
              transfer_number_e164, recording_disclosure, email_sender_name) ON tenants TO kynetic_app;
--> statement-breakpoint
-- users: self-read, tenant members read each other. Kynetic role and disable are not runtime-writable.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE users FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY users_select ON users FOR SELECT TO kynetic_app, kynetic_worker
  USING (id = app_user_id() OR EXISTS (SELECT 1 FROM memberships m
                                      WHERE m.user_id = users.id AND m.tenant_id = app_tenant_id()));
--> statement-breakpoint
CREATE POLICY users_insert ON users FOR INSERT TO kynetic_app WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY users_update_self ON users FOR UPDATE TO kynetic_app
  USING (id = app_user_id() AND NOT app_read_only()) WITH CHECK (id = app_user_id() AND NOT app_read_only());
--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE ON users FROM kynetic_app, kynetic_worker;
--> statement-breakpoint
GRANT INSERT (email, name, image) ON users TO kynetic_app;
--> statement-breakpoint
GRANT UPDATE (name, image, two_factor_enabled, last_login_at) ON users TO kynetic_app;
--> statement-breakpoint
-- tenant_modules: writes only through set_tenant_module() (M0-09).
REVOKE INSERT, UPDATE, DELETE ON tenant_modules FROM kynetic_app, kynetic_worker;
--> statement-breakpoint
-- memberships: owners write, staff read.
DROP POLICY tenant_insert ON memberships;
--> statement-breakpoint
DROP POLICY tenant_update ON memberships;
--> statement-breakpoint
DROP POLICY tenant_delete ON memberships;
--> statement-breakpoint
CREATE POLICY memberships_owner_write ON memberships FOR ALL TO kynetic_app
  USING (tenant_id = app_tenant_id() AND app_role() = 'owner' AND NOT app_read_only())
  WITH CHECK (tenant_id = app_tenant_id() AND app_role() = 'owner' AND NOT app_read_only());
--> statement-breakpoint
-- tenant_secrets: the web role has no privilege at all. Only the worker reads ciphertext.
REVOKE ALL ON tenant_secrets FROM kynetic_app;
--> statement-breakpoint
DROP POLICY tenant_select ON tenant_secrets;
--> statement-breakpoint
DROP POLICY tenant_insert ON tenant_secrets;
--> statement-breakpoint
DROP POLICY tenant_update ON tenant_secrets;
--> statement-breakpoint
DROP POLICY tenant_delete ON tenant_secrets;
--> statement-breakpoint
CREATE POLICY tenant_secrets_worker ON tenant_secrets FOR ALL TO kynetic_worker USING (true) WITH CHECK (true);
--> statement-breakpoint
-- audit_log: runtime may insert only. Reads go through audit_search() (M0-09).
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON audit_log FROM kynetic_app, kynetic_worker;
--> statement-breakpoint
GRANT INSERT ON audit_log TO kynetic_app, kynetic_worker;
--> statement-breakpoint
CREATE POLICY audit_insert ON audit_log FOR INSERT TO kynetic_app, kynetic_worker WITH CHECK (true);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION audit_log_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'audit_log is append-only'; END $$;
--> statement-breakpoint
-- Statement level, so it fires even when RLS leaves the statement no visible rows.
CREATE TRIGGER audit_log_no_update_delete BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_immutable();
--> statement-breakpoint
CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_immutable();
--> statement-breakpoint
-- Global tables with no tenant_id: no runtime grant, or read-only reference data.
REVOKE ALL ON backup_runs FROM kynetic_app, kynetic_worker;
--> statement-breakpoint
ALTER TABLE backup_runs ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE backup_runs FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON backup_runs TO kynetic_worker;
--> statement-breakpoint
CREATE POLICY backup_runs_worker ON backup_runs FOR ALL TO kynetic_worker USING (true) WITH CHECK (true);
--> statement-breakpoint
ALTER TABLE module_catalog ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE module_catalog FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE module_prices ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE module_prices FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE ON module_catalog, module_prices FROM kynetic_app, kynetic_worker;
--> statement-breakpoint
CREATE POLICY module_catalog_read ON module_catalog FOR SELECT TO kynetic_app, kynetic_worker USING (true);
--> statement-breakpoint
CREATE POLICY module_prices_read ON module_prices FOR SELECT TO kynetic_app, kynetic_worker USING (true);
--> statement-breakpoint
-- terms_acceptances: global; a user reads and inserts only their own rows.
ALTER TABLE terms_acceptances ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE terms_acceptances FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE UPDATE, DELETE ON terms_acceptances FROM kynetic_app, kynetic_worker;
--> statement-breakpoint
CREATE POLICY terms_select_own ON terms_acceptances FOR SELECT TO kynetic_app, kynetic_worker USING (user_id = app_user_id());
--> statement-breakpoint
CREATE POLICY terms_insert_own ON terms_acceptances FOR INSERT TO kynetic_app WITH CHECK (user_id = app_user_id() AND NOT app_read_only());
