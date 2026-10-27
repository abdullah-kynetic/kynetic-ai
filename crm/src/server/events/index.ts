import { z } from 'zod';
import type { Tx } from '../db/client';
import { enqueue, registerWorker } from '../jobs';
import { ModuleDisabledError, requireModule, type ModuleKey } from '../modules';

// ARCHITECTURE section 6. Delivery is at-least-once, so every subscriber is idempotent by env.id.

export const envelopeSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  version: z.literal(1),
  tenantId: z.uuid(),
  occurredAt: z.iso.datetime(),
  actor: z.object({
    type: z.enum(['user', 'alex', 'automation', 'system']),
    id: z.string().optional()
  }),
  payload: z.record(z.string(), z.unknown())
});
export type EventEnvelope = z.infer<typeof envelopeSchema>;

export type EmitInput = Omit<EventEnvelope, 'id' | 'version' | 'occurredAt'> & {
  id?: string;
  occurredAt?: string;
};

/**
 * Queues an event in the caller's transaction (no separate outbox): it is delivered if and only if
 * the surrounding write commits. Payloads carry ids, not PII.
 */
export async function emitEvent(tx: Tx, input: EmitInput): Promise<EventEnvelope> {
  const envelope = envelopeSchema.parse({
    ...input,
    id: input.id ?? crypto.randomUUID(),
    version: 1,
    occurredAt: input.occurredAt ?? new Date().toISOString()
  });
  await enqueue('event.dispatch', envelope, { tx });
  return envelope;
}

export type Subscriber = {
  id: string;
  handler: (env: EventEnvelope) => Promise<void>;
  /** When set, the event is skipped for tenants without the module (F-70). */
  module?: ModuleKey;
};

const subscribers = new Map<string, Map<string, Subscriber>>();

/** Registers a subscriber in this process. `id` must be unique per event name and stable across deploys. */
export function subscribe(
  name: string,
  id: string,
  handler: Subscriber['handler'],
  opts: { module?: ModuleKey } = {}
): void {
  const forName = subscribers.get(name) ?? new Map<string, Subscriber>();
  if (forName.has(id)) throw new Error(`Subscriber ${id} is already registered for ${name}`);
  forName.set(id, { id, handler, module: opts.module });
  subscribers.set(name, forName);
}

/** Test helper: forget every subscriber. */
export function clearSubscribers(): void {
  subscribers.clear();
}

/** Delivers one envelope to one subscriber, honoring the module flag. Exported for tests. */
export async function deliver(
  env: EventEnvelope,
  subscriberId: string
): Promise<'ran' | 'skipped'> {
  const sub = subscribers.get(env.name)?.get(subscriberId);
  if (!sub) return 'skipped'; // removed in a later deploy; nothing to do
  if (sub.module) {
    try {
      await requireModule({ tenantId: env.tenantId, role: 'system' }, sub.module);
    } catch (e) {
      if (e instanceof ModuleDisabledError) return 'skipped';
      throw e;
    }
  }
  await sub.handler(env);
  return 'ran';
}

/** Starts the two workers that fan events out. Called once by the worker process. */
export async function registerEventWorkers(
  opts: { pollingIntervalSeconds?: number } = {}
): Promise<void> {
  await registerWorker<EventEnvelope>(
    'event.dispatch',
    async (raw) => {
      const env = envelopeSchema.parse(raw);
      for (const sub of subscribers.get(env.name)?.values() ?? []) {
        await enqueue(
          'event.subscriber',
          { envelope: env, subscriberId: sub.id },
          { singletonKey: `${env.id}:${sub.id}` }
        );
      }
    },
    opts
  );
  await registerWorker<{ envelope: EventEnvelope; subscriberId: string }>(
    'event.subscriber',
    async ({ envelope, subscriberId }) => {
      await deliver(envelopeSchema.parse(envelope), subscriberId);
    },
    opts
  );
}
