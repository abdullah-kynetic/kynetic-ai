import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { audit } from '../audit';
import { contacts, dealContacts, deals, pipelineStages } from '../db/schema';
import { ValidationError } from '../errors';
import { requireModule } from '../modules';
import type { TenantContextInput } from '../tenancy';
import { parseInput, uuidSchema } from '../validation';
import { notFound, run, type DealOpts } from './pipelines';
import { dealContactRoleSchema, type DealRole } from './schemas';

// Several people on one deal, each with a role (M2-04; PRD F-15; DATABASE deal_contacts). CRM Full
// only: every function checks `crm` at level full first, so a lite tenant gets MODULE_DISABLED (403)
// and nothing is written. Composite FKs stop a cross-tenant link; RLS makes the other tenant's
// deal or contact read as not found (404), never 403.

export type DealContact = {
  dealId: string;
  contactId: string;
  role: DealRole;
  name: string;
};

const fullName = (first: string, last: string | null) => [first, last].filter(Boolean).join(' ');

const gate = (ctx: TenantContextInput, opts: DealOpts) =>
  requireModule(ctx, 'crm', { level: 'full', db: opts.db });

async function assertDeal(tx: Parameters<Parameters<typeof run>[2]>[0], dealId: string) {
  const [d] = await tx
    .select({ id: deals.id })
    .from(deals)
    .where(and(eq(deals.id, dealId), isNull(deals.deletedAt)))
    .limit(1);
  if (!d) throw notFound();
}

/** The people on a deal, oldest link first. */
export async function listDealContacts(
  ctx: TenantContextInput,
  dealId: string,
  opts: DealOpts = {}
): Promise<DealContact[]> {
  parseInput(uuidSchema, dealId);
  await gate(ctx, opts);
  return run(ctx, opts, async (tx) => {
    await assertDeal(tx, dealId);
    return tx
      .select({
        dealId: dealContacts.dealId,
        contactId: dealContacts.contactId,
        role: dealContacts.role,
        firstName: contacts.firstName,
        lastName: contacts.lastName
      })
      .from(dealContacts)
      .innerJoin(contacts, eq(contacts.id, dealContacts.contactId))
      .where(and(eq(dealContacts.dealId, dealId), isNull(contacts.deletedAt)))
      .orderBy(asc(dealContacts.createdAt), asc(dealContacts.contactId))
      .then((rows) =>
        rows.map(({ firstName, lastName, ...r }): DealContact => ({
          ...r,
          role: r.role as DealRole,
          name: fullName(firstName, lastName)
        }))
      );
  });
}

/** The deals a contact is on, for the contact page. */
export async function listDealsForContact(
  ctx: TenantContextInput,
  contactId: string,
  opts: DealOpts = {}
) {
  parseInput(uuidSchema, contactId);
  await gate(ctx, opts);
  return run(ctx, opts, (tx) =>
    tx
      .select({
        dealId: deals.id,
        title: deals.title,
        stageId: deals.stageId,
        stageName: pipelineStages.name,
        stageIsWon: pipelineStages.isWon,
        stageIsLost: pipelineStages.isLost,
        valueCents: deals.valueCents,
        role: dealContacts.role
      })
      .from(dealContacts)
      .innerJoin(deals, eq(deals.id, dealContacts.dealId))
      .innerJoin(pipelineStages, eq(pipelineStages.id, deals.stageId))
      .where(and(eq(dealContacts.contactId, contactId), isNull(deals.deletedAt)))
      .orderBy(asc(deals.title), asc(deals.id))
  );
}

export async function addDealContact(
  ctx: TenantContextInput,
  dealId: string,
  input: { contactId: string; role: DealRole },
  opts: DealOpts = {}
): Promise<DealContact> {
  parseInput(uuidSchema, dealId);
  const v = parseInput(dealContactRoleSchema, input);
  await gate(ctx, opts);
  return run(ctx, opts, async (tx) => {
    await assertDeal(tx, dealId);
    const [c] = await tx
      .select({ id: contacts.id, firstName: contacts.firstName, lastName: contacts.lastName })
      .from(contacts)
      .where(and(eq(contacts.id, v.contactId), isNull(contacts.deletedAt)))
      .limit(1);
    if (!c) throw new ValidationError({ contactId: ['not_found'] });
    const [row] = await tx
      .insert(dealContacts)
      .values({
        tenantId: sql`app_tenant_id()` as unknown as string,
        dealId,
        contactId: c.id,
        role: v.role
      })
      .onConflictDoNothing()
      .returning();
    if (!row) throw new ValidationError({ contactId: ['already_on_deal'] });
    await audit(tx, {
      action: 'deal.contact_add',
      entity: 'deal',
      entityId: dealId,
      after: { contactId: c.id, role: v.role }
    });
    return { dealId, contactId: c.id, role: v.role, name: fullName(c.firstName, c.lastName) };
  });
}

export async function setDealContactRole(
  ctx: TenantContextInput,
  dealId: string,
  contactId: string,
  role: DealRole,
  opts: DealOpts = {}
): Promise<void> {
  parseInput(uuidSchema, dealId);
  parseInput(uuidSchema, contactId);
  const v = parseInput(dealContactRoleSchema.pick({ role: true }), { role });
  await gate(ctx, opts);
  await run(ctx, opts, async (tx) => {
    await assertDeal(tx, dealId);
    const [before] = await tx
      .select({ role: dealContacts.role })
      .from(dealContacts)
      .where(and(eq(dealContacts.dealId, dealId), eq(dealContacts.contactId, contactId)))
      .limit(1);
    if (!before) throw notFound();
    await tx
      .update(dealContacts)
      .set({ role: v.role })
      .where(and(eq(dealContacts.dealId, dealId), eq(dealContacts.contactId, contactId)));
    await audit(tx, {
      action: 'deal.contact_role',
      entity: 'deal',
      entityId: dealId,
      before: { contactId, role: before.role },
      after: { contactId, role: v.role }
    });
  });
}

export async function removeDealContact(
  ctx: TenantContextInput,
  dealId: string,
  contactId: string,
  opts: DealOpts = {}
): Promise<void> {
  parseInput(uuidSchema, dealId);
  parseInput(uuidSchema, contactId);
  await gate(ctx, opts);
  await run(ctx, opts, async (tx) => {
    await assertDeal(tx, dealId);
    const gone = await tx
      .delete(dealContacts)
      .where(and(eq(dealContacts.dealId, dealId), eq(dealContacts.contactId, contactId)))
      .returning({ contactId: dealContacts.contactId });
    if (!gone.length) throw notFound();
    await audit(tx, {
      action: 'deal.contact_remove',
      entity: 'deal',
      entityId: dealId,
      before: { contactId }
    });
  });
}
