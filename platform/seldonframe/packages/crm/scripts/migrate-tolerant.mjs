#!/usr/bin/env node
// packages/crm/scripts/migrate-tolerant.mjs
//
// 2026-05-20 — Tolerant wrapper around `drizzle-kit migrate` for Vercel builds.
// 2026-05-29 — Made LOUD. Previously this swallowed ALL errors and exited 0,
//   which is what let two migrations reach prod silently (0019_silky_viper /
//   users.stripe_payment_method_id, and 0055_users_onboarding_completed_at).
//   The build log even said "migrations applied cleanly" because, from
//   drizzle's view, nothing new was in the journal to apply.
//
// ── The tradeoff this script manages
//
// Production migrations are sometimes applied out-of-band via the Neon MCP
// (scripts/apply-prod-migrations.mjs applies SQL directly, without writing to
// __drizzle_migrations). The journal + tracker can therefore drift from
// reality. When that happens, `drizzle-kit migrate` may try to re-apply a
// migration whose table/column already exists and error with e.g. 42701
// "column already exists". That kind of error is SAFE: the schema already has
// the thing. Failing the deploy on it would be the wrong call.
//
// But "the thing already exists" is the ONLY class of error that's safe to
// swallow. A migration that errors for a real reason (bad SQL, missing
// referenced table, a typo) MUST break the deploy — otherwise it ships broken
// schema and 500s authenticated requests, which is exactly what happened
// twice. So:
//
//   • Idempotent / already-applied errors (42701 column exists, 42P07 relation
//     exists, 42710 duplicate object, 42712 dup alias, 42723 dup function,
//     23505 unique violation on a tracker re-insert) → SAFE-SKIP: warn, continue.
//   • Everything else, including connection failures → FATAL: fail the build.
//
// Log lines are deliberately greppable:
//   [migrate-tolerant] SAFE-SKIP: <code> <message>
//   [migrate-tolerant] FATAL:    <code> <message>
//
// Escape hatch: MIGRATION_STRICT=1 forces even SAFE-SKIP classes to fail
// (useful when you want a hard guarantee the journal/tracker are in sync).
//
// 2026-08-29 — Switched from shelling out to `drizzle-kit migrate` to calling
// drizzle-orm's own `migrate()` directly over the neon-http driver (the same
// driver src/db/index.ts uses at runtime). Two independent reasons:
//   1. drizzle-kit's CLI spinner was swallowing the real Postgres/connection
//      error on every Vercel build failure — logs only ever showed
//      "(no SQLSTATE found)" and a wall of unreadable spinner frames, even
//      with CI=1/FORCE_COLOR=0 set on the child process.
//   2. drizzle-kit migrate opens a WebSocket connection to Neon; the app's
//      own runtime queries go over plain HTTPS via neon-http. If Vercel's
//      build sandbox allows outbound HTTPS but blocks the WebSocket
//      upgrade, that alone would explain a silent connection failure on
//      every build — switching to the same driver the app already uses
//      successfully removes that as a variable entirely.
// The SAFE_SKIP/FATAL classification and log format are unchanged; only how
// the migration actually runs and how its error is obtained changed.
//
// 2026-08-29 (later) — Stopped calling drizzle-orm's built-in migrate() and
// apply each journaled migration file in its own loop instead. The built-in
// migrate() runs every pending migration's statements in ONE pass with no
// per-file recovery: the first thrown error — including one we'd classify as
// SAFE-SKIP — aborts the loop immediately, so every migration listed AFTER
// it in the journal never even gets attempted, safe or not. That silently
// starved real, new migrations behind an earlier idempotent conflict, which
// is exactly how users.stripe_payment_method_id and 6 other critical columns
// stayed missing even on a "successfully tolerated" build (caught live via
// assert-schema-drift.mjs, whose whole job is catching this). Running each
// file independently means one safe-skipped migration no longer blocks every
// migration after it — only a genuinely FATAL error still stops the run.

import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql as sqlTemplate } from "drizzle-orm";
import { readMigrationFiles } from "drizzle-orm/migrator";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = join(__dirname, "..", "drizzle");

// Postgres SQLSTATE codes that mean "the schema already has this" — safe to
// skip during an idempotent re-run after an out-of-band Neon MCP apply.
// https://www.postgresql.org/docs/current/errcodes-appendix.html
export const SAFE_SKIP_PG_CODES = new Set([
  "42701", // duplicate_column        — ALTER TABLE ADD COLUMN, already exists
  "42P07", // duplicate_table         — CREATE TABLE, relation already exists
  "42710", // duplicate_object        — ADD CONSTRAINT / CREATE TYPE, exists
  "42712", // duplicate_alias
  "42723", // duplicate_function
  "42P06", // duplicate_schema        — CREATE SCHEMA, already exists
  "42P16", // invalid_table_definition (e.g. multiple primary keys re-add)
  "23505", // unique_violation        — re-inserting an existing tracker row
]);

// Postgres SQLSTATE class 08 = connection exceptions. Environmental, not a
// schema problem — these should fail loudly (a deploy with no DB connection
// must not silently "succeed" with un-applied migrations).
function isConnectionError(code) {
  return typeof code === "string" && code.startsWith("08");
}

/**
 * Pure classifier — extracted so it's unit-testable without running a real
 * migration. Maps a Postgres SQLSTATE code to a disposition.
 *
 *   "safe-skip" → the schema already has the object; warn and continue.
 *   "fatal"     → a genuine failure (bad SQL, missing dep, connection error,
 *                 or an unknown/undefined code); break the build.
 *
 * Unknown codes are FATAL on purpose: we only forgive errors we've explicitly
 * recognized as idempotent re-runs. Forgiving-by-default is what caused the
 * outages this script exists to prevent.
 *
 * @param {string|undefined|null} code - Postgres SQLSTATE (e.g. "42701")
 * @returns {"safe-skip"|"fatal"}
 */
export function classifyMigrateError(code) {
  if (!code) return "fatal";
  if (isConnectionError(code)) return "fatal";
  if (SAFE_SKIP_PG_CODES.has(code)) return "safe-skip";
  return "fatal";
}

/**
 * Extract a Postgres SQLSTATE code from drizzle-kit's combined stdout+stderr.
 * drizzle-kit surfaces the underlying pg error; the code shows up as
 * `code: '42701'`, `"code":"42701"`, or a bare 5-char SQLSTATE token. We scan
 * for the first plausible code so the classifier can decide.
 *
 * @param {string} output
 * @returns {string|null}
 */
export function extractPgCode(output) {
  if (!output) return null;
  // `code: '42701'` or code: "42701" or "code":"42701"
  const labeled = output.match(/code['"]?\s*[:=]\s*['"]?([0-9A-Z]{5})\b/);
  if (labeled) return labeled[1];
  // A bare SQLSTATE: 5 chars, digits + uppercase letters, at least one letter
  // OR all digits, e.g. 42701, 42P07, 23505, 08006. Avoid matching plain
  // 5-digit years/ids by requiring it to look like a SQLSTATE class we list
  // OR contain a letter.
  const bare = output.match(/\b(\d{2}[0-9A-Z]{3})\b/);
  if (bare) return bare[1];
  return null;
}

// Pull a Postgres SQLSTATE off a thrown error, wherever it landed. The neon
// driver wraps the underlying pg error, so the code can show up as
// err.code, err.cause.code, or only inside the stringified message/stack.
function codeFromError(err) {
  const direct = err?.code ?? err?.cause?.code;
  if (typeof direct === "string" && /^[0-9A-Z]{5}$/.test(direct)) return direct;
  return extractPgCode(`${err?.stack ?? ""}\n${err?.message ?? ""}\n${err?.cause?.message ?? ""}`);
}

const MIGRATIONS_SCHEMA = "drizzle";
const MIGRATIONS_TABLE = "__drizzle_migrations";

async function ensureTrackingTable(db) {
  await db.execute(sqlTemplate.raw(`CREATE SCHEMA IF NOT EXISTS "${MIGRATIONS_SCHEMA}"`));
  await db.execute(
    sqlTemplate.raw(
      `CREATE TABLE IF NOT EXISTS "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}" (
         id SERIAL PRIMARY KEY,
         hash text NOT NULL,
         created_at bigint
       )`,
    ),
  );
}

async function appliedHashes(db) {
  const rows = await db.execute(
    sqlTemplate.raw(`SELECT hash FROM "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}"`),
  );
  return new Set(rows.rows.map((r) => r.hash));
}

async function markApplied(db, migration) {
  await db.execute(
    sqlTemplate`insert into ${sqlTemplate.identifier(MIGRATIONS_SCHEMA)}.${sqlTemplate.identifier(MIGRATIONS_TABLE)}
      ("hash", "created_at") values (${migration.hash}, ${migration.folderMillis})`,
  );
}

async function runMigrate() {
  if (!process.env.DATABASE_URL) {
    console.log("[migrate-tolerant] DATABASE_URL not set — skipping");
    return;
  }

  console.log("[migrate-tolerant] running migrations via neon-http (same driver as the app's runtime db client)");

  const strict = process.env.MIGRATION_STRICT === "1";
  const sqlClient = neon(process.env.DATABASE_URL);
  const db = drizzle(sqlClient);

  const migrations = readMigrationFiles({ migrationsFolder });
  await ensureTrackingTable(db);
  const done = await appliedHashes(db);

  let appliedCount = 0;
  let skippedCount = 0;

  for (const migration of migrations) {
    if (done.has(migration.hash)) continue;

    try {
      for (const stmt of migration.sql) {
        if (stmt.trim()) await db.execute(sqlTemplate.raw(stmt));
      }
      await markApplied(db, migration);
      appliedCount++;
    } catch (err) {
      const code = codeFromError(err);
      const disposition = classifyMigrateError(code);
      const codeStr = code ?? "(no SQLSTATE found)";
      const msgLine = err?.message ?? String(err);

      if (disposition === "safe-skip" && !strict) {
        console.warn(`[migrate-tolerant] SAFE-SKIP: ${codeStr} ${msgLine}`);
        console.warn(
          "[migrate-tolerant] This error means the schema already has the object — " +
            "expected after an out-of-band Neon MCP apply. Not marking it applied " +
            "(so it's retried next run); continuing to the next migration.",
        );
        skippedCount++;
        continue;
      }

      if (disposition === "safe-skip" && strict) {
        console.error(`[migrate-tolerant] FATAL (MIGRATION_STRICT=1): ${codeStr} ${msgLine}`);
        console.error(
          "[migrate-tolerant] Would normally SAFE-SKIP, but strict mode forbids drift. " +
            "Reconcile the journal/__drizzle_migrations before deploying.",
        );
        process.exitCode = 1;
        return;
      }

      // disposition === "fatal"
      console.error(`[migrate-tolerant] FATAL: ${codeStr} ${msgLine}`);
      if (err?.stack) console.error(err.stack);
      console.error(
        "[migrate-tolerant] This is NOT an idempotent re-run — a migration errored " +
          "for a real reason (or the DB was unreachable). FAILING THE BUILD so broken " +
          "schema never reaches production. Investigate the error above; do not just " +
          "re-deploy.",
      );
      process.exitCode = 1;
      return;
    }
  }

  console.log(
    `[migrate-tolerant] done — ${appliedCount} migration(s) newly applied, ${skippedCount} safe-skipped, ` +
      `${migrations.length - appliedCount - skippedCount} already up to date.`,
  );
}

// Only run when invoked directly, not when imported by tests (importing must
// have no side effects — otherwise the top-level process.exit kills the test
// runner mid-suite).
const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) await runMigrate();
