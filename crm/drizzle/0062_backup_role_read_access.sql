-- F-63: allow the dedicated backup role to dump application objects without write access.
GRANT USAGE ON SCHEMA public TO kynetic_backup;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO kynetic_backup;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO kynetic_backup;

ALTER DEFAULT PRIVILEGES FOR ROLE kynetic_owner IN SCHEMA public
  GRANT SELECT ON TABLES TO kynetic_backup;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES FOR ROLE kynetic_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO kynetic_backup;
--> statement-breakpoint
DO $$ BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO kynetic_backup', current_database());
END $$;
