import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { recordConsent } from '@/server/consent';
import { createContact, deleteContact, getContactDetail, NotFoundError } from '@/server/contacts';
import { ValidationError } from '@/server/errors';
import { stopJobs } from '@/server/jobs';
import { ctx, seedTwoTenants, type SeededTenant } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let tdb: TestDatabase;
let opts: { db: Db };
let a: SeededTenant;
let b: SeededTenant;

beforeAll(async () => {
  tdb = await createTestDatabase({ jobs: true });
  ({ a, b } = await seedTwoTenants(tdb.admin));
  opts = { db: createDb(tdb.app) };
  process.env.APP_BASE_URL = 'http://localhost:3000';
  process.env.DATABASE_URL = tdb.urls.app;
  process.env.DATABASE_URL_WORKER = tdb.urls.worker;
  process.env.DATABASE_URL_AUTH = tdb.authUrl;
  process.env.BETTER_AUTH_SECRET = 'x'.repeat(32);
  process.env.APP_ENCRYPTION_KEY = 'y'.repeat(32);
});
afterAll(async () => {
  await stopJobs();
  await tdb?.drop();
});

describe('M1-03 contact detail', () => {
  it('F-06: loads the contact with a status for every consent channel', async () => {
    const c = await createContact(
      ctx.ownerA(),
      { firstName: 'Dee', phones: ['415-555-0131'], emails: ['dee@example.test'] },
      opts
    );
    const d = await getContactDetail(ctx.ownerA(), c.id, opts);
    expect(d.contact.id).toBe(c.id);
    expect(d.consent.map((x) => x.channel)).toEqual(['phone_call', 'sms', 'email']);
    expect(d.consent.every((x) => x.state === 'none')).toBe(true);
  });

  it('F-06: consent status matches the latest consents row', async () => {
    const c = await createContact(
      ctx.ownerA(),
      { firstName: 'Eve', phones: ['415-555-0132'] },
      opts
    );
    await recordConsent(
      ctx.ownerA(),
      { contactId: c.id, channel: 'sms', source: 'form', capturedText: 'I agree' },
      opts
    );
    let d = await getContactDetail(ctx.ownerA(), c.id, opts);
    expect(d.consent.find((x) => x.channel === 'sms')?.state).toBe('consented');
    expect(d.consent.find((x) => x.channel === 'email')?.state).toBe('none');

    await tdb.admin`insert into consents (tenant_id, contact_id, channel, kind, source, captured_at)
      values (${a.tenantId}, ${c.id}, 'sms', 'opt_out', 'sms_keyword', now() + interval '1 minute')`;
    d = await getContactDetail(ctx.ownerA(), c.id, opts);
    expect(d.consent.find((x) => x.channel === 'sms')?.state).toBe('opted_out');
  });

  it("F-72: another tenant's contact id is a NotFoundError", async () => {
    await expect(getContactDetail(ctx.ownerA(), b.contactId, opts)).rejects.toBeInstanceOf(
      NotFoundError
    );
    await expect(getContactDetail(ctx.ownerB(), a.contactId, opts)).rejects.toBeInstanceOf(
      NotFoundError
    );
  });

  it('F-06: soft-deleted contacts and malformed ids are not found', async () => {
    const c = await createContact(
      ctx.ownerA(),
      { firstName: 'Gone', emails: ['gone@example.test'] },
      opts
    );
    await deleteContact(ctx.ownerA(), c.id, opts);
    await expect(getContactDetail(ctx.ownerA(), c.id, opts)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getContactDetail(ctx.ownerA(), 'not-a-uuid', opts)).rejects.toBeInstanceOf(
      ValidationError
    );
  });
});
