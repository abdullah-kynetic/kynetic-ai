import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resetEnvCacheForTests } from '@/server/env';
import { createDb } from '@/server/db/client';
import { QUEUES, stopJobs } from '@/server/jobs';
import { requestReview, reviewSummary } from '@/server/reviews';
import { createReferral, listReferrals, updateReferral } from '@/server/referrals';
import { getClientUsage } from '@/server/client-usage';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';

let tdb: TestDatabase;
let db: ReturnType<typeof createDb>;
let contactA: string;
let optedOut: string;
let contactB: string;
// Tuesday noon in Los Angeles, inside quiet-hours limits.
const now = new Date('2026-11-10T20:00:00.000Z');

beforeAll(async () => {
  tdb = await createTestDatabase({ jobs: true, jobQueues: QUEUES });
  const seeded = await seedTwoTenants(tdb.admin);
  contactA = seeded.a.contactId;
  contactB = seeded.b.contactId;
  Object.assign(process.env, {
    APP_BASE_URL: 'http://localhost:3000',
    DATABASE_URL: tdb.urls.app,
    DATABASE_URL_AUTH: tdb.authUrl,
    DATABASE_URL_WORKER: tdb.urls.worker,
    BETTER_AUTH_SECRET: 'lane-a-a1-integration-secret-not-for-real-use',
    APP_ENCRYPTION_KEY: 'lane-a-a1-integration-key-not-for-real-use',
    PROVIDER_MODE: 'stub',
    OUTBOUND_ENABLED: 'false'
  });
  resetEnvCacheForTests();
  db = createDb(tdb.app);
  await tdb.admin`insert into tenant_modules (tenant_id, module_key, enabled, level) values
    (${IDS.tenantA}, 'opm', true, ''), (${IDS.tenantA}, 'crm', true, 'full'),
    (${IDS.tenantB}, 'opm', true, '')`;
  const [opt] =
    await tdb.admin`insert into contacts (tenant_id, first_name, phones, primary_phone_e164)
    values (${IDS.tenantA}, 'Opted Out', ${['+15555550177']}, '+15555550177') returning id`;
  optedOut = opt.id;
  await tdb.admin`insert into consents (tenant_id, contact_id, channel, kind, source)
    values (${IDS.tenantA}, ${optedOut}, 'sms', 'opt_out', 'staff')`;
}, 30000);
afterAll(async () => {
  await stopJobs();
  await tdb?.drop();
});

describe('Lane A A1 reviews', () => {
  it('queues a request for a consented contact and shows it in the summary', async () => {
    const row = await requestReview(
      ctx.ownerA(),
      { contactId: contactA, channel: 'sms' },
      { db, now }
    );
    expect(row.status).toBe('queued');
    const summary = await reviewSummary(ctx.ownerA(), { db, now });
    // One fixture request plus the one just queued.
    expect(summary.requestsTotal).toBe(2);
    expect(summary.requests.map((r) => r.id)).toContain(row.id);
    expect(summary.totalReviews).toBeGreaterThanOrEqual(1);
    const [msg] =
      await tdb.admin`select count(*)::int as n from messages where tenant_id = ${IDS.tenantA}`;
    expect(msg.n).toBe(1); // only the fixture message; nothing was sent
  });

  it('blocks opted-out contacts, other tenants and read-only sessions', async () => {
    await expect(
      requestReview(ctx.ownerA(), { contactId: optedOut, channel: 'sms' }, { db, now })
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(
      requestReview(ctx.ownerA(), { contactId: contactB, channel: 'sms' }, { db, now })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      requestReview(
        { ...ctx.ownerA(), readOnly: true },
        { contactId: contactA, channel: 'sms' },
        { db, now }
      )
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('keeps tenants apart and needs the opm module', async () => {
    const b = await reviewSummary(ctx.ownerB(), { db, now });
    expect(b.requestsTotal).toBe(1); // only tenant B's fixture row
    await tdb.admin`update tenant_modules set enabled = false where tenant_id = ${IDS.tenantB} and module_key = 'opm'`;
    await expect(reviewSummary(ctx.ownerB(), { db, now })).rejects.toBeTruthy();
  });
});

describe('Lane A A1 referrals', () => {
  it('creates a referee contact with source referral and an activity on the referrer', async () => {
    const { id, refereeContactId } = await createReferral(
      ctx.ownerA(),
      { referrerContactId: contactA, refereeName: 'Pat Neighbor', refereePhone: '+15555550155' },
      { db, now }
    );
    const [referee] = await tdb.admin`select source from contacts where id = ${refereeContactId}`;
    expect(referee.source).toBe('referral');
    const acts =
      await tdb.admin`select summary from activities where contact_id = ${contactA} and ref_id = ${id}`;
    expect(acts).toHaveLength(1);
    // Same phone again reuses the contact.
    const again = await createReferral(
      ctx.ownerA(),
      { referrerContactId: contactA, refereeName: 'Pat Neighbor', refereePhone: '+15555550155' },
      { db, now }
    );
    expect(again.refereeContactId).toBe(refereeContactId);
  });

  it('only the owner edits rewards, and the list filters by status', async () => {
    const { rows } = await listReferrals(ctx.ownerA(), {}, { db, now });
    const id = rows[0].id;
    await expect(
      updateReferral(ctx.staffA(), id, { rewardCents: 5000 }, { db, now })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await updateReferral(ctx.staffA(), id, { status: 'won' }, { db, now });
    await updateReferral(
      ctx.ownerA(),
      id,
      { rewardCents: 5000, rewardStatus: 'pending' },
      { db, now }
    );
    const won = await listReferrals(ctx.ownerA(), { status: 'won' }, { db, now });
    expect(won.rows.map((r) => r.id)).toEqual([id]);
    expect(won.kpis.rewardsPendingCents).toBe(5000);
    const b = await listReferrals(ctx.ownerB(), {}, { db, now }).catch(() => null);
    expect(b?.rows ?? []).toHaveLength(0);
  });
});

describe('Lane A A1 usage', () => {
  it('shows counts and cap status without dollar amounts, owner only', async () => {
    await tdb.admin`delete from usage_daily where tenant_id = ${IDS.tenantA}`;
    await tdb.admin`insert into usage_daily (tenant_id, day, call_count, call_seconds, call_cost_cents, sms_count, email_count)
      values (${IDS.tenantA}, '2026-11-03', 3, 600, 400, 2, 1)`;
    const usage = await getClientUsage(ctx.ownerA(), '2026-11', { db, now });
    expect(usage.totals).toMatchObject({ minutes: 10, calls: 3, sms: 2, emails: 1 });
    expect(JSON.stringify(usage)).not.toMatch(/cents|cost|\$/i);
    await expect(getClientUsage(ctx.staffA(), '2026-11', { db, now })).rejects.toMatchObject({
      code: 'FORBIDDEN'
    });
    await expect(getClientUsage(ctx.ownerA(), '2026-13', { db, now })).rejects.toBeTruthy();
  });
});
