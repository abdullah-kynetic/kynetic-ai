CREATE TABLE "recovery_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recovery_codes" ADD CONSTRAINT "recovery_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recovery_codes_user_idx" ON "recovery_codes" USING btree ("user_id");--> statement-breakpoint
-- Only the auth layer (system scope, after a session or login check) may touch recovery codes.
ALTER TABLE recovery_codes ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE recovery_codes FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY system_all ON recovery_codes FOR ALL USING (app_role() = 'system') WITH CHECK (app_role() = 'system');--> statement-breakpoint
CREATE POLICY admin_all ON recovery_codes FOR ALL USING (app_role() = 'admin') WITH CHECK (app_role() = 'admin');--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON recovery_codes TO portal_app;
