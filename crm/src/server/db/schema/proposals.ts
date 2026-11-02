import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid
} from 'drizzle-orm/pg-core';
import { agencyWorkspaces } from './agency';
import { deals, users } from './baseline';
export const agencyProposals = pgTable(
  'agency_proposals',
  {
    id: uuid().defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => agencyWorkspaces.tenantId, { onDelete: 'restrict' }),
    dealId: uuid('deal_id').notNull(),
    title: text().notNull(),
    status: text().notNull().default('draft'),
    problem: text().notNull().default(''),
    solution: text().notNull().default(''),
    roadmap: text().notNull().default(''),
    roi: text().notNull().default(''),
    revision: integer().notNull().default(1),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    updatedBy: uuid('updated_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull()
  },
  (t) => [
    unique('agency_proposals_tenant_id_deal_id_key').on(t.tenantId, t.dealId),
    foreignKey({
      columns: [t.tenantId, t.dealId],
      foreignColumns: [deals.tenantId, deals.id]
    }).onDelete('restrict'),
    check('agency_proposals_title_check', sql`length(btrim(${t.title})) between 1 and 200`),
    check('agency_proposals_status_check', sql`${t.status} = 'draft'`),
    check('agency_proposals_problem_check', sql`length(${t.problem}) <= 6000`),
    check('agency_proposals_solution_check', sql`length(${t.solution}) <= 6000`),
    check('agency_proposals_roadmap_check', sql`length(${t.roadmap}) <= 6000`),
    check('agency_proposals_roi_check', sql`length(${t.roi}) <= 6000`),
    check('agency_proposals_revision_check', sql`${t.revision} >= 1`)
  ]
);
