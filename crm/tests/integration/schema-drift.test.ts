import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '@/server/db/schema';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let db: TestDatabase;
beforeAll(async () => {
  db = await createTestDatabase();
});
afterAll(async () => {
  await db?.drop();
});

describe('Drizzle schema matches the migrated database', () => {
  it('every table and column in src/server/db/schema exists in Postgres and vice versa', async () => {
    const tables = (Object.values(schema) as unknown[]).filter(
      (v): v is PgTable => v instanceof PgTable
    );
    const rows = await db.admin`select table_name, column_name from information_schema.columns
      where table_schema = 'public' order by table_name, ordinal_position`;
    const actual = new Map<string, string[]>();
    for (const r of rows)
      actual.set(r.table_name, [...(actual.get(r.table_name) ?? []), r.column_name]);

    const declared = new Map(
      tables.map((t) => {
        const cfg = getTableConfig(t);
        return [cfg.name, cfg.columns.map((c) => c.name).sort()] as const;
      })
    );
    expect([...declared.keys()].sort()).toEqual([...actual.keys()].sort());
    for (const [name, cols] of declared) {
      expect(cols, name).toEqual([...(actual.get(name) ?? [])].sort());
    }
  });
});
