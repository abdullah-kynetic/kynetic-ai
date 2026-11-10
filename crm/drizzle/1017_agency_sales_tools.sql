-- Agency contracts, finance, and document versions. No outbound delivery.
CREATE TABLE agency_contracts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES agency_workspaces(tenant_id) ON DELETE RESTRICT,
 deal_id uuid NOT NULL,
 title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','signed','void')),
 sent_on date,
 signed_on date,
 notes text NOT NULL DEFAULT '' CHECK (length(notes) <= 2000),
 signed_file_key text,
 created_by uuid NOT NULL REFERENCES users(id),
 updated_by uuid NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (tenant_id, id),
 FOREIGN KEY (tenant_id, deal_id) REFERENCES deals(tenant_id, id) ON DELETE RESTRICT,
 CHECK (signed_file_key IS NULL OR signed_file_key <> '')
);
--> statement-breakpoint
CREATE TABLE agency_expenses (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES agency_workspaces(tenant_id) ON DELETE RESTRICT,
 spent_on date NOT NULL,
 vendor text NOT NULL CHECK (length(btrim(vendor)) BETWEEN 1 AND 200),
 category text NOT NULL CHECK (length(btrim(category)) BETWEEN 1 AND 80),
 amount_cents integer NOT NULL CHECK (amount_cents >= 0),
 note text NOT NULL DEFAULT '' CHECK (length(note) <= 2000),
 created_by uuid NOT NULL REFERENCES users(id),
 updated_by uuid NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 deleted_at timestamptz
);
--> statement-breakpoint
CREATE TABLE agency_revenue_entries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES agency_workspaces(tenant_id) ON DELETE RESTRICT,
 deal_id uuid,
 received_on date NOT NULL,
 amount_cents integer NOT NULL CHECK (amount_cents > 0),
 note text NOT NULL DEFAULT '' CHECK (length(note) <= 2000),
 created_by uuid NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 deleted_at timestamptz,
 FOREIGN KEY (tenant_id, deal_id) REFERENCES deals(tenant_id, id) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE agency_referrals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES agency_workspaces(tenant_id) ON DELETE RESTRICT,
 referrer_name text NOT NULL CHECK (length(btrim(referrer_name)) BETWEEN 1 AND 200),
 contact_id uuid,
 status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','approved','declined')),
 reward_note text NOT NULL DEFAULT '' CHECK (length(reward_note) <= 2000),
 approved_by uuid REFERENCES users(id),
 approved_at timestamptz,
 created_by uuid NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (tenant_id, contact_id) REFERENCES contacts(tenant_id, id) ON DELETE RESTRICT,
 CHECK ((status = 'approved') = (approved_at IS NOT NULL AND approved_by IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE agency_case_studies (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES agency_workspaces(tenant_id) ON DELETE RESTRICT,
 client_tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT,
 status text NOT NULL DEFAULT 'idea' CHECK (status IN ('idea','drafting','approved','published')),
 url text CHECK (url IS NULL OR length(url) BETWEEN 1 AND 500),
 note text NOT NULL DEFAULT '' CHECK (length(note) <= 2000),
 created_by uuid NOT NULL REFERENCES users(id),
 updated_by uuid NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE tenant_documents ADD COLUMN deleted_at timestamptz;
--> statement-breakpoint
ALTER TABLE tenant_documents ADD COLUMN superseded_by uuid;
--> statement-breakpoint
ALTER TABLE tenant_documents ADD CONSTRAINT tenant_documents_tenant_id_id_key UNIQUE (tenant_id, id);
--> statement-breakpoint
ALTER TABLE tenant_documents ADD CONSTRAINT tenant_documents_superseded_by_fkey
 FOREIGN KEY (tenant_id, superseded_by) REFERENCES tenant_documents (tenant_id, id) ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE tenant_documents ADD CONSTRAINT tenant_documents_not_self
 CHECK (superseded_by IS NULL OR superseded_by <> id);
--> statement-breakpoint
DO $$
DECLARE r record;
BEGIN
 FOR r IN
  SELECT conname FROM pg_constraint
  WHERE conrelid = 'agency_campaign_history'::regclass AND contype = 'u'
 LOOP
  EXECUTE format('ALTER TABLE agency_campaign_history DROP CONSTRAINT %I', r.conname);
 END LOOP;
 FOR r IN
  SELECT conname FROM pg_constraint
  WHERE conrelid = 'agency_campaign_history'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%simulated%'
 LOOP
  EXECUTE format('ALTER TABLE agency_campaign_history DROP CONSTRAINT %I', r.conname);
 END LOOP;
END $$;
--> statement-breakpoint
ALTER TABLE agency_campaign_history ADD CONSTRAINT agency_campaign_history_result_check
 CHECK (result IN ('simulated','manual_complete','done','skipped','rescheduled'));
--> statement-breakpoint
ALTER TABLE agency_campaign_history ADD COLUMN recorded_by uuid REFERENCES users(id);
--> statement-breakpoint
ALTER TABLE agency_campaign_history ADD COLUMN note text CHECK (note IS NULL OR length(note) <= 1000);
--> statement-breakpoint
SELECT app_enable_tenant_rls(t) FROM unnest(ARRAY[
 'agency_contracts','agency_expenses','agency_revenue_entries','agency_referrals','agency_case_studies'
]::regclass[]) t;
--> statement-breakpoint
REVOKE DELETE ON agency_contracts, agency_expenses, agency_revenue_entries, agency_referrals, agency_case_studies
 FROM kynetic_app, kynetic_worker;
--> statement-breakpoint
ALTER TABLE agency_call_attempts DROP CONSTRAINT agency_call_attempts_tenant_id_contact_id_key;
