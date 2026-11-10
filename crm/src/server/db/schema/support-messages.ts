import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid
} from 'drizzle-orm/pg-core';
import { tenants, users } from './baseline';
import { supportRequests } from './support';

/** A reply on a support request. Clients insert their own side; Kynetic replies through a rollup function. */
export const supportRequestMessages = pgTable(
  'support_request_messages',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    requestId: uuid('request_id').notNull(),
    authorUserId: uuid('author_user_id')
      .notNull()
      .references(() => users.id),
    authorSide: text('author_side').notNull(),
    body: text().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull()
  },
  (table) => [
    unique().on(table.tenantId, table.id),
    index('support_request_messages_thread_idx').on(
      table.tenantId,
      table.requestId,
      table.createdAt
    ),
    foreignKey({
      columns: [table.tenantId, table.requestId],
      foreignColumns: [supportRequests.tenantId, supportRequests.id]
    }).onDelete('restrict'),
    check(
      'support_request_messages_author_side_check',
      sql`${table.authorSide} IN ('client', 'kynetic')`
    )
  ]
);
