import sanitizeHtml from 'sanitize-html';
import { z } from 'zod';
import type { Tx } from '../db/client';
import { recordActivity } from '../activity';
import { contactExists } from './reads';
import type { ServiceContext } from '../service-auth/authenticate';

// POST /api/service/call-log. Records the outcome of a call a HUMAN already placed, as one entry on
// the contact's timeline. It never dials, texts, emails, emits an event or queues a job, and it does
// not touch consent or do-not-call state (those go through contact-decisions). The note is untrusted
// text: it is reduced to plain text here and must be read as data, never as instructions.

/** `dnc` is left out on purpose: a do-not-call request is a consent decision, not a call outcome. */
export const CALL_LOG_OUTCOMES = [
  'booked',
  'qualified',
  'not_interested',
  'voicemail',
  'no_answer',
  'transferred',
  'other'
] as const;

const MAX_PAST_MS = 90 * 24 * 3_600_000;
const MAX_FUTURE_MS = 5 * 60_000;

/** Plain text only: tags removed, entities decoded, control characters dropped, whitespace collapsed. */
export function plainNote(raw: string): string {
  const text = sanitizeHtml(raw, { allowedTags: [], allowedAttributes: {} });
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/[<>]/g, '')
    .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const callLogSchema = z.strictObject({
  contactId: z.uuid(),
  outcome: z.enum(CALL_LOG_OUTCOMES),
  calledAt: z.iso.datetime({ offset: true }).refine((v) => {
    const t = Date.parse(v);
    const now = Date.now();
    return t <= now + MAX_FUTURE_MS && t >= now - MAX_PAST_MS;
  }, 'out_of_range'),
  durationS: z.number().int().min(0).max(14_400).optional(),
  note: z.string().max(2000).optional()
});

export type CallLogInput = z.output<typeof callLogSchema>;

const LABEL: Record<(typeof CALL_LOG_OUTCOMES)[number], string> = {
  booked: 'booked',
  qualified: 'qualified',
  not_interested: 'not interested',
  voicemail: 'voicemail',
  no_answer: 'no answer',
  transferred: 'transferred',
  other: 'other'
};

/** Runs inside withServiceTenant. Returns the new activity id. */
export async function recordCallLog(
  tx: Tx,
  svc: ServiceContext,
  input: CallLogInput
): Promise<{ activityId: string; outcome: string }> {
  await contactExists(tx, input.contactId);
  const note = input.note ? plainNote(input.note).slice(0, 500) : '';
  const summary = `Call logged: ${LABEL[input.outcome]}${note ? ` (${note})` : ''}`;
  const { id } = await recordActivity(tx, {
    contactId: input.contactId,
    type: 'call',
    summary,
    actor: { type: 'system' },
    occurredAt: new Date(input.calledAt),
    meta: {
      source: 'service-api',
      serviceTokenId: svc.tokenId,
      outcome: input.outcome,
      ...(input.durationS !== undefined ? { durationS: input.durationS } : {}),
      ...(note ? { note } : {})
    }
  });
  return { activityId: id, outcome: input.outcome };
}
