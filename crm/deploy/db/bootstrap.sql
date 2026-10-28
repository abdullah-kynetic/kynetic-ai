-- Cluster-level role bootstrap. Run once per cluster by a superuser (psql), never by the app.
-- Idempotent. Passwords come from psql variables so none live in the repo:
--   psql -v owner_pw=... -v app_pw=... -v worker_pw=... -v auth_pw=... -v backup_pw=... -f bootstrap.sql
-- Role model: DATABASE.md "Storage model", SECURITY 2.3.
\set ON_ERROR_STOP on

SELECT format('CREATE ROLE kynetic_owner LOGIN PASSWORD %L', :'owner_pw')
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kynetic_owner') \gexec
SELECT format('ALTER ROLE kynetic_owner PASSWORD %L', :'owner_pw') \gexec

SELECT 'CREATE ROLE kynetic_rollup NOLOGIN BYPASSRLS'
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kynetic_rollup') \gexec

SELECT format('CREATE ROLE kynetic_auth LOGIN PASSWORD %L NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE', :'auth_pw')
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kynetic_auth') \gexec
SELECT format('ALTER ROLE kynetic_auth PASSWORD %L NOBYPASSRLS', :'auth_pw') \gexec

SELECT format('CREATE ROLE kynetic_app LOGIN PASSWORD %L NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE', :'app_pw')
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kynetic_app') \gexec
SELECT format('ALTER ROLE kynetic_app PASSWORD %L NOBYPASSRLS', :'app_pw') \gexec

SELECT format('CREATE ROLE kynetic_worker LOGIN PASSWORD %L NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE', :'worker_pw')
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kynetic_worker') \gexec
SELECT format('ALTER ROLE kynetic_worker PASSWORD %L NOBYPASSRLS', :'worker_pw') \gexec

SELECT format('CREATE ROLE kynetic_backup LOGIN PASSWORD %L NOSUPERUSER NOCREATEROLE BYPASSRLS CREATEDB', :'backup_pw')
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kynetic_backup') \gexec
SELECT format('ALTER ROLE kynetic_backup PASSWORD %L NOSUPERUSER CREATEDB NOCREATEROLE BYPASSRLS', :'backup_pw') \gexec

GRANT USAGE ON SCHEMA public TO kynetic_backup;
ALTER DEFAULT PRIVILEGES FOR ROLE kynetic_owner IN SCHEMA public GRANT SELECT ON TABLES TO kynetic_backup;
ALTER DEFAULT PRIVILEGES FOR ROLE kynetic_owner IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO kynetic_backup;

-- The owner may hand function ownership to the NOLOGIN roll-up role (M0-09).
GRANT kynetic_rollup TO kynetic_owner;

-- Run once per database: make the owner own it and close the public schema to everyone else.
-- (Executed by the deploy and test helpers with the target database selected.)
