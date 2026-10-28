import type { Queue } from 'pg-boss';

// Every queue is declared here and created by setupJobs() under the owner role, because creating a
// queue is DDL and the runtime roles cannot run it. A feature that needs a queue adds it to this list.
// Payloads carry ids only (tenantId, record ids), never PII (SECURITY: logs and queues).
export const JOBS_SCHEMA = 'pgboss';

type QueueDef = Omit<Queue, 'name'>;

/** Retries back off exponentially: 30 s, 1 min, 2 min ... up to 6 tries. Exhausted jobs stay failed and visible. */
const retrying: QueueDef = {
  retryLimit: 6,
  retryDelay: 30,
  retryBackoff: true,
  retryDelayMax: 3600
};

export const QUEUES = {
  /** One job per emitted event; the dispatcher fans it out to subscribers. */
  'event.dispatch': retrying,
  /** One job per (event, subscriber), so a failing subscriber retries alone. */
  'event.subscriber': { ...retrying, policy: 'short' },
  /** One job per notification row, to email its recipients. */
  'notification.email': { ...retrying, policy: 'short' },
  /** One job per stored webhook_events row. */
  'webhook.process': { ...retrying, policy: 'short' },
  /** One job per outbound call attempt (F-78). A queued attempt is unique per tenant, contact, trigger and attempt. */
  'call.outbound': { ...retrying, policy: 'short' },
  /** One delayed job per task/due-date version; the handler rechecks the live task before notifying. */
  'task.due': { ...retrying, policy: 'short' } /** One rebuildable tenant/day metrics rollup. */,
  'metrics.daily': { ...retrying, policy: 'short' },
  'automation.step': { ...retrying, policy: 'short' },
  'report.monthly': { ...retrying, policy: 'short' }
  , 'backup.run': { ...retrying, policy: 'short' }
} as const satisfies Record<string, QueueDef>;

export type QueueName = keyof typeof QUEUES;
