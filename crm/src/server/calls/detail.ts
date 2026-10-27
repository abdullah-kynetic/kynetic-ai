import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { audit } from '../audit';
import { authorize, type Actor } from '../auth';
import { calls, contacts } from '../db/schema';
import { AppError, ValidationError } from '../errors';
import { emitEvent } from '../events';
import { requireModule } from '../modules';
import { withTenant, type TenantContextInput } from '../tenancy';

export type TranscriptLine = { speaker: string; text: string; startS: number | null };

export type CallDetail = {
  id: string;
  contactId: string | null;
  contactName: string | null;
  direction: 'inbound' | 'outbound';
  startedAt: string;
  durationS: number | null;
  outcome: string | null;
  sentiment: string | null;
  summary: string | null;
  /** Null while the transcript is still processing. */
  transcript: TranscriptLine[] | null;
  extracted: Record<string, unknown>;
  hasRecording: boolean;
  disclosureGiven: boolean;
  disclosureVersion: string | null;
  flagged: boolean;
  flagNote: string | null;
};

const segmentSchema = z.object({
  speaker: z.string().min(1),
  text: z.string(),
  start: z.number().nonnegative().optional()
});

/** Timed segments when the provider sent them, otherwise the "Speaker: text" lines of the plain transcript. */
export function transcriptLines(
  segments: unknown,
  transcript: string | null
): TranscriptLine[] | null {
  const parsed = z.array(segmentSchema).safeParse(segments);
  if (parsed.success && parsed.data.length > 0) {
    return parsed.data.map((s) => ({ speaker: s.speaker, text: s.text, startS: s.start ?? null }));
  }
  if (!transcript?.trim()) return null;
  return transcript
    .split('\n')
    .filter((l) => l.trim())
    .map((line) => {
      const m = /^([^:]{1,40}):\s*(.*)$/.exec(line);
      return m
        ? { speaker: m[1].trim(), text: m[2], startS: null }
        : { speaker: '', text: line, startS: null };
    });
}

/**
 * One call for the detail page (F-27). Permission and module checks first, then a tenant-scoped
 * read, so another tenant's call is a 404. The recording key and cost are never returned; the player
 * gets a signed URL from `getCallRecordingUrl`.
 */
export async function getCallDetail(
  actor: Actor,
  ctx: TenantContextInput,
  callId: string
): Promise<CallDetail> {
  authorize(actor, 'calls.read', ctx.tenantId);
  await requireModule(ctx, 'alex_core');
  const row = await withTenant(ctx, async (tx) => {
    const [r] = await tx
      .select({
        call: calls,
        firstName: contacts.firstName,
        lastName: contacts.lastName
      })
      .from(calls)
      .leftJoin(
        contacts,
        and(eq(contacts.id, calls.contactId), eq(contacts.tenantId, calls.tenantId))
      )
      .where(eq(calls.id, callId))
      .limit(1);
    return r;
  });
  if (!row) throw new AppError('NOT_FOUND');
  const c = row.call;
  const name = [row.firstName, row.lastName].filter(Boolean).join(' ').trim();
  return {
    id: c.id,
    contactId: c.contactId,
    contactName: name || null,
    direction: c.direction as CallDetail['direction'],
    startedAt: c.startedAt,
    durationS: c.durationS,
    outcome: c.outcome,
    sentiment: c.sentiment,
    summary: c.summary,
    transcript: transcriptLines(c.transcriptSegments, c.transcript),
    extracted: (c.extracted ?? {}) as Record<string, unknown>,
    hasRecording: Boolean(c.recordingKey),
    disclosureGiven: c.disclosureGiven,
    disclosureVersion: c.disclosureVersion,
    flagged: c.flagged,
    flagNote: c.flagNote
  };
}

const flagInput = z.object({
  reason: z
    .string()
    .trim()
    .max(1000, 'Keep the reason under 1,000 characters')
    .optional()
    .transform((v) => v || undefined)
});

/**
 * Flags a call for Kynetic review (F-28). Sets `calls.flagged` (the admin review list reads
 * `calls_flagged_idx`), writes the audit row, and emits `call.flagged` in the same transaction so
 * Kynetic is notified exactly when the flag commits. Flagging again is a no-op and does not
 * overwrite the first reason or notify twice.
 */
export async function flagCall(
  actor: Actor,
  ctx: TenantContextInput,
  callId: string,
  input: { reason?: string }
): Promise<{ flagged: true; alreadyFlagged: boolean }> {
  authorize(actor, 'calls.flag', ctx.tenantId);
  await requireModule(ctx, 'alex_core');
  const parsed = flagInput.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError({ reason: parsed.error.issues.map((i) => i.message) });
  }
  const { reason } = parsed.data;
  return withTenant(ctx, async (tx) => {
    const [row] = await tx
      .select({ flagged: calls.flagged, contactId: calls.contactId })
      .from(calls)
      .where(eq(calls.id, callId))
      .for('update')
      .limit(1);
    if (!row) throw new AppError('NOT_FOUND');
    if (row.flagged) return { flagged: true as const, alreadyFlagged: true };

    await tx
      .update(calls)
      .set({
        flagged: true,
        flaggedBy: actor.userId,
        flaggedAt: new Date().toISOString(),
        flagNote: reason ?? null,
        updatedAt: new Date().toISOString()
      })
      .where(eq(calls.id, callId));
    await audit(tx, {
      action: 'call.flag',
      entity: 'calls',
      entityId: callId,
      before: { flagged: false },
      after: { flagged: true, reason: reason ?? null }
    });
    await emitEvent(tx, {
      name: 'call.flagged',
      tenantId: ctx.tenantId,
      actor: { type: 'user', id: actor.userId },
      payload: { callId, contactId: row.contactId }
    });
    return { flagged: true as const, alreadyFlagged: false };
  });
}
