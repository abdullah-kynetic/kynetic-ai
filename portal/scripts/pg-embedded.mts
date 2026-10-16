/**
 * Local Postgres for dev and tests (no Docker needed): starts an embedded cluster, creates the
 * `portal` database with `portal_owner` (migrations) and `portal_app` (runtime, RLS-bound) roles.
 */
import EmbeddedPostgres from "embedded-postgres";
import postgres from "postgres";
import { rm } from "node:fs/promises";

export type LocalPg = { ownerUrl: string; appUrl: string; stop: () => Promise<void> };

export async function startLocalPg(opts: { dir: string; port: number; fresh?: boolean }): Promise<LocalPg> {
  if (opts.fresh) await rm(opts.dir, { recursive: true, force: true });
  const pg = new EmbeddedPostgres({ databaseDir: opts.dir, user: "postgres", password: "postgres", port: opts.port, persistent: !opts.fresh, onLog: () => {}, onError: () => {} });
  let initialised = true;
  try { await pg.initialise(); } catch { initialised = false; /* already initialised */ }
  await pg.start();
  const su = postgres(`postgres://postgres:postgres@127.0.0.1:${opts.port}/postgres`, { max: 1, onnotice: () => {} });
  const [{ exists }] = await su`select exists(select 1 from pg_database where datname = 'portal') as exists`;
  if (!exists) {
    await su.unsafe(`do $$ begin
      if not exists (select 1 from pg_roles where rolname='portal_owner') then create role portal_owner login password 'owner_local'; end if;
      if not exists (select 1 from pg_roles where rolname='portal_app') then create role portal_app login password 'app_local' nosuperuser nobypassrls; end if;
    end $$;`);
    await su.unsafe(`create database portal owner portal_owner`);
    const db = postgres(`postgres://postgres:postgres@127.0.0.1:${opts.port}/portal`, { max: 1, onnotice: () => {} });
    await db.unsafe(`revoke all on schema public from public; grant all on schema public to portal_owner; grant usage on schema public to portal_app; create extension if not exists pgcrypto;`);
    await db.end();
  }
  await su.end();
  void initialised;
  return {
    ownerUrl: `postgres://portal_owner:owner_local@127.0.0.1:${opts.port}/portal`,
    appUrl: `postgres://portal_app:app_local@127.0.0.1:${opts.port}/portal`,
    stop: () => pg.stop(),
  };
}
