import { and, asc, desc, eq, ilike, isNull, isNotNull, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import type { Tx } from '../db/client';
import { contacts, dealContacts, deals, pipelineStages, pipelines } from '../db/schema';
import { CONTACT_STATUSES } from '../contacts/constants';
import { AppError } from '../errors';
import { decodeCursor, encodeCursor, likeLiteral, pageShape, updatedSinceSchema } from './page';

// Read-only DTOs for the service API. Every function takes the transaction from withServiceTenant, so
// RLS pins the rows to the token's tenant. Nothing returns a raw table row.

export const contactListSchema = z.strictObject({
  ...pageShape,
  q: z.string().trim().min(1).max(100).optional(),
  status: z.enum(CONTACT_STATUSES).optional(),
  updatedSince: updatedSinceSchema
});

export type ContactListItem = {
  id: string;
  firstName: string;
  lastName: string | null;
  status: string;
  source: string | null;
  tags: string[];
  ownerId: string | null;
  doNotCall: boolean;
  createdAt: string;
  updatedAt: string;
};

/** No phone or email in lists: those stay on the single-contact route. */
export async function listContactsDto(tx: Tx, q: z.output<typeof contactListSchema>) {
  const cursor = decodeCursor(q.cursor);
  const where: (SQL | undefined)[] = [
    isNull(contacts.deletedAt),
    isNull(contacts.mergedIntoId),
    q.status ? eq(contacts.status, q.status) : undefined,
    q.q
      ? ilike(
          sql`concat_ws(' ', ${contacts.firstName}, ${contacts.lastName})`,
          `%${likeLiteral(q.q)}%`
        )
      : undefined,
    q.updatedSince ? sql`${contacts.updatedAt} >= ${q.updatedSince}::timestamptz` : undefined,
    cursor
      ? sql`(${contacts.updatedAt}, ${contacts.id}) < (${cursor.at}::timestamptz, ${cursor.id}::uuid)`
      : undefined
  ];
  const rows = await tx
    .select({
      id: contacts.id,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      status: contacts.status,
      source: contacts.source,
      tags: contacts.tags,
      ownerId: contacts.ownerId,
      doNotCallAt: contacts.doNotCallAt,
      createdAt: contacts.createdAt,
      updatedAt: contacts.updatedAt
    })
    .from(contacts)
    .where(and(...where))
    .orderBy(desc(contacts.updatedAt), desc(contacts.id))
    .limit(q.limit + 1);
  const page = rows.slice(0, q.limit);
  const last = page.at(-1);
  const items: ContactListItem[] = page.map((r) => ({
    id: r.id,
    firstName: r.firstName,
    lastName: r.lastName,
    status: r.status,
    source: r.source,
    tags: r.tags.filter(Boolean),
    ownerId: r.ownerId,
    doNotCall: r.doNotCallAt !== null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt
  }));
  return {
    items,
    nextCursor: rows.length > q.limit && last ? encodeCursor(last.updatedAt, last.id) : null
  };
}

export async function contactExists(tx: Tx, id: string): Promise<void> {
  const [row] = await tx
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.id, id), isNull(contacts.deletedAt)))
    .limit(1);
  if (!row) throw new AppError('NOT_FOUND');
}

export async function listPipelinesDto(tx: Tx) {
  const ps = await tx
    .select()
    .from(pipelines)
    .orderBy(asc(pipelines.position), asc(pipelines.createdAt));
  const stages = await tx.select().from(pipelineStages).orderBy(asc(pipelineStages.position));
  return ps.map((p) => ({
    id: p.id,
    name: p.name,
    isDefault: p.isDefault,
    stages: stages
      .filter((s) => s.pipelineId === p.id)
      .map((s) => ({
        id: s.id,
        name: s.name,
        position: s.position,
        probability: s.probability,
        isWon: s.isWon,
        isLost: s.isLost
      }))
  }));
}

export const dealListSchema = z.strictObject({
  ...pageShape,
  pipelineId: z.uuid().optional(),
  stageId: z.uuid().optional(),
  status: z.enum(['open', 'won', 'lost']).optional(),
  updatedSince: updatedSinceSchema
});

const dealColumns = {
  id: deals.id,
  title: deals.title,
  pipelineId: deals.pipelineId,
  stageId: deals.stageId,
  stageName: pipelineStages.name,
  valueCents: deals.valueCents,
  serviceType: deals.serviceType,
  source: deals.source,
  expectedClose: deals.expectedClose,
  ownerId: deals.ownerId,
  lostReason: deals.lostReason,
  wonAt: deals.wonAt,
  lostAt: deals.lostAt,
  createdAt: deals.createdAt,
  updatedAt: deals.updatedAt
};

type DealRow = {
  id: string;
  title: string;
  pipelineId: string;
  stageId: string;
  stageName: string;
  valueCents: number;
  serviceType: string | null;
  source: string | null;
  expectedClose: string | null;
  ownerId: string | null;
  lostReason: string | null;
  wonAt: string | null;
  lostAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function dealDto(r: DealRow) {
  return {
    id: r.id,
    title: r.title,
    pipelineId: r.pipelineId,
    stage: { id: r.stageId, name: r.stageName },
    status: r.wonAt ? 'won' : r.lostAt ? 'lost' : 'open',
    valueCents: r.valueCents,
    serviceType: r.serviceType,
    source: r.source,
    expectedClose: r.expectedClose,
    ownerId: r.ownerId,
    lostReason: r.lostReason,
    wonAt: r.wonAt,
    lostAt: r.lostAt,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt
  };
}

export async function listDealsDto(tx: Tx, q: z.output<typeof dealListSchema>) {
  const cursor = decodeCursor(q.cursor);
  const where: (SQL | undefined)[] = [
    isNull(deals.deletedAt),
    q.pipelineId ? eq(deals.pipelineId, q.pipelineId) : undefined,
    q.stageId ? eq(deals.stageId, q.stageId) : undefined,
    q.status === 'won' ? isNotNull(deals.wonAt) : undefined,
    q.status === 'lost' ? isNotNull(deals.lostAt) : undefined,
    q.status === 'open' ? and(isNull(deals.wonAt), isNull(deals.lostAt)) : undefined,
    q.updatedSince ? sql`${deals.updatedAt} >= ${q.updatedSince}::timestamptz` : undefined,
    cursor
      ? sql`(${deals.updatedAt}, ${deals.id}) < (${cursor.at}::timestamptz, ${cursor.id}::uuid)`
      : undefined
  ];
  const rows = await tx
    .select(dealColumns)
    .from(deals)
    .innerJoin(pipelineStages, eq(pipelineStages.id, deals.stageId))
    .where(and(...where))
    .orderBy(desc(deals.updatedAt), desc(deals.id))
    .limit(q.limit + 1);
  const page = rows.slice(0, q.limit);
  const last = page.at(-1);
  return {
    items: page.map(dealDto),
    nextCursor: rows.length > q.limit && last ? encodeCursor(last.updatedAt, last.id) : null
  };
}

export async function getDealDto(tx: Tx, id: string) {
  const [row] = await tx
    .select(dealColumns)
    .from(deals)
    .innerJoin(pipelineStages, eq(pipelineStages.id, deals.stageId))
    .where(and(eq(deals.id, id), isNull(deals.deletedAt)))
    .limit(1);
  if (!row) throw new AppError('NOT_FOUND');
  const people = await tx
    .select({ contactId: dealContacts.contactId, role: dealContacts.role })
    .from(dealContacts)
    .where(eq(dealContacts.dealId, id));
  return { ...dealDto(row), contacts: people };
}
