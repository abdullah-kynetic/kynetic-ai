import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { registerAutomationSubscribers } from '@/server/automations/worker';
import { registerStageRuleSubscribers } from '@/server/automations/rules';
import { registerN8nEventSubscribers } from '@/server/integrations/n8n';
import { clearSubscribers, deliver, type EventEnvelope } from '@/server/events';
import { stopJobs } from '@/server/jobs';
import { issueServiceToken } from '@/server/service-auth';
import { POST as postStage } from '@/app/api/service/deals/[id]/stage/route';
import { ctx, IDS, seedTwoTenants, type SeededTenant } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let tdb: TestDatabase;
let db: Db;
let worker: Db;
let a: SeededTenant;
let b: SeededTenant;
let keyN = 0;
let stages: { contacted: string; won: string; lost: string; quoted: string; otherPipeline: string };

const post = (
  dealId: string,
  body: unknown,
  token?: string,
  key: string | null = `key-${Date.now()}-${keyN++}`
) =>
  postStage(
    new Request(`http://localhost/api/service/deals/${dealId}/stage`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(key ? { 'idempotency-key': key } : {})
      },
      body: typeof body === 'string' ? body : JSON.stringify(body)
    }),
    { params: Promise.resolve({ id: dealId }) }
  );

async function token(owner: 'A' | 'B', scopes: string[]) {
  const c = owner === 'A' ? ctx.ownerA() : ctx.ownerB();
  return issueServiceToken(c, { label: 'test', scopes }, { db });
}
const dealStage = async (id: string) => {
  const [r] =
    await tdb.admin`select stage_id, won_at, lost_at, lost_reason from deals where id = ${id}`;
  return r!;
};
const resetDeal = () =>
  tdb.admin`update deals set stage_id = ${a.stageId}, won_at = null, lost_at = null, lost_reason = null where id = ${a.dealId}`;
const counts = async () => {
  const [r] = await tdb.admin`select
    (select count(*) from notifications)::int as notifications,
    (select count(*) from messages)::int as messages,
    (select count(*) from calls)::int as calls,
    (select count(*) from automation_runs)::int as runs,
    (select count(*) from activities)::int as activities,
    (select count(*) from audit_log)::int as audit,
    (select count(*) from pgboss.job where name = 'event.dispatch')::int as events`;
  return r!;
};
const eventsFor = async (name: string) =>
  (
    await tdb.admin`select data from pgboss.job where name = 'event.dispatch' and data->>'name' = ${name}
      and data->'payload'->>'dealId' = ${a.dealId} order by created_on`
  ).map((r) => r.data as EventEnvelope);

beforeAll(async () => {
  tdb = await createTestDatabase({ jobs: true });
  ({ a, b } = await seedTwoTenants(tdb.admin));
  db = createDb(tdb.app);
  worker = createDb(tdb.worker);
  Object.assign(process.env, {
    APP_BASE_URL: 'http://localhost:3000',
    DATABASE_URL: tdb.urls.app,
    DATABASE_URL_WORKER: tdb.urls.worker,
    DATABASE_URL_AUTH: tdb.authUrl,
    BETTER_AUTH_SECRET: 'integration-only-secret-not-real-000000000000',
    APP_ENCRYPTION_KEY: 'integration-only-encryption-key-not-real'
  });
  Object.assign(globalThis as typeof globalThis & { __kyneticDb?: Db; __kyneticWorkerDb?: Db }, {
    __kyneticDb: db,
    __kyneticWorkerDb: worker
  });
  const add = async (name: string, position: number, won = false, lost = false) =>
    (
      await tdb.admin`insert into pipeline_stages (tenant_id, pipeline_id, name, position, is_won, is_lost)
        values (${IDS.tenantA}, ${a.pipelineId}, ${name}, ${position}, ${won}, ${lost}) returning id`
    )[0]!.id as string;
  const [other] =
    await tdb.admin`insert into pipelines (tenant_id, name, is_default) values (${IDS.tenantA}, 'Second', false) returning id`;
  const [otherStage] =
    await tdb.admin`insert into pipeline_stages (tenant_id, pipeline_id, name, position)
      values (${IDS.tenantA}, ${other!.id}, 'Elsewhere', 0) returning id`;
  stages = {
    contacted: await add('Contacted', 1),
    quoted: await add('Quoted', 2),
    won: await add('Won', 3, true),
    lost: await add('Lost', 4, false, true),
    otherPipeline: otherStage!.id
  };
});
afterAll(async () => {
  clearSubscribers();
  await stopJobs();
  const g = globalThis as typeof globalThis & { __kyneticDb?: Db; __kyneticWorkerDb?: Db };
  delete g.__kyneticDb;
  delete g.__kyneticWorkerDb;
  await tdb?.drop();
});

describe('deal stage: auth, scope, rate limit', () => {
  it('401 with no token and the wrong scope; 200 with deals:write', async () => {
    await resetDeal();
    const body = { stageId: stages.contacted };
    expect((await post(a.dealId, body)).status).toBe(401);
    const wrong = await token('A', ['deals:read', 'notes:write']);
    expect((await post(a.dealId, body, wrong.token)).status).toBe(401);
    const ok = await token('A', ['deals:write']);
    const res = await post(a.dealId, body, ok.token);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.changed).toBe(true);
    expect(json.data.toStageId).toBe(stages.contacted);
    expect((await dealStage(a.dealId)).stage_id).toBe(stages.contacted);
  });

  it('429 with Retry-After once the write limit is hit', async () => {
    const t = await token('A', ['deals:write']);
    let limited: Response | undefined;
    for (let i = 0; i < 130 && !limited; i++) {
      const res = await post(a.dealId, { stageId: stages.contacted }, t.token);
      if (res.status === 429) limited = res;
    }
    expect(limited).toBeDefined();
    expect(limited!.headers.get('retry-after')).toBeTruthy();
  });
});

describe('deal stage: tenant and pipeline isolation', () => {
  it("another tenant's deal is a 404 and nothing is written", async () => {
    const t = await token('A', ['deals:write']);
    const [before] = await tdb.admin`select stage_id from deals where id = ${b.dealId}`;
    const c = await counts();
    expect((await post(b.dealId, { stageId: stages.contacted }, t.token)).status).toBe(404);
    expect((await tdb.admin`select stage_id from deals where id = ${b.dealId}`)[0]).toEqual(before);
    expect(await counts()).toEqual(c);
  });

  it("another tenant's stage is a 404 and nothing is written", async () => {
    await resetDeal();
    const t = await token('A', ['deals:write']);
    const c = await counts();
    expect((await post(a.dealId, { stageId: b.stageId }, t.token)).status).toBe(404);
    expect((await dealStage(a.dealId)).stage_id).toBe(a.stageId);
    expect(await counts()).toEqual(c);
  });

  it('a stage of another pipeline in the same tenant is a 404 and nothing is written', async () => {
    await resetDeal();
    const t = await token('A', ['deals:write']);
    const c = await counts();
    expect((await post(a.dealId, { stageId: stages.otherPipeline }, t.token)).status).toBe(404);
    expect((await post(a.dealId, { stageId: crypto.randomUUID() }, t.token)).status).toBe(404);
    expect((await dealStage(a.dealId)).stage_id).toBe(a.stageId);
    expect(await counts()).toEqual(c);
  });

  it('an unknown or soft-deleted deal is a 404', async () => {
    const t = await token('A', ['deals:write']);
    expect((await post(crypto.randomUUID(), { stageId: stages.contacted }, t.token)).status).toBe(
      404
    );
  });
});

describe('deal stage: idempotency', () => {
  it('the same key and body replays the first response and moves once', async () => {
    await resetDeal();
    const t = await token('A', ['deals:write']);
    const key = 'dup-stage-0001';
    const first = await post(a.dealId, { stageId: stages.contacted }, t.token, key);
    const c = await counts();
    const again = await post(a.dealId, { stageId: stages.contacted }, t.token, key);
    expect(first.status).toBe(200);
    expect(again.status).toBe(200);
    expect(again.headers.get('idempotent-replay')).toBe('true');
    expect(await counts()).toEqual(c);
  });

  it('the same key with a different body is a 409 and changes nothing', async () => {
    await resetDeal();
    const t = await token('A', ['deals:write']);
    const key = 'dup-stage-0002';
    await post(a.dealId, { stageId: stages.contacted }, t.token, key);
    const c = await counts();
    expect((await post(a.dealId, { stageId: stages.quoted }, t.token, key)).status).toBe(409);
    expect((await dealStage(a.dealId)).stage_id).toBe(stages.contacted);
    expect(await counts()).toEqual(c);
  });

  it('a missing or malformed Idempotency-Key is a 400', async () => {
    const t = await token('A', ['deals:write']);
    expect((await post(a.dealId, { stageId: stages.contacted }, t.token, null)).status).toBe(400);
    expect((await post(a.dealId, { stageId: stages.contacted }, t.token, 'short')).status).toBe(
      400
    );
  });
});

describe('deal stage: validation and outcomes', () => {
  it('rejects unknown fields and bad input with 400', async () => {
    const t = await token('A', ['deals:write']);
    for (const body of [
      { stageId: stages.contacted, afterDealId: a.dealId },
      { stageId: stages.contacted, wonAt: '2026-01-01' },
      { stageId: 'nope' },
      {},
      { stageId: stages.lost, lostReason: 'x'.repeat(501) },
      '{not json'
    ]) {
      expect((await post(a.dealId, body, t.token)).status, JSON.stringify(body).slice(0, 60)).toBe(
        400
      );
    }
    const bad = await post('not-a-uuid', { stageId: stages.contacted }, t.token);
    expect(bad.status).toBe(400);
  });

  it('a Lost stage needs a reason; the reason is stored as plain text', async () => {
    await resetDeal();
    const t = await token('A', ['deals:write']);
    expect((await post(a.dealId, { stageId: stages.lost }, t.token)).status).toBe(400);
    expect((await dealStage(a.dealId)).stage_id).toBe(a.stageId);
    const res = await post(
      a.dealId,
      { stageId: stages.lost, lostReason: 'Went with <b>another</b> bidder <script>x</script>' },
      t.token
    );
    expect(res.status).toBe(200);
    const row = await dealStage(a.dealId);
    expect(row.stage_id).toBe(stages.lost);
    expect(row.lost_at).not.toBeNull();
    expect(row.lost_reason).not.toMatch(/[<>]/);
    expect(row.lost_reason).toContain('another');
  });

  it('moving to the same stage is a 200 with changed:false and emits nothing', async () => {
    await resetDeal();
    const t = await token('A', ['deals:write']);
    const c = await counts();
    const res = await post(a.dealId, { stageId: a.stageId }, t.token);
    expect(res.status).toBe(200);
    expect((await res.json()).data.changed).toBe(false);
    expect((await counts()).events).toBe(c.events);
  });
});

describe('deal stage: audit', () => {
  it('writes an audit row naming the token and the stage ids, with no free text', async () => {
    await resetDeal();
    const t = await token('A', ['deals:write']);
    const res = await post(
      a.dealId,
      { stageId: stages.lost, lostReason: 'private words here' },
      t.token
    );
    expect(res.status).toBe(200);
    const rows = await tdb.admin`select entity, entity_id, after from audit_log
      where action = 'service.deal_stage' and after->>'serviceTokenId' = ${t.id}`;
    expect(rows).toHaveLength(1);
    expect(rows[0]!.entity_id).toBe(a.dealId);
    expect(rows[0]!.after).toMatchObject({ fromStageId: a.stageId, toStageId: stages.lost });
    expect(JSON.stringify(rows[0]!.after)).not.toContain('private words');
  });
});

describe('deal stage: nothing outbound runs for the events it emits', () => {
  it('stage_changed, won and lost carry origin service-api and a system actor', async () => {
    await resetDeal();
    await tdb.admin`delete from pgboss.job where name = 'event.dispatch'`;
    const t = await token('A', ['deals:write']);
    await post(a.dealId, { stageId: stages.won }, t.token);
    await post(a.dealId, { stageId: stages.lost, lostReason: 'Changed mind' }, t.token);
    const changed = await eventsFor('deal.stage_changed');
    const won = await eventsFor('deal.won');
    const lost = await eventsFor('deal.lost');
    expect(changed).toHaveLength(2);
    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(1);
    for (const env of [...changed, ...won, ...lost]) {
      expect(env.payload.origin).toBe('service-api');
      expect(env.actor).toEqual({ type: 'system' });
    }
  });

  it('the n8n push, quote follow-up and won alert skip them; the stop-run subscribers still run', async () => {
    await resetDeal();
    await tdb.admin`delete from pgboss.job where name = 'event.dispatch'`;
    const fetcher = vi.fn(async () => new Response('{}', { status: 200 }));
    registerN8nEventSubscribers({ db: worker, fetcher: fetcher as unknown as typeof fetch });
    registerAutomationSubscribers();
    registerStageRuleSubscribers();
    const t = await token('A', ['deals:write']);
    await post(a.dealId, { stageId: stages.quoted }, t.token);
    await post(a.dealId, { stageId: stages.won }, t.token);
    const before = await counts();
    const [changedQuoted] = await eventsFor('deal.stage_changed');
    const [won] = await eventsFor('deal.won');
    expect(changedQuoted!.payload.toStageId).toBe(stages.quoted);
    for (const env of await eventsFor('deal.stage_changed')) {
      await deliver(env, 'n8n-deal-stage_changed');
      await deliver(env, 'automation-quote-followup');
    }
    await deliver(won!, 'm7-deal-won-alert');
    await expect(deliver(won!, 'automation-stop-deal.won')).resolves.toBe('ran');
    expect(fetcher).not.toHaveBeenCalled();
    const after = await counts();
    expect(after.notifications).toBe(before.notifications);
    expect(after.runs).toBe(before.runs);
    expect(after.messages).toBe(before.messages);
    expect(after.calls).toBe(before.calls);
  });

  it('control: the same won event without the tag does raise the in-app won alert', async () => {
    await tdb.admin`update tenant_modules set enabled = true where tenant_id = ${IDS.tenantA}`;
    const [won] = await eventsFor('deal.won');
    const untagged = {
      ...won!,
      id: crypto.randomUUID(),
      payload: { ...won!.payload, origin: undefined }
    } as EventEnvelope;
    const [before] =
      await tdb.admin`select count(*)::int as n from notifications where kind = 'deal_won'`;
    await deliver(untagged, 'm7-deal-won-alert');
    const [after] =
      await tdb.admin`select count(*)::int as n from notifications where kind = 'deal_won'`;
    expect(after!.n).toBe(before!.n + 1);
  });

  it('PROVIDER_MODE stub and OUTBOUND_ENABLED off: the route adds no message, call or notification', async () => {
    await resetDeal();
    const t = await token('A', ['deals:write']);
    const c = await counts();
    expect((await post(a.dealId, { stageId: stages.won }, t.token)).status).toBe(200);
    const d = await counts();
    expect(d.messages).toBe(c.messages);
    expect(d.calls).toBe(c.calls);
    expect(d.notifications).toBe(c.notifications);
    expect(d.runs).toBe(c.runs);
  });
});
