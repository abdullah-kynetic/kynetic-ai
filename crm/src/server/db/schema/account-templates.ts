import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { tenants, users } from './baseline';

/** Agency-level saved client setups (migration 1094). Admin and VA read with no client context; admin writes. */
export const accountTemplates = pgTable('account_templates', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  name: text().notNull(),
  description: text().default('').notNull(),
  sourceTenantId: uuid('source_tenant_id').references(() => tenants.id, {
    onDelete: 'set null'
  }),
  snapshot: jsonb().notNull(),
  createdBy: uuid('created_by').references(() => users.id, {
    onDelete: 'set null'
  }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'string' })
});
