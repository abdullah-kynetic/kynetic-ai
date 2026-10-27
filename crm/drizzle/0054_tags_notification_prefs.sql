-- M9-11: tag registry (F-43) and per-user notification preferences (F-36). Both are tenant tables with
-- the standard RLS. A tag on a contact stays in contacts.tags; the registry only lets an owner create a
-- tag before it is used and gives rename and delete one place to start. A missing preference row means
-- the default (email on).
CREATE TABLE tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 50 AND name = btrim(name)),
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX tags_tenant_name_uq ON tags (tenant_id, lower(name));
--> statement-breakpoint
CREATE TABLE notification_preferences (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('new_lead','booked','task_due','report_ready','action_needed','deal_won','hot_lead')),
  email_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id, kind),
  FOREIGN KEY (tenant_id, user_id) REFERENCES memberships (tenant_id, user_id) ON DELETE CASCADE
);
--> statement-breakpoint
SELECT app_enable_tenant_rls(t) FROM unnest(ARRAY['tags','notification_preferences']::regclass[]) AS t;
