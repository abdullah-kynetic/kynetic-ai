import { jsonb, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { tenants } from './baseline';

/** M12-03: immutable request ledger; runtime grants allow SELECT and INSERT only. */
export const contactDecisions = pgTable(
  'contact_decisions',
  {
    id: uuid().defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    eventId: uuid('event_id').notNull(),
    contactId: uuid('contact_id').notNull(),
    payload: jsonb().notNull(),
    payloadHash: text('payload_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow()
  },
  (t) => [unique('contact_decisions_tenant_event_key').on(t.tenantId, t.eventId)]
);
