import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { seedDemoTenants } from '@/server/db/seed/demo';
import { clearSubscribers } from '@/server/events';
import { stopJobs } from '@/server/jobs';
import { clearWebhookProcessors } from '@/server/webhooks';
import { devLeadIntakeResponse } from '@/server/leads/dev-intake';
import { assertDevRuntime } from '@/server/leads/dev-runtime-worker';
import { verifyDevSignedRuntime } from '@/server/leads/dev-runtime-smoke';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let db: TestDatabase;
let child: ChildProcess | undefined;
const phone = '+' + ['1', '555', '555', '0101'].join('');
const config = {
  APP_BASE_URL: 'https://dev.kyneticai.com',
  TEST_PHONE: phone,
  PROVIDER_MODE: 'stub' as const,
  OUTBOUND_ENABLED: false,
  ELEVENLABS_LIVE_ENABLED: false,
  DEV_PERSONA_SWITCHING: false
};
beforeAll(async () => {
  db = await createTestDatabase({ jobs: true });
  await seedDemoTenants(db.admin);
  Object.assign(process.env, {
    APP_BASE_URL: config.APP_BASE_URL,
    TEST_PHONE: phone,
    DATABASE_URL: db.urls.app,
    DATABASE_URL_WORKER: db.urls.worker,
    DATABASE_URL_AUTH: db.authUrl,
    BETTER_AUTH_SECRET: 'x'.repeat(32),
    APP_ENCRYPTION_KEY: 'y'.repeat(32),
    PROVIDER_MODE: 'stub',
    OUTBOUND_ENABLED: 'false',
    ELEVENLABS_LIVE_ENABLED: 'false',
    DEV_PERSONA_SWITCHING: 'false'
  });
  clearSubscribers();
  clearWebhookProcessors();
  const workerFile = fileURLToPath(
    new URL('../../src/server/leads/dev-runtime-worker.ts', import.meta.url)
  );
  child = spawn('bun', [workerFile], {
    env: {
      PATH: process.env.PATH,
      NODE_ENV: 'production',
      APP_BASE_URL: config.APP_BASE_URL,
      TEST_PHONE: phone,
      DATABASE_URL: db.urls.app,
      DATABASE_URL_WORKER: db.urls.worker,
      DATABASE_URL_AUTH: db.authUrl,
      BETTER_AUTH_SECRET: 'x'.repeat(32),
      APP_ENCRYPTION_KEY: 'y'.repeat(32),
      PROVIDER_MODE: 'stub',
      OUTBOUND_ENABLED: 'false',
      ELEVENLABS_LIVE_ENABLED: 'false',
      DEV_PERSONA_SWITCHING: 'false'
    },
    stdio: ['ignore', 'pipe', 'ignore']
  });
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('Restricted worker readiness timed out')),
      15_000
    );
    child!.once('error', () => {
      clearTimeout(timeout);
      reject(new Error('Restricted worker could not start'));
    });
    child!.once('exit', () => {
      clearTimeout(timeout);
      reject(new Error('Restricted worker exited before readiness'));
    });
    child!.stdout!.on('data', (data) => {
      if (String(data).includes('DEV synthetic worker ready')) {
        clearTimeout(timeout);
        resolve();
      }
    });
  });
}, 30_000);
afterAll(async () => {
  if (child && child.exitCode === null) {
    const processToStop = child;
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        processToStop.kill('SIGKILL');
        resolve();
      }, 5000);
      processToStop.once('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
      processToStop.kill('SIGTERM');
    });
  }
  await stopJobs();
  clearSubscribers();
  clearWebhookProcessors();
  await db?.drop();
});

describe('sender-free DEV runtime end-to-end smoke', () => {
  it('processes signed intake asynchronously, deduplicates it and durably defers without calling a provider', async () => {
    const network = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('Real network forbidden'));
    const urls: URL[] = [];
    const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      const url = new URL(request.url);
      urls.push(url);
      expect(url.origin).toBe('https://dev.kyneticai.com');
      expect(init?.redirect).toBe('error');
      const tenantId = url.pathname.split('/').pop()!;
      return devLeadIntakeResponse(request, tenantId);
    }) as typeof fetch;
    try {
      expect(
        await verifyDevSignedRuntime(db.admin, db.worker, { fetcher, timeoutMs: 20_000 })
      ).toMatchObject({
        signed_intake: 'accepted',
        duplicate: 'duplicate',
        worker: 'processed',
        outbound: 'deferred',
        new_calls: 0,
        new_messages: 0,
        provider_requests: 0,
        live_test_authorized: false
      });
      expect(urls).toHaveLength(2);
      expect(network).not.toHaveBeenCalled();
    } finally {
      network.mockRestore();
    }
  }, 30_000);

  it('refuses a live runtime, unset TEST_PHONE and production URL', () => {
    expect(() => assertDevRuntime(config)).not.toThrow();
    for (const over of [
      { PROVIDER_MODE: 'live' as const },
      { OUTBOUND_ENABLED: true },
      { ELEVENLABS_LIVE_ENABLED: true },
      { DEV_PERSONA_SWITCHING: true },
      { TEST_PHONE: '' },
      { APP_BASE_URL: 'https://portal.kyneticai.com' }
    ])
      expect(() => assertDevRuntime({ ...config, ...over })).toThrow();
  });
});
