import {
  getVoiceProvider,
  registerOutboundCallSubscriber,
  registerOutboundCallWorker,
  registerVoiceProcessor
} from './calls';
import { getEnv } from './env';
import { wireEmail } from './email/wire';
import { registerEventWorkers } from './events';
import { stopJobs } from './jobs';
import { registerAgencyDigestWorker } from './agency/ops';
import { registerAgencyMaintenanceWorker } from './agency/scheduling';
import { getSmsProvider } from './messaging/provider';
import { registerTwilioProcessor } from './messaging';
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
import { registerReportWorker } from './reports';
import { registerRetentionWorker, scheduleRetentionPurge } from './retention/purge';
import { registerScheduleWorkers, scheduleTenantJobs } from './schedules';
import { registerN8nEventSubscribers } from './integrations/n8n';
import { registerWorker, scheduleRecurring } from './jobs';
import { handleBackupJob, type BackupJob } from './admin/backups';

// Worker entry (kynetic_worker). Feature milestones register their subscribers and webhook
// processors before this point; the fan-out workers below deliver to them.
wireEmail(getEnv());
registerVoiceProcessor({ provider: getVoiceProvider('elevenlabs')! });
registerLeadProcessor();
registerOutboundCallSubscriber();
registerDevLeadSubscriber();
registerTwilioProcessor({ provider: getSmsProvider() });
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
await scheduleTenantJobs();
await scheduleRetentionPurge();
console.log(JSON.stringify({ level: 'info', msg: 'worker started' }));

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    void stopJobs().finally(() => process.exit(0));
  });
}
