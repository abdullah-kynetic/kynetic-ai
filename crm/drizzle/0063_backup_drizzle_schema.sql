-- F-63: pg_dump also reads Drizzle's migration ledger in the drizzle schema.
GRANT USAGE ON SCHEMA drizzle TO kynetic_backup;
GRANT SELECT ON ALL TABLES IN SCHEMA drizzle TO kynetic_backup;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA drizzle TO kynetic_backup;

ALTER DEFAULT PRIVILEGES FOR ROLE kynetic_owner IN SCHEMA drizzle
  GRANT SELECT ON TABLES TO kynetic_backup;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES FOR ROLE kynetic_owner IN SCHEMA drizzle
  GRANT USAGE, SELECT ON SEQUENCES TO kynetic_backup;
