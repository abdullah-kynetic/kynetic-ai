import { rmSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { getEnv, type Env } from '../env';
import { registerEventWorkers } from '../events';
import { stopJobs } from '../jobs';
import { registerAgencyMaintenanceWorker } from '../agency/scheduling';
import { registerAgencyDigestWorker } from '../agency/ops';
import { registerWebhookWorker } from '../webhooks';
import { registerDevLeadSubscriber, registerDevLeadWorker } from './dev-chain';
import { assertDevPortal } from './dev-policy';
import { registerLeadProcessor } from './intake';

export const DEV_WORKER_READY = '/tmp/kynetic-dev-synthetic-worker-ready';
type RuntimeEnv = Pick<
  Env,
  | 'APP_BASE_URL'
  | 'PROVIDER_MODE'
  | 'OUTBOUND_ENABLED'
  | 'ELEVENLABS_LIVE_ENABLED'
  | 'DEV_PERSONA_SWITCHING'
  | 'TEST_PHONE'
>;

export function assertDevRuntime(env: RuntimeEnv) {
  assertDevPortal(env.APP_BASE_URL);
  if (
    env.PROVIDER_MODE !== 'stub' ||
    env.OUTBOUND_ENABLED ||
    env.ELEVENLABS_LIVE_ENABLED ||
    env.DEV_PERSONA_SWITCHING
  )
    throw new Error('DEV runtime must remain isolated with outbound disabled.');
  if (!env.TEST_PHONE || !/^\+[1-9]\d{7,14}$/.test(env.TEST_PHONE))
    throw new Error('TEST_PHONE must be configured as E.164.');
}

/** Deliberately no voice/SMS/email adapters, normal dispatchers, notification or n8n subscribers. */
export async function startDevSyntheticWorker(opts: { pollingIntervalSeconds?: number } = {}) {
  assertDevRuntime(getEnv());
  registerLeadProcessor();
  registerDevLeadSubscriber();
  await registerEventWorkers(opts);
  await registerWebhookWorker(opts);
  await registerDevLeadWorker();
  await registerAgencyMaintenanceWorker();
  await registerAgencyDigestWorker();
}

async function main() {
  rmSync(DEV_WORKER_READY, { force: true });
  // Existing job libraries log arbitrary errors; this restricted process emits fixed messages only.
  console.error = () => {
    process.stderr.write('DEV synthetic worker error; raw diagnostics withheld.\n');
  };
  let stopping = false;
  const close = async (code: number) => {
    if (stopping) return;
    stopping = true;
    rmSync(DEV_WORKER_READY, { force: true });
    try {
      await stopJobs();
    } finally {
      process.exit(code);
    }
  };
  process.on('SIGTERM', () => {
    void close(0);
  });
  process.on('SIGINT', () => {
    void close(0);
  });
  process.on('uncaughtException', () => {
    console.error();
    void close(1);
  });
  process.on('unhandledRejection', () => {
    console.error();
    void close(1);
  });
  try {
    await startDevSyntheticWorker();
    writeFileSync(DEV_WORKER_READY, 'ready\n', { mode: 0o600 });
    process.stdout.write(
      'DEV synthetic worker ready; sender adapters absent; outbound disabled.\n'
    );
  } catch {
    console.error();
    await close(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) void main();
