import { index, integer, jsonb, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { tenants } from './baseline';

export const auditRuns = pgTable(
  'audit_runs',
  {
    id: uuid().defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    contactId: uuid('contact_id'),
    companyId: uuid('company_id'),
    mode: text().notNull(),
    scores: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    findings: jsonb().$type<unknown[]>().notNull().default([]),
    pdfKey: text('pdf_key'),
    costCents: integer('cost_cents').notNull().default(0),
    idempotencyKey: text('idempotency_key').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull()
  },
  (table) => [
    unique('audit_runs_tenant_idempotency_key').on(table.tenantId, table.idempotencyKey),
    index('audit_runs_tenant_created_idx').on(table.tenantId, table.createdAt)
  ]
);

