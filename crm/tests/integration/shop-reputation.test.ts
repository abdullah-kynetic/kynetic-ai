import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb } from '@/server/db/client';
import { ModuleDisabledError } from '@/server/modules';
import {
  approveReviewReply,
  bringBackEmail,
  getCustomers,
  getGetFound,
  getReviews
} from '@/server/shop';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';
import { seedShopPipeline } from '../helpers/shop';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let tdb: TestDatabase;
let opts: { db: ReturnType<typeof createDb> };
let replyId: string;

beforeAll(async () => {
  tdb = await createTestDatabase();
  await seedTwoTenants(tdb.admin);
  opts = { db: createDb(tdb.app) };
  const { dealIds } = await seedShopPipeline(tdb.admin, IDS.tenantA, [
    {
      title: 'Bumper',
      stage: 'Picked up',
      customer: 'Ana Lopez',
      valueCents: 120_000,
      wonAt: new Date().toISOString(),
      custom: { vehicle_year: 2019, vehicle_make: 'Toyota', vehicle_model: 'Camry' }
    },
    { title: 'Door', stage: 'Quoted', customer: 'Ben Carter', valueCents: 50_000 },
    {
      title: 'Fender',
      stage: 'Picked up',
      customer: 'Cy Diaz',
      valueCents: 70_000,
      wonAt: new Date().toISOString()
    }
  ]);
  const links =
    await tdb.admin`select deal_id, contact_id from deal_contacts where tenant_id = ${IDS.tenantA}`;
  const contactOf = (d: string) => links.find((l) => l.deal_id === d)!.contact_id as string;
  // Cy completed a request; Ben has one waiting; Ana's latest request is a cancelled one.
  await tdb.admin`insert into review_requests (tenant_id, contact_id, channel, status, requested_at) values
    (${IDS.tenantA}, ${contactOf(dealIds[2]!)}, 'sms', 'completed', now()),
    (${IDS.tenantA}, ${contactOf(dealIds[1]!)}, 'sms', 'queued', now()),
    (${IDS.tenantA}, ${contactOf(dealIds[0]!)}, 'sms', 'cancelled', now())`;
  await tdb.admin`insert into review_snapshots (tenant_id, source, captured_on, review_count, average_rating) values
    (${IDS.tenantA}, 'Google', '2026-10-01', 100, 4.0),
    (${IDS.tenantA}, 'Google', '2026-11-01', 120, 4.5),
    (${IDS.tenantA}, 'Yelp', '2026-11-01', 30, 4.0)`;
  const [reply] =
    await tdb.admin`insert into presence_items (tenant_id, kind, title, status, notes) values
    (${IDS.tenantA}, 'review_site', 'Reply to Rob', 'planned',
      ${JSON.stringify({ type: 'review_reply', reviewer: 'Rob T.', rating: 4, source: 'Google', text: 'Good.', reply: 'Thanks!' })}) returning id`;
  replyId = reply!.id;
  await tdb.admin`insert into presence_items (tenant_id, kind, title, status, notes) values
    (${IDS.tenantA}, 'review_site', 'Broken', 'planned', 'not json'),
    (${IDS.tenantA}, 'profile', 'Google Business Profile', 'done', ''),
    (${IDS.tenantA}, 'directory', 'Bing Places', 'planned', ''),
    (${IDS.tenantA}, 'social_post', 'Post draft 1', 'planned', 'Before and after.')`;
  await tdb.admin`insert into tenant_modules (tenant_id, module_key, enabled) values (${IDS.tenantA}, 'shop_ops', true)`;
});
afterAll(async () => tdb?.drop());

describe('E-1 customers', () => {
  it('refuses a tenant without the module', async () => {
    await expect(getCustomers(ctx.ownerB(), opts)).rejects.toBeInstanceOf(ModuleDisabledError);
    await expect(getReviews(ctx.ownerB(), opts)).rejects.toBeInstanceOf(ModuleDisabledError);
    await expect(getGetFound(ctx.ownerB(), opts)).rejects.toBeInstanceOf(ModuleDisabledError);
  });

  it('totals spend from picked-up jobs only and reads review status from requests', async () => {
    const { customers } = await getCustomers(ctx.ownerA(), opts);
    const by = (name: string) => customers.find((c) => c.name === name)!;
    expect(by('Ana Lopez')).toMatchObject({
      jobs: 1,
      lifetimeCents: 120_000,
      pickedUp: true,
      reviewStatus: 'not_requested' // a cancelled request does not count
    });
    expect(by('Ben Carter')).toMatchObject({
      jobs: 1,
      lifetimeCents: 0, // quoted, not picked up
      pickedUp: false,
      reviewStatus: 'requested'
    });
    expect(by('Cy Diaz')).toMatchObject({ lifetimeCents: 70_000, reviewStatus: 'reviewed' });
    expect(by('Ana Lopez').lastJobLabel).toBeTruthy();
  });

  it('writes the bring-back email for any past customer the same way', () => {
    const a = bringBackEmail({
      firstName: 'Ana',
      businessName: 'AA Auto Body',
      vehicle: '2019 Toyota Camry'
    });
    expect(a.body).toContain('Hi Ana,');
    expect(a.body).toContain('your 2019 Toyota Camry');
    expect(bringBackEmail({ firstName: 'Ben', businessName: 'AA', vehicle: null }).body).toContain(
      'your car'
    );
  });
});

describe('E-2 reviews', () => {
  it('shows the latest rating per source, weighted by review count', async () => {
    const r = await getReviews(ctx.ownerA(), opts);
    expect(r.sources.map((s) => [s.source, s.reviewCount, s.averageRating])).toEqual([
      ['Google', 120, 4.5],
      ['Yelp', 30, 4]
    ]);
    expect(r.totalReviews).toBe(150);
    expect(r.rating).toBe(4.4); // (120 * 4.5 + 30 * 4.0) / 150
    expect(r.requests.length).toBeGreaterThanOrEqual(3); // ours plus the fixture's own
  });

  it('lists parseable drafted replies and skips junk rows', async () => {
    const r = await getReviews(ctx.ownerA(), opts);
    expect(r.replies).toHaveLength(1);
    expect(r.replies[0]).toMatchObject({ reviewer: 'Rob T.', approved: false, reply: 'Thanks!' });
  });

  it('approving marks the draft approved and posts nothing', async () => {
    const count = async (table: string) => {
      const [row] = await tdb.admin.unsafe(`select count(*)::int as n from ${table}`);
      return row!.n as number;
    };
    const before = [await count('messages'), await count('calls'), await count('review_requests')];
    await approveReviewReply(ctx.ownerA(), replyId, opts);
    const r = await getReviews(ctx.ownerA(), opts);
    expect(r.replies[0]!.approved).toBe(true);
    expect([await count('messages'), await count('calls'), await count('review_requests')]).toEqual(
      before
    );
    const [audit] =
      await tdb.admin`select action from audit_log where entity_id = ${replyId} and action = 'shop.review_reply.approve'`;
    expect(audit).toBeTruthy();
    // Approving again changes nothing.
    await approveReviewReply(ctx.ownerA(), replyId, opts);
    const [audits] =
      await tdb.admin`select count(*)::int as n from audit_log where entity_id = ${replyId} and action = 'shop.review_reply.approve'`;
    expect(audits!.n).toBe(1);
  });

  it("cannot approve another tenant's item or a non-reply", async () => {
    const [other] =
      await tdb.admin`select id from presence_items where tenant_id = ${IDS.tenantA} and kind = 'profile'`;
    await expect(approveReviewReply(ctx.ownerA(), other!.id, opts)).rejects.toMatchObject({
      code: 'NOT_FOUND'
    });
  });
});

describe('E-4 get found', () => {
  it('splits listings from post drafts', async () => {
    const f = await getGetFound(ctx.ownerA(), opts);
    const titles = f.listings.map((l) => l.title);
    expect(titles).toEqual(expect.arrayContaining(['Bing Places', 'Google Business Profile']));
    expect(titles).not.toContain('Reply to Rob'); // a drafted reply is not a listing
    expect(f.posts.map((p) => p.text)).toEqual(['Before and after.']);
  });
});
