-- M4-09 (F-30, F-35): addresses that bounced or complained, and the tenant lookup for Resend events.
-- email_suppressions is tenant-scoped; the runtime may insert and update (a complaint upgrades a
-- bounce) but never delete, so lifting a suppression is an admin tool for a later task.
CREATE TABLE email_suppressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  address text NOT NULL CHECK (address = lower(address)),
  reason text NOT NULL CHECK (reason IN ('bounced','complained')),
  provider_message_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, address)
);
--> statement-breakpoint
SELECT app_enable_tenant_rls('email_suppressions'::regclass);
--> statement-breakpoint
REVOKE DELETE ON email_suppressions FROM kynetic_app, kynetic_worker;
--> statement-breakpoint
-- Resend events carry only the provider's email id. Tenant resolution uses our own messages row
-- (SECURITY 3.6 item 6), never a payload field. The worker has no cross-tenant read, so this
-- SECURITY DEFINER function, owned by the roll-up role, returns the one tenant id and nothing else.
GRANT SELECT (tenant_id, provider, provider_message_id) ON messages TO kynetic_rollup;
--> statement-breakpoint
GRANT CREATE ON SCHEMA public TO kynetic_rollup;
--> statement-breakpoint
CREATE FUNCTION email_message_tenant(p_provider_message_id text) RETURNS uuid
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT m.tenant_id FROM messages m
  WHERE m.provider = 'resend' AND m.provider_message_id = p_provider_message_id LIMIT 1 $$;
--> statement-breakpoint
ALTER FUNCTION email_message_tenant(text) OWNER TO kynetic_rollup;
--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM kynetic_rollup;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION email_message_tenant(text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION email_message_tenant(text) TO kynetic_worker;
