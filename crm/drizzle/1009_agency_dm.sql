CREATE TABLE agency_dm_logs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES agency_workspaces(tenant_id) ON DELETE RESTRICT,
 contact_id uuid NOT NULL,
 direction text NOT NULL CHECK(direction IN ('inbound','outbound')),
 platform text NOT NULL CHECK(length(btrim(platform)) BETWEEN 1 AND 80),
 body text NOT NULL CHECK(length(btrim(body)) BETWEEN 1 AND 5000),
 occurred_at timestamptz NOT NULL DEFAULT now(),
 logged_by uuid NOT NULL REFERENCES users(id),
 FOREIGN KEY(tenant_id,contact_id) REFERENCES contacts(tenant_id,id) ON DELETE RESTRICT
);
--> statement-breakpoint
SELECT app_enable_tenant_rls('agency_dm_logs'::regclass);
