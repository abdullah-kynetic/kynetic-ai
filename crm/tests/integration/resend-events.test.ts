import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb } from '@/server/db/client';
import { applyEmailEvent, isEmailSuppressed } from '@/server/email';
import { canContact } from '@/server/consent';
import { IDS, seedTwoTenants, type SeededTenant } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let db: TestDatabase;
let workerDb: ReturnType<typeof createDb>;
let a: SeededTenant;
let b: SeededTenant;

beforeAll(async () => {
  db = await createTestDatabase({ jobs: true });
  ({ a, b } = await seedTwoTenants(db.admin));
  workerDb = createDb(db.worker);
  process.env.APP_BASE_URL = 'http://localhost:3000';
  process.env.DATABASE_URL = db.urls.app;
  process.env.DATABASE_URL_WORKER = db.urls.worker;
  process.env.DATABASE_URL_AUTH = db.authUrl;
  process.env.BETTER_AUTH_SECRET = 'x'.repeat(32);
  process.env.APP_ENCRYPTION_KEY = 'y'.repeat(32);
});
afterAll(async () => {
  await db?.drop();
});

async function sentMessage(tenantId: string, contactId: string, providerId: string, to: string) {
  await db.admin`update contacts set primary_email = ${to} where id = ${contactId}`;
  await db.admin`insert into messages (tenant_id, contact_id, channel, direction, actor_type, from_address,
    to_address, provider, provider_message_id, status) values (${tenantId}, ${contactId}, 'email',
    'outbound', 'system', 'biz@mail.example.test', ${to}, 'resend', ${providerId}, 'sent')`;
}

describe('M4-09 Resend events', () => {
  it('a bounce marks the message and address and shows in integration health', async () => {
    await sentMessage(IDS.tenantA, a.contactId, 'em_b1', 'bounce@example.test');
    const evt = { providerId: 'em_b1', kind: 'bounced' as const, address: 'bounce@example.test' };
    expect(await applyEmailEvent(evt, { db: workerDb })).toBe('applied');
    expect(await applyEmailEvent(evt, { db: workerDb })).toBe('applied'); // replay is harmless

    const [m] = await db.admin`select status from messages where provider_message_id = 'em_b1'`;
    expect(m.status).toBe('bounced');
    expect(await isEmailSuppressed(IDS.tenantA, 'Bounce@Example.test', { db: workerDb })).toBe(
      true
    );
    const [i] = await db.admin`select status, error_count, last_error from integrations
      where tenant_id = ${IDS.tenantA} and kind = 'email'`;
    expect(i.status).toBe('degraded');
    expect(i.last_error).toBe('bounced');
    // other tenant sees nothing
    expect(await isEmailSuppressed(IDS.tenantB, 'bounce@example.test', { db: workerDb })).toBe(
      false
    );
  });

  it('a complaint upgrades the suppression and opts the contact out of email', async () => {
    await sentMessage(IDS.tenantB, b.contactId, 'em_c1', 'angry@example.test');
    await applyEmailEvent(
      { providerId: 'em_c1', kind: 'complained', address: 'angry@example.test' },
      { db: workerDb }
    );
    const [s] =
      await db.admin`select reason from email_suppressions where address = 'angry@example.test'`;
    expect(s.reason).toBe('complained');
    const d = await canContact(
      { tenantId: IDS.tenantB, role: 'system' },
      b.contactId,
      'email',
      new Date(),
      { db: workerDb }
    );
    expect(d.allowed).toBe(false);
  });

  it('a later delivered never overwrites a bounce, and a bounce never downgrades a complaint', async () => {
    await applyEmailEvent(
      { providerId: 'em_b1', kind: 'delivered', address: 'bounce@example.test' },
      { db: workerDb }
    );
    const [m] = await db.admin`select status from messages where provider_message_id = 'em_b1'`;
    expect(m.status).toBe('bounced');
    await applyEmailEvent(
      { providerId: 'em_c1', kind: 'bounced', address: 'angry@example.test' },
      { db: workerDb }
    );
    const [s] =
      await db.admin`select reason from email_suppressions where address = 'angry@example.test'`;
    expect(s.reason).toBe('complained');
  });

  it('delivery updates the message and success time', async () => {
    await sentMessage(IDS.tenantA, a.contactId, 'em_d1', 'ok@example.test');
    await applyEmailEvent(
      { providerId: 'em_d1', kind: 'delivered', address: 'ok@example.test' },
      { db: workerDb }
    );
    const [m] =
      await db.admin`select status, delivered_at from messages where provider_message_id = 'em_d1'`;
    expect(m.status).toBe('delivered');
    expect(m.delivered_at).not.toBeNull();
  });

  it('an email with no messages row is unattributed and changes nothing', async () => {
    const before = await db.admin`select count(*)::int as n from email_suppressions`;
    expect(
      await applyEmailEvent(
        { providerId: 'em_unknown', kind: 'bounced', address: 'x@example.test' },
        { db: workerDb }
      )
    ).toBe('unattributed');
    const after = await db.admin`select count(*)::int as n from email_suppressions`;
    expect(after[0].n).toBe(before[0].n);
  });

  it('the app role cannot delete suppressions', async () => {
    await expect(db.app`delete from email_suppressions`).rejects.toThrow();
  });
});
