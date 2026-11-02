-- M16-03/04/06: manual activity only; no provider calls, jobs or automated sends.
CREATE TABLE agency_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES agency_workspaces(tenant_id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  script text NOT NULL CHECK (length(btrim(script)) BETWEEN 1 AND 5000),
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id)
);
--> statement-breakpoint
CREATE UNIQUE INDEX agency_campaigns_name_uq ON agency_campaigns(tenant_id, lower(name));
--> statement-breakpoint
CREATE TABLE agency_campaign_leads (
  tenant_id uuid NOT NULL REFERENCES agency_workspaces(tenant_id) ON DELETE RESTRICT,
  campaign_id uuid NOT NULL,
  contact_id uuid NOT NULL,
  PRIMARY KEY (tenant_id, campaign_id, contact_id),
  FOREIGN KEY (tenant_id, campaign_id) REFERENCES agency_campaigns(tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, contact_id) REFERENCES contacts(tenant_id, id) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE agency_call_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES agency_workspaces(tenant_id) ON DELETE RESTRICT,
  contact_id uuid NOT NULL,
  event_id uuid NOT NULL,
  request_hash text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  outcome text NOT NULL CHECK (outcome IN ('no_answer','voicemail','connected','interested','not_interested','callback','dnc')),
  notes text NOT NULL DEFAULT '' CHECK (length(notes) <= 1000),
  logged_by uuid NOT NULL REFERENCES users(id),
  logged_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, contact_id),
  UNIQUE (tenant_id, event_id),
  FOREIGN KEY (tenant_id, contact_id) REFERENCES contacts(tenant_id, id) ON DELETE RESTRICT
);
--> statement-breakpoint
SELECT app_enable_tenant_rls(t) FROM unnest(ARRAY['agency_campaigns','agency_campaign_leads','agency_call_attempts']::regclass[]) AS t;
--> statement-breakpoint
REVOKE UPDATE, DELETE ON agency_call_attempts FROM kynetic_app, kynetic_worker;
