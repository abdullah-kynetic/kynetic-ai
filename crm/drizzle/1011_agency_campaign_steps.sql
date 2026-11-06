ALTER TABLE agency_campaigns ADD COLUMN steps jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(steps)='array' AND jsonb_array_length(steps)<=20);
--> statement-breakpoint
CREATE TABLE agency_campaign_progress (
 tenant_id uuid NOT NULL REFERENCES agency_workspaces(tenant_id) ON DELETE RESTRICT,
 campaign_id uuid NOT NULL,
 contact_id uuid NOT NULL,
 step_index integer NOT NULL DEFAULT 0 CHECK(step_index>=0),
 due_at timestamptz NOT NULL,
 state text NOT NULL DEFAULT 'active' CHECK(state IN ('active','stopped','complete')),
 stop_reason text,
 enrolled_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,campaign_id,contact_id),
 FOREIGN KEY(tenant_id,campaign_id,contact_id) REFERENCES agency_campaign_leads(tenant_id,campaign_id,contact_id) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE agency_campaign_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL,
 campaign_id uuid NOT NULL,
 contact_id uuid NOT NULL,
 step_index integer NOT NULL CHECK(step_index>=0),
 channel text NOT NULL CHECK(channel IN ('call','sms','email','dm')),
 result text NOT NULL CHECK(result IN ('simulated','manual_complete')),
 recorded_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,campaign_id,contact_id,step_index),
 FOREIGN KEY(tenant_id,campaign_id,contact_id) REFERENCES agency_campaign_progress(tenant_id,campaign_id,contact_id) ON DELETE RESTRICT
);
--> statement-breakpoint
SELECT app_enable_tenant_rls(t) FROM unnest(ARRAY['agency_campaign_progress','agency_campaign_history']::regclass[]) t;
