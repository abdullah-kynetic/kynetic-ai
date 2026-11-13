import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { audit } from '../audit';
import { authorize, type Actor } from '../auth';
import { aiMessageDrafts, llmAudit } from '../db/schema';
import { AppError } from '../errors';
import { decideLlmOutput } from '../llm';
import { EMAIL_BODY_MAX, EMAIL_SUBJECT_MAX, SMS_MAX } from '../llm/features/message-draft';
import { sendContactMessage, type ContactMessageDeps } from '../messaging/contact-message';
import { withTenant, type TenantContextInput } from '../tenancy';
import { parseInput, uuidSchema } from '../validation';

// The human step for a model-written message. Lives outside server/llm on purpose: this is the only
// place a draft meets the outbound gate, and it only does so after a signed-in person approves.

const approveSchema = z.strictObject({
  draftId: uuidSchema,
  /** The person's edits. Whatever they approve is what goes out, edited or not. */
  subject: z.string().trim().min(1).max(EMAIL_SUBJECT_MAX).optional(),
  body: z.string().trim().min(1).max(EMAIL_BODY_MAX).optional()
});

export type DraftSendResult =
  | { status: 'sent'; messageId: string }
  | { status: 'blocked'; message: string }
  | { status: 'failed'; message: string };

/**
 * A person approves a draft and it is sent through the same gate as any manual message. Consent,
 * opt-out, DNC, quiet hours and the switches all still apply; if the gate refuses, the draft stays
 * (status `blocked`, with the reason in plain words) and nothing is sent. Approval is audited with
 * the approver's id, and any edit is audited with before and after.
 */
export async function approveAndSendDraft(
  actor: Actor,
  ctx: TenantContextInput,
  request: z.input<typeof approveSchema>,
  deps: ContactMessageDeps = {}
): Promise<DraftSendResult> {
  authorize(actor, 'tenant_data.write', ctx.tenantId);
  if (!ctx.userId || ctx.readOnly) throw new AppError('FORBIDDEN');
  const input = parseInput(approveSchema, request);
  const draft = await withTenant(ctx, async (tx) => {
    const [row] = await tx
      .select()
      .from(aiMessageDrafts)
      .where(
        and(
          eq(aiMessageDrafts.id, input.draftId),
          inArray(aiMessageDrafts.status, ['draft', 'blocked'])
        )
      )
      .limit(1);
    return row;
  });
  if (!draft) throw new AppError('NOT_FOUND');
  const body = input.body ?? draft.body;
  const subject = draft.channel === 'email' ? (input.subject ?? draft.subject ?? '') : null;
  if (draft.channel === 'sms' && body.length > SMS_MAX) {
    throw new AppError('VALIDATION_FAILED', {
      message: `Keep the text under ${SMS_MAX} characters.`
    });
  }
  const edited = body !== draft.body || subject !== draft.subject;
  // The first approval is stamped; a retry after a block reuses it (already approved, same person's text).
  await decideLlmOutput({ ...ctx, userId: ctx.userId }, draft.auditId, 'approved');
  const [approved] = await withTenant(ctx, (tx) =>
    tx
      .select({ status: llmAudit.approvalStatus })
      .from(llmAudit)
      .where(eq(llmAudit.id, draft.auditId))
  );
  if (approved?.status !== 'approved') throw new AppError('FORBIDDEN');
  if (edited) {
    await withTenant(ctx, async (tx) => {
      await tx
        .update(aiMessageDrafts)
        .set({ body, subject })
        .where(eq(aiMessageDrafts.id, draft.id));
      await audit(tx, {
        action: 'ai_draft.edit',
        entity: 'ai_message_draft',
        entityId: draft.id,
        before: { subject: draft.subject, body: draft.body },
        after: { subject, body }
      });
    });
  }
  const result = await sendContactMessage(
    ctx,
    draft.channel === 'sms'
      ? { contactId: draft.contactId, channel: 'sms', body }
      : { contactId: draft.contactId, channel: 'email', subject: subject ?? '', body },
    deps
  );
  await withTenant(ctx, async (tx) => {
    if (result.status === 'sent') {
      await tx
        .update(aiMessageDrafts)
        .set({ status: 'sent', blockedMessage: null, sentMessageId: result.messageId })
        .where(eq(aiMessageDrafts.id, draft.id));
    } else {
      await tx
        .update(aiMessageDrafts)
        .set({ status: 'blocked', blockedMessage: result.message })
        .where(eq(aiMessageDrafts.id, draft.id));
    }
    await audit(tx, {
      action: result.status === 'sent' ? 'ai_draft.send' : 'ai_draft.send_blocked',
      entity: 'ai_message_draft',
      entityId: draft.id,
      after: { status: result.status }
    });
  });
  return result.status === 'sent'
    ? { status: 'sent', messageId: result.messageId }
    : { status: result.status, message: result.message };
}

export async function rejectDraft(
  actor: Actor,
  ctx: TenantContextInput,
  draftId: string
): Promise<void> {
  authorize(actor, 'tenant_data.write', ctx.tenantId);
  if (!ctx.userId || ctx.readOnly) throw new AppError('FORBIDDEN');
  const id = parseInput(uuidSchema, draftId);
  const draft = await withTenant(ctx, async (tx) => {
    const [row] = await tx
      .select({ auditId: aiMessageDrafts.auditId })
      .from(aiMessageDrafts)
      .where(and(eq(aiMessageDrafts.id, id), eq(aiMessageDrafts.status, 'draft')))
      .limit(1);
    return row;
  });
  if (!draft) throw new AppError('NOT_FOUND');
  await decideLlmOutput({ ...ctx, userId: ctx.userId }, draft.auditId, 'rejected');
  await withTenant(ctx, (tx) =>
    tx.update(aiMessageDrafts).set({ status: 'rejected' }).where(eq(aiMessageDrafts.id, id))
  );
}
