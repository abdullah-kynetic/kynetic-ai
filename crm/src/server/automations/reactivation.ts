import { and, eq, isNull, or } from 'drizzle-orm';
import { z } from 'zod';
import { audit } from '../audit';
import { can, type Actor } from '../auth/permissions';
import { canContact } from '../consent';
import type { Db } from '../db/client';
import { automationRuns, automations, contacts, reactivationBatches } from '../db/schema';
import { AppError, ValidationError } from '../errors';
import { enqueue } from '../jobs';
import { requireModule } from '../modules';
import { withTenant, type TenantContextInput } from '../tenancy';

export const reactivationAudienceSchema = z
  .strictObject({
    importedSource: z.string().trim().min(1).max(100).optional(),
    importBatchId: z.uuid().optional()
  })
  .refine((v) => Boolean(v.importedSource || v.importBatchId), {
    message: 'an audience source or import batch is required',
    path: ['importedSource']
  });

export type ReactivationAudience = z.infer<typeof reactivationAudienceSchema>;

export type ReactivationResult = {
  batchId: string;
  requested: number;
  eligible: number;
  enrolled: number;
  blocked: number;
};

/** Launches a one-time, consent-gated reactivation campaign over imported old leads. */
export async function launchReactivation(
  ctx: TenantContextInput,
  actor: Actor,
  input: ReactivationAudience,
  opts: { now?: Date; db?: Db } = {}
): Promise<ReactivationResult> {
  if (!can(actor, 'tenant_data.write', ctx.tenantId)) throw new AppError('FORBIDDEN');
  const audience = reactivationAudienceSchema.safeParse(input);
  if (!audience.success) throw new ValidationError({ audience: ['invalid'] });
  const now = opts.now ?? new Date();

  return withTenant(
    ctx,
    async (tx) => {
      await requireModule(ctx, 'reactivation', { tx });
      const [sequence] = await tx
        .select({ id: automations.id })
        .from(automations)
        .where(
          and(
            eq(automations.templateKey, 'reactivation'),
            eq(automations.kind, 'template'),
            eq(automations.enabled, true)
          )
        )
        .limit(1);
      if (!sequence) throw new AppError('CONFLICT', { message: 'Reactivation automation is not enabled.' });

      const source = audience.data.importedSource;
      const batch = audience.data.importBatchId;
      const rows = await tx
        .select({ id: contacts.id })
        .from(contacts)
        .where(
          and(
            isNull(contacts.deletedAt),
            isNull(contacts.mergedIntoId),
            or(
              source ? eq(contacts.importedSource, source) : undefined,
              batch ? eq(contacts.importBatchId, batch) : undefined
            )
          )
        );
      const [created] = await tx
        .insert(reactivationBatches)
        .values({
          tenantId: ctx.tenantId,
          audienceFilter: audience.data,
          requestedCount: rows.length,
          launchedAt: now.toISOString(),
          createdBy: actor.userId
        })
        .returning({ id: reactivationBatches.id });

      let eligible = 0;
      let enrolled = 0;
      let blocked = 0;
      for (const contact of rows) {
        const decision = await canContact(ctx, contact.id, 'sms', now, {
          tx,
          purpose: 'reactivation'
        });
        if (!decision.allowed) {
          blocked += 1;
          continue;
        }
        eligible += 1;
        const [existing] = await tx
          .select({ id: automationRuns.id })
          .from(automationRuns)
          .where(
            and(
              eq(automationRuns.automationId, sequence.id),
              eq(automationRuns.contactId, contact.id),
              eq(automationRuns.status, 'active')
            )
          )
          .limit(1);
        if (existing) continue;
        const [run] = await tx
          .insert(automationRuns)
          .values({
            tenantId: ctx.tenantId,
            automationId: sequence.id,
            contactId: contact.id,
            nextRunAt: now.toISOString()
          })
          .returning({ id: automationRuns.id });
        await enqueue(
          'automation.step',
          { tenantId: ctx.tenantId, runId: run.id },
          { tx, singletonKey: `automation-step:${run.id}:1` }
        );
        enrolled += 1;
      }

      await tx
        .update(reactivationBatches)
        .set({ eligibleCount: eligible, enrolledCount: enrolled, blockedCount: blocked, status: 'completed' })
        .where(eq(reactivationBatches.id, created.id));
      await audit(tx, {
        action: 'reactivation.launch',
        entity: 'reactivation_batch',
        entityId: created.id,
        after: { requested: rows.length, eligible, enrolled, blocked }
      });
      return { batchId: created.id, requested: rows.length, eligible, enrolled, blocked };
    },
    { db: opts.db }
  );
}
