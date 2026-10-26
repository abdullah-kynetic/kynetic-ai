-- M0-11: resolve the caller's membership in the requested tenant on the auth connection.
-- The tenant id on a request is only a claim; a membership row (and a tenant that is not suspended)
-- is what makes it count. Column-limited, read-only.
GRANT SELECT (tenant_id, role, can_export, can_bulk_delete) ON memberships TO kynetic_auth;
--> statement-breakpoint
CREATE POLICY tenants_auth_select ON tenants FOR SELECT TO kynetic_auth USING (true);
--> statement-breakpoint
GRANT SELECT (id, status) ON tenants TO kynetic_auth;
