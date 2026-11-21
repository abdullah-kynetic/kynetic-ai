import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { stopJobs } from '@/server/jobs';
import { issueServiceToken } from '@/server/service-auth';
import { createReferral } from '@/server/referrals';
import { GET as summaryRoute } from '@/app/api/service/reviews/summary/route';
import { GET as listRoute, POST as createRoute } from '@/app/api/service/referrals/route';
import { PATCH as patchRoute } from '@/app/api/service/referrals/[id]/route';
import { ctx, IDS, seedTwoTenants, type SeededTenant } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let tdb: TestDatabase;
let db: Db;
let a: SeededTenant;
let b: SeededTenant;
let keyN = 0;
let foreignReferral: string;

const headers = (token?: string, key: string | null = `key-${Date.now()}-${keyN++}`) => ({
  'content-type': 'application/json',
  ...(token ? { authorization: `Bearer ${token}` } : {}),
  ...(key ? { 'idempotency-key': key } : {})
});
async function token(scopes: string[]) {
  return issueServiceToken(ctx.ownerA(), { label: 'test', scopes }, { db });
}
const withId = (id: string) => ({ params: Promise.resolve({ id }) });

beforeAll(async () => {
  tdb = await createTestDatabase({ jobs: true });
  ({ a, b } = await seedTwoTenants(tdb.admin));
  // Reviews need opm; referrals need crm at full. Replace any seeded rows so the test controls them.
  await tdb.admin`delete from tenant_modules where module_key in ('crm', 'opm') and tenant_id in (${IDS.tenantA}, ${IDS.tenantB})`;
  await tdb.admin`insert into tenant_modules (tenant_id, module_key, enabled, level) values
    (${IDS.tenantA}, 'crm', true, 'full'),
    (${IDS.tenantB}, 'crm', true, 'full')`;
  await tdb.admin`insert into tenant_modules (tenant_id, module_key, enabled, level) values
    (${IDS.tenantA}, 'opm', true, ''),
    (${IDS.tenantB}, 'opm', true, '')`;
  db = createDb(tdb.app);
  Object.assign(process.env, {
    APP_BASE_URL: 'http://localhost:3000',
    DATABASE_URL: tdb.urls.app,
    DATABASE_URL_WORKER: tdb.urls.worker,
    DATABASE_URL_AUTH: tdb.authUrl,
    BETTER_AUTH_SECRET: 'integration-only-secret-not-real-000000000000',
    APP_ENCRYPTION_KEY: 'integration-only-encryption-key-not-real'
  });
  (globalThis as typeof globalThis & { __kyneticDb?: Db }).__kyneticDb = db;
  const made = await createReferralAs(ctx.ownerB(), b.contactId, 'B Neighbor', '+15555550201');
  foreignReferral = made.id;
});
afterAll(async () => {
  await stopJobs();
  delete (globalThis as typeof globalThis & { __kyneticDb?: Db }).__kyneticDb;
  await tdb?.drop();
});

async function createReferralAs(
  c: ReturnType<typeof ctx.ownerB>,
  contactId: string,
  name: string,
  phone: string
) {
  return createReferral(
    c,
    { referrerContactId: contactId, refereeName: name, refereePhone: phone },
    { db }
  );
}

const summary = (range: string | null, t?: string) =>
  summaryRoute(
    new Request(
      `http://localhost/api/service/reviews/summary${range === null ? '' : `?range=${range}`}`,
      { headers: headers(t, null) }
    )
  );
const list = (t?: string, status?: string) =>
  listRoute(
    new Request(`http://localhost/api/service/referrals${status ? `?status=${status}` : ''}`, {
      headers: headers(t, null)
    })
  );
const create = (body: unknown, t?: string, key?: string | null) =>
  createRoute(
    new Request('http://localhost/api/service/referrals', {
      method: 'POST',
      headers: headers(t, key === undefined ? undefined : key),
      body: JSON.stringify(body)
    })
  );
const patch = (id: string, body: unknown, t?: string) =>
  patchRoute(
    new Request(`http://localhost/api/service/referrals/${id}`, {
      method: 'PATCH',
      headers: headers(t),
      body: JSON.stringify(body)
    }),
    withId(id)
  );

describe('reviews summary', () => {
  it('needs reputation:read; a referral-only token is refused', async () => {
    const onlyReferrals = await token(['referrals:write']);
    expect((await summary(null, onlyReferrals.token)).status).toBe(401);
    expect((await summary(null)).status).toBe(401);
    const rep = await token(['reputation:read']);
    expect((await summary(null, rep.token)).status).toBe(200);
  });

  it('accepts 90d and 12m, refuses anything else', async () => {
    const rep = await token(['reputation:read']);
    expect((await summary('12m', rep.token)).status).toBe(200);
    expect((await summary('90d', rep.token)).status).toBe(200);
    expect((await summary('1y', rep.token)).status).toBe(400);
  });
});

describe('referrals', () => {
  it('create, list and edit one referral; the referee is linked and the status moves', async () => {
    const t = await token(['referrals:write']);
    const made = await create(
      { referrerContactId: a.contactId, refereeName: 'A Neighbor', refereePhone: '+15555550202' },
      t.token
    );
    expect(made.status).toBe(201);
    const id = (await made.json()).data.id as string;
    const rows = (await (await list(t.token)).json()).data.rows as { id: string }[];
    expect(rows.map((r) => r.id)).toContain(id);
    const moved = await patch(id, { status: 'booked' }, t.token);
    expect(moved.status).toBe(200);
    const won = (await (await list(t.token, 'booked')).json()).data.rows as { id: string }[];
    expect(won.map((r) => r.id)).toContain(id);
  });

  it('reward fields are refused for the API, even on a token with every referral scope', async () => {
    const t = await token(['referrals:write']);
    const made = await create(
      { referrerContactId: a.contactId, refereeName: 'Reward Test', refereePhone: '+15555550203' },
      t.token
    );
    const id = (await made.json()).data.id as string;
    const res = await patch(id, { rewardCents: 5000 }, t.token);
    expect(res.status).toBe(403);
    const resStatus = await patch(id, { rewardStatus: 'paid' }, t.token);
    expect(resStatus.status).toBe(403);
    const [row] = await tdb.admin`select reward_cents from client_referrals where id = ${id}`;
    expect(row.reward_cents).toBe(0);
  });

  it('an unknown status filter is a validation error, not an empty list', async () => {
    const t = await token(['referrals:write']);
    expect((await list(t.token, 'nope')).status).toBe(400);
  });

  it("another tenant's referral is a 404 and nothing changes", async () => {
    const t = await token(['referrals:write']);
    const before =
      await tdb.admin`select status from client_referrals where id = ${foreignReferral}`;
    const res = await patch(foreignReferral, { status: 'won' }, t.token);
    expect(res.status).toBe(404);
    const after =
      await tdb.admin`select status from client_referrals where id = ${foreignReferral}`;
    expect(after).toEqual(before);
  });

  it('create is idempotent: the same key replays the first answer and makes one referral', async () => {
    const t = await token(['referrals:write']);
    const body = {
      referrerContactId: a.contactId,
      refereeName: 'Once Only',
      refereePhone: '+15555550204'
    };
    const key = 'referral-replay-1';
    const first = await create(body, t.token, key);
    const second = await create(body, t.token, key);
    expect(first.status).toBe(201);
    expect((await second.json()).data.id).toBe((await first.clone().json()).data.id);
    const [n] =
      await tdb.admin`select count(*)::int as n from client_referrals where referee_name = 'Once Only'`;
    expect(n.n).toBe(1);
  });
});
