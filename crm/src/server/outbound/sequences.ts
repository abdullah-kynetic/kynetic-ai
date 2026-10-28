import { and, eq, isNull } from 'drizzle-orm';
import { enqueue } from '../jobs';
import { automationRuns, automations, contacts } from '../db/schema';
import { withTenant, type TenantContextInput } from '../tenancy';
import { AppError, ValidationError } from '../errors';

export type EnrollInSequenceInput = { contactId: string; sequenceKey: string };

/** The sequence engine ships in M7-02. Until then enrolling is a no-op the caller can see. */
export type EnrollResult = { status: 'enrolled'; runId: string } | { status: 'not_available' };

export async function enrollInSequence(
  ctx: TenantContextInput,
  input: EnrollInSequenceInput
): Promise<EnrollResult> {
  if (!input.contactId || !input.sequenceKey) throw new ValidationError({ sequence: ['invalid'] });
  return withTenant(ctx, async (tx) => {
    const [contact] = await tx
      .select({ id: contacts.id })
      .from(contacts)
      .where(and(eq(contacts.id, input.contactId), isNull(contacts.deletedAt)))
      .limit(1);
    if (!contact) throw new AppError('NOT_FOUND');
    const [sequence] = await tx
      .select()
      .from(automations)
      .where(and(eq(automations.templateKey, input.sequenceKey), eq(automations.enabled, true)))
      .limit(1);
    if (!sequence) return { status: 'not_available' };
    const [existingRun] = await tx
      .select({ id: automationRuns.id })
      .from(automationRuns)
      .where(
        and(
          eq(automationRuns.automationId, sequence.id),
          eq(automationRuns.contactId, input.contactId),
          eq(automationRuns.status, 'active')
        )
      )
      .limit(1);
    if (existingRun) return { status: 'enrolled', runId: existingRun.id };
    const [run] = await tx
      .insert(automationRuns)
      .values({
        tenantId: ctx.tenantId,
        automationId: sequence.id,
        contactId: input.contactId,
        nextRunAt: new Date().toISOString()
      })
      .returning({ id: automationRuns.id });
    await enqueue(
      'automation.step',
      { tenantId: ctx.tenantId, runId: run.id },
      { tx, singletonKey: `automation-step:${run.id}:1` }
    );
    return { status: 'enrolled', runId: run.id };
  });
}
