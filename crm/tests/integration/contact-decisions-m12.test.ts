import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { POST } from '@/app/api/service/contact-decisions/route';
import { createDb, type Db } from '@/server/db/client';
import { contactDecisions } from '@/server/db/schema';
import { issueServiceToken, revokeServiceToken } from '@/server/service-auth';
import { withTenant } from '@/server/tenancy';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';

let tdb: TestDatabase;
let db: Db;
let tokenA: string;
let tokenB: string;
let contactA: string;
let contactB: string;
const at = '2026-11-01T12:00:00.000Z';
const decision = (contactId = contactA, result: 'allow' | 'deny' = 'allow') => ({
  eventId: crypto.randomUUID(),
  version: 1,
  occurredAt: at,
  payload: {
    contactId,
    channel: 'phone_call',
    decision: result,
    reasonCode: result === 'allow' ? 'consented' : 'internal_dnc',
    ruleVersion: 'test-v1',
    firedRule: 'consent',
    evaluatedAt: at
  }
});
const post = (body: unknown, token = tokenA) =>
  POST(
    new Request('http://localhost/api/service/contact-decisions', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body)
    })
  );
beforeAll(async () => {
  tdb = await createTestDatabase();
  const { a, b } = await seedTwoTenants(tdb.admin);
  contactA = a.contactId;
  contactB = b.contactId;
  db = createDb(tdb.app);
  (globalThis as typeof globalThis & { __kyneticDb?: Db }).__kyneticDb = db;
  tokenA = (
    await issueServiceToken(
      ctx.ownerA(),
      { label: 'synthetic', scopes: ['contact-decisions:write'] },
      { db }
    )
  ).token;
  tokenB = (
    await issueServiceToken(
      ctx.ownerB(),
      { label: 'synthetic', scopes: ['contact-decisions:write'] },
      { db }
    )
  ).token;
});
afterAll(async () => {
  delete (globalThis as typeof globalThis & { __kyneticDb?: Db }).__kyneticDb;
  await tdb?.drop();
});
describe('M12-03 F-74/F-89 decision evidence', () => {
  it('stores allow and deny with reason/rule evidence on the contact timeline', async () => {
    for (const result of ['allow', 'deny'] as const) {
      const input = decision(contactA, result);
      const response = await post(input);
      expect(response.status).toBe(201);
      expect(response.headers.get('cache-control')).toBe('no-store');
      const { data } = await response.json();
      const [row] = await tdb.admin`select payload from contact_decisions where id = ${data.id}`;
      expect(row!.payload).toEqual(input);
      const [activity] =
        await tdb.admin`select tenant_id, contact_id, meta, summary from activities where ref_table = 'contact_decisions' and ref_id = ${data.id}`;
      expect(activity).toMatchObject({
        tenant_id: IDS.tenantA,
        contact_id: contactA,
        summary: `Contact decision: ${result} (${input.payload.reasonCode})`,
        meta: { ...input.payload, eventId: input.eventId }
      });
    }
  });
  it('deduplicates reordered and concurrent retries to one ledger row and one activity', async () => {
    const input = decision();
    const responses = await Promise.all([
      post(input),
      post({ payload: input.payload, occurredAt: at, version: 1, eventId: input.eventId }),
      post(input)
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 200, 201]);
    const results = await Promise.all(responses.map((r) => r.json()));
    expect(new Set(results.map((r) => r.data.id)).size).toBe(1);
    const rows =
      await tdb.admin`select id from contact_decisions where event_id = ${input.eventId}`;
    expect(rows).toHaveLength(1);
    expect(
      await tdb.admin`select id from activities where ref_table = 'contact_decisions' and ref_id = ${rows[0]!.id}`
    ).toHaveLength(1);
    const conflict = await post({ ...input, payload: { ...input.payload, decision: 'deny' } });
    expect(conflict.status).toBe(409);
  });
  it('rejects foreign/missing contacts and tenant overrides without writing', async () => {
    const input = decision(contactB);
    expect((await post(input)).status).toBe(404);
    expect((await post(decision(crypto.randomUUID()))).status).toBe(404);
    expect((await post({ ...decision(), tenantId: IDS.tenantB })).status).toBe(400);
    expect(
      (await post({ ...decision(), payload: { ...decision().payload, tenantId: IDS.tenantB } }))
        .status
    ).toBe(400);
    expect(
      await tdb.admin`select id from contact_decisions where event_id = ${input.eventId}`
    ).toHaveLength(0);
  });
  it('enforces RLS, composite contact ownership and per-tenant event identity', async () => {
    const input = decision();
    const a = await (await post(input)).json();
    const b = await (
      await post({ ...input, payload: { ...input.payload, contactId: contactB } }, tokenB)
    ).json();
    expect(a.data.id).not.toBe(b.data.id);
    const rows = await withTenant(ctx.ownerA(), (tx) => tx.select().from(contactDecisions), { db });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.tenantId === IDS.tenantA)).toBe(true);
    expect(await db.select().from(contactDecisions)).toHaveLength(0);
    for (const tenantId of [IDS.tenantA, IDS.tenantB]) {
      await expect(
        withTenant(
          ctx.ownerA(),
          (tx) =>
            tx.insert(contactDecisions).values({
              tenantId,
              eventId: crypto.randomUUID(),
              contactId: contactB,
              payload: {},
              payloadHash: '0'.repeat(64)
            }),
          { db }
        )
      ).rejects.toThrow();
    }
  });
  it('rejects missing, wrong-scope and revoked credentials', async () => {
    expect((await post(decision(), '')).status).toBe(401);
    const limited = await issueServiceToken(
      ctx.ownerA(),
      { label: 'wrong scope', scopes: ['contacts:read'] },
      { db }
    );
    expect((await post(decision(), limited.token)).status).toBe(401);
    const revoked = await issueServiceToken(
      ctx.ownerA(),
      { label: 'revoked', scopes: ['contact-decisions:write'] },
      { db }
    );
    await revokeServiceToken(ctx.ownerA(), revoked.id, { db });
    expect((await post(decision(), revoked.token)).status).toBe(401);
  });
  it('requires strict version, channel, decision, timestamp and rule-code shapes', async () => {
    const input = decision();
    for (const body of [
      { ...input, version: 2 },
      ...[
        { reasonCode: 'untrusted free text' },
        { decision: 'maybe' },
        { channel: 'voice' },
        { evaluatedAt: 'yesterday' }
      ].map((change) => ({ ...input, payload: { ...input.payload, ...change } }))
    ])
      expect((await post(body)).status).toBe(400);
  });
  it('can log a module-off denial without granting consent or queueing a send', async () => {
    await tdb.admin`update tenant_modules set enabled = false where tenant_id = ${IDS.tenantA} and module_key = 'alex_core'`;
    const before = await tdb.admin`select * from consents where tenant_id = ${IDS.tenantA}`;
    const input = decision(contactA, 'deny');
    input.payload.reasonCode = 'module_off';
    expect((await post(input)).status).toBe(201);
    expect(await tdb.admin`select * from consents where tenant_id = ${IDS.tenantA}`).toEqual(
      before
    );
    // The test database has no job schema: logging requires no provider or queue at all.
  });
  it('rolls back the ledger on timeline failure and accepts a subsequent retry', async () => {
    const input = decision();
    await tdb.admin
      .unsafe(`CREATE FUNCTION reject_decision_activity() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.ref_table = 'contact_decisions' THEN RAISE EXCEPTION 'synthetic failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER reject_decision_activity BEFORE INSERT ON activities FOR EACH ROW EXECUTE FUNCTION reject_decision_activity();`);
    try {
      expect((await post(input)).status).toBe(500);
      expect(
        await tdb.admin`select id from contact_decisions where event_id = ${input.eventId}`
      ).toHaveLength(0);
    } finally {
      await tdb.admin.unsafe(
        'DROP TRIGGER reject_decision_activity ON activities; DROP FUNCTION reject_decision_activity();'
      );
    }
    expect((await post(input)).status).toBe(201);
  });
  it('denies ledger updates and deletes to both runtime roles', async () => {
    for (const role of ['kynetic_app', 'kynetic_worker']) {
      const [grants] =
        await tdb.admin`select has_table_privilege(${role}, 'contact_decisions', 'UPDATE') as updates,
        has_table_privilege(${role}, 'contact_decisions', 'DELETE') as deletes`;
      expect(grants).toEqual({ updates: false, deletes: false });
    }
  });
});
