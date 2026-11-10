import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { clearSubscribers, deliver, type EventEnvelope } from '@/server/events';
import { N8N_PUSH_SECRET } from '@/server/admin/lead-webhooks';
import { registerN8nEventSubscribers, verifyN8nEvent } from '@/server/integrations/n8n';
import { buildKeyring } from '@/server/secrets/crypto';
import { writeTenantSecret } from '@/server/secrets';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { IDS, seedTwoTenants } from '../helpers/fixtures';

const keyring = buildKeyring({
  APP_ENCRYPTION_KEY: 'synthetic-test-key-not-real-000000000000',
  APP_ENCRYPTION_KEY_VERSION: 1
});

let tdb: TestDatabase;
let workerDb: Db;

beforeAll(async () => {
  tdb = await createTestDatabase();
  await seedTwoTenants(tdb.admin);
  workerDb = createDb(tdb.worker);
});
afterAll(async () => {
  clearSubscribers();
  await tdb?.drop();
});

describe('F-89 n8n event delivery', () => {
  it('subscribes to canonical producer names and signs outbound events', async () => {
    const secret = 'synthetic-webhook-signing-secret';
    await tdb.admin`update tenant_modules set config = ${tdb.admin.json({
      n8nWebhookUrl: 'https://n8n.example.test/hooks/lead',
      n8nWebhookSecret: 'plaintext-must-not-be-used'
    })} where tenant_id = ${IDS.tenantA} and module_key = 'platform'`;
    await writeTenantSecret(workerDb, { tenantId: IDS.tenantA, ...N8N_PUSH_SECRET }, secret, {
      keyring
    });

    const fetcher = vi.fn(
      async (_url: string | URL | Request, _init?: RequestInit) =>
        new Response(null, { status: 204 })
    );
    registerN8nEventSubscribers({ db: workerDb, fetcher, keyring });
    const event: EventEnvelope = {
      id: '33333333-3333-4333-8333-333333333333',
      name: 'lead.created',
      version: 1,
      tenantId: IDS.tenantA,
      occurredAt: '2026-10-28T12:00:00.000Z',
      actor: { type: 'system' },
      payload: { contactId: '44444444-4444-4444-8444-444444444444' }
    };

    await expect(deliver(event, 'n8n-lead-created')).resolves.toBe('ran');
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe('https://n8n.example.test/hooks/lead');
    const headers = new Headers(init?.headers);
    expect(headers.get('x-kynetic-event-name')).toBe('lead.created');
    expect(headers.get('x-kynetic-event-id')).toBe(event.id);
    expect(
      verifyN8nEvent(String(init?.body), headers.get('x-kynetic-signature') ?? '', secret)
    ).toBe(true);
    expect(String(init?.body)).not.toContain('plaintext-must-not-be-used');
    expect(
      verifyN8nEvent(
        String(init?.body),
        headers.get('x-kynetic-signature') ?? '',
        'plaintext-must-not-be-used'
      )
    ).toBe(false);
  });

  it('does not deliver when the only secret is plaintext in module config', async () => {
    clearSubscribers();
    await tdb.admin`delete from tenant_secrets where tenant_id = ${IDS.tenantA} and provider = 'n8n'`;
    await tdb.admin`update tenant_modules set config = ${tdb.admin.json({
      n8nWebhookUrl: 'https://n8n.example.test/hooks/ignored',
      n8nWebhookSecret: 'plaintext-must-not-be-used'
    })} where tenant_id = ${IDS.tenantA} and module_key = 'platform'`;
    const fetcher = vi.fn(async () => new Response(null, { status: 204 }));
    registerN8nEventSubscribers({ db: workerDb, fetcher, keyring });
    await expect(
      deliver(
        {
          id: '66666666-6666-4666-8666-666666666666',
          name: 'lead.created',
          version: 1,
          tenantId: IDS.tenantA,
          occurredAt: '2026-10-28T12:00:00.000Z',
          actor: { type: 'system' },
          payload: { contactId: 'synthetic-contact' }
        },
        'n8n-lead-created'
      )
    ).resolves.toBe('ran');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('F-89 retries a failed n8n delivery with the same event id and valid stable signature', async () => {
    clearSubscribers();
    const secret = 'synthetic-webhook-retry-secret';
    await tdb.admin`update tenant_modules set config = ${tdb.admin.json({
      n8nWebhookUrl: 'https://n8n.example.test/hooks/retry'
    })} where tenant_id = ${IDS.tenantA} and module_key = 'platform'`;
    await writeTenantSecret(workerDb, { tenantId: IDS.tenantA, ...N8N_PUSH_SECRET }, secret, {
      keyring
    });
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    registerN8nEventSubscribers({ db: workerDb, fetcher: fetcher as typeof fetch, keyring });
    const event: EventEnvelope = {
      id: '55555555-5555-4555-8555-555555555555',
      name: 'lead.created',
      version: 1,
      tenantId: IDS.tenantA,
      occurredAt: '2026-10-28T12:00:00.000Z',
      actor: { type: 'system' },
      payload: { contactId: 'synthetic-contact' }
    };
    await expect(deliver(event, 'n8n-lead-created')).rejects.toThrow('503');
    await expect(deliver(event, 'n8n-lead-created')).resolves.toBe('ran');
    expect(fetcher).toHaveBeenCalledTimes(2);
    const firstHeaders = new Headers(fetcher.mock.calls[0]![1]?.headers);
    const secondHeaders = new Headers(fetcher.mock.calls[1]![1]?.headers);
    expect(firstHeaders.get('x-kynetic-event-id')).toBe(event.id);
    expect(secondHeaders.get('x-kynetic-event-id')).toBe(event.id);
    expect(firstHeaders.get('x-kynetic-signature')).toBe(secondHeaders.get('x-kynetic-signature'));
    expect(
      verifyN8nEvent(
        String(fetcher.mock.calls[1]![1]?.body),
        secondHeaders.get('x-kynetic-signature')!,
        secret
      )
    ).toBe(true);
  });
});
