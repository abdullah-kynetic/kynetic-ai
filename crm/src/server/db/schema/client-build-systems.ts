import { sql } from 'drizzle-orm';
import { check, index, integer, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { tenants } from './baseline';

/** The systems being built for one client and where each one is. Written by staff through admin functions only. */
export const clientBuildSystems = pgTable(
  'client_build_systems',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    systemKey: text('system_key').notNull(),
    name: text().notNull(),
    outcome: text(),
    stage: text().default('planned').notNull(),
    note: text(),
    sortOrder: integer('sort_order').default(0).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull()
  },
  (table) => [
    unique('client_build_systems_tenant_key').on(table.tenantId, table.systemKey),
    index('client_build_systems_tenant_idx').on(table.tenantId, table.sortOrder),
    check(
      'client_build_systems_stage_check',
      sql`${table.stage} IN ('planned', 'building', 'testing', 'live')`
    )
  ]
);
