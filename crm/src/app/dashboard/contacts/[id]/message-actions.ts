'use server';

import { AppError, ValidationError } from '@/server/errors';
import { contactsScope } from '@/server/contacts';
import { sendContactMessage } from '@/server/messaging';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

export type SendMessageResult = { ok: true } | { ok: false; message: string };

/**
 * The compose box on the contact page (F-47). The caller comes from the session, never from the
 * arguments. The send itself passes consent, DNC, quiet hours and the outbound switch, so a block
 * comes back as plain words for the box to show.
 */
export async function sendMessageAction(
  contactId: string,
  channel: 'sms' | 'email',
  subject: string,
  body: string
): Promise<SendMessageResult> {
  const ctx = await contactsScope(await headers(), 'tenant_data.write');
  if (!ctx) return { ok: false, message: 'You do not have access to send messages.' };
  try {
    const result = await sendContactMessage(
      ctx,
      channel === 'sms' ? { contactId, channel, body } : { contactId, channel, subject, body }
    );
    if (result.status === 'sent') {
      revalidatePath(`/dashboard/contacts/${contactId}`);
      return { ok: true };
    }
    revalidatePath(`/dashboard/contacts/${contactId}`);
    return { ok: false, message: result.message };
  } catch (error) {
    if (error instanceof ValidationError) {
      return {
        ok: false,
        message: channel === 'email' ? 'Add a subject and a message.' : 'Write a message first.'
      };
    }
    if (error instanceof AppError && error.code === 'NOT_FOUND') {
      return { ok: false, message: 'That contact no longer exists.' };
    }
    throw error;
  }
}
