import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb } from '@/server/db/client';
import { moveDeal } from '@/server/deals';
import { stopJobs } from '@/server/jobs';
import {
  approveReviewReply,
  createWalkIn,
  getAwaySettings,
  getCustomers,
  getFollowUps,
  getInsurance,
  getJobsBoard,
  getMoney,
  getQuotes,
  getReviews,
  getTeam,
  getToday,
  getWeeklyReport,
  saveAwaySettings
} from '@/server/shop';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';
import { seedShopPipeline } from '../helpers/shop';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

// F-5: no shop page or action creates anything that leaves the portal, whether the outbound flags
// are off or on. "Leaves" means a message row, an outbound call row, or any queued job other than
// the internal event dispatch.
let tdb: TestDatabase;
let opts: { db: ReturnType<typeof createDb> };
let stageIds: Record<string, string>;
let dealId: string;
let replyId: string;
const FLAGS = ['OUTBOUND_ENABLED', 'REVIEW_REQUESTS_ENABLED', 'CLIENT_EMAIL_ENABLED'] as const;

beforeAll(async () => {
  tdb = await createTestDatabase({ jobs: true });
  await seedTwoTenants(tdb.admin);
  opts = { db: createDb(tdb.app) };
  process.env.APP_BASE_URL = 'http://localhost:3000';
  process.env.DATABASE_URL = tdb.urls.app;
  process.env.DATABASE_URL_WORKER = tdb.urls.worker;
  process.env.DATABASE_URL_AUTH = tdb.authUrl;
  process.env.BETTER_AUTH_SECRET = 'x'.repeat(32);
  process.env.APP_ENCRYPTION_KEY = 'y'.repeat(32);
  const seeded = await seedShopPipeline(tdb.admin, IDS.tenantA, [
    { title: 'Bumper', stage: 'Quoted', customer: 'Ana Lopez', valueCents: 100_000 },
    {
      title: 'Hood',
      stage: 'Picked up',
      customer: 'Ben Carter',
      valueCents: 50_000,
      wonAt: new Date().toISOString()
    }
  ]);
  stageIds = seeded.stageIds;
  dealId = seeded.dealIds[0]!;
  const [reply] =
    await tdb.admin`insert into presence_items (tenant_id, kind, title, status, notes) values
    (${IDS.tenantA}, 'review_site', 'Reply', 'planned',
      ${JSON.stringify({ type: 'review_reply', reviewer: 'R', rating: 5, source: 'Google', text: 't', reply: 'r' })}) returning id`;
  replyId = reply!.id;
  await tdb.admin`insert into tenant_modules (tenant_id, module_key, enabled) values (${IDS.tenantA}, 'shop_ops', true)`;
});
afterAll(async () => {
  for (const f of FLAGS) delete process.env[f];
  await stopJobs();
  await tdb?.drop();
});

const snapshot = async () => {
  const [m] = await tdb.admin`select count(*)::int as n from messages`;
  const [c] = await tdb.admin`select count(*)::int as n from calls where direction = 'outbound'`;
  const [r] = await tdb.admin`select count(*)::int as n from review_requests`;
  const jobs = await tdb.admin`select distinct name from pgboss.job where name <> 'event.dispatch'`;
  return { messages: m!.n, outboundCalls: c!.n, reviewRequests: r!.n, otherJobs: jobs.length };
};

async function everyShopAction(suffix: string) {
  const c = ctx.ownerA();
  // Every read behind a shop page.
  await Promise.all([
    getToday(c, opts),
    getJobsBoard(c, opts),
    getQuotes(c, opts),
    getFollowUps(c, opts),
    getInsurance(c, opts),
    getTeam(c, opts),
    getMoney(c, opts),
    getWeeklyReport(c, opts),
    getCustomers(c, opts),
    getReviews(c, opts),
    getAwaySettings(c, opts)
  ]);
  // Every write a shop page can make.
  await createWalkIn(c, {
    firstName: 'Walk',
    lastName: `In${suffix}`,
    phone: suffix === 'a' ? '+12145550191' : '+12145550192',
    title: `Walk-in: ${suffix}`
  });
  await saveAwaySettings(
    c,
    {
      enabled: true,
      from: '2026-12-01',
      until: '2026-12-05',
      dailySummary: true,
      alerts: { urgentCalls: true, quoteReplies: true, pickupsWaiting: true }
    },
    opts
  );
  await approveReviewReply(c, replyId, opts);
  await moveDeal(
    c,
    dealId,
    { stageId: stageIds[suffix === 'a' ? 'In repair and paint' : 'Ready for pickup']! },
    opts
  );
}

describe('F-5 shop actions never send', () => {
  it('with the outbound flags off', async () => {
    for (const f of FLAGS) process.env[f] = 'false';
    const before = await snapshot();
    await everyShopAction('a');
    expect(await snapshot()).toEqual(before);
  });

  it('with the outbound flags on', async () => {
    for (const f of FLAGS) process.env[f] = 'true';
    const before = await snapshot();
    await everyShopAction('b');
    expect(await snapshot()).toEqual(before);
  });
});

describe('F-1 away mode is a setting only', () => {
  it('defaults to off, saves, and reads back', async () => {
    const before = await getAwaySettings(ctx.ownerA(), opts);
    expect(before.from).toBe('2026-12-01'); // saved by the earlier test
    await saveAwaySettings(
      ctx.ownerA(),
      { ...before, enabled: false, from: null, until: null },
      opts
    );
    expect((await getAwaySettings(ctx.ownerA(), opts)).enabled).toBe(false);
  });

  it('refuses a missing range when turned on and a range that ends before it starts', async () => {
    const base = {
      dailySummary: true,
      alerts: { urgentCalls: true, quoteReplies: true, pickupsWaiting: false }
    };
    await expect(
      saveAwaySettings(ctx.ownerA(), { ...base, enabled: true, from: null, until: null }, opts)
    ).rejects.toMatchObject({ fieldErrors: { from: 'Pick the first and last day away.' } });
    await expect(
      saveAwaySettings(
        ctx.ownerA(),
        { ...base, enabled: false, from: '2026-12-05', until: '2026-12-01' },
        opts
      )
    ).rejects.toMatchObject({ fieldErrors: { until: expect.any(String) } });
  });

  it('is stored as one row and hidden from the Get found checklist', async () => {
    await saveAwaySettings(
      ctx.ownerA(),
      {
        enabled: true,
        from: '2026-12-01',
        until: '2026-12-02',
        dailySummary: true,
        alerts: { urgentCalls: true, quoteReplies: true, pickupsWaiting: false }
      },
      opts
    );
    const rows =
      await tdb.admin`select id from presence_items where tenant_id = ${IDS.tenantA} and title = 'Away mode (shop setting)'`;
    expect(rows).toHaveLength(1);
    const { getGetFound } = await import('@/server/shop');
    const found = await getGetFound(ctx.ownerA(), opts);
    expect(found.listings.map((l) => l.title)).not.toContain('Away mode (shop setting)');
  });
});
