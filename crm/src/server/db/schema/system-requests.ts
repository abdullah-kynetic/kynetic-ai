import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { moduleCatalog, tenants, users } from './baseline';

/** A client asks for a system that is not on for their account. No payment is taken. */
export const systemRequests = pgTable(
  'system_requests',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    moduleKey: text('module_key')
      .notNull()
      .references(() => moduleCatalog.moduleKey),
    status: text().default('open').notNull(),
    requestedBy: uuid('requested_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull()
  },
  (table) => [
    unique('system_requests_tenant_module_key').on(table.tenantId, table.moduleKey),
    unique('system_requests_tenant_id_key').on(table.tenantId, table.id),
    index('system_requests_tenant_idx').on(table.tenantId, table.createdAt),
    check('system_requests_status_check', sql`${table.status} = 'open'`)
  ]
);
