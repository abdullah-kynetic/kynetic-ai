import { createHmac, timingSafeEqual } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { readN8nPushSecret } from '../admin/lead-webhooks';
import { getWorkerDb, type Db } from '../db/client';
import { subscribe, type EventEnvelope } from '../events';
import { tenantModules } from '../db/schema';
import type { Keyring } from '../secrets/crypto';
import { withTenant } from '../tenancy';

export function signN8nEvent(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

export function verifyN8nEvent(body: string, signature: string, secret: string): boolean {
  const expected = Buffer.from(signN8nEvent(body, secret), 'hex');
  const given = Buffer.from(signature, 'hex');
  return expected.length === given.length && timingSafeEqual(expected, given);
}

function pushUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash)
      return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function deliver(
  env: EventEnvelope,
  opts: { db?: Db; fetcher?: typeof fetch; keyring?: Keyring } = {}
): Promise<void> {
  const target = await withTenant(
    { tenantId: env.tenantId, role: 'system' },
    async (tx) => {
      const [config] = await tx
        .select({ config: tenantModules.config })
        .from(tenantModules)
        .where(
          and(eq(tenantModules.tenantId, env.tenantId), eq(tenantModules.moduleKey, 'platform'))
        )
        .limit(1);
      const stored = config?.config as { n8nWebhookUrl?: unknown } | undefined;
      const url = pushUrl(stored?.n8nWebhookUrl);
      if (!url) return null;
      const secret = await readN8nPushSecret(tx, env.tenantId, { keyring: opts.keyring });
      return secret ? { url, secret } : null;
    },
    { db: opts.db ?? getWorkerDb() }
  );
  if (!target) return;
  const body = JSON.stringify(env);
  const response = await (opts.fetcher ?? fetch)(target.url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-kynetic-event-id': env.id,
      'x-kynetic-event-name': env.name,
      'x-kynetic-signature': signN8nEvent(body, target.secret)
    },
    body
  });
  if (!response.ok) throw new Error(`n8n event delivery failed: ${response.status}`);
}

export function registerN8nEventSubscribers(
  opts: { db?: Db; fetcher?: typeof fetch; keyring?: Keyring } = {}
): void {
  for (const name of ['lead.created', 'deal.stage_changed', 'call.completed'] as const) {
    // Subscribe to the producer's canonical event name. Prefixing this name used to make the
    // subscriber unreachable because emitEvent() queues `lead.created`, not `n8n.lead.created`.
    subscribe(name, `n8n-${name.replaceAll('.', '-')}`, (env) => deliver(env, opts));
  }
}
