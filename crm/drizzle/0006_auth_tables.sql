-- M0-10: Better-Auth tables and the kynetic_auth role grants (DC-055).
-- The auth library connects as kynetic_auth, never as kynetic_app. It sees the global auth tables and
-- a column-limited slice of users, memberships and invitations to decide who may sign in. Tenant data is
-- out of reach: no grant on any other table, and the tenant tables' policies do not name this role.
GRANT USAGE ON SCHEMA public TO kynetic_auth;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN email_verified boolean NOT NULL DEFAULT false;
--> statement-breakpoint
CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX sessions_user_idx ON sessions (user_id);
--> statement-breakpoint
CREATE TABLE accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id text NOT NULL,
  provider_id text NOT NULL,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  password text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_id, account_id)
);
--> statement-breakpoint
CREATE INDEX accounts_user_idx ON accounts (user_id);
--> statement-breakpoint
CREATE TABLE verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  value text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX verifications_identifier_idx ON verifications (identifier);
--> statement-breakpoint
-- Global auth tables: only kynetic_auth. Default privileges gave the runtime roles full access, so revoke.
REVOKE ALL ON sessions, accounts, verifications FROM kynetic_app, kynetic_worker;
--> statement-breakpoint
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE sessions FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE accounts FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE verifications ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE verifications FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY auth_all ON sessions FOR ALL TO kynetic_auth USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY auth_all ON accounts FOR ALL TO kynetic_auth USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY auth_all ON verifications FOR ALL TO kynetic_auth USING (true) WITH CHECK (true);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON sessions, accounts, verifications TO kynetic_auth;
--> statement-breakpoint
-- users: kynetic_auth may create and look up users and record sign-in. Column grants (not the policy) stop it setting kynetic_role,
-- disabled_at or two_factor_enabled; staff roles are granted by an admin through a separate path.
CREATE POLICY users_auth_select ON users FOR SELECT TO kynetic_auth USING (true);
--> statement-breakpoint
CREATE POLICY users_auth_insert ON users FOR INSERT TO kynetic_auth WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY users_auth_update ON users FOR UPDATE TO kynetic_auth USING (true) WITH CHECK (true);
--> statement-breakpoint
GRANT SELECT ON users TO kynetic_auth;
--> statement-breakpoint
GRANT INSERT (id, email, name, image, email_verified, created_at, updated_at) ON users TO kynetic_auth;
--> statement-breakpoint
GRANT UPDATE (name, image, email_verified, last_login_at, updated_at) ON users TO kynetic_auth;
--> statement-breakpoint
-- Sign-in gate inputs: does this user belong to a tenant, is there a pending invitation for this email.
CREATE POLICY memberships_auth_select ON memberships FOR SELECT TO kynetic_auth USING (true);
--> statement-breakpoint
GRANT SELECT (user_id) ON memberships TO kynetic_auth;
--> statement-breakpoint
CREATE POLICY invitations_auth_select ON invitations FOR SELECT TO kynetic_auth USING (true);
--> statement-breakpoint
GRANT SELECT (email, expires_at, accepted_at, revoked_at) ON invitations TO kynetic_auth;
