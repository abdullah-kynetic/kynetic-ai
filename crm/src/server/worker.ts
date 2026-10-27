import {
  getVoiceProvider,
  registerOutboundCallSubscriber,
  registerOutboundCallWorker,
  registerVoiceProcessor
} from './calls';
import { registerResendProcessor } from './email';
import { getEnv } from './env';
import { registerEventWorkers } from './events';
import { stopJobs } from './jobs';
import { registerLeadProcessor } from './leads';
import { registerTwilioProcessor } from './messaging';
import { getSmsProvider } from './messaging/provider';
import { registerWebhookWorker } from './webhooks';

// Worker entry (kynetic_worker). Feature milestones register their subscribers and webhook
// processors before this point; the fan-out workers below deliver to them.
getEnv();
registerLeadProcessor();
registerTwilioProcessor({ provider: getSmsProvider() });
registerVoiceProcessor({ provider: getVoiceProvider('elevenlabs')! });
registerResendProcessor();
registerOutboundCallSubscriber();
await registerEventWorkers();
await registerWebhookWorker();
await registerOutboundCallWorker();
console.log(JSON.stringify({ level: 'info', msg: 'worker started' }));

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    void stopJobs().finally(() => process.exit(0));
  });
}
