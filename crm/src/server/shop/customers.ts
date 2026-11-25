import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import {
  contacts,
  dealContacts,
  deals,
  pipelineStages,
  reviewRequests,
  tenants
} from '../db/schema';
import type { TenantContextInput } from '../tenancy';
import { shopRun, type ShopOpts } from './guard';
import type { AwaySettings, CustomerRow } from './types';

/** Customers: contacts with job count, what they have paid (picked-up jobs) and review status. */
export async function getCustomers(
  ctx: TenantContextInput,
  opts: ShopOpts & { limit?: number } = {}
): Promise<{ customers: CustomerRow[]; businessName: string }> {
  return shopRun(ctx, opts, async (tx) => {
    const [tenant] = await tx
      .select({ name: tenants.name })
      .from(tenants)
      .where(eq(tenants.id, sql`app_tenant_id()`))
      .limit(1);
    const businessName = tenant?.name ?? 'the shop';
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
    if (people.length === 0) return { customers: [], businessName };
    const jobs = await tx
      .select({
        contactId: dealContacts.contactId,
        n: sql<number>`count(*)::int`,
        wonCents: sql<number>`coalesce(sum(case when ${pipelineStages.isWon} then ${deals.valueCents} else 0 end), 0)::int`,
        last: sql<string | null>`max(${deals.createdAt})`,
        wonJobs: sql<number>`count(*) filter (where ${pipelineStages.isWon})::int`
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
    const latestDeals = await tx
      .selectDistinctOn([dealContacts.contactId], {
        contactId: dealContacts.contactId,
        title: deals.title,
        custom: deals.custom
      })
      .from(dealContacts)
      .innerJoin(deals, eq(deals.id, dealContacts.dealId))
      .where(
        and(
          isNull(deals.deletedAt),
          inArray(
            dealContacts.contactId,
            people.map((p) => p.id)
          )
        )
      )
      .orderBy(dealContacts.contactId, desc(deals.createdAt));
    const label = new Map(
      latestDeals.map((d) => {
        const c = (d.custom && typeof d.custom === 'object' ? d.custom : {}) as Record<
          string,
          unknown
        >;
        const car = [c.vehicle_year, c.vehicle_make, c.vehicle_model]
          .filter((v) => (typeof v === 'string' && v) || typeof v === 'number')
          .join(' ');
        return [d.contactId, car || d.title] as const;
      })
    );
    const requests = await tx
      .select({
        contactId: reviewRequests.contactId,
        status: reviewRequests.status,
        requestedAt: reviewRequests.requestedAt
      })
      .from(reviewRequests)
      .orderBy(asc(reviewRequests.requestedAt));
    // Latest request wins; a completed request means they reviewed.
    const review = new Map<string, 'requested' | 'reviewed'>();
    for (const r of requests) {
      if (r.status === 'cancelled') continue;
      review.set(r.contactId, r.status === 'completed' ? 'reviewed' : 'requested');
    }
    return {
      businessName,
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
          lastJobLabel: label.get(p.id) ?? null,
          pickedUp: (j?.wonJobs ?? 0) > 0,
          reviewStatus: review.get(p.id) ?? ('not_requested' as const)
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

/**
 * The "Bring back old customers" email, as plain text. A preview only: nothing in the portal sends
 * it. Every past customer gets the same wording, with their own name and car.
 */
export function bringBackEmail(input: {
  firstName: string;
  businessName: string;
  vehicle: string | null;
}): { subject: string; body: string } {
  const car = input.vehicle ? `your ${input.vehicle}` : 'your car';
  return {
    subject: `It has been a while, ${input.firstName}`,
    body: [
      `Hi ${input.firstName},`,
      '',
      `This is ${input.businessName}. We fixed ${car} and wanted to check in. If anything else needs attention, or a friend or family member needs a body shop, we would be glad to help.`,
      '',
      'Reply to this email or call us any time for a free estimate.',
      '',
      `Thank you,`,
      input.businessName
    ].join('\n')
  };
}
