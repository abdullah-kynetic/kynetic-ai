import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { contacts, dealContacts, deals, pipelineStages } from '../db/schema';
import type { TenantContextInput } from '../tenancy';
import { shopRun, type ShopOpts } from './guard';
import type { AwaySettings, CustomerRow } from './types';

/** Customers: contacts with job count and what they have paid. Review status waits on phase E. */
export async function getCustomers(
  ctx: TenantContextInput,
  opts: ShopOpts & { limit?: number } = {}
): Promise<{ customers: CustomerRow[] }> {
  return shopRun(ctx, opts, async (tx) => {
    const people = await tx
      .select({
        id: contacts.id,
        first: contacts.firstName,
        last: contacts.lastName,
        phone: contacts.primaryPhoneE164,
        email: contacts.primaryEmail
      })
      .from(contacts)
      .where(and(isNull(contacts.deletedAt), isNull(contacts.mergedIntoId)))
      .orderBy(asc(contacts.firstName), asc(contacts.lastName))
      .limit(opts.limit ?? 500);
    if (people.length === 0) return { customers: [] };
    const jobs = await tx
      .select({
        contactId: dealContacts.contactId,
        n: sql<number>`count(*)::int`,
        wonCents: sql<number>`coalesce(sum(case when ${pipelineStages.isWon} then ${deals.valueCents} else 0 end), 0)::int`,
        last: sql<string | null>`max(${deals.createdAt})`
      })
      .from(dealContacts)
      .innerJoin(deals, eq(deals.id, dealContacts.dealId))
      .innerJoin(pipelineStages, eq(pipelineStages.id, deals.stageId))
      .where(
        and(
          isNull(deals.deletedAt),
          inArray(
            dealContacts.contactId,
            people.map((p) => p.id)
          )
        )
      )
      .groupBy(dealContacts.contactId);
    const byContact = new Map(jobs.map((j) => [j.contactId, j]));
    return {
      customers: people.map((p) => {
        const j = byContact.get(p.id);
        return {
          id: p.id,
          name: `${p.first} ${p.last ?? ''}`.trim() || 'Unnamed',
          phone: p.phone,
          email: p.email,
          jobs: j?.n ?? 0,
          lifetimeCents: j?.wonCents ?? 0,
          lastJobAt: j?.last ?? null,
          reviewStatus: 'not_requested' as const
        };
      })
    };
  });
}

/** Away mode has no settings table yet. It always reads as off. */
export async function getAwaySettings(
  ctx: TenantContextInput,
  opts: ShopOpts = {}
): Promise<AwaySettings> {
  return shopRun(ctx, opts, async () => ({
    enabled: false,
    until: null,
    greeting: null,
    receptionistPaused: false
  }));
}
