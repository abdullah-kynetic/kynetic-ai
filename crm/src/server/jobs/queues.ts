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
  /** Synthetic DEV attempts; explicit delayed scheduling only, never automatic provider retries. */
  'dev.lead-attempt': { retryLimit: 0, policy: 'short' },
  /** One delayed job per task/due-date version; the handler rechecks the live task before notifying. */
  'task.due': { ...retrying, policy: 'short' } /** One rebuildable tenant/day metrics rollup. */,
  'metrics.daily': { ...retrying, policy: 'short' },
  'automation.step': { ...retrying, policy: 'short' },
  'report.monthly': { ...retrying, policy: 'short' },
  'backup.run': { ...retrying, policy: 'short' },
  'agency.digest': { ...retrying, policy: 'short' },
  'agency.maintenance': { ...retrying, policy: 'short' },
  /** Lists due tenants and enqueues one metrics.daily job per tenant and day. */
  'metrics.fanout': { ...retrying, policy: 'short' },
  /** Lists tenants whose local day matches the report schedule and enqueues report.monthly. */
  'report.fanout': { ...retrying, policy: 'short' },
  /** Clears data that has passed the PRD decision 9 retention windows. */
  'retention.purge': { ...retrying, policy: 'short' },
  /** One rebuildable tenant/day usage rollup. */
  'usage.daily': { ...retrying, policy: 'short' },
  /** Lists operating tenants and enqueues usage.daily. */
  'usage.fanout': { ...retrying, policy: 'short' },
  /** Monday client email. The handler no-ops unless both email flags are on. */
  'client.weekly_email': { ...retrying, policy: 'short' },
  'client.weekly_fanout': { ...retrying, policy: 'short' },
  /** In-app daily digest for Kynetic admins. Email stays off unless ADMIN_ALERT_EMAIL_ENABLED. */
  'admin.digest': { ...retrying, policy: 'short' },
  /** One client review request to send. Only enqueued, and only acted on, when REVIEW_REQUESTS_ENABLED is on. */
  'review.send': { ...retrying, policy: 'short' },
  /** Evaluates the alert rules (dead worker, backups, disk, queue). One notice per rule per six hours. */
  'monitor.check': { ...retrying, policy: 'short' },
  /** Deletes expired rate-limit counters. */
  'security.rate_limit_purge': { ...retrying, policy: 'short' },
  /** One zip export for an offboarded client. */
  'tenant.export': { ...retrying, policy: 'short' }
} as const satisfies Record<string, QueueDef>;

export type QueueName = keyof typeof QUEUES;
