import { and, asc, eq, isNull } from 'drizzle-orm';
import { contacts, dealContacts, deals, memberships, pipelineStages, users } from '../db/schema';
import { withTenant, type TenantContextInput } from '../tenancy';
import { parseInput, uuidSchema } from '../validation';
import { notFound, type DealOpts, type Stage } from './pipelines';
import type { Deal } from './service';

// Deal detail read model (M2-03; PRD F-14). One tenant-scoped read for the detail page and the
// slide-out: the deal, its stage and sibling stages, the owner, the people on the job and the
// members who can own a deal. Another tenant's id (hidden by RLS) and a soft-deleted deal both
// throw the standard NOT_FOUND, so the page cannot reveal that an id exists.

export type DealPerson = { id: string; name: string | null; email: string };

export type DealDetail = {
  deal: Deal;
  stage: Stage;
  /** Every stage of the deal's pipeline in board order, for the stage control. */
  stages: Stage[];
  owner: DealPerson | null;
  /** Tenant members, for the owner select. */
  members: DealPerson[];
  contacts: { contactId: string; name: string; role: string }[];
};

const fullName = (c: { firstName: string | null; lastName: string | null }) =>
  [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Unnamed contact';

export async function getDealDetail(
  ctx: TenantContextInput,
  id: string,
  opts: DealOpts = {}
): Promise<DealDetail> {
  parseInput(uuidSchema, id);
  const read = async (tx: Parameters<Parameters<typeof withTenant>[1]>[0]): Promise<DealDetail> => {
    const [deal] = await tx
      .select()
      .from(deals)
      .where(and(eq(deals.id, id), isNull(deals.deletedAt)))
      .limit(1);
    if (!deal) throw notFound();

    const stages = await tx
      .select()
      .from(pipelineStages)
      .where(eq(pipelineStages.pipelineId, deal.pipelineId))
      .orderBy(asc(pipelineStages.position));
    const stage = stages.find((s) => s.id === deal.stageId);
    if (!stage) throw notFound();

    const members = await tx
      .select({ id: users.id, name: users.name, email: users.email })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .orderBy(asc(users.name), asc(users.email));

    const linked = await tx
      .select({
        contactId: contacts.id,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        role: dealContacts.role
      })
      .from(dealContacts)
      .innerJoin(contacts, eq(contacts.id, dealContacts.contactId))
      .where(and(eq(dealContacts.dealId, id), isNull(contacts.deletedAt)))
      .orderBy(asc(dealContacts.createdAt));

    return {
      deal,
      stage,
      stages,
      owner: members.find((m) => m.id === deal.ownerId) ?? null,
      members,
      contacts: linked.map((c) => ({ contactId: c.contactId, name: fullName(c), role: c.role }))
    };
  };
  return opts.tx ? read(opts.tx) : withTenant(ctx, read, { db: opts.db });
}
