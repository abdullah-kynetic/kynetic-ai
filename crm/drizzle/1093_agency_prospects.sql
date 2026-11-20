-- Design workspace only: synthetic prospecting funnel. Apply to disposable dev/test databases.
CREATE TABLE agency_prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES agency_workspaces(tenant_id) ON DELETE RESTRICT,
  business_name text NOT NULL CHECK (length(btrim(business_name)) BETWEEN 1 AND 200),
  source text NOT NULL CHECK (source IN ('google_maps', 'directory', 'referral', 'manual')),
  stage text NOT NULL DEFAULT 'scraped' CHECK (stage IN ('scraped', 'half_enriched', 'fully_enriched')),
  website text,
  phone text,
  email text,
  owner_name text,
  city text,
  state text,
  moved_deal_id uuid REFERENCES deals(id) ON DELETE RESTRICT,
  moved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((moved_deal_id IS NULL) = (moved_at IS NULL))
);
--> statement-breakpoint
CREATE INDEX agency_prospects_tenant_stage_idx ON agency_prospects (tenant_id, stage, created_at DESC);
--> statement-breakpoint
SELECT app_enable_tenant_rls('agency_prospects'::regclass);
