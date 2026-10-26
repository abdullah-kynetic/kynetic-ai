import {
  getVoiceProvider,
  registerOutboundCallSubscriber,
  registerOutboundCallWorker,
  registerVoiceProcessor
} from './calls';
import { getEnv } from './env';
import { registerEventWorkers } from './events';
import { stopJobs } from './jobs';
import { registerLeadProcessor } from './leads';
import { registerResendProcessor } from './email';
import { getSmsProvider } from './messaging/provider';
import { registerTwilioProcessor } from './messaging';
import { getSmsProvider } from './messaging/provider';
import { registerTwilioProcessor } from './messaging';
import { registerResendProcessor } from './email';
import { registerWebhookWorker } from './webhooks';

// Worker entry (kynetic_worker). Feature milestones register their subscribers and webhook
// processors before this point; the fan-out workers below deliver to them.
getEnv();
registerLeadProcessor();
registerTwilioProcessor({ provider: getSmsProvider() });
registerVoiceProcessor({ provider: getVoiceProvider('elevenlabs')! });
registerVoiceProcessor({ provider: getVoiceProvider('elevenlabs')! });
registerLeadProcessor();
registerOutboundCallSubscriber();
await registerEventWorkers();
registerResendProcessor();
await registerWebhookWorker();
await registerOutboundCallWorker();
console.log(JSON.stringify({ level: 'info', msg: 'worker started' }));

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    void stopJobs().finally(() => process.exit(0));
  });
}
