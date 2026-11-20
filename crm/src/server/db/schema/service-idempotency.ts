import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid
} from 'drizzle-orm/pg-core';
import { serviceTokens, tenants } from './baseline';

export const serviceIdempotency = pgTable(
  'service_idempotency',
  {
    id: uuid().defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    tokenId: uuid('token_id'),
    adminKeyId: uuid('admin_key_id'),
    key: text().notNull(),
    method: text().notNull(),
    path: text().notNull(),
    requestHash: text('request_hash').notNull(),
    status: integer().notNull(),
    response: jsonb().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow()
  },
  (t) => [
    unique('service_idempotency_tenant_id_key_key').on(t.tenantId, t.key),
    foreignKey({
      columns: [t.tokenId, t.tenantId],
      foreignColumns: [serviceTokens.id, serviceTokens.tenantId],
      name: 'service_idempotency_token_id_tenant_id_fkey'
    }).onDelete('restrict'),
    check('service_idempotency_key_check', sql`${t.key} ~ '^[A-Za-z0-9_-]{8,128}$'`),
    check('service_idempotency_request_hash_check', sql`${t.requestHash} ~ '^[0-9a-f]{64}$'`),
    check('service_idempotency_status_check', sql`${t.status} between 200 and 299`)
  ]
);
