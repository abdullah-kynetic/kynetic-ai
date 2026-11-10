import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { tenants, users } from './baseline';

/** M20-06: a client's request for help. Clients insert and read; staff change status through rollup functions. */
export const supportRequests = pgTable(
  'support_requests',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    subject: text().notNull(),
    body: text().notNull(),
    category: text().default('general').notNull(),
    status: text().default('open').notNull(),
    submittedBy: uuid('submitted_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true, mode: 'string' })
  },
  (table) => [
    unique().on(table.tenantId, table.id),
    index('support_requests_tenant_idx').on(table.tenantId, table.createdAt),
    index('support_requests_status_idx').on(table.status, table.createdAt),
    check(
      'support_requests_status_check',
      sql`${table.status} IN ('open', 'in_progress', 'resolved')`
    ),
    check(
      'support_requests_category_check',
      sql`${table.category} IN ('general', 'alex_change', 'system_request')`
    )
  ]
);
