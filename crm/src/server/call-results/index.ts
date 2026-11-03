import { createHash, randomUUID } from 'node:crypto';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { writeCallInTransaction } from '../calls';
import { CALL_OUTCOMES, CALL_SENTIMENTS } from '../calls/outcomes';
import type { Db } from '../db/client';
import { activities, alexConfigs, calls, contacts } from '../db/schema';
import { AppError } from '../errors';
import { requireModule } from '../modules';
import { type ServiceContext, withServiceTenant } from '../service-auth';
import { parseInput } from '../validation';

export const callResultSchema = z.strictObject({
  eventId: z.uuid(),
  version: z.literal(1),
  occurredAt: z.iso.datetime(),
  payload: z.strictObject({
    contactId: z.uuid(),
    provider: z.enum(['elevenlabs', 'retell']),
    providerCallId: z.string().regex(/^[a-zA-Z0-9_-]{1,200}$/),
    agentId: z.string().regex(/^[a-zA-Z0-9_-]{1,200}$/),
    direction: z.enum(['inbound', 'outbound']),
    startedAt: z.iso.datetime(),
    durationS: z.number().int().min(0).max(86_400),
    outcome: z.enum(CALL_OUTCOMES),
    sentiment: z.enum(CALL_SENTIMENTS).default('unknown'),
    transcript: z.string().max(200_000).optional(),
    summary: z.string().max(5_000).optional(),
    costCents: z.number().int().min(0).max(2_147_483_647).optional(),
    // Already-ingested recording only: never accept/fetch an arbitrary provider URL.
    recordingKey: z.string().max(400).optional()
  })
});

export async function recordCallResult(svc: ServiceContext, raw: unknown, opts: { db?: Db } = {}) {
  if (!svc.scopes.includes('calls:write')) throw new AppError('FORBIDDEN');
  return withServiceTenant(
    svc,
    async (tx) => {
      const ctx = { tenantId: svc.tenantId, role: 'system' as const };
      await requireModule(ctx, 'alex_core', { tx });
      const input = parseInput(callResultSchema, raw);
      const p = input.payload;
      const [contact] = await tx
        .select({ id: contacts.id, phone: contacts.primaryPhoneE164 })
        .from(contacts)
        .where(
          and(
            eq(contacts.id, p.contactId),
            isNull(contacts.deletedAt),
            isNull(contacts.mergedIntoId)
          )
        )
        .limit(1);
      const [agent] = await tx
        .select({ ref: alexConfigs.agentRef })
        .from(alexConfigs)
        .where(and(eq(alexConfigs.provider, p.provider), eq(alexConfigs.agentRef, p.agentId)))
        .limit(1);
      if (!contact || !agent) throw new AppError('NOT_FOUND');
      // Restrict the reference to this tenant's calls storage area, not documents/backups or external URLs.
      if (
        p.recordingKey &&
        !new RegExp(`^${svc.tenantId}/calls/[a-zA-Z0-9_-]{1,100}/recording$`).test(p.recordingKey)
      )
        throw new AppError('NOT_FOUND');
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`${svc.tenantId}:call-result:${input.eventId}`}, 0))`
      );
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`${svc.tenantId}:${p.provider}:${p.providerCallId}`}, 0))`
      );
      const hash = createHash('sha256').update(JSON.stringify(input)).digest('hex');
      const prior = await tx.execute<{ call_id: string; payload_hash: string }>(sql`
      select call_id, payload_hash from call_result_receipts where tenant_id = ${svc.tenantId}::uuid
      and (event_id = ${input.eventId}::uuid or (provider = ${p.provider} and provider_call_id = ${p.providerCallId}))`);
      if (prior.length) {
        if (prior.length !== 1 || prior[0]!.payload_hash !== hash) throw new AppError('CONFLICT');
        return { callId: prior[0]!.call_id, status: 'duplicate' as const };
      }
      const [existing] = await tx
        .select({ id: calls.id, contactId: calls.contactId })
        .from(calls)
        .where(and(eq(calls.provider, p.provider), eq(calls.providerCallId, p.providerCallId)))
        .limit(1);
      if (existing?.contactId && existing.contactId !== contact.id) throw new AppError('CONFLICT');
      if (existing) {
        const [completed] = await tx
          .select({ id: activities.id })
          .from(activities)
          .where(and(eq(activities.refTable, 'calls'), eq(activities.refId, existing.id)))
          .limit(1);
        // A native completion already owns this call; do not silently overwrite its evidence.
        if (completed) throw new AppError('CONFLICT');
      }
      const stored = await writeCallInTransaction(
        ctx,
        {
          ...p,
          externalId: input.eventId,
          kind: 'call.ended',
          counterpartE164: contact.phone ?? undefined
        },
        p.provider,
        tx,
        contact.id
      );
      if (p.recordingKey)
        await tx
          .update(calls)
          .set({ recordingKey: p.recordingKey })
          .where(eq(calls.id, stored.callId));
      // The immutable receipt and shared call/timeline/event persistence commit together.
      await tx.execute(sql`insert into call_result_receipts (id, tenant_id, event_id, call_id, provider, provider_call_id, payload_hash)
      values (${randomUUID()}::uuid, ${svc.tenantId}::uuid, ${input.eventId}::uuid, ${stored.callId}::uuid,
        ${p.provider}, ${p.providerCallId}, ${hash})`);
      return { callId: stored.callId, status: 'recorded' as const };
    },
    opts
  );
}
