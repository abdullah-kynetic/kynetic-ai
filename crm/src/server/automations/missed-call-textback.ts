import { and, eq } from 'drizzle-orm';
import { getWorkerDb } from '../db/client';
import { calls } from '../db/schema';
import { subscribe } from '../events';
import { getSmsProvider } from '../messaging/provider';
import type { SmsProvider } from '../adapters/sms/types';
import { sendSms } from '../messaging/sms';
import { withTenant } from '../tenancy';

/** F-81: one compliant SMS for an inbound call that was not answered. */
export function registerMissedCallTextbackSubscriber(
  opts: { db?: ReturnType<typeof getWorkerDb>; provider?: SmsProvider; now?: () => Date } = {}
): void {
  subscribe(
    'call.completed',
    'missed-call-textback',
    async (env) => {
      if (
        env.payload.direction !== 'inbound' ||
        (env.payload.outcome !== 'no_answer' && env.payload.outcome !== 'voicemail')
      ) {
        return;
      }
      const callId = env.payload.callId;
      if (typeof callId !== 'string') return;

      const [call] = await withTenant(
        { tenantId: env.tenantId, role: 'system' },
        (tx) =>
          tx
            .select({ contactId: calls.contactId })
            .from(calls)
            .where(and(eq(calls.id, callId), eq(calls.tenantId, env.tenantId)))
            .limit(1),
        { db: opts.db ?? getWorkerDb() }
      );
      if (!call?.contactId) return;

      await sendSms(
        { tenantId: env.tenantId, role: 'system' },
        {
          contactId: call.contactId,
          module: 'missed_call_textback',
          purpose: 'missed_call_textback',
          body: 'Sorry we missed your call. Reply here and our team will get back to you shortly.',
          idempotencyKey: `missed-call-textback:${callId}`,
          actor: { type: 'automation' }
        },
        {
          provider: opts.provider ?? getSmsProvider(),
          now: opts.now?.() ?? new Date(env.occurredAt)
        }
      );
    },
    { module: 'missed_call_textback' }
  );
}
