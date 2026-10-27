import { and, eq, isNull, ne, sql } from 'drizzle-orm';
import { getWorkerDb, type Db } from '../db/client';
import { contacts, emailSuppressions, integrations, messages } from '../db/schema';
import { revokeConsent } from '../consent';
import { emitEvent } from '../events';
import { registerWebhookProcessor } from '../webhooks';
import { withTenant } from '../tenancy';
import type { VerifiedEmailEvent } from '../adapters/email/types';

export const RESEND_SOURCE = 'resend';

const STATUS = { delivered: 'delivered', bounced: 'bounced', complained: 'complained' } as const;

/**
 * Applies one verified Resend event (F-30, F-35): message status, address suppression, a complaint
 * as an email opt-out, and the tenant's `email` integration health (F-62). The tenant comes from
 * our own messages row; an email with no such row (a magic link, say) has no tenant and is a no-op.
 */
export async function applyEmailEvent(
  evt: VerifiedEmailEvent,
  opts: { db?: Db; now?: Date } = {}
): Promise<'applied' | 'unattributed'> {
  const db = opts.db ?? getWorkerDb();
  const now = (opts.now ?? new Date()).toISOString();
  const rows = await db.execute<{ t: string | null }>(
    sql`select email_message_tenant(${evt.providerId}) as t`
  );
  const tenantId = rows[0]?.t;
  if (!tenantId) return 'unattributed';

  await withTenant(
    { tenantId, role: 'system' },
    async (tx) => {
      const updated = await tx
        .update(messages)
        .set({
          status: STATUS[evt.kind],
          deliveredAt: evt.kind === 'delivered' ? now : undefined,
          errorCode: evt.kind === 'delivered' ? undefined : evt.kind
        })
        .where(
          and(
            eq(messages.provider, 'resend'),
            eq(messages.providerMessageId, evt.providerId),
            // a late "delivered" never overwrites a bounce or complaint
            ne(messages.status, 'bounced'),
            ne(messages.status, 'complained')
          )
        )
        .returning({ id: messages.id });

      if (evt.kind !== 'delivered') {
        await tx
          .insert(emailSuppressions)
          .values({
            tenantId,
            address: evt.address,
            reason: evt.kind,
            providerMessageId: evt.providerId
          })
          .onConflictDoUpdate({
            target: [emailSuppressions.tenantId, emailSuppressions.address],
            set: { reason: 'complained', updatedAt: now },
            // only a complaint upgrades an existing row
            setWhere: sql`excluded.reason = 'complained'`
          });
      }

      if (evt.kind === 'complained') {
        const matches = await tx
          .select({ id: contacts.id })
          .from(contacts)
          .where(
            and(
              isNull(contacts.deletedAt),
              sql`(${contacts.primaryEmail} = ${evt.address} or ${evt.address} = any(${contacts.emails}))`
            )
          );
        for (const c of matches) {
          await revokeConsent(
            { tenantId, role: 'system' },
            {
              contactId: c.id,
              channel: 'email',
              source: 'email_link',
              capturedText: 'spam complaint'
            },
            { tx }
          );
        }
      }

      const failed = evt.kind !== 'delivered';
      await tx
        .insert(integrations)
        .values({
          tenantId,
          kind: 'email',
          status: failed ? 'degraded' : 'ok',
          lastSuccessAt: failed ? undefined : now,
          lastErrorAt: failed ? now : undefined,
          lastError: failed ? evt.kind : undefined,
          errorCount: failed ? 1 : 0
        })
        .onConflictDoUpdate({
          target: [integrations.tenantId, integrations.kind],
          set: failed
            ? {
                status: 'degraded',
                lastErrorAt: now,
                lastError: evt.kind,
                errorCount: sql`${integrations.errorCount} + 1`
              }
            : { lastSuccessAt: now }
        });

      for (const m of updated) {
        await emitEvent(tx, {
          name: 'message.status_changed',
          tenantId,
          actor: { type: 'system' },
          payload: { messageId: m.id, channel: 'email', status: STATUS[evt.kind] }
        });
      }
    },
    { db }
  );
  return 'applied';
}

/** True when this tenant must not email the address (bounced or complained). */
export async function isEmailSuppressed(
  tenantId: string,
  address: string,
  opts: { db?: Db } = {}
): Promise<boolean> {
  return withTenant(
    { tenantId, role: 'system' },
    async (tx) => {
      const [row] = await tx
        .select({ id: emailSuppressions.id })
        .from(emailSuppressions)
        .where(
          and(
            eq(emailSuppressions.tenantId, tenantId),
            eq(emailSuppressions.address, address.trim().toLowerCase())
          )
        )
        .limit(1);
      return !!row;
    },
    opts
  );
}

/** Call once at worker boot, before the webhook worker starts. */
export function registerResendProcessor(): void {
  registerWebhookProcessor(RESEND_SOURCE, async (event) => {
    await applyEmailEvent(event.payload as VerifiedEmailEvent);
  });
}
