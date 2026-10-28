import { createHmac, timingSafeEqual } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { getWorkerDb } from '../db/client';
import { subscribe, type EventEnvelope } from '../events';
import { tenantModules } from '../db/schema';
import { withTenant } from '../tenancy';

export function signN8nEvent(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

export function verifyN8nEvent(body: string, signature: string, secret: string): boolean {
  const expected = Buffer.from(signN8nEvent(body, secret), 'hex');
  const given = Buffer.from(signature, 'hex');
  return expected.length === given.length && timingSafeEqual(expected, given);
}

async function deliver(env: EventEnvelope): Promise<void> {
  const [config] = await withTenant(
    { tenantId: env.tenantId, role: 'system' },
    (tx) =>
      tx
        .select({ config: tenantModules.config })
        .from(tenantModules)
        .where(
          and(eq(tenantModules.tenantId, env.tenantId), eq(tenantModules.moduleKey, 'platform'))
        )
        .limit(1),
    { db: getWorkerDb() }
  );
  const value = config?.config as { n8nWebhookUrl?: unknown; n8nWebhookSecret?: unknown } | undefined;
  if (typeof value?.n8nWebhookUrl !== 'string' || typeof value.n8nWebhookSecret !== 'string') return;
  const body = JSON.stringify(env);
  const response = await fetch(value.n8nWebhookUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-kynetic-event-id': env.id,
      'x-kynetic-event-name': env.name,
      'x-kynetic-signature': signN8nEvent(body, value.n8nWebhookSecret)
    },
    body
  });
  if (!response.ok) throw new Error(`n8n event delivery failed: ${response.status}`);
}

export function registerN8nEventSubscribers(): void {
  for (const name of ['lead.created', 'deal.stage_changed', 'call.completed'] as const) {
    subscribe(`n8n.${name}`, `n8n-${name.replaceAll('.', '-')}`, (env) => deliver(env));
  }
}
