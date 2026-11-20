import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { agencyWorkspaces } from './agency';
import { deals } from './baseline';

/** Synthetic prospects moving through enrichment before they become Sales deals. */
export const agencyProspects = pgTable(
  'agency_prospects',
  {
    id: uuid().defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => agencyWorkspaces.tenantId, { onDelete: 'restrict' }),
    businessName: text('business_name').notNull(),
    source: text().notNull(),
    stage: text().notNull().default('scraped'),
    website: text(),
    phone: text(),
    email: text(),
    ownerName: text('owner_name'),
    city: text(),
    state: text(),
    movedDealId: uuid('moved_deal_id').references(() => deals.id, { onDelete: 'restrict' }),
    movedAt: timestamp('moved_at', { withTimezone: true, mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow()
  },
  (t) => [
    index('agency_prospects_tenant_stage_idx').on(t.tenantId, t.stage, t.createdAt.desc()),
    check(
      'agency_prospects_business_name_check',
      sql`length(btrim(${t.businessName})) between 1 and 200`
    ),
    check(
      'agency_prospects_source_check',
      sql`${t.source} in ('google_maps','directory','referral','manual')`
    ),
    check(
      'agency_prospects_stage_check',
      sql`${t.stage} in ('scraped','half_enriched','fully_enriched')`
    ),
    check('agency_prospects_check', sql`(${t.movedDealId} is null) = (${t.movedAt} is null)`)
  ]
);
