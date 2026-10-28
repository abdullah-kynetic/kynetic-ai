import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { clearSubscribers, deliver, type EventEnvelope } from '@/server/events';
import { registerN8nEventSubscribers, verifyN8nEvent } from '@/server/integrations/n8n';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { IDS, seedTwoTenants } from '../helpers/fixtures';

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
      n8nWebhookSecret: secret
    })} where tenant_id = ${IDS.tenantA} and module_key = 'platform'`;

    const fetcher = vi.fn(
      async (_url: string | URL | Request, _init?: RequestInit) =>
        new Response(null, { status: 204 })
    );
    registerN8nEventSubscribers({ db: workerDb, fetcher });
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
  });
});
