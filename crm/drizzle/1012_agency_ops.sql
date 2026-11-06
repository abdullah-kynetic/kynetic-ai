CREATE TABLE agency_ops_settings (
 tenant_id uuid PRIMARY KEY REFERENCES agency_workspaces(tenant_id) ON DELETE RESTRICT,
 dev_webhook_url text NOT NULL,
 workflow_name text NOT NULL CHECK(workflow_name LIKE 'DEV - %'),
 workflow_id text NOT NULL CHECK(workflow_id ~ '^[A-Za-z0-9_-]{1,80}$'),
 updated_by uuid NOT NULL REFERENCES users(id),
 updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
SELECT app_enable_tenant_rls('agency_ops_settings'::regclass);
