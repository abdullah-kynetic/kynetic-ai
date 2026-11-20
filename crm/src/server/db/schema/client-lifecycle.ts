import { sql } from 'drizzle-orm';
import { check, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { tenants, users } from './baseline';

/** Staff-only lifecycle stage for the client board. Runtime access goes through admin functions. */
export const clientLifecycle = pgTable(
  'client_lifecycle',
  {
    tenantId: uuid('tenant_id')
      .primaryKey()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    stage: text().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'restrict' })
  },
  (table) => [
    check(
      'client_lifecycle_stage_check',
      sql`${table.stage} IN ('onboarding', 'live', 'at_risk', 'churned', 'demo')`
    )
  ]
);
