-- M0-06: baseline part B. CRM tables (companies, custom fields, contacts, pipelines, deals,
-- activities, tasks, notes) from DATABASE.md, in dependency order, with RLS.

CREATE EXTENSION IF NOT EXISTS btree_gin;  -- tenant_id + array GIN indexes on contacts (DATABASE.md note)
--> statement-breakpoint
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
--> statement-breakpoint
CREATE INDEX companies_tenant_name_idx ON companies (tenant_id, name) WHERE deleted_at IS NULL;
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
CREATE INDEX contacts_tenant_list_idx ON contacts (tenant_id, updated_at DESC) WHERE deleted_at IS NULL;
--> statement-breakpoint
CREATE INDEX contacts_tenant_phone_idx ON contacts (tenant_id, primary_phone_e164) WHERE deleted_at IS NULL;
--> statement-breakpoint
CREATE INDEX contacts_tenant_email_idx ON contacts (tenant_id, primary_email) WHERE deleted_at IS NULL;
--> statement-breakpoint
CREATE INDEX contacts_phones_gin ON contacts USING gin (tenant_id, phones);   -- dedupe on any phone (F-07); btree_gin needed; see Queries
--> statement-breakpoint
CREATE INDEX contacts_emails_gin ON contacts USING gin (tenant_id, emails);
--> statement-breakpoint
CREATE INDEX contacts_custom_gin ON contacts USING gin (custom jsonb_path_ops);
--> statement-breakpoint
CREATE INDEX contacts_name_trgm ON contacts USING gin ((first_name || ' ' || coalesce(last_name, '')) gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX contacts_owner_idx ON contacts (tenant_id, owner_id) WHERE deleted_at IS NULL;
--> statement-breakpoint
CREATE TABLE pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  is_default boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id)
);
--> statement-breakpoint
CREATE UNIQUE INDEX pipelines_one_default ON pipelines (tenant_id) WHERE is_default;
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
CREATE INDEX deals_board_idx ON deals (tenant_id, pipeline_id, stage_id, position) WHERE deleted_at IS NULL;
--> statement-breakpoint
CREATE INDEX deals_owner_idx ON deals (tenant_id, owner_id) WHERE deleted_at IS NULL;
--> statement-breakpoint
CREATE INDEX deals_close_idx ON deals (tenant_id, expected_close) WHERE deleted_at IS NULL;
--> statement-breakpoint
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
--> statement-breakpoint
CREATE INDEX deal_contacts_tenant_idx ON deal_contacts (tenant_id, contact_id);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE INDEX activities_contact_idx ON activities (tenant_id, contact_id, occurred_at DESC);
--> statement-breakpoint
CREATE INDEX activities_deal_idx ON activities (tenant_id, deal_id, occurred_at DESC);
--> statement-breakpoint
CREATE INDEX activities_type_idx ON activities (tenant_id, type, occurred_at DESC);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE INDEX tasks_my_idx ON tasks (tenant_id, assignee_id, due_at) WHERE completed_at IS NULL AND deleted_at IS NULL;
--> statement-breakpoint
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
--> statement-breakpoint
CREATE INDEX notes_parent_idx ON notes (tenant_id, contact_id, pinned DESC, created_at DESC) WHERE deleted_at IS NULL;
--> statement-breakpoint
CREATE TABLE note_mentions (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  note_id uuid NOT NULL,
  user_id uuid NOT NULL,
  PRIMARY KEY (note_id, user_id),
  FOREIGN KEY (tenant_id, note_id) REFERENCES notes (tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, user_id) REFERENCES memberships (tenant_id, user_id) ON DELETE CASCADE
);
--> statement-breakpoint
SELECT app_enable_tenant_rls(t) FROM unnest(ARRAY[
  'companies','custom_field_defs','contacts','pipelines','pipeline_stages','deals','deal_contacts',
  'activities','tasks','notes','note_mentions'
]::regclass[]) AS t;
