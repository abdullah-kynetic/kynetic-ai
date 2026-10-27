import { sql } from 'drizzle-orm';
import {
  boolean,
  foreignKey,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from 'drizzle-orm/pg-core';
import { memberships, tenants } from './baseline';

// M9-11 (DC-115): the tag registry (F-43) and per-user notification preferences (F-36).
export const tags = pgTable(
  'tags',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    name: text().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull()
  },
  (t) => [uniqueIndex('tags_tenant_name_uq').on(t.tenantId, sql`lower(${t.name})`)]
);

export const notificationPreferences = pgTable(
  'notification_preferences',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    userId: uuid('user_id').notNull(),
    kind: text().notNull(),
    emailEnabled: boolean('email_enabled').default(true).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull()
  },
  (t) => [
    primaryKey({ columns: [t.tenantId, t.userId, t.kind] }),
    foreignKey({
      columns: [t.tenantId, t.userId],
      foreignColumns: [memberships.tenantId, memberships.userId]
    }).onDelete('cascade')
  ]
);
