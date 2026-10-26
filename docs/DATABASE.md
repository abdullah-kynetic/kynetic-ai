# DATABASE: Kynetic Client CRM & Portal

Status: Draft for review. Not approved.
Sources, in order of precedence: `DECISIONS_locked.md` (Oct 25 2026, wins on conflict), `PRD.md` (feature IDs F-01 to F-106, module keys, open decisions), `SPEC_client_crm_portal.md` (data model, section 5), and the existing portal schema in `portal/drizzle/0000_init.sql` to `0002_recovery_codes.sql` (current VPS portal, read only).

Conventions used here:
- Primary keys are `uuid` with `gen_random_uuid()`. Timestamps are `timestamptz`.
- Money is `*_cents integer`. Durations are `*_s`.
- Closed value sets are `text` with a `CHECK`, not Postgres enums, so values can be added without `ALTER TYPE`. Provider columns (`provider`) are free text, validated by the app's adapter registry, so the voice provider stays generic (PRD PRD decision 3).
- Feature references use PRD IDs (F-xx). Milestone references use PRD tags (M0 to M10).

## Storage model

- Database: PostgreSQL 16 (spec section 7). Server version and extensions on the VPS: Not configured (verify before M0).
- Separate database from the existing portal (`portal.kyneticai.com`). No data is migrated from the existing portal (PRD F-88, decided 2026-10-25): it has no real client users, so the new build launches clean and the demo tenant is synthetic.
- Ownership model: one shared schema, one row per client business identified by `tenant_id`. Every tenant table carries `tenant_id NOT NULL` and has RLS enabled and forced (see the RLS section). Kynetic staff are global identities (`users.kynetic_role`), not tenants.
- Data classification (per table in the Entities table): public, internal, personal, sensitive. Recordings, transcripts, consents and provider secrets are the sensitive set.
- Database roles (decided in the security review; names decided here):
  - `kynetic_owner`: owns all objects. Runs migrations only. Never used by the web app or the worker. Tenant tables are FORCE-enabled, so the owner is subject to policies too (see the RLS section; Decided list, item 16).
  - `kynetic_rollup`: NOLOGIN, owns the SECURITY DEFINER roll-up functions and is the only role with `BYPASSRLS`. It is reachable only through those functions (recommended option; Decided list, item 16).
  - `kynetic_app`: web runtime. Not the owner, no `BYPASSRLS`. Subject to RLS on every tenant table.
  - `kynetic_worker`: pg-boss jobs. No `BYPASSRLS`. Sets tenant context per job. Cross-tenant access is limited to the webhook and due-run tables in the RLS section.
- Session context (transaction-local, set with `set_config(name, value, true)` by one server helper from the verified session): `app.tenant_id`, `app.user_id`, `app.role` (`owner` | `staff` | `admin` | `va` | `system`), `app.impersonator_id` (view-as only), `app.read_only` (`on` | `off`).
  - Trust note: a bug that sets the wrong `app.tenant_id` defeats RLS. Mitigations: one helper, no raw `set_config` elsewhere, and RLS tests that a forged tenant reads zero rows.
  - The existing portal uses `app.client_id` and `app.role` with different values (`admin`, `client`, `ingest`, `system`). The new build uses `app.role` with the values above. Those values do not carry over (contradiction 3).

## Entities

Retention and classification are per table. Retention values are the PRD decision 9 values (Decided 2026-10-25). All tables below are created by the M0 baseline migration (ARCHITECTURE section 1). The Milestone column is the feature milestone that owns the behaviour.

| Entity (table) | Purpose | Owner | Retention | Class | Milestone | Module |
| --- | --- | --- | --- | --- | --- | --- |
| tenants | One client business: plan, tier, branding, hours, Alex transfer number, baseline, guarantee | Tenant (Kynetic creates) | Life of tenant. Offboarding delete is Later (Later) | Internal | M0 | platform |
| users | Global identity for Kynetic staff and client users | System (auth library, see Auth tables) | Until disabled and purged on request | Personal | M0 | platform |
| memberships | User to tenant link with role and staff permissions | Tenant | Until removed | Personal | M0 | platform |
| invitations | Pending owner and staff invites | Tenant | 14 days after expiry, then purged (decided, recommended option) | Personal | M0 | platform |
| module_catalog, module_prices | Module keys and reference prices from decisions | Kynetic (migration seed) | Permanent | Internal | M0 | platform |
| tenant_modules | Per-tenant on/off flag, CRM level, who changed it | Kynetic admin | Permanent (history in audit_log) | Internal | M0 | all (F-70) |
| tenant_secrets | Provider keys, encrypted | Tenant (set by Kynetic) | Until rotated or tenant offboards | Secret | M0 | platform (F-87) |
| audit_log | Who did what, when, from where, before and after; append only | System | Decided 2026-10-25 (recommended option approved: 2 years online, then archived; PRD decision 9) | Internal | M0 | platform (F-60) |
| impersonation_sessions | Every view-as session | System | Same as audit_log | Internal | M0 | platform (F-57) |
| backup_runs | Nightly and manual backup and restore-test results | Kynetic | 13 months (matches 30 daily + 12 monthly) | Internal | M0 | platform (F-63) |
| activities | Unified timeline row for every covered write | Tenant | Life of tenant, with the contact or deal | Personal | M0 (contract) / M3 (feature) | crm |
| companies | Commercial customers, property managers | Tenant | Until deleted (soft) | Personal | M1 | crm |
| contacts | People: name, phones, emails, address, source, owner, tags | Tenant | Until deleted (soft). Erasure on request: Later | Personal | M1 | crm |
| custom_field_defs | Per-tenant field definitions for contacts, companies, deals | Tenant | Until deleted | Internal | M1 | crm (F-12) |
| pipelines, pipeline_stages | Tenant pipelines and stages | Tenant | Until deleted | Internal | M2 | crm |
| deals | Jobs: value, stage, service, expected close, owner, lost reason | Tenant | Until deleted (soft) | Personal | M2 | crm |
| deal_contacts | Contacts on a deal with a role | Tenant | With the deal | Personal | M2 | crm |
| tasks | Follow-ups with due time, assignee, priority | Tenant | Until deleted (soft) | Internal | M3 | crm |
| notes, note_mentions | Rich-text notes and @mentions | Tenant | Until deleted (soft) | Personal | M3 | crm |
| appointments | Estimates booked by Alex or staff | Tenant | Until deleted (soft) | Personal | M5 | alex_core |
| calls | Alex call results: outcome, transcript, recording key, summary, extracted fields | Tenant | Decided (PRD decision 9, recommended option: 12 months, then recording deleted, row kept) | Sensitive | M4 | alex_core |
| messages | SMS and email sent or received, with delivery status | Tenant | Decided (PRD decision 9, recommended option: 24 months) | Personal | M4 | platform (F-30) |
| consents | Consent evidence per contact and channel: wording, IP, time, revocation | Tenant | Keep for life of tenant plus 5 years after revocation (Decided 2026-10-25, PRD decision 9; wording and any longer state duty need counsel) | Personal | M4 | platform (F-32, spec section 8) |
| dnc_entries | Per-tenant do-not-call list (SECURITY C10) | Tenant (system adds on opt-out) | Kept after removal for audit | Personal | M4 | platform |
| webhook_events | Verified inbound webhooks, idempotent by (source, external_id) | System | Payload purged after 30 days, id and status kept (SECURITY 6.1; decided) | Internal | M4 | platform |
| integrations | Health per tenant and provider | System | Latest state only | Internal | M4 | platform (F-62) |
| phone_numbers | Provider numbers and routing; global uniqueness of E.164 | Kynetic | Until released | Internal | M4 | alex_core, after_hours, missed_call_textback |
| alex_configs | Alex settings per tenant | Kynetic and owner (limited fields) | Current version; history in audit_log | Internal | M4 | alex_core (F-58) |
| alex_prompts | Raw prompt bodies, versioned | Kynetic admin only | Permanent (F-59 Later: rollback) | Internal | M4 | alex_core |
| service_tokens | Tenant-scoped, hashed, revocable tokens for lead intake and n8n | Tenant (Kynetic creates) | Until revoked | Secret (hash only) | M0 (table); M4 (intake); M7 (n8n use) | platform |
| metrics_daily | Daily rollup for dashboards and ROI report | System | Permanent | Internal | M6 | alex_core |
| reports | Monthly ROI report records and stored PDF keys | System | 24 months | Internal | M6 | alex_core (F-49) |
| automations, automation_steps, automation_runs | Templates, sequences, and their runs | Tenant | Runs: 12 months after completion | Personal | M7 | per template |
| notifications | Bell items per user | System | 90 days | Internal | M7 | platform (F-35) |
| import_batches, import_batch_records | Onboarding data imports: one row per upload, with mapping, dry-run report, counts, status and undo; records created per batch | Tenant (Kynetic admin runs it) | Batch row kept for the life of the tenant. Raw file deleted 30 days after commit (SECURITY 6.1; decided) | Personal | M9 | platform (F-90 to F-94) |

Module-specific tables not yet defined (PRD F-83 opm, F-82 reactivation, F-84 followup_bundle): see Schema section "Not yet in the schema".

## Schema

Migration split is in "Migrations and seed data". All DDL below is PostgreSQL 16. Every table that carries `tenant_id` gets the RLS helper in the RLS block. Every tenant-scoped foreign key is composite: `(tenant_id, parent_id)` references `parent (tenant_id, id)`. That makes a cross-tenant link impossible even if app code is wrong. Parents declare `UNIQUE (tenant_id, id)`. Nullable child foreign keys use `ON DELETE SET NULL (column)` so only the reference column is nulled, not `tenant_id`.

### Extensions and tenancy

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- global search (F-37)

CREATE TABLE tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{3,40}$'),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  status text NOT NULL DEFAULT 'onboarding' CHECK (status IN ('onboarding','active','suspended','offboarded')),
  plan text NOT NULL CHECK (plan IN ('founding','value')),              -- spec tenants.plan, F-86
  pricing_tier text CHECK (pricing_tier IN ('T1','T2','T3')),           -- F-86; NULL until avg job value is known
  avg_job_value_cents integer CHECK (avg_job_value_cents >= 0),         -- basis for tier; NOT on onboarding form (contradiction 4)
  timezone text NOT NULL,                                               -- IANA name, validated in app; quiet hours (spec s8)
  logo_url text,
  primary_color text CHECK (primary_color ~ '^#[0-9A-Fa-f]{6}$'),       -- F-39
  business_hours jsonb NOT NULL DEFAULT '{}',                           -- F-41, call windows
  service_area jsonb NOT NULL DEFAULT '{}',                             -- F-41: zips or radius
  services jsonb NOT NULL DEFAULT '[]',                                 -- F-41
  transfer_number_e164 text CHECK (transfer_number_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  recording_disclosure text,                                            -- spec s8: disclosure text per tenant
  email_sender_name text,                                               -- F-39 sender display name (DC-051)
  baseline jsonb NOT NULL DEFAULT '{}',                                 -- F-01: captured at signup
  guarantee_target_bookings integer CHECK (guarantee_target_bookings >= 0),  -- F-03; location chosen here (PRD decision 10)
  guarantee_start_date date,                                            -- F-03
  go_live_at timestamptz,                                               -- F-53
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL CHECK (email = lower(email)),
  name text,
  image text,
  kynetic_role text CHECK (kynetic_role IN ('admin','va')),             -- NULL for client users (F-73)
  two_factor_enabled boolean NOT NULL DEFAULT false,                    -- spec s8: TOTP for Kynetic staff first (Later)
  disabled_at timestamptz,                                              -- F-61: deactivate ends sessions
  last_login_at timestamptz,                                            -- F-53 last login
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (kynetic_role IS NULL OR kynetic_role IN ('admin','va'))
);
CREATE UNIQUE INDEX users_email_uq ON users (email);

CREATE TABLE memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner','staff')),                 -- spec memberships.role
  can_export boolean NOT NULL DEFAULT false,                            -- F-73: owner-toggleable; home is this row (Decided 2026-10-25)
  can_bulk_delete boolean NOT NULL DEFAULT false,                       -- F-73, F-08
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);
CREATE INDEX memberships_user_idx ON memberships (user_id);

CREATE TABLE invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  email text NOT NULL CHECK (email = lower(email)),
  role text NOT NULL CHECK (role IN ('owner','staff')),
  token_hash text NOT NULL UNIQUE,                                      -- hash only; raw token never stored
  invited_by uuid REFERENCES users(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX invitations_tenant_idx ON invitations (tenant_id, created_at DESC);
-- Decided (recommended option): whether invites live here or in the auth library's tables depends on PRD decision 2.
```

### Modules (F-70, F-84, F-85, F-86)

```sql
CREATE TABLE module_catalog (
  module_key text PRIMARY KEY CHECK (module_key IN (
    'platform','alex_core','quote_followup','after_hours','missed_call_textback',
    'reactivation','opm','followup_bundle','crm')),
  label text NOT NULL,
  always_on boolean NOT NULL DEFAULT false                              -- true only for platform
);

CREATE TABLE module_prices (                                            -- reference only in v1 (billing is F-66)
  module_key text NOT NULL REFERENCES module_catalog(module_key),
  tier text NOT NULL CHECK (tier IN ('T1','T2','T3','ALL')),           -- ALL = same for every tier (crm)
  level text NOT NULL DEFAULT '' CHECK (level IN ('','lite','full')),  -- crm only
  setup_cents integer CHECK (setup_cents >= 0),
  monthly_cents integer CHECK (monthly_cents >= 0),
  one_time_cents integer CHECK (one_time_cents >= 0),
  PRIMARY KEY (module_key, tier, level)
);

CREATE TABLE tenant_modules (                                           -- one row per tenant and module (F-70)
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  module_key text NOT NULL REFERENCES module_catalog(module_key),
  enabled boolean NOT NULL DEFAULT false,
  level text NOT NULL DEFAULT '' CHECK (level IN ('','lite','full')),
  config jsonb NOT NULL DEFAULT '{}',
  changed_by uuid REFERENCES users(id) ON DELETE SET NULL,             -- F-70 changed-by
  changed_at timestamptz NOT NULL DEFAULT now(),                       -- F-70 timestamp
  PRIMARY KEY (tenant_id, module_key),
  CHECK ((module_key = 'crm') = (level <> '')),                         -- crm carries lite|full; others carry none
  CHECK (module_key <> 'platform' OR enabled)                          -- platform cannot be turned off
);
-- Only one CRM level may be enabled at a time (F-85 upgrade path).
CREATE UNIQUE INDEX tenant_modules_one_crm_level ON tenant_modules (tenant_id) WHERE module_key = 'crm' AND enabled;
```

Note: `platform` cannot be off, which the CHECK enforces with `module_key <> 'platform' OR enabled`. A client who only bought Alex has `crm` off and still gets the base portal (leads, kanban, appointments, calls, reports; PRD decision 1). Companies, tasks, notes and configurable stages need `crm` Lite; custom fields, bulk actions, multi-contact deals, search and export need `crm` Full. The tables always exist.

### Secrets, audit and operations

```sql
CREATE TABLE tenant_secrets (                                           -- F-87: encrypted at rest, never returned to a browser
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  provider text NOT NULL,
  name text NOT NULL,
  ciphertext bytea NOT NULL,
  nonce bytea NOT NULL,
  key_version integer NOT NULL DEFAULT 1,                              -- envelope key id; key held in the app secret store (SECURITY 4.2)
  created_at timestamptz NOT NULL DEFAULT now(),
  rotated_at timestamptz,
  UNIQUE (tenant_id, provider, name)
);
CREATE INDEX tenant_secrets_tenant_idx ON tenant_secrets (tenant_id);

CREATE TABLE audit_log (                                                -- F-60: append only; no FKs (FK actions would UPDATE)
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  actor_user_id uuid,
  impersonator_user_id uuid,                                            -- F-57: set when a view-as session writes
  action text NOT NULL,                                                 -- e.g. 'module.toggle', 'contact.update', 'auth.login'
  entity text NOT NULL,
  entity_id text,
  before jsonb,
  after jsonb,
  ip inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_tenant_time_idx ON audit_log (tenant_id, created_at DESC);
CREATE INDEX audit_actor_time_idx ON audit_log (actor_user_id, created_at DESC);

CREATE TABLE impersonation_sessions (                                   -- F-57: every view-as session
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
CREATE INDEX impersonation_tenant_idx ON impersonation_sessions (tenant_id, started_at DESC);

CREATE TABLE backup_runs (                                              -- F-63: global, no tenant_id
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('nightly','manual','restore_test')),
  status text NOT NULL CHECK (status IN ('running','ok','failed')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  size_bytes bigint CHECK (size_bytes >= 0),
  sha256 text,
  offsite_key text,
  restore_test_passed boolean,                                          -- monthly drill (spec M10)
  error text
);
CREATE INDEX backup_runs_time_idx ON backup_runs (started_at DESC);
```

### Clients, contacts, companies (M1; F-05 to F-12)

```sql
CREATE TABLE companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  phone_e164 text CHECK (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  website text,
  address jsonb NOT NULL DEFAULT '{}',
  custom jsonb NOT NULL DEFAULT '{}',                                  -- F-12 values keyed by custom_field_defs.key
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (tenant_id, id)
);
CREATE INDEX companies_tenant_name_idx ON companies (tenant_id, name) WHERE deleted_at IS NULL;

CREATE TABLE custom_field_defs (                                        -- F-12, F-43
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  entity text NOT NULL CHECK (entity IN ('contact','company','deal')),
  key text NOT NULL CHECK (key ~ '^[a-z][a-z0-9_]{1,40}$'),
  label text NOT NULL,
  type text NOT NULL CHECK (type IN ('text','number','money','date','select','multi_select','checkbox')),
  options jsonb NOT NULL DEFAULT '[]',
  show_in_table boolean NOT NULL DEFAULT false,
  filterable boolean NOT NULL DEFAULT false,
  importable boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  UNIQUE (tenant_id, entity, key),
  UNIQUE (tenant_id, id),
  CHECK (type NOT IN ('select','multi_select') OR jsonb_typeof(options) = 'array')
);

CREATE TABLE contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  first_name text NOT NULL DEFAULT '',
  last_name text,
  company_id uuid,
  primary_phone_e164 text CHECK (primary_phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  primary_email text CHECK (primary_email = lower(primary_email)),
  phones text[] NOT NULL DEFAULT '{}',                                 -- spec phones[]; every element E.164
  emails text[] NOT NULL DEFAULT '{}',                                 -- spec emails[]; every element lower-case
  address jsonb NOT NULL DEFAULT '{}',
  timezone text,                                                        -- quiet hours (spec s8); NULL = tenant timezone
  source text,
  status text NOT NULL DEFAULT 'new',                                   -- value set: new, working, booked, won, lost, dead (Decided 2026-10-25)
  tags text[] NOT NULL DEFAULT '{}',
  owner_id uuid,
  custom jsonb NOT NULL DEFAULT '{}',
  do_not_call_at timestamptz,                                           -- cache of the latest consents row; never the source of truth
  merged_into_id uuid,                                                  -- F-07 merge: loser points at survivor, then soft-deleted
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (tenant_id, id),
  CHECK (primary_phone_e164 IS NOT NULL OR primary_email IS NOT NULL OR coalesce(cardinality(phones), 0) + coalesce(cardinality(emails), 0) > 0),
  FOREIGN KEY (tenant_id, company_id) REFERENCES companies (tenant_id, id) ON DELETE SET NULL (company_id),
  FOREIGN KEY (tenant_id, owner_id) REFERENCES memberships (tenant_id, user_id) ON DELETE SET NULL (owner_id),
  FOREIGN KEY (tenant_id, merged_into_id) REFERENCES contacts (tenant_id, id)
);
CREATE INDEX contacts_tenant_list_idx ON contacts (tenant_id, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX contacts_tenant_phone_idx ON contacts (tenant_id, primary_phone_e164) WHERE deleted_at IS NULL;
CREATE INDEX contacts_tenant_email_idx ON contacts (tenant_id, primary_email) WHERE deleted_at IS NULL;
CREATE INDEX contacts_phones_gin ON contacts USING gin (tenant_id, phones);   -- dedupe on any phone (F-07); btree_gin needed; see Queries
CREATE INDEX contacts_emails_gin ON contacts USING gin (tenant_id, emails);
CREATE INDEX contacts_custom_gin ON contacts USING gin (custom jsonb_path_ops);
CREATE INDEX contacts_name_trgm ON contacts USING gin ((first_name || ' ' || coalesce(last_name, '')) gin_trgm_ops);
CREATE INDEX contacts_owner_idx ON contacts (tenant_id, owner_id) WHERE deleted_at IS NULL;
```

Note on `phones` and `emails` GIN indexes: a GIN index on `(tenant_id, phones)` needs the `btree_gin` extension. Decided (recommended option): enable `btree_gin` in M0 as well, or drop the tenant column from the GIN and filter on tenant with the array index. Decided 2026-10-26 (M0-06, DC-052): `btree_gin` is enabled in migration 0002 and the indexes keep the tenant column.

### Pipelines and deals (M2; F-14 to F-17)

```sql
CREATE TABLE pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  is_default boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id)
);
CREATE UNIQUE INDEX pipelines_one_default ON pipelines (tenant_id) WHERE is_default;

CREATE TABLE pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  pipeline_id uuid NOT NULL,
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  position integer NOT NULL,
  probability smallint NOT NULL DEFAULT 0 CHECK (probability BETWEEN 0 AND 100),
  is_won boolean NOT NULL DEFAULT false,                                -- F-17: Won and Lost flagged
  is_lost boolean NOT NULL DEFAULT false,
  color text,
  UNIQUE (tenant_id, pipeline_id, id),
  UNIQUE (pipeline_id, name),
  CHECK (NOT (is_won AND is_lost)),
  FOREIGN KEY (tenant_id, pipeline_id) REFERENCES pipelines (tenant_id, id) ON DELETE RESTRICT
);

CREATE TABLE deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  pipeline_id uuid NOT NULL,
  stage_id uuid NOT NULL,
  title text NOT NULL CHECK (length(btrim(title)) > 0),
  value_cents integer NOT NULL DEFAULT 0 CHECK (value_cents >= 0),     -- F-14: $12,500 = 1250000
  service_type text,
  expected_close date,
  owner_id uuid,
  source text,
  lost_reason text,                                                    -- F-14: required when lost (app rule + CHECK below)
  won_at timestamptz,
  lost_at timestamptz,
  position text NOT NULL,                                              -- fractional index key for kanban order (F-16)
  custom jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (tenant_id, id),
  CHECK (NOT (won_at IS NOT NULL AND lost_at IS NOT NULL)),
  CHECK (lost_at IS NULL OR (lost_reason IS NOT NULL AND length(btrim(lost_reason)) > 0)),
  FOREIGN KEY (tenant_id, pipeline_id) REFERENCES pipelines (tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, pipeline_id, stage_id) REFERENCES pipeline_stages (tenant_id, pipeline_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, owner_id) REFERENCES memberships (tenant_id, user_id) ON DELETE SET NULL (owner_id)
);
CREATE INDEX deals_board_idx ON deals (tenant_id, pipeline_id, stage_id, position) WHERE deleted_at IS NULL;
CREATE INDEX deals_owner_idx ON deals (tenant_id, owner_id) WHERE deleted_at IS NULL;
CREATE INDEX deals_close_idx ON deals (tenant_id, expected_close) WHERE deleted_at IS NULL;

CREATE TABLE deal_contacts (                                            -- F-15
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  deal_id uuid NOT NULL,
  contact_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('homeowner','spouse','tenant','property_manager','other')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (deal_id, contact_id),
  FOREIGN KEY (tenant_id, deal_id) REFERENCES deals (tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, contact_id) REFERENCES contacts (tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX deal_contacts_tenant_idx ON deal_contacts (tenant_id, contact_id);
```

Two tenant-isolation tests are required for `deal_contacts`: a contact in tenant A cannot be linked to a deal in tenant B, and the composite FKs above enforce it (F-15 acceptance).

### Activities, tasks, notes (M0 contract for activities; M3 feature; F-19, F-20, F-22)

```sql
CREATE TABLE activities (                                               -- one row per covered write (F-19); M0 creates it so M4 can write without M3
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  contact_id uuid,
  deal_id uuid,
  company_id uuid,
  type text NOT NULL CHECK (type IN ('call','sms','email','stage_change','note','task','appointment','automation','system','import')),
  ref_table text,                                                       -- polymorphic reference; no FK (app enforces)
  ref_id uuid,
  summary text NOT NULL,
  actor_type text NOT NULL CHECK (actor_type IN ('user','alex','automation','system')),  -- F-19 actor
  actor_id uuid,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  meta jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, contact_id) REFERENCES contacts (tenant_id, id) ON DELETE SET NULL (contact_id),
  FOREIGN KEY (tenant_id, deal_id) REFERENCES deals (tenant_id, id) ON DELETE SET NULL (deal_id),
  FOREIGN KEY (tenant_id, company_id) REFERENCES companies (tenant_id, id) ON DELETE SET NULL (company_id)
);
CREATE INDEX activities_contact_idx ON activities (tenant_id, contact_id, occurred_at DESC);
CREATE INDEX activities_deal_idx ON activities (tenant_id, deal_id, occurred_at DESC);
CREATE INDEX activities_type_idx ON activities (tenant_id, type, occurred_at DESC);
```

The M0 baseline creates `activities` with its foreign keys, in dependency order: companies, contacts, pipelines and deals come before it. The DDL order in this section is that order.

```sql
CREATE TABLE tasks (                                                    -- F-20
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (length(btrim(title)) > 0),
  due_at timestamptz,
  assignee_id uuid,
  contact_id uuid,
  deal_id uuid,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high')),
  completed_at timestamptz,
  completed_by uuid,
  recurrence text,                                                      -- F-21 Later; column reserved, unused in v1
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, assignee_id) REFERENCES memberships (tenant_id, user_id) ON DELETE SET NULL (assignee_id),
  FOREIGN KEY (tenant_id, contact_id) REFERENCES contacts (tenant_id, id) ON DELETE SET NULL (contact_id),
  FOREIGN KEY (tenant_id, deal_id) REFERENCES deals (tenant_id, id) ON DELETE SET NULL (deal_id)
);
CREATE INDEX tasks_my_idx ON tasks (tenant_id, assignee_id, due_at) WHERE completed_at IS NULL AND deleted_at IS NULL;

CREATE TABLE notes (                                                    -- F-22
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  body_text text NOT NULL DEFAULT '',                                   -- plain text for search
  body_json jsonb NOT NULL DEFAULT '{}',                                -- editor document; HTML sanitized on save (F-22)
  pinned boolean NOT NULL DEFAULT false,
  author_id uuid,
  contact_id uuid,
  company_id uuid,
  deal_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (tenant_id, id),
  CHECK (contact_id IS NOT NULL OR company_id IS NOT NULL OR deal_id IS NOT NULL),
  FOREIGN KEY (tenant_id, contact_id) REFERENCES contacts (tenant_id, id) ON DELETE SET NULL (contact_id),
  FOREIGN KEY (tenant_id, company_id) REFERENCES companies (tenant_id, id) ON DELETE SET NULL (company_id),
  FOREIGN KEY (tenant_id, deal_id) REFERENCES deals (tenant_id, id) ON DELETE SET NULL (deal_id)
);
CREATE INDEX notes_parent_idx ON notes (tenant_id, contact_id, pinned DESC, created_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE note_mentions (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  note_id uuid NOT NULL,
  user_id uuid NOT NULL,
  PRIMARY KEY (note_id, user_id),
  FOREIGN KEY (tenant_id, note_id) REFERENCES notes (tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, user_id) REFERENCES memberships (tenant_id, user_id) ON DELETE CASCADE
);
```

### Calls, messages, consent, provider state (M4; F-26 to F-32, F-62)

```sql
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
CREATE INDEX calls_list_idx ON calls (tenant_id, started_at DESC);
CREATE INDEX calls_contact_idx ON calls (tenant_id, contact_id, started_at DESC);
CREATE INDEX calls_outcome_idx ON calls (tenant_id, outcome, started_at DESC);
CREATE INDEX calls_flagged_idx ON calls (started_at) WHERE flagged;

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
CREATE INDEX messages_contact_idx ON messages (tenant_id, contact_id, created_at DESC);
CREATE INDEX messages_status_idx ON messages (tenant_id, status) WHERE status IN ('failed','bounced');

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
-- The latest row per (contact, channel) is the current state. Writes are append-only; a revocation sets revoked_at, it never deletes.
CREATE INDEX consents_current_idx ON consents (tenant_id, contact_id, channel, captured_at DESC);

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
CREATE UNIQUE INDEX dnc_entries_active_uq ON dnc_entries (tenant_id, e164) WHERE removed_at IS NULL;

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
CREATE INDEX webhook_events_pending_idx ON webhook_events (next_attempt_at) WHERE processed_at IS NULL;
CREATE INDEX webhook_events_tenant_idx ON webhook_events (tenant_id, received_at DESC);

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

CREATE TABLE alex_prompts (                                             -- F-58 raw prompt; never shown to owners
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  version integer NOT NULL CHECK (version >= 1),
  body text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, version)
);
CREATE UNIQUE INDEX alex_prompts_one_active ON alex_prompts (tenant_id) WHERE is_active;

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
CREATE INDEX service_tokens_tenant_idx ON service_tokens (tenant_id);
```

Notes on this group:
- `consents` has no `UPDATE` grant for `kynetic_app` (append-only, enforced in the GRANT block below). Revocations are new rows with `kind='opt_out'`. The `revoked_at` column on a grant is set only when a human reverses it, which is a new row too (see Migrations).
- `calls.purge_after` drives retention. The recording blob and transcript are cleared at `purge_after`, and the row stays for reporting.
- `alex_prompts` is readable only by the Kynetic admin role. The RLS block below gives it a dedicated policy.

### Appointments (M5; F-24)

```sql
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
CREATE INDEX appointments_calendar_idx ON appointments (tenant_id, starts_at) WHERE status <> 'cancelled';
CREATE UNIQUE INDEX appointments_external_uq ON appointments (tenant_id, external_event_id) WHERE external_event_id IS NOT NULL;
-- Business-hours enforcement for Alex bookings (M5 acceptance) is in the booking API against tenants.business_hours; not a DB constraint.
```

### Metrics and reports (M6; F-01 to F-03, F-49)

```sql
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
```

### Automations and notifications (M7; F-31 to F-35)

```sql
CREATE TABLE automation_templates (                                     -- global seed; not tenant data
  key text PRIMARY KEY CHECK (key IN ('speed_to_lead','reactivation','quote_followup','appointment_reminders','no_show_recovery','missed_call_textback')),
  module_key text REFERENCES module_catalog(module_key),                 -- NULL only for templates not tied to a module
  label text NOT NULL
);

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
CREATE UNIQUE INDEX automations_one_template ON automations (tenant_id, template_key) WHERE kind = 'template';

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
-- The worker's due scan is cross-tenant and uses the partial index below.
CREATE INDEX automation_runs_due_idx ON automation_runs (next_run_at) WHERE status = 'active';
CREATE INDEX automation_runs_contact_idx ON automation_runs (tenant_id, contact_id, status);

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
CREATE INDEX notifications_unread_idx ON notifications (tenant_id, user_id, created_at DESC) WHERE read_at IS NULL;
```

Notes on this group:
- `deal_won` and `hot_lead` are added to the spec's list of types because F-33 requires them as alerts. This needs confirmation.
- Module gating for automations is applied in the worker and API. When a module is turned off, its active runs move to `stopped_module_off`, not deleted (PRD F-70, module off: data retained).
- `automation_templates.module_key` for `appointment_reminders` and `no_show_recovery` is `alex_core` (PRD decision 6).

### Imports (M9; F-38)

```sql
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
CREATE INDEX import_batches_tenant_idx ON import_batches (tenant_id, created_at DESC);

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
CREATE INDEX import_batch_records_batch_idx ON import_batch_records (tenant_id, batch_id);

-- F-92 source tagging. Added to the existing tables in the baseline migration (shown here together).
ALTER TABLE contacts  ADD COLUMN imported_source text, ADD COLUMN import_batch_id uuid, ADD COLUMN external_id text;
ALTER TABLE companies ADD COLUMN imported_source text, ADD COLUMN import_batch_id uuid, ADD COLUMN external_id text;
ALTER TABLE deals     ADD COLUMN imported_source text, ADD COLUMN import_batch_id uuid, ADD COLUMN external_id text;
ALTER TABLE notes     ADD COLUMN imported_source text, ADD COLUMN import_batch_id uuid, ADD COLUMN external_id text;
ALTER TABLE contacts  ADD FOREIGN KEY (tenant_id, import_batch_id) REFERENCES import_batches (tenant_id, id) ON DELETE SET NULL (import_batch_id);
ALTER TABLE companies ADD FOREIGN KEY (tenant_id, import_batch_id) REFERENCES import_batches (tenant_id, id) ON DELETE SET NULL (import_batch_id);
ALTER TABLE deals     ADD FOREIGN KEY (tenant_id, import_batch_id) REFERENCES import_batches (tenant_id, id) ON DELETE SET NULL (import_batch_id);
ALTER TABLE notes     ADD FOREIGN KEY (tenant_id, import_batch_id) REFERENCES import_batches (tenant_id, id) ON DELETE SET NULL (import_batch_id);
CREATE UNIQUE INDEX contacts_external_uq  ON contacts  (tenant_id, imported_source, external_id) WHERE external_id IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX companies_external_uq ON companies (tenant_id, imported_source, external_id) WHERE external_id IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX deals_external_uq     ON deals     (tenant_id, imported_source, external_id) WHERE external_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX contacts_import_batch_idx ON contacts (tenant_id, import_batch_id) WHERE import_batch_id IS NOT NULL;
-- activities.type gains 'import' (timeline entry for imported history and for batch events).
```

### Gap-check additions (2026-10-25; approved for v1, created in the M0 baseline)

```sql
ALTER TABLE tenants ADD COLUMN twenty_company_id text UNIQUE;           -- F-106 reference only; no sync in v1

CREATE TABLE terms_acceptances (                                         -- F-102; global per user, not tenant-scoped data
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document text NOT NULL CHECK (document IN ('terms','privacy')),
  version text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  ip inet,
  UNIQUE (user_id, document, version)
);

CREATE TABLE tenant_billing (                                            -- F-99; admin-only, no owner or staff policy
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE RESTRICT,
  billing_start_date date,
  stripe_customer_id text,
  notes text,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE tenant_billing_modules (                                    -- price snapshot taken when a module is enabled
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
CREATE INDEX tenant_billing_modules_idx ON tenant_billing_modules (tenant_id, module_key);

CREATE TABLE onboarding_steps (                                          -- F-100
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  step_key text NOT NULL,                                                -- from a template, per enabled module
  title text NOT NULL,
  module_key text,
  client_visible boolean NOT NULL DEFAULT false,                         -- owner sees only these, read-only
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','doing','blocked','done','n/a')),
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  due_date date,
  done_at timestamptz,
  note text,
  UNIQUE (tenant_id, step_key)
);

CREATE TABLE tenant_documents (                                          -- F-103
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('agreement','proposal','invoice','report','other')),
  title text NOT NULL,
  file_key text NOT NULL,                                                -- private R2 key under the tenant prefix
  uploaded_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tenant_documents_idx ON tenant_documents (tenant_id, created_at DESC);
```

Access: `tenant_billing` and `tenant_billing_modules` have the standard RLS enabled but no policy for owner or staff roles in application code; only admin routes read them, through `withTenant` while viewing a tenant as admin, and the audit trigger records every write. `onboarding_steps` rows are readable by owners only where `client_visible`. `tenant_documents` is readable by owners and written by admins. `terms_acceptances` is a global table: users read and insert their own rows.

### Not in the baseline schema (decided by the PRD decisions log)

- OPM data (F-83): a status/task record per item and the monthly report (M11, approved). Tables `presence_items` and `review_snapshots`; no vendor integration tables until vendors are chosen (UNRESOLVED).
- Reactivation batches (F-82): a one-time campaign needs a `reactivation_batches` record (audience filter, launched_at, counts). Created in M7 with the reactivation module.
- Follow-up bundle (F-84): modeled as flags on `tenant_modules` only. Contents are fixed by PRD decision 7; no table.
- CRM Lite vs Full surfaces (F-85): gated by `tenant_modules.level`. No extra tables (PRD decision 1).
- Notification preferences (F-36), saved views (F-09), recurring tasks (F-21), attachments (F-23), multiple pipelines (F-18), prompt history (F-59), usage (F-64), Phase 2 tables (F-65 to F-69): Later. Not created in v1.

### Row-level security and privileges (M0)

Principles:
- `kynetic_app` is not the table owner and has no `BYPASSRLS`. It sees only rows where `tenant_id = app.tenant_id`.
- `kynetic_owner` owns the tables. Tenant tables are RLS-enabled and FORCE-enabled (SECURITY 2.3 and its CI gate; the existing portal also uses FORCE). Cross-tenant roll-ups run in SECURITY DEFINER functions owned by the NOLOGIN role `kynetic_rollup`, which has `BYPASSRLS` and is reachable only through those functions. The web app and worker never connect as the owner or as `kynetic_rollup`. Unresolved question 16 asks Abdullah to confirm.
- No policy names a Kynetic staff role. Cross-tenant staff reads happen only in SECURITY DEFINER functions that check `app.role` and write `audit_log`.
- Table privileges are the backstop: `REVOKE` where a role must never write, RLS narrows rows.

```sql
CREATE OR REPLACE FUNCTION app_tenant_id() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.tenant_id', true), '')::uuid $$;
CREATE OR REPLACE FUNCTION app_user_id() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;
CREATE OR REPLACE FUNCTION app_role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.role', true), '') $$;
CREATE OR REPLACE FUNCTION app_read_only() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT coalesce(current_setting('app.read_only', true), 'off') = 'on' $$;
CREATE OR REPLACE FUNCTION app_module_enabled(p_key text) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM tenant_modules m
                 WHERE m.tenant_id = app_tenant_id() AND m.module_key = p_key AND m.enabled) $$;

-- Standard policies for a tenant table T that has tenant_id. No staff clause.
-- DC-050: policies are TO kynetic_app, kynetic_worker (the worker sets tenant context per job).
CREATE OR REPLACE FUNCTION app_enable_tenant_rls(t regclass) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', t);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', t);
  EXECUTE format($p$CREATE POLICY tenant_select ON %1$s FOR SELECT TO kynetic_app, kynetic_worker
    USING (tenant_id = app_tenant_id())$p$, t);
  EXECUTE format($p$CREATE POLICY tenant_insert ON %1$s FOR INSERT TO kynetic_app, kynetic_worker
    WITH CHECK (tenant_id = app_tenant_id() AND NOT app_read_only())$p$, t);
  EXECUTE format($p$CREATE POLICY tenant_update ON %1$s FOR UPDATE TO kynetic_app, kynetic_worker
    USING (tenant_id = app_tenant_id() AND NOT app_read_only())
    WITH CHECK (tenant_id = app_tenant_id() AND NOT app_read_only())$p$, t);
  EXECUTE format($p$CREATE POLICY tenant_delete ON %1$s FOR DELETE TO kynetic_app, kynetic_worker
    USING (tenant_id = app_tenant_id() AND NOT app_read_only())$p$, t);
END $$;

SELECT app_enable_tenant_rls(t) FROM unnest(ARRAY[
  'memberships','invitations','tenant_modules','tenant_secrets','impersonation_sessions',
  'companies','custom_field_defs','contacts','pipelines','pipeline_stages','deals','deal_contacts',
  'activities','tasks','notes','note_mentions','calls','messages','consents','dnc_entries',
  'integrations','phone_numbers','alex_configs','alex_prompts','service_tokens','appointments',
  'metrics_daily','reports','automations','automation_steps','automation_runs','notifications','import_batches','import_batch_records',
  'tenant_billing','tenant_billing_modules','onboarding_steps','tenant_documents'
]::regclass[]) AS t;
-- Implementation note: this runs after the table DDL in the same migration.

-- Narrowing exceptions. Permissive policies combine with OR, so helper policies are dropped where a table has stricter write rules.

-- tenants: no insert or delete for the runtime role (creation is create_tenant, below).
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_row_select ON tenants FOR SELECT TO kynetic_app USING (id = app_tenant_id());
CREATE POLICY tenant_row_update ON tenants FOR UPDATE TO kynetic_app
  USING (id = app_tenant_id() AND NOT app_read_only()) WITH CHECK (id = app_tenant_id() AND NOT app_read_only());
-- Column grants are the real limit: the owner cannot change plan, pricing tier, status, baseline or guarantee.
REVOKE UPDATE ON tenants FROM kynetic_app;
GRANT UPDATE (name, logo_url, primary_color, timezone, business_hours, service_area, services,
              transfer_number_e164, recording_disclosure, email_sender_name) ON tenants TO kynetic_app;

-- users: self-read, tenant members read each other. Kynetic role and disable are not writable by the runtime role.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
CREATE POLICY users_select ON users FOR SELECT TO kynetic_app
  USING (id = app_user_id() OR EXISTS (SELECT 1 FROM memberships m
                                      WHERE m.user_id = users.id AND m.tenant_id = app_tenant_id()));
REVOKE INSERT, UPDATE ON users FROM kynetic_app;
GRANT INSERT (email, name, image) ON users TO kynetic_app;                  -- sign-up path (auth library; PRD decision 2)
GRANT UPDATE (name, image, two_factor_enabled, last_login_at) ON users TO kynetic_app;

-- tenant_modules: writes only through set_tenant_module().
REVOKE INSERT, UPDATE, DELETE ON tenant_modules FROM kynetic_app;

-- memberships: owners write, staff read.
DROP POLICY tenant_insert ON memberships; DROP POLICY tenant_update ON memberships; DROP POLICY tenant_delete ON memberships;
CREATE POLICY memberships_owner_write ON memberships FOR ALL TO kynetic_app
  USING (tenant_id = app_tenant_id() AND app_role() = 'owner' AND NOT app_read_only())
  WITH CHECK (tenant_id = app_tenant_id() AND app_role() = 'owner' AND NOT app_read_only());

-- tenant_secrets: the runtime role has no privilege at all. Only the worker reads ciphertext.
REVOKE ALL ON tenant_secrets FROM kynetic_app;
DROP POLICY tenant_select ON tenant_secrets; DROP POLICY tenant_insert ON tenant_secrets;
DROP POLICY tenant_update ON tenant_secrets; DROP POLICY tenant_delete ON tenant_secrets;
CREATE POLICY tenant_secrets_worker ON tenant_secrets FOR ALL TO kynetic_worker USING (true) WITH CHECK (true);

-- alex_prompts: admin role only, inside tenant context.
DROP POLICY tenant_select ON alex_prompts; DROP POLICY tenant_insert ON alex_prompts;
DROP POLICY tenant_update ON alex_prompts; DROP POLICY tenant_delete ON alex_prompts;
CREATE POLICY alex_prompts_admin ON alex_prompts FOR ALL TO kynetic_app
  USING (tenant_id = app_tenant_id() AND app_role() = 'admin')
  WITH CHECK (tenant_id = app_tenant_id() AND app_role() = 'admin' AND NOT app_read_only());

-- consents: append only for the runtime. Corrections are new rows.
REVOKE UPDATE, DELETE ON consents FROM kynetic_app;

-- webhook_events: intake inserts; worker reads and updates. Tenant health is read from integrations.
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON webhook_events FROM kynetic_app;
GRANT INSERT ON webhook_events TO kynetic_app;
CREATE POLICY webhook_events_intake ON webhook_events FOR INSERT TO kynetic_app WITH CHECK (true);
CREATE POLICY webhook_events_worker ON webhook_events FOR ALL TO kynetic_worker USING (true) WITH CHECK (true);

-- audit_log: runtime may insert only. Reads go through audit_search().
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;
REVOKE ALL ON audit_log FROM kynetic_app;
GRANT INSERT ON audit_log TO kynetic_app;
CREATE POLICY audit_insert ON audit_log FOR INSERT TO kynetic_app, kynetic_worker
  WITH CHECK (tenant_id IS NULL OR tenant_id = app_tenant_id());   -- DC-053

-- Global tables with no tenant_id: no runtime grant.
REVOKE ALL ON backup_runs FROM kynetic_app;
CREATE POLICY backup_runs_worker ON backup_runs FOR ALL TO kynetic_worker USING (true) WITH CHECK (true);
ALTER TABLE module_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_catalog FORCE ROW LEVEL SECURITY;
ALTER TABLE module_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_prices FORCE ROW LEVEL SECURITY;
CREATE POLICY module_catalog_read ON module_catalog FOR SELECT TO kynetic_app USING (true);
CREATE POLICY module_prices_read ON module_prices FOR SELECT TO kynetic_app USING (true);

-- Due automation scan is cross-tenant and worker-only.
CREATE POLICY automation_runs_worker ON automation_runs FOR ALL TO kynetic_worker USING (true) WITH CHECK (true);
```

SECURITY DEFINER functions (owned by `kynetic_rollup`, `SET search_path = public`). Each one checks `app_role()` first and raises `42501` otherwise. Each writes an `audit_log` row in the same transaction.

| Function | Who may call | What it does |
| --- | --- | --- |
| `create_tenant(...)` | admin | Inserts the tenant, sets context to the new id, creates the owner membership and invite, default pipeline and stages, and draft Alex config (F-55) |
| `set_tenant_module(p_tenant, p_module, p_enabled, p_level)` | admin | Upserts `tenant_modules` with `changed_by` and `changed_at` (F-70) |
| `admin_update_tenant_commercial(...)` | admin | Writes plan, pricing_tier, status, baseline, guarantee fields |
| `admin_set_kynetic_role(p_user, p_role)` | admin | Sets `users.kynetic_role`; VA cannot call it for `admin` (F-61) |
| `admin_tenant_overview()` | admin, va | One row per tenant: plan, status, leads 30d, booking rate, guarantee status, health inputs, last login (F-53, F-54) |
| `audit_search(p_tenant, p_actor, p_action, p_from, p_to)` | admin | Filtered read of `audit_log` (F-60) |

Implemented in migration 0005 (M0-09, DC-054). Signatures: `create_tenant(slug, name, plan, timezone, owner_email, invite_token_hash, invite_expires_at) returns uuid`; `set_tenant_module(tenant, module, enabled, level default '')`; `admin_update_tenant_commercial(tenant, patch jsonb)` with an allowlist of fields; `admin_set_kynetic_role(user, role or null)`; `admin_tenant_overview()`; `audit_search(tenant, actor, action, from, to, limit)`. `admin_tenant_overview` and `audit_search` allow admin and VA (SECURITY 2.2: VA reads); the others are admin only. Only `kynetic_app` may execute them.

Functions that aggregate across tenants must never take a tenant id the caller could not otherwise see: they check the role, then compute.

Audit immutability and grants:

```sql
CREATE OR REPLACE FUNCTION audit_log_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'audit_log is append-only'; END $$;
CREATE TRIGGER audit_log_no_update_delete BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_immutable();   -- statement level (DC-051)
CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_immutable();
REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM kynetic_app, kynetic_worker;
```

Test requirements (M0 acceptance, written with the schema):
- As `kynetic_app` with `app.tenant_id` = tenant A: a select from every tenant table returns no tenant B rows. An insert with tenant B's id is refused.
- With `app.tenant_id` unset: every tenant table returns zero rows.
- With `app.read_only = on`: insert, update and delete are refused on every tenant table.
- As `kynetic_app`: `UPDATE tenants SET plan = ...` is refused. `UPDATE users SET kynetic_role = 'admin'` is refused. `UPDATE tenant_modules` is refused. `SELECT ... FROM audit_log` is refused. `SELECT ... FROM tenant_secrets` is refused.
- `set_tenant_module` called with `app.role = owner` is refused; with `app.role = admin` it writes one `tenant_modules` row and one `audit_log` row.
- `audit_log` UPDATE and DELETE are refused, including from `kynetic_owner` and `kynetic_rollup`.
- A contact in tenant A cannot be linked to a deal in tenant B (composite FK).
- Every tenant table has RLS enabled, and its owner is not `kynetic_app` (from `pg_class` and `pg_tables`).
- `kynetic_app` and `kynetic_worker` have no `BYPASSRLS` (from `pg_roles`).

## Relationships

- tenants 1 to many: memberships, invitations, tenant_modules (one row per module, `(tenant_id, module_key)`), contacts, deals and every other tenant table. Delete: `RESTRICT`. Tenants are never deleted in v1. Offboarding delete is Later (spec s8 "Data export/deletion", priority Later), so there is no cascade path to test in v1.
- users 1 to many: memberships (`CASCADE` on user delete). The user row is disabled, not deleted, in normal use (`disabled_at`, F-61).
- memberships 1 to many: tasks.assignee, deals.owner, contacts.owner, notes.author (`SET NULL` on the reference column). Removing a staff member keeps their history. Their assignments are cleared.
- companies 1 to many contacts. Delete company: `SET NULL (company_id)`.
- contacts many to many deals through deal_contacts (role per link). Delete contact: `CASCADE` on the link row only.
- pipelines 1 to many pipeline_stages 1 to many deals. Delete stage with deals: `RESTRICT`; the app requires a target stage (F-17), so the move happens first.
- contacts 1 to many calls, messages, consents, appointments, tasks, notes, activities, automation_runs. Contact delete is soft (`deleted_at`). Hard delete only through the merge routine (F-07), which repoints children in one transaction and then soft-deletes the loser.
- automations 1 to many automation_steps (`CASCADE`) and automation_runs (`RESTRICT`; a run is never dropped while active).
- activities, audit_log and webhook_events use polymorphic or loose references (`ref_table`, `ref_id`, `entity_id`, `external_id`). They have no FK, because an FK would cascade an UPDATE or DELETE into an append-only table or block cleanup of an external reference.
- Merge (F-07): `contacts.merged_into_id` points to the survivor. Children move to the survivor in one transaction. The loser keeps `deleted_at`. The `activities` row for the merge records both ids.

## Access rules

Roles (PRD F-73): Kynetic admin (`app.role = admin`), Kynetic VA (`va`), client owner (`owner`), client staff (`staff`). R = read, W = write, "-" = none. View-as sessions set `app.read_only = on` (F-57): reads work, writes are refused unless an admin escalates, and every session is logged.

| Entity | Admin | VA | Owner | Staff | Enforced by |
| --- | --- | --- | --- | --- | --- |
| tenants | R, W settings via RLS; commercial fields (plan, pricing_tier, status, baseline, guarantee) via `admin_update_tenant_commercial` | R (overview via function) | R, W column allow-list (name, branding, hours, services, transfer number, disclosure) | R | RLS tenant_row_*; column grants; functions |
| users | Kynetic role via `admin_set_kynetic_role` | R | R members of own tenant | R self | RLS users_select; column grants |
| memberships | W within tenant context | R | W own tenant, not Kynetic roles | R | RLS memberships_owner_write |
| invitations | W within tenant context | R | W own tenant (owner invites staff) | - | RLS helper; server check |
| tenant_modules | W via `set_tenant_module` only (F-70) | R | R | R | No INSERT/UPDATE/DELETE grant; function checks `app.role = admin` |
| tenant_secrets | - (never in browser) | - | - | - | No grant to `kynetic_app`; worker only |
| contacts, companies, deals, tasks, notes | W within tenant context; view-as read-only | W on request | W | W; bulk delete and export need membership flags | RLS helper; server permission check |
| custom_field_defs, pipelines, pipeline_stages | W | R | W (F-43) | R | RLS helper; server check |
| activities | R | R | R | R | Writes by server code only |
| calls | R, flag review | R | R, flag | R (staff call access flag, decided: off by default, owner can enable) | RLS helper; flag route checks role |
| messages | R | R | R | R | Writes by server or worker only |
| consents, dnc_entries | R | R | R; record manually (source `staff`) | R; record manually | Append-only grant on consents; INSERT by intake |
| webhook_events | Health via `integrations` only | - | - | - | `kynetic_app` INSERT only; worker reads and updates |
| integrations | R | R | R summary (owners see status and last error only) | - | RLS helper |
| alex_configs | W | R | W pause and call hours only (F-42 recommended option) | R | Server field allow-list |
| alex_prompts | R, W | - | - | - | RLS alex_prompts policy, `app.role = admin` |
| phone_numbers | W | R | R | - | RLS helper |
| service_tokens | W | - | W own tenant | - | Hash only stored; server check |
| automations, automation_steps | W | R | W (template toggles subject to module guard) | R | RLS helper; module guard |
| automation_runs | R | R | R | R | Worker writes |
| notifications | Own only | Own only | Own only (plus rows with user_id NULL) | Own only | Server filter on user_id |
| metrics_daily, reports | R | R | R | R | Worker writes |
| import_batches, import_batch_records | RW (F-94) | R | R (client-side import is Later, F-95) | - | RLS helper; server role check (admin only to write) |
| audit_log | R via `audit_search` | R via `audit_search` (SECURITY 2.2) | - | - | No SELECT grant to `kynetic_app` |
| impersonation_sessions | R | R | - | - | Written by view-as route |
| backup_runs | R via admin function | - | - | - | No grant to `kynetic_app`; worker writes |
| module_catalog, module_prices | R | R | R | R | Written by migrations only |

Cross-tenant staff reads: none through policies. Admin and VA see many tenants only through the SECURITY DEFINER functions in the RLS section (`admin_tenant_overview`, `audit_search`, and the others listed there). Each checks `app.role` and writes an audit row.

## Queries and indexes

Key queries and the index that serves each:

| Query | Filter, sort, page | Index |
| --- | --- | --- |
| Contacts list (F-05) | tenant, optional status, source, tag, owner, date; sort by updated_at; keyset page | `contacts_tenant_list_idx` (partial, deleted_at null). Filters on arrays use GIN on `tags` (add in M1) |
| Dedupe on phone or email (F-07) | equal match on any phone or email | `contacts_tenant_phone_idx`, `contacts_tenant_email_idx`, `contacts_phones_gin`, `contacts_emails_gin` |
| Global search (F-37) | trigram match on name; exact match on phone | `contacts_name_trgm`, `contacts_tenant_phone_idx`; companies and deals trigram indexes added in M9 |
| Custom field filter (F-12) | `custom @> '{"roof_type":"tile"}'` | `contacts_custom_gin` (`jsonb_path_ops`) |
| Kanban board (F-16) | tenant, pipeline, stage; ordered by position | `deals_board_idx` (partial, deleted_at null) |
| Column totals (F-16) | sum of value_cents per stage | `deals_board_idx` (index only scan candidate) |
| Contact timeline (F-19) | contact, newest first; type filter | `activities_contact_idx`, `activities_type_idx` |
| My Tasks (F-20) | assignee, overdue or today or upcoming | `tasks_my_idx` (partial, open tasks) |
| Call list (F-26) | tenant, newest first; outcome and date filters | `calls_list_idx`, `calls_outcome_idx` |
| Flagged calls for admin (F-28) | flagged, newest | `calls_flagged_idx` |
| Message log (F-30) | tenant, contact; failed or bounced | `messages_contact_idx`, `messages_status_idx` |
| Current consent (F-06, F-32) | latest row per contact and channel | `consents_current_idx` (read the newest row with `LIMIT 1`) |
| Calendar (F-24) | tenant, date range | `appointments_calendar_idx` |
| Dashboard numbers (F-01, F-02) | tenant, date range from rollup | `metrics_daily` primary key (tenant_id, day) |
| Due automation runs (F-32, F-79) | next_run_at at or before now, active | `automation_runs_due_idx` (partial) |
| Unread notifications (F-35) | user, unread | `notifications_unread_idx` (partial) |
| Webhook retries (spec s6) | pending by next_attempt_at | `webhook_events_pending_idx` (partial) |
| Admin all clients (F-53) | tenant table with rollups | `metrics_daily` and `tenants` (small table) |
| Audit filter (F-60) | tenant, actor, action, time | `audit_tenant_time_idx`, `audit_actor_time_idx`; add action index in M8 if slow |

Rules:
- Every list endpoint is keyset-paginated on `(updated_at, id)` or `(created_at, id)`. Offset paging is not used for lists over 1,000 rows.
- Every tenant query includes `tenant_id` explicitly as well as relying on RLS. Planner choice relies on the leading `tenant_id` in each index.
- Performance target for list reads: 95th percentile under 500 ms with 10,000 contacts (PRD success measures, decided). Measurement: Not configured (the load test is defined in M10).
- The GIN indexes on `(tenant_id, phones)` and `(tenant_id, emails)` need the `btree_gin` extension. Add it in M0 (decided, recommended option) or drop the tenant column from those indexes.

Index rule for every table: each tenant table has an index led by `tenant_id`, either as a named index above or as the leading column of its primary access index. The migration test lists tables with no tenant-leading index and fails.

## Migrations and seed data

Tool and review (Drizzle confirmed, Decided 2026-10-25):
- Drizzle ORM and `drizzle-kit`, as the existing portal already uses (`portal/drizzle.config.ts`, SQL migrations in `portal/drizzle/`). Migration files are plain SQL, reviewed in the PR. Migration command: `bun run db:migrate` in `crm/` (needs `DATABASE_URL_MIGRATE`, run as `kynetic_owner`; M0-04). Roles are created first, once per cluster, by `crm/deploy/db/bootstrap.sql` run by a superuser (DC-050).
- Each migration reviewed for: RLS on new tenant tables, composite FK, a `CHECK` on every enum-like column, index on `tenant_id`, no `DROP` without a two-step plan.
- Expand then contract for any rename or drop. Two deploys minimum.
- CI runs migrations against an empty Postgres 16 and against a seeded preview database, then runs the RLS test suite. Failure blocks merge.

Ownership and file ranges (so parallel milestone threads do not collide on numbers). The M0 baseline creates every table in this document, with its RLS, grants and functions. Later milestones add only additive migrations (new indexes, columns that are not in this doc, FKs that need data, seed rows) in their own range:

| Range | Milestone | Creates |
| --- | --- | --- |
| 0000 to 0003 | M0 | Baseline, split by task (DC-050): 0000 roles check, extensions, helpers, `app_enable_tenant_rls` (M0-04); 0001 to 0003 tables (M0-05 to M0-07). Baseline contents: extensions, helpers, every table in the Schema section in dependency order, RLS, grants, audit trigger, SECURITY DEFINER functions, module_catalog and module_prices seed |
| 0002 to 0099 | M0 | Reserved for M0 follow-ups (hardening found in review) |
| 0100 to 0199 | M1 | Additive: contacts and companies indexes, trigram indexes once data exists |
| 0200 to 0299 | M2 | Additive: deal board indexes |
| 0300 to 0399 | M3 | Additive: task and note indexes |
| 0400 to 0499 | M4 | Additive: call and message indexes, webhook retry index |
| 0500 to 0599 | M5 | Additive: calendar indexes |
| 0600 to 0699 | M6 | Additive: metrics and reports indexes |
| 0700 to 0799 | M7 | Seed: automation_templates rows; additive indexes on runs |
| 0800 to 0899 | M8 | Admin-side functions and audit index |
| 0900 to 0999 | M9 | Import and search indexes |
| 1000 to 1099 | M10 | Restore helpers; any hardening changes |

TypeScript schema: `crm/src/server/db/schema/baseline.ts` is generated from the migrated database with `drizzle-kit pull` and stripped of policy entries (DC-051). A test (`schema-drift.test.ts`) fails if it differs from Postgres, so regenerate it in any PR that changes columns.

Rules:
- Only M0 creates tables, policies and functions. A feature thread that needs a new table opens a question to the M0 owner first.
- Each milestone's additive migration must not change RLS or grants without the security review.
Lock order: 0001 runs before any other migration. Milestone threads merge in wave order (ARCHITECTURE).

Auth tables (library-owned, not defined here): the auth library creates its session, account and verification tables (Better-Auth names: `sessions`, `accounts`, `verification`; Auth.js names differ). Those tables are global, carry no `tenant_id`, and get RLS enabled and forced with a policy for the `kynetic_auth` role only (DC-055); `kynetic_app` and `kynetic_worker` have no grant. Added by migration 0006 together with `users.email_verified`. Library choice is PRD decision 2, so this doc does not pick one. Which table names exist depends on that choice.

Rate limiter table (M0-21, DC-067, migration 0014): `rate_limits(key text, window_start timestamptz, count int, expires_at timestamptz, PRIMARY KEY (key, window_start))`. Global, no `tenant_id`, RLS enabled and forced with a policy for `kynetic_app` and `kynetic_worker`; `kynetic_auth` has no grant. `key` is the rule name plus a hash of the subject, so no IP or email is stored. Expired rows are purged by `purgeExpiredRateLimits` (scheduled once the M0-15 job runner exists).

Seed data (synthetic only; no real client data in preview, spec s6):
- `module_catalog`: nine rows, the module keys listed in the PRD. `platform` has `always_on = true`.
- `module_prices` (USD, stored as cents). From DECISIONS_locked.md, with the reading that the parenthetical is setup and the main figure is monthly. Confirm before any billing use (contradiction 6).
  - alex_core: T1 2500 monthly / 10000 setup; T2 3500 / 15000; T3 5000 / 20000.
  - quote_followup: T1 1000 / 3000; T2 1500 / 4500; T3 2500 / 6000.
  - after_hours: T1 750 / 2000; T2 1000 / 3000; T3 1500 / 4000.
  - missed_call_textback: T1 300 / 750; T2 400 / 1000; T3 500 / 1500. Included at no charge when after_hours is on (rule, not a second price row).
  - reactivation: one_time 4000 (T1), 6000 (T2), 9000 (T3).
  - opm: T1 1000 / 2500; T2 1500 / 3500; T3 2000 / 5000.
  - followup_bundle: T1 1600 / 4500; T2 2400 / 6500; T3 3800 / 9000.
  - crm: tier ALL. Lite setup 1000, monthly 500. Full setup 2000, monthly 750 (on top of the main system; updated 2026-10-25).
  - Founding clients: fixed setup 6500 covering 3 months, then monthly 1500. No founding discount on add-on setups (dropped 2026-10-25). Stored as reference text in the admin UI (F-86), not as a row, until billing (F-66).
- `automation_templates`: six rows, keys from F-31. `module_key` as in the PRD, except `appointment_reminders` and `no_show_recovery` = `alex_core` (recommended option, PRD decision 6).
- `pipelines` and `pipeline_stages`: created per tenant at onboarding (F-55), not as global seed. Default stages in order: New, Contacted, Qualified, Estimate Booked, Estimate Done, Quoted, Won (is_won), Lost (is_lost).
- Sales demo tenant (F-88): one seeded synthetic tenant (`demo-sales`) built from the same fictional generator as the test tenants. It is never built from real CRM records. Production does not receive test or demo seeds except this one.
- Demo tenants for tests: two synthetic tenants (slugs `demo-a`, `demo-b`), with fictional contacts on 555-01xx numbers and no real names. Owners and staff with test emails on a reserved test domain.

Backups and restore:
- Nightly `pg_dump`, encrypted, to offsite storage: 30 daily and 12 monthly kept (spec s7, F-63). Each run writes a `backup_runs` row.
- Monthly restore drill into a scratch database. The result writes a `backup_runs` row with `kind='restore_test'`. Pilot is blocked until one drill passes (spec M10).
- Commands and provider for backup: Not configured.

Rollback:
- Forward fix preferred. Destructive rollback is by restore from the nightly backup, tested by the drill. Down migrations are not written (decided, recommended option).

## Data validation

Required fields and allowed values are in the DDL. These rules apply on top, enforced in the app with the DB as a backstop where a CHECK exists:

- Phone: E.164 (`+` then 8 to 15 digits). Input normalized in the app; stored in `primary_phone_e164` and the `phones` array. Invalid input is refused with 422 and a field error.
- Email: lower-case on save. Duplicate detection on `primary_email` and `emails` (F-07). Invalid email is 422.
- Contact: needs a name or at least one contact point (CHECK). A contact with no phone or email is 422.
- Deal: `value_cents >= 0`. Lost deals require `lost_reason` (CHECK). Won and Lost are mutually exclusive. Moving to a stage in another pipeline is refused by the composite FK.
- Stage deletion with deals: refused unless a target stage is given (F-17). Refusal: 409 with the count of deals.
- Appointment: `ends_at > starts_at` (CHECK). Alex bookings must fall inside `tenants.business_hours` (M5 acceptance, enforced in the booking API). Staff bookings outside hours: warning in the UI, allowed.
- Consent: a contact cannot receive outbound calls or SMS without the latest row for that channel being `express_written` and not revoked. Enforced by one server function used by every send path (`canContact(ctx, contactId, channel, now, opts?: { purpose? })`, SECURITY 3.1 and ARCHITECTURE). Failure: send is refused, the action is logged in `activities`, and no provider call is made.
- STOP keyword: writes `consents` with `kind='opt_out'` and sets `contacts.do_not_call_at` for voice. Failure to write: the webhook is not marked processed and is retried.
- Quiet hours: computed from `contacts.timezone` (or the tenant timezone). Outside the window, sends are scheduled, not refused.
- Recording: a call row is written with `disclosure_given` only after the disclosure step is logged. A call without disclosure in a two-party-consent state is flagged for review (spec s8). The list of states is UNRESOLVED (needs counsel).
- Money: integers in cents, never floats. Negative values refused by CHECK.
- Webhook: signature verified before insert. Invalid signature is 401 and nothing is stored. Duplicate `(source, external_id)` is 200 with no second effect. Replay test: 10 replays of one event give 1 effect (PRD success measures).
- Tenant context: a request with no resolved tenant on a tenant route is refused before the query runs (403), and RLS returns zero rows if it were reached.
- Module off: writes to a module's routes return 403 and nothing is written (PRD F-70). Its data is kept.
- Import (F-90 to F-96): a commit needs a successful dry run of the same file and mapping. Rows that fail validation are counted in `import_batches.rows_failed` and listed (first 200) in `report`. The batch as a whole is not rolled back on a bad row. Duplicates (phone or email, E.164 and lower-case) are counted in `rows_duplicate` and handled by `duplicate_rule`. Every created row carries `imported_source`, `import_batch_id` and `external_id` when the file has one. Imports never emit `lead.created` and never enqueue calls or SMS. A consent row is created only when the file maps consent evidence, with source `import`. Undo soft-deletes created records and restores `filled_empty` values from `import_batch_records`; records edited after import are listed, not removed.
- Audit: every write in a covered entity writes one `audit_log` row in the same transaction. If the audit insert fails, the write fails.

## Feature traceability (PRD IDs to tables)

| PRD IDs | Milestone | Tables and columns |
| --- | --- | --- |
| F-70, F-84, F-85, F-86 | M0 | tenant_modules, module_catalog, module_prices, tenants.plan, tenants.pricing_tier |
| F-71, F-73 | M0 | users, memberships.role, users.kynetic_role; Better-Auth tables (incl. two-factor) |
| F-57, F-60 | M0 | impersonation_sessions, audit_log (immutable) |
| F-87 | M0 | tenant_secrets, rate-limit store (Not configured; in-process or Redis is an M0 decision) |
| F-63 | M0 (table), M8 (UI) | backup_runs |
| F-01 to F-03, F-53 | M6 (F-01, F-02, F-03 data); M8 (F-53) | tenants.baseline, guarantee_*, metrics_daily |
| F-05 to F-12 | M1 | contacts, companies, custom_field_defs |
| F-14 to F-17 | M2 | deals, deal_contacts, pipelines, pipeline_stages |
| F-19 | M3 (writes from M1 onward through the helper) | activities |
| F-20, F-22 | M3 | tasks, notes, note_mentions |
| F-24 | M5 | appointments |
| F-26 to F-28, F-30, F-32 (consent part) | M4 | calls, messages, consents |
| F-58, F-42 | M4 (data), M8 (admin UI) | alex_configs, alex_prompts |
| F-62 | M4 | integrations, webhook_events |
| F-99 | M8a | tenant_billing, tenant_billing_modules |
| F-100 | M8a | onboarding_steps |
| F-102 | M0 | terms_acceptances |
| F-103 | M9 | tenant_documents |
| F-106 | Later | tenants.twenty_company_id (reference) |
| F-89, lead intake | M0 (table); M4 (lead intake); M7 (n8n use) | service_tokens, webhook_events |
| F-49 | M6 | reports, metrics_daily |
| F-31 to F-33, F-35 | M7 (tables created in M0) | automation_templates, automations, automation_steps, automation_runs, notifications |
| F-38 | M9 | (export only; no table) |
| F-90 to F-94, F-96 | M9 (tables and columns: M0) | import_batches, import_batch_records, imported_source / import_batch_id / external_id on contacts, companies, deals, notes |
| F-88 | M0 (demo seed), M10 | Synthetic demo tenant seed only; no migration |
| F-79 to F-82, F-84 | M7 | automations, automation_runs, tenant_modules flags |
| F-83, F-48 | M11 | `presence_items`, `review_snapshots` (M11 baseline) |

## Unresolved questions and contradictions

All questions that were open here are closed by Abdullah's approvals on 2026-10-25 (PRD "Decisions log"). What each means for the schema:

Decided:
1. Alex-only clients get the base portal; CRM Lite and Full are paid per-tenant upsells (PRD decision 1, explicit). `crm.level` is `lite` or `full`; core CRM tables always exist.
2. Auth: Better-Auth with Google and magic links, admin TOTP (decisions 2). Auth library tables (including two-factor) are created by the library's migration inside the M0 baseline; `invitations` stays ours.
3. Voice: ElevenLabs primary, Retell fallback. `provider` stays a generic text column.
4. Drizzle, pg-boss, Resend confirmed. Plain SQL migrations for RLS.
5. Existing portal: no migration, clean launch, synthetic demo tenant (F-88). Import rules: PRD decision 17.
6. Upsell backends: `automation_templates.module_key` for `appointment_reminders` and `no_show_recovery` is `alex_core`; OPM tables (`presence_items`, `review_snapshots`) arrive with M11.
7. Follow-up bundle is a flag only.
8. Client-editable Alex settings: pause and call hours. Owner write allow-list is server-side.
9. Retention: PRD decision 9. `calls.purge_after` and the Entities column carry it.
10. Health score and guarantee: `tenants.guarantee_target_bookings`, `guarantee_start_date`.
11. Domain: one portal.kyneticai.com; `tenants.slug` is not used for routing in v1.
12. Pricing: locked $6,500 setup + 3 months then $1,500/mo; `module_prices` keeps only these figures.
13. Targets: PRD decision 13.
14. D-007 governs Kynetic's own prospecting only (PRD decision 14); Alex calls to a client's inbound leads still need `consents` rows per the compliance gate.
15. `audit_log`: Kynetic admin and VA read via `audit_search`.
16. RLS: ENABLE + FORCE, cross-tenant reads through SECURITY DEFINER functions owned by NOLOGIN `kynetic_rollup` (BYPASSRLS).
17. Staff permissions live as columns on `memberships`.
18. Call access for client staff is a membership flag, off by default, owner can enable.
19. `contacts.status` value set: new, working, booked, won, lost, dead.
20. `deal_won` and `hot_lead` notification types are included.
21. Owners see integration status and last error only.
22. Booking hours live in `tenants.business_hours` only in v1.
23. Encryption key for `tenant_secrets` is held in the app secret store (SECURITY 4.2).

UNRESOLVED (needs outside information):
- Two-party-consent state list and consent wording (counsel).
- F-97 connectors and OPM vendors (no tables until chosen).
- Twilio A2P status values beyond the four in `integrations.a2p_status`, once Twilio approves.
- Delivery date.

Contradictions between sources:
1. Plan vs tier. Spec `tenants.plan` is founding or value. Decisions add value tiers T1 to T3 and a founding fee. Resolved by keeping `plan` and adding `pricing_tier`. Both are in the DDL.
2. Existing portal schema vs spec data model. The live VPS portal (`portal/drizzle/0000` to `0002`) has `clients`, `business_profiles`, `scope_items`, `milestones`, `documents`, `daily_results`, `ingest_keys`, `rate_limits` and `auth_tokens`, and a `users` table with password and TOTP columns. None of these are in spec section 5 except the idea of `users`. Spec uses `tenants` and `tenant_id`, where the portal uses `clients` and `client_id`. Spec tables are followed here. No migration is planned (F-88, decided 2026-10-25).
3. Session variables. The existing portal sets `app.client_id` and `app.role` (with `admin`, `client`, `ingest`, `system`). This doc uses `app.tenant_id`, `app.user_id`, `app.role` (`owner`, `staff`, `admin`, `va`, `system`) and `app.impersonator_id` (ARCHITECTURE). The same name `app.role` has different values in the two systems. Two RLS models will exist during migration.
4. Onboarding vs tier. The onboarding form (F-55) has no average job value, but tier is chosen at onboarding (F-86). `avg_job_value_cents` is therefore nullable and `pricing_tier` is nullable until someone enters it.
5. Auth. Spec stack says Better-Auth with Google and magic link. Decisions say Better-Auth or Auth.js. The existing portal uses its own password and TOTP, not a library. Decided: Better-Auth (PRD decision 2); auth tables come from its migration.
6. Price format. Decisions write "Monthly (setup)", for example "Alex core $2.5K($10K)". The PRD reads the parenthetical as setup. CRM build-out was written as "$3.5K + $500/mo" in the locked decisions and is now $1,000 setup + $500/mo (Lite) and $2,000 setup + $750/mo (Full), the same shape as the other modules. `module_prices` follows the PRD reading.
7. Base product vs upsell. Spec section 1 sells the CRM as the product ("a CRM good enough that clients drop their old one"). Decisions list "CRM build-out (Lite/Full)" as a module. Schema treats the core CRM tables as always present and `crm` as a level flag (PRD F-85). PRD decision 1 settles what Alex-only clients get any CRM.
8. Reviews. Spec feature F-48 ("Reviews add-on", Later) has no matching decision module. PRD maps it to `opm` (decided, recommended option).
9. "Revenue recovered" (F-01) had no definition in any source. Decided 2026-10-25: PRD "Metric definitions" (Won deal value with an Alex call or booking); `metrics_daily` columns follow it.
10. Module-off behavior. PRD says data is kept when a module is off. Automation templates and runs under a disabled module move to `stopped_module_off` (kept). Consistent, but the spec does not say so; this doc adds the status.
11. Milestone order vs writes. Spec wave 2 runs M4 in parallel with M1, but M4 writes `activities`, `contacts` and `calls`. Resolved: the M0 baseline creates every table, so no milestone waits on another's migration (ARCHITECTURE section 1). Feature code still follows the milestone's dependency rules.
12. Pipeline stage names. Spec default stages match PRD F-17. No conflict. Recorded so nobody renames them in the seed.

Cross-document check items:
- Feature IDs are PRD IDs (F-01 to F-106). Spec section numbering is not used.
- Module keys match PRD v4 and ARCHITECTURE exactly.
- CODE_STYLE decided `tenant_modules(tenant_id, module_key, enabled, config jsonb, updated_at)`. This doc adds `level`, `changed_by` and `changed_at`, which the PRD F-70 requires (changed-by, timestamp) and the CRM level requires.
