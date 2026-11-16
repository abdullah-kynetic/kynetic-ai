import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { AppError } from '@/server/errors';
import {
  auditService,
  issueServiceToken,
  purgeServiceIdempotency,
  runIdempotent,
  withServiceTenant,
  type ServiceContext
} from '@/server/service-auth';
import { GET as getTenant } from '@/app/api/service/tenant/route';
import { GET as getMetrics } from '@/app/api/service/metrics/daily/route';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let tdb: TestDatabase;
let db: Db;
const bearer = (t: string) => ({ authorization: `Bearer ${t}` });
const get = (path: string, token?: string) =>
  new Request(`http://localhost${path}`, {
    headers: token ? bearer(token) : {}
  });

async function token(owner: 'A' | 'B', scopes: string[]) {
  const c = owner === 'A' ? ctx.ownerA() : ctx.ownerB();
  const t = await issueServiceToken(c, { label: 'test', scopes }, { db });
  const svc: ServiceContext = {
    tenantId: owner === 'A' ? IDS.tenantA : IDS.tenantB,
    tokenId: t.id,
    scopes
  };
  return { ...t, svc };
}

const post = (key: string | null, body: unknown) =>
  new Request('http://localhost/api/service/thing', {
    method: 'POST',
    headers: key ? { 'idempotency-key': key } : {},
    body: JSON.stringify(body)
  });

beforeAll(async () => {
  tdb = await createTestDatabase();
  await seedTwoTenants(tdb.admin);
  db = createDb(tdb.app);
  (globalThis as typeof globalThis & { __kyneticDb?: Db }).__kyneticDb = db;
  await tdb.admin`insert into metrics_daily (tenant_id, day, leads, calls) values
    (${IDS.tenantA}, current_date, 7, 3), (${IDS.tenantB}, current_date, 99, 98)
    on conflict (tenant_id, day) do update set leads = excluded.leads, calls = excluded.calls`;
});
afterAll(async () => {
  delete (globalThis as typeof globalThis & { __kyneticDb?: Db }).__kyneticDb;
  await tdb?.drop();
});

describe('service API: auth and scope on the shared-layer routes', () => {
  it('401 with no token, a wrong scope, or a malformed token', async () => {
    const metricsOnly = await token('A', ['metrics:read']);
    for (const res of [
      await getTenant(get('/api/service/tenant')),
      await getTenant(get('/api/service/tenant', metricsOnly.token)),
      await getMetrics(get('/api/service/metrics/daily', 'kst_nope')),
      await getMetrics(get('/api/service/metrics/daily', (await token('A', ['tenant:read'])).token))
    ]) {
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: 'unauthorized' });
    }
  });

  it('tenant: returns only the token tenant', async () => {
    const a = await token('A', ['tenant:read']);
    const res = await getTenant(get('/api/service/tenant', a.token));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.id).toBe(IDS.tenantA);
    expect(JSON.stringify(body)).not.toContain(IDS.tenantB);
  });

  it('metrics: cross-tenant blocked, range validated', async () => {
    const a = await token('A', ['metrics:read']);
    const res = await getMetrics(get('/api/service/metrics/daily', a.token));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.days).toHaveLength(1);
    expect(body.data.days[0].leads).toBe(7);
    const b = await token('B', ['metrics:read']);
    const rb = await (await getMetrics(get('/api/service/metrics/daily', b.token))).json();
    expect(rb.data.days[0].leads).toBe(99);
    const bad = await getMetrics(
      get('/api/service/metrics/daily?from=2026-01-01&to=2026-12-31', a.token)
    );
    expect(bad.status).toBe(400);
    const unknown = await getMetrics(get('/api/service/metrics/daily?tenantId=x', a.token));
    expect(unknown.status).toBe(400);
  });

  it('rate limit: a client token is cut off with 429 and Retry-After after its minute budget', async () => {
    const t = await token('A', ['tenant:read']);
    let limited: Response | undefined;
    // 120 per fixed one-minute window; up to 250 calls covers a window boundary.
    for (let i = 0; i < 250 && !limited; i++) {
      const res = await getTenant(get('/api/service/tenant', t.token));
      if (res.status === 429) limited = res;
      else expect(res.status).toBe(200);
    }
    expect(limited).toBeDefined();
    expect(limited!.headers.get('retry-after')).toBeTruthy();
    // Another token of the same client has its own budget.
    const other = await token('A', ['tenant:read']);
    expect((await getTenant(get('/api/service/tenant', other.token))).status).toBe(200);
  });
});

describe('service API: idempotency and audit helpers', () => {
  it('runs a write once, replays the stored response, and rejects a changed body', async () => {
    const t = await token('A', ['x']);
    let runs = 0;
    const fn = async () => {
      runs++;
      return { status: 201, body: { ok: true, data: { n: runs } } };
    };
    const body = { title: 'one' };
    const first = await runIdempotent(t.svc, post('key-aaaaaaaa', body), JSON.stringify(body), fn, {
      db
    });
    const again = await runIdempotent(t.svc, post('key-aaaaaaaa', body), JSON.stringify(body), fn, {
      db
    });
    expect(first.replayed).toBe(false);
    expect(again).toMatchObject({
      replayed: true,
      status: 201,
      body: { ok: true, data: { n: 1 } }
    });
    expect(runs).toBe(1);
    const changed = { title: 'two' };
    await expect(
      runIdempotent(t.svc, post('key-aaaaaaaa', changed), JSON.stringify(changed), fn, { db })
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('requires a valid key, and a failed write leaves no record so the key can retry', async () => {
    const t = await token('A', ['x']);
    const fn = async () => ({ status: 201, body: {} });
    for (const key of [null, 'short']) {
      await expect(runIdempotent(t.svc, post(key, {}), '{}', fn, { db })).rejects.toMatchObject({
        code: 'VALIDATION_FAILED'
      });
    }
    await expect(
      runIdempotent(
        t.svc,
        post('retry-key-1', {}),
        '{}',
        async () => {
          throw new AppError('NOT_FOUND');
        },
        { db }
      )
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const ok = await runIdempotent(t.svc, post('retry-key-1', {}), '{}', fn, {
      db
    });
    expect(ok.replayed).toBe(false);
  });

  it('the same key in another tenant is independent', async () => {
    const a = await token('A', ['x']);
    const b = await token('B', ['x']);
    const mk = (n: number) => async () => ({ status: 201, body: { n } });
    const ra = await runIdempotent(a.svc, post('shared-key-1', {}), '{}', mk(1), { db });
    const rb = await runIdempotent(b.svc, post('shared-key-1', {}), '{}', mk(2), { db });
    expect(ra.replayed).toBe(false);
    expect(rb).toMatchObject({ replayed: false, body: { n: 2 } });
  });

  it('writes an audit_log row that names the service token, and purges old records', async () => {
    const t = await token('A', ['x']);
    await withServiceTenant(
      t.svc,
      (tx) =>
        auditService(tx, t.svc, {
          action: 'service.test',
          entity: 'thing',
          after: { a: 1 }
        }),
      { db }
    );
    const [row] = await tdb.admin`select actor_user_id, after from audit_log
      where action = 'service.test' and tenant_id = ${IDS.tenantA}`;
    expect(row.actor_user_id).toBeNull();
    expect(row.after).toEqual({ a: 1, serviceTokenId: t.id });

    await runIdempotent(
      t.svc,
      post('purge-key-1', {}),
      '{}',
      async () => ({ status: 201, body: {} }),
      {
        db
      }
    );
    await tdb.admin`update service_idempotency set created_at = now() - interval '25 hours'
      where key = 'purge-key-1'`;
    expect(await purgeServiceIdempotency(createDb(tdb.worker))).toBeGreaterThanOrEqual(1);
    const left = await tdb.admin`select 1 from service_idempotency where key = 'purge-key-1'`;
    expect(left).toHaveLength(0);
  });
});
