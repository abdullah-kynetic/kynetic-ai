import { getEnv } from './env';
import { registerEventWorkers } from './events';
import { stopJobs } from './jobs';
import { registerNotificationEmailWorker } from './notifications';
import { getSmsProvider } from './messaging/provider';
import { registerTwilioProcessor } from './messaging';
import { registerLeadProcessor } from './leads';
import { registerResendProcessor } from './email';
import { registerWebhookWorker } from './webhooks';

// Worker entry (kynetic_worker). Feature milestones register their subscribers and webhook
// processors before this point; the fan-out workers below deliver to them.
getEnv();
registerTwilioProcessor({ provider: getSmsProvider() });
registerLeadProcessor();
await registerEventWorkers();
registerResendProcessor();
await registerWebhookWorker();
await registerNotificationEmailWorker();
console.log(JSON.stringify({ level: 'info', msg: 'worker started' }));

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    void stopJobs().finally(() => process.exit(0));
  });
}
