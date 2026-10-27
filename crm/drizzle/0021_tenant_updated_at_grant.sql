-- M9-09: settings writes stamp tenants.updated_at, so the runtime role needs that column in its
-- UPDATE allow-list (DC-081). Still no access to plan, pricing tier, status, baseline or guarantee.
GRANT UPDATE (updated_at) ON tenants TO kynetic_app;
