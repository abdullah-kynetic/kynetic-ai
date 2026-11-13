'use server';

import { approveAndSendDraft, rejectDraft } from '@/server/ai-drafts';
import { contactsActorScope } from '@/server/contacts';
import { AppError } from '@/server/errors';
import { describeLlmFailure } from '@/server/llm/messages';
import { createLeadBrief, decideBriefFact } from '@/server/llm/features/lead-brief';
import { createMessageDraft } from '@/server/llm/features/message-draft';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';

type Result = { ok: true; note?: string } | { ok: false; message: string };

async function run(
  contactId: string,
  fn: (
    s: NonNullable<Awaited<ReturnType<typeof contactsActorScope>>>
  ) => Promise<string | undefined>
): Promise<Result> {
  const scope = await contactsActorScope(await headers(), 'tenant_data.write');
  if (!scope) return { ok: false, message: 'You do not have access to do this.' };
  try {
    const note = await fn(scope);
    revalidatePath(`/dashboard/contacts/${contactId}`);
    return { ok: true, note };
  } catch (error) {
    const known = describeLlmFailure(error);
    if (known) return { ok: false, message: known };
    if (error instanceof AppError && error.code === 'NOT_FOUND') {
      return { ok: false, message: 'That no longer exists.' };
    }
    throw error;
  }
}

export async function draftMessageAction(
  contactId: string,
  channel: 'sms' | 'email',
  purpose: string
) {
  return run(contactId, async ({ ctx, actor }) => {
    await createMessageDraft(actor, ctx, { contactId, channel, purpose });
    return undefined;
  });
}

export async function approveDraftAction(
  contactId: string,
  draftId: string,
  subject: string,
  body: string
) {
  return run(contactId, async ({ ctx, actor }) => {
    const r = await approveAndSendDraft(actor, ctx, {
      draftId,
      ...(subject.trim() ? { subject } : {}),
      body
    });
    if (r.status === 'sent') return 'Sent.';
    throw new AppError('VALIDATION_FAILED', { message: r.message });
  });
}

export async function rejectDraftAction(contactId: string, draftId: string) {
  return run(contactId, async ({ ctx, actor }) => {
    await rejectDraft(actor, ctx, draftId);
    return 'Draft discarded.';
  });
}

export async function createBriefAction(contactId: string) {
  return run(contactId, async ({ ctx, actor }) => {
    await createLeadBrief(actor, ctx, contactId);
    return undefined;
  });
}

export async function decideFactAction(
  contactId: string,
  factId: string,
  decision: 'accepted' | 'dismissed'
) {
  return run(contactId, async ({ ctx, actor }) => {
    await decideBriefFact(actor, ctx, { factId, decision });
    return undefined;
  });
}
