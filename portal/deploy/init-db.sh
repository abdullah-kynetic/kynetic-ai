#!/bin/sh
# Runs once on first start of an empty portal-db volume (postgres image entrypoint).
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<SQL
CREATE ROLE portal_owner LOGIN PASSWORD '${PORTAL_OWNER_PASSWORD}' NOSUPERUSER NOBYPASSRLS;
CREATE ROLE portal_app   LOGIN PASSWORD '${PORTAL_APP_PASSWORD}'   NOSUPERUSER NOBYPASSRLS;
CREATE DATABASE portal OWNER portal_owner;
SQL
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname portal <<SQL
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO portal_owner;
GRANT USAGE ON SCHEMA public TO portal_app;
REVOKE ALL ON DATABASE portal FROM PUBLIC;
GRANT CONNECT ON DATABASE portal TO portal_owner, portal_app;
SQL
