import { and, desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import type { StaffCaller } from '../admin/users';
import { getStorage, mintSignedUrl, tenantKey, type StorageAdapter } from '../adapters/storage';
import { audit } from '../audit';
import type { Db } from '../db/client';
import { agencyContracts, deals, pipelineStages } from '../db/schema';
import { assertPdfUpload } from '../documents/pdf-file';
import { AppError } from '../errors';
import { parseInput } from '../validation';
import { inAgency } from './index';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
type Options = { db?: Db; now?: Date; storage?: StorageAdapter };

export async function listAgencyContracts(
  caller: StaffCaller,
  filter: { status?: string; stageId?: string } = {},
  opts: Options = {}
) {
  const status = ['draft', 'sent', 'signed', 'void'].includes(filter.status ?? '')
    ? filter.status
    : undefined;
  return inAgency(
    caller,
    (tx) =>
      tx
        .select({
          id: agencyContracts.id,
          dealId: agencyContracts.dealId,
          title: agencyContracts.title,
          status: agencyContracts.status,
          sentOn: agencyContracts.sentOn,
          signedOn: agencyContracts.signedOn,
          notes: agencyContracts.notes,
          signedFileKey: agencyContracts.signedFileKey,
          dealTitle: deals.title,
          stageId: pipelineStages.id,
          stageName: pipelineStages.name
        })
        .from(agencyContracts)
        .innerJoin(deals, eq(deals.id, agencyContracts.dealId))
        .innerJoin(pipelineStages, eq(pipelineStages.id, deals.stageId))
        .where(
          and(
            isNull(deals.deletedAt),
            status ? eq(agencyContracts.status, status) : undefined,
            filter.stageId ? eq(pipelineStages.id, filter.stageId) : undefined
          )
        )
        .orderBy(desc(agencyContracts.updatedAt), agencyContracts.id)
        .limit(100),
    opts
  );
}

export async function createAgencyContract(caller: StaffCaller, raw: unknown, opts: Options = {}) {
  const input = parseInput(
    z.strictObject({
      dealId: z.uuid(),
      title: z.string().trim().min(1).max(200)
    }),
    raw
  );
  return inAgency(
    caller,
    async (tx, tenantId) => {
      const [deal] = await tx
        .select({ id: deals.id })
        .from(deals)
        .where(and(eq(deals.id, input.dealId), isNull(deals.deletedAt)))
        .limit(1);
      if (!deal) throw new AppError('NOT_FOUND');
      const now = (opts.now ?? new Date()).toISOString();
      const [row] = await tx
        .insert(agencyContracts)
        .values({
          tenantId,
          dealId: input.dealId,
          title: input.title,
          createdBy: caller.id,
          updatedBy: caller.id,
          updatedAt: now
        })
        .returning();
      await audit(tx, {
        action: 'agency.contract.create',
        entity: 'agency_contract',
        entityId: row!.id,
        after: { dealId: input.dealId, status: 'draft' }
      });
      return row!;
    },
    opts
  );
}

async function loadContract(tx: Parameters<Parameters<typeof inAgency>[1]>[0], id: string) {
  const [row] = await tx
    .select()
    .from(agencyContracts)
    .where(eq(agencyContracts.id, id))
    .for('update')
    .limit(1);
  if (!row) throw new AppError('NOT_FOUND');
  return row;
}

export async function markAgencyContractSent(
  caller: StaffCaller,
  raw: unknown,
  opts: Options = {}
) {
  const input = parseInput(z.strictObject({ id: z.uuid(), sentOn: date }), raw);
  return inAgency(
    caller,
    async (tx) => {
      const row = await loadContract(tx, input.id);
      if (row.status !== 'draft') throw new AppError('CONFLICT');
      const now = (opts.now ?? new Date()).toISOString();
      await tx
        .update(agencyContracts)
        .set({
          status: 'sent',
          sentOn: input.sentOn,
          updatedBy: caller.id,
          updatedAt: now
        })
        .where(eq(agencyContracts.id, row.id));
      await audit(tx, {
        action: 'agency.contract.sent',
        entity: 'agency_contract',
        entityId: row.id,
        before: { status: row.status },
        after: { status: 'sent', sentOn: input.sentOn }
      });
    },
    opts
  );
}

export async function markAgencyContractSigned(
  caller: StaffCaller,
  raw: unknown,
  file: { name: string; body: Uint8Array } | null,
  opts: Options = {}
) {
  const input = parseInput(
    z.strictObject({
      id: z.uuid(),
      signedOn: date,
      notes: z.string().trim().max(2000).default('')
    }),
    raw
  );
  if (file) assertPdfUpload(file.name, file.body);
  return inAgency(
    caller,
    async (tx, tenantId) => {
      const row = await loadContract(tx, input.id);
      if (row.status !== 'draft' && row.status !== 'sent') throw new AppError('CONFLICT');
      const storage = opts.storage ?? getStorage();
      let key = row.signedFileKey;
      if (file) {
        key = tenantKey(tenantId, 'contracts', row.id, 'signed.pdf');
        await storage.put(key, file.body, { contentType: 'application/pdf' });
      }
      const now = (opts.now ?? new Date()).toISOString();
      try {
        await tx
          .update(agencyContracts)
          .set({
            status: 'signed',
            signedOn: input.signedOn,
            notes: input.notes || row.notes,
            signedFileKey: key,
            updatedBy: caller.id,
            updatedAt: now
          })
          .where(eq(agencyContracts.id, row.id));
      } catch (error) {
        if (file && key) await storage.remove(key);
        throw error;
      }
      await audit(tx, {
        action: 'agency.contract.signed',
        entity: 'agency_contract',
        entityId: row.id,
        before: { status: row.status },
        after: { status: 'signed', signedOn: input.signedOn, file: Boolean(file) }
      });
    },
    opts
  );
}

export async function voidAgencyContract(caller: StaffCaller, id: string, opts: Options = {}) {
  parseInput(z.uuid(), id);
  return inAgency(
    caller,
    async (tx) => {
      const row = await loadContract(tx, id);
      if (row.status === 'void') return;
      const now = (opts.now ?? new Date()).toISOString();
      await tx
        .update(agencyContracts)
        .set({ status: 'void', updatedBy: caller.id, updatedAt: now })
        .where(eq(agencyContracts.id, id));
      await audit(tx, {
        action: 'agency.contract.void',
        entity: 'agency_contract',
        entityId: id,
        before: { status: row.status },
        after: { status: 'void' }
      });
    },
    opts
  );
}

export async function getAgencyContractFileUrl(
  caller: StaffCaller,
  id: string,
  opts: Options = {}
) {
  parseInput(z.uuid(), id);
  const key = await inAgency(
    caller,
    async (tx, tenantId) => {
      const [row] = await tx
        .select({ key: agencyContracts.signedFileKey })
        .from(agencyContracts)
        .where(eq(agencyContracts.id, id))
        .limit(1);
      if (!row?.key) throw new AppError('NOT_FOUND');
      return { tenantId, key: row.key };
    },
    opts
  );
  return {
    url: await mintSignedUrl(opts.storage ?? getStorage(), key.tenantId, key.key)
  };
}
