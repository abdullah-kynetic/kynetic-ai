import { registerOutboundCallSubscriber, registerOutboundCallWorker } from './calls';
import { getEnv } from './env';
import { wireEmail } from './email/wire';
import { registerEventWorkers } from './events';
import { stopJobs } from './jobs';
import { registerAgencyDigestWorker } from './agency/ops';
import { registerAgencyMaintenanceWorker } from './agency/scheduling';
import { registerNotificationEmailWorker } from './notifications';
import { registerLeadProcessor } from './leads';
import { registerDevLeadSubscriber, registerDevLeadWorker } from './leads/dev-chain';
import { registerResendProcessor } from './email';
import { registerWebhookWorker } from './webhooks';
import { registerTaskDueWorker } from './tasks';
import { registerAppointmentSubscriber } from './appointments';
import { registerMetricsWorker } from './metrics';
import {
  registerAutomationSubscribers,
  registerAutomationWorker,
  registerStageRuleSubscribers,
  registerAfterHoursSubscriber,
  registerMissedCallTextbackSubscriber
} from './automations';
import { registerReportReadyEmail, registerReportWorker } from './reports';
import { registerRetentionWorker, scheduleRetentionPurge } from './retention/purge';
import { registerScheduleWorkers, scheduleTenantJobs } from './schedules';
import { registerUsageWorker } from './usage';
import { registerWeeklyEmailWorker } from './reports/weekly-email';
import { publishAdminDigest } from './admin/alerts';
import { registerTenantExportWorker } from './admin/tenant-export';
import { purgeExpiredRateLimits, RATE_LIMIT_PURGE_CRON } from './security/rate-limit';
import { getWorkerDb } from './db/client';
import { registerN8nEventSubscribers } from './integrations/n8n';
import { registerWorker, scheduleRecurring } from './jobs';
import { handleBackupJob, type BackupJob } from './admin/backups';
import { startWorkerHeartbeat } from './worker-heartbeat';
import { registerProviderProcessors } from './worker-boot';

// Worker entry (kynetic_worker). Feature milestones register their subscribers and webhook
// processors before this point; the fan-out workers below deliver to them.
registerReportReadyEmail();
wireEmail(getEnv());
registerLeadProcessor();
registerOutboundCallSubscriber();
registerDevLeadSubscriber();
// A missing provider key skips that provider's webhook processor instead of stopping the worker.
registerProviderProcessors();
await registerEventWorkers();
registerResendProcessor();
await registerWebhookWorker();
await registerOutboundCallWorker();
await registerDevLeadWorker();
await registerNotificationEmailWorker();
await registerTaskDueWorker();
registerAppointmentSubscriber();
await registerMetricsWorker();
await registerAgencyMaintenanceWorker();
await registerAgencyDigestWorker();
registerAutomationSubscribers();
registerStageRuleSubscribers();
registerAfterHoursSubscriber();
registerMissedCallTextbackSubscriber();
registerN8nEventSubscribers();
await registerWorker<BackupJob>('backup.run', handleBackupJob);
await scheduleRecurring(
  'worker',
  'backup.run',
  '0 2 * * *',
  { kind: 'nightly' },
  'encrypted-backup-nightly'
);
await scheduleRecurring(
  'worker',
  'backup.run',
  '0 3 1 * *',
  { kind: 'restore_test' },
  'encrypted-backup-monthly-restore'
);
await registerAutomationWorker();
await registerReportWorker();
await registerScheduleWorkers();
await registerRetentionWorker();
await registerUsageWorker();
await registerWeeklyEmailWorker();
await registerTenantExportWorker();
await registerWorker('admin.digest', async () => {
  await publishAdminDigest();
});
await registerWorker('security.rate_limit_purge', async () => {
  await purgeExpiredRateLimits(getWorkerDb());
});
await scheduleTenantJobs();
await scheduleRetentionPurge();
await scheduleRecurring(
  'worker',
  'admin.digest',
  '0 8 * * *',
  {},
  'admin-daily-digest',
  'America/Los_Angeles'
);
await scheduleRecurring(
  'worker',
  'security.rate_limit_purge',
  RATE_LIMIT_PURGE_CRON,
  {},
  'rate-limit-purge-hourly'
);
// /api/health reads this beat; it goes 503 if the worker stops beating (P0-3).
const stopHeartbeat = startWorkerHeartbeat(getWorkerDb());
console.log(JSON.stringify({ level: 'info', msg: 'worker started' }));

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    stopHeartbeat();
    void stopJobs().finally(() => process.exit(0));
  });
}
