CREATE TABLE agency_deal_terms (
 tenant_id uuid NOT NULL REFERENCES agency_workspaces(tenant_id) ON DELETE RESTRICT,
 deal_id uuid NOT NULL,
 currency text NOT NULL CHECK(currency='USD'),
 setup_cents integer NOT NULL CHECK(setup_cents>=0),
 monthly_cents integer CHECK(monthly_cents>0),
 installments jsonb NOT NULL CHECK(jsonb_typeof(installments)='array'),
 updated_by uuid NOT NULL REFERENCES users(id),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,deal_id),
 FOREIGN KEY(tenant_id,deal_id) REFERENCES deals(tenant_id,id) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE agency_invoice_drafts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES agency_workspaces(tenant_id) ON DELETE RESTRICT,
 deal_id uuid NOT NULL,
 cycle_key text NOT NULL,
 terms_hash text NOT NULL CHECK(terms_hash ~ '^[0-9a-f]{64}$'),
 amount_cents integer NOT NULL CHECK(amount_cents>0),
 currency text NOT NULL CHECK(currency='USD'),
 due_on date NOT NULL,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','open','paid','past_due')),
 provider text NOT NULL DEFAULT 'stub' CHECK(provider='stub'),
 last_event_created bigint NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id),
 UNIQUE(tenant_id,deal_id,cycle_key),
 FOREIGN KEY(tenant_id,deal_id) REFERENCES agency_deal_terms(tenant_id,deal_id) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE agency_billing_events (
 tenant_id uuid NOT NULL,
 event_id text NOT NULL,
 invoice_id uuid NOT NULL,
 payload_hash text NOT NULL CHECK(payload_hash ~ '^[0-9a-f]{64}$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,event_id),
 FOREIGN KEY(tenant_id,invoice_id) REFERENCES agency_invoice_drafts(tenant_id,id) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE agency_dunning_drafts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL,
 invoice_id uuid NOT NULL,
 day date NOT NULL,
 body text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,invoice_id,day),
 FOREIGN KEY(tenant_id,invoice_id) REFERENCES agency_invoice_drafts(tenant_id,id) ON DELETE RESTRICT
);
--> statement-breakpoint
SELECT app_enable_tenant_rls(t) FROM unnest(ARRAY['agency_deal_terms','agency_invoice_drafts','agency_billing_events','agency_dunning_drafts']::regclass[]) t;
