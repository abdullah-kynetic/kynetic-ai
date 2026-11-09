-- Staff alerts belong to the agency, not client tenant memberships.
CREATE TABLE agency_alerts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES agency_workspaces(tenant_id) ON DELETE RESTRICT,
 kind text NOT NULL CHECK (kind IN ('new_lead','daily_digest')),
 title text NOT NULL,
 body text NOT NULL,
 event_key text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,event_key)
);
--> statement-breakpoint
SELECT app_enable_tenant_rls('agency_alerts'::regclass);
