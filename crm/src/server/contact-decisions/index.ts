import { createHash } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { recordActivity } from '../activity';
import { CONSENT_CHANNELS } from '../consent/types';
import { type Db } from '../db/client';
import { contactDecisions, contacts } from '../db/schema';
import { AppError } from '../errors';
import { requireModule } from '../modules';
import { type ServiceContext, withServiceTenant } from '../service-auth';
import { parseInput } from '../validation';

// Rule identifiers, not free-form transcripts, PII or secret-bearing diagnostics.
const ruleCode = z.string().regex(/^[a-zA-Z0-9_.:-]{1,100}$/);
export const contactDecisionSchema = z.strictObject({
  eventId: z.uuid(),
  version: z.literal(1),
  occurredAt: z.iso.datetime(),
  payload: z.strictObject({
    contactId: z.uuid(),
    channel: z.enum(CONSENT_CHANNELS),
    decision: z.enum(['allow', 'deny']),
    reasonCode: ruleCode,
    ruleVersion: ruleCode,
    firedRule: ruleCode,
    evaluatedAt: z.iso.datetime()
  })
});

/** Append one decision and timeline item atomically; this function never authorizes a send. */
export async function recordContactDecision(
  svc: ServiceContext,
  input: unknown,
  opts: { db?: Db } = {}
): Promise<{ id: string; status: 'recorded' | 'duplicate' }> {
  // Defence in depth for non-route callers; the route authenticates before reading the body.
  if (!svc.scopes.includes('contact-decisions:write')) throw new AppError('FORBIDDEN');
  return withServiceTenant(
    svc,
    async (tx) => {
      await requireModule({ tenantId: svc.tenantId, role: 'system' }, 'platform', { tx });
      const value = parseInput(contactDecisionSchema, input);
      const [contact] = await tx
        .select({ id: contacts.id })
        .from(contacts)
        .where(
          and(
            eq(contacts.id, value.payload.contactId),
            isNull(contacts.deletedAt),
            isNull(contacts.mergedIntoId)
          )
        )
        .limit(1);
      if (!contact) throw new AppError('NOT_FOUND');
      // Zod builds a fixed-key-order object, so JSON member order on a retry is immaterial.
      const payloadHash = createHash('sha256').update(JSON.stringify(value)).digest('hex');
      const [created] = await tx
        .insert(contactDecisions)
        .values({
          tenantId: svc.tenantId,
          eventId: value.eventId,
          contactId: contact.id,
          payload: value,
          payloadHash
        })
        .onConflictDoNothing({ target: [contactDecisions.tenantId, contactDecisions.eventId] })
        .returning({ id: contactDecisions.id });
      if (!created) {
        const [existing] = await tx
          .select({ id: contactDecisions.id, hash: contactDecisions.payloadHash })
          .from(contactDecisions)
          .where(eq(contactDecisions.eventId, value.eventId))
          .limit(1);
        if (!existing || existing.hash !== payloadHash) throw new AppError('CONFLICT');
        return { id: existing.id, status: 'duplicate' };
      }
      await recordActivity(tx, {
        contactId: contact.id,
        type: 'automation',
        refTable: 'contact_decisions',
        refId: created.id,
        summary: `Contact decision: ${value.payload.decision} (${value.payload.reasonCode})`,
        actor: { type: 'automation' },
        meta: {
          ...value.payload,
          eventId: value.eventId,
          version: value.version,
          occurredAt: value.occurredAt,
          serviceTokenId: svc.tokenId
        }
      });
      return { id: created.id, status: 'recorded' };
    },
    opts
  );
}
