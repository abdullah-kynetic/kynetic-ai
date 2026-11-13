import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { contacts, serviceTokens } from '@/server/db/schema';
import {
  authenticateServiceToken,
  issueServiceToken,
  revokeServiceToken,
  withServiceAuth,
  withServiceTenant
} from '@/server/service-auth';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { GET as getServiceContact } from '@/app/api/service/contacts/[id]/route';

let tdb: TestDatabase;
let db: Db;
let contactA: string;
let contactB: string;
const bearer = (t: string) => `Bearer ${t}`;

beforeAll(async () => {
  tdb = await createTestDatabase();
  const seeded = await seedTwoTenants(tdb.admin);
  contactA = seeded.a.contactId;
  contactB = seeded.b.contactId;
  db = createDb(tdb.app);
  (globalThis as typeof globalThis & { __kyneticDb?: Db }).__kyneticDb = db;
});
afterAll(async () => {
  delete (globalThis as typeof globalThis & { __kyneticDb?: Db }).__kyneticDb;
  await tdb?.drop();
});

describe('M0-20 service tokens', () => {
  it('stores only a hash, never the raw token', async () => {
    const { id, token } = await issueServiceToken(
      ctx.ownerA(),
      { label: 'n8n', scopes: ['x'] },
      { db }
    );
    const [row] = await tdb.admin`select * from service_tokens where id = ${id}`;
    expect(JSON.stringify(row)).not.toContain(token.split('_')[2]);
    expect(row.key_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.tenant_id).toBe(IDS.tenantA);
  });

  it('authenticates a valid token to its own tenant and stamps last_used_at', async () => {
    const { id, token } = await issueServiceToken(
      ctx.ownerA(),
      { label: 'n8n', scopes: ['create-contact'] },
      { db }
    );
    const svc = await authenticateServiceToken(bearer(token), { db });
    expect(svc).toEqual({ tenantId: IDS.tenantA, tokenId: id, scopes: ['create-contact'] });
    const [row] = await tdb.admin`select last_used_at from service_tokens where id = ${id}`;
    expect(row.last_used_at).not.toBeNull();
  });

  it('refuses the tokens of a suspended or offboarded client, and works again when reactivated', async () => {
    const { token } = await issueServiceToken(ctx.ownerB(), { label: 'n8n', scopes: [] }, { db });
    expect(await authenticateServiceToken(bearer(token), { db })).not.toBeNull();
    for (const status of ['suspended', 'offboarded']) {
      await tdb.admin`update tenants set status = ${status} where id = ${IDS.tenantB}`;
      expect(await authenticateServiceToken(bearer(token), { db })).toBeNull();
    }
    await tdb.admin`update tenants set status = 'active' where id = ${IDS.tenantB}`;
    expect(await authenticateServiceToken(bearer(token), { db })).not.toBeNull();
  });

  it('is scoped to one tenant: a tenant A token reads tenant A rows and never tenant B', async () => {
    const { token } = await issueServiceToken(ctx.ownerA(), { label: 'n8n', scopes: [] }, { db });
    const svc = await authenticateServiceToken(bearer(token), { db });
    expect(svc).not.toBeNull();
    const rows = await withServiceTenant(svc!, (tx) => tx.select().from(contacts), { db });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.tenantId === IDS.tenantA)).toBe(true);
    // Writing a tenant B row through the token's context is refused by RLS.
    await expect(
      withServiceTenant(
        svc!,
        (tx) =>
          tx.insert(serviceTokens).values({
            tenantId: IDS.tenantB,
            prefix: 'b'.repeat(16),
            keyHash: 'x',
            label: 'l',
            scopes: []
          }),
        { db }
      )
    ).rejects.toThrow();
  });

  it('refuses a revoked token, and revocation is per tenant', async () => {
    const { id, token } = await issueServiceToken(
      ctx.ownerA(),
      { label: 'n8n', scopes: [] },
      { db }
    );
    expect(await authenticateServiceToken(bearer(token), { db })).not.toBeNull();
    expect(await revokeServiceToken(ctx.ownerB(), id, { db })).toBe(false);
    expect(await authenticateServiceToken(bearer(token), { db })).not.toBeNull();
    expect(await revokeServiceToken(ctx.ownerA(), id, { db })).toBe(true);
    expect(await authenticateServiceToken(bearer(token), { db })).toBeNull();
  });

  it('refuses missing, malformed, unknown and wrong-secret tokens', async () => {
    const { token } = await issueServiceToken(ctx.ownerA(), { label: 'n8n', scopes: [] }, { db });
    const [prefix] = [token.split('_')[1]];
    for (const h of [
      undefined,
      '',
      'Bearer',
      'Basic abc',
      bearer('nope'),
      bearer(`kst_${'0'.repeat(16)}_${'0'.repeat(64)}`),
      bearer(`kst_${prefix}_${'0'.repeat(64)}`)
    ]) {
      expect(await authenticateServiceToken(h, { db })).toBeNull();
    }
  });

  it('enforces a required scope', async () => {
    const { token } = await issueServiceToken(
      ctx.ownerA(),
      { label: 'n8n', scopes: ['event-ack'] },
      { db }
    );
    expect(
      await authenticateServiceToken(bearer(token), { db, requiredScope: 'event-ack' })
    ).not.toBeNull();
    expect(
      await authenticateServiceToken(bearer(token), { db, requiredScope: 'update-deal-stage' })
    ).toBeNull();
  });

  it('the app role cannot list tokens across tenants or read them without a tenant context', async () => {
    await issueServiceToken(ctx.ownerA(), { label: 'n8n', scopes: [] }, { db });
    await issueServiceToken(ctx.ownerB(), { label: 'n8n', scopes: [] }, { db });
    expect(await db.select().from(serviceTokens)).toHaveLength(0);
    expect(
      await db.select().from(serviceTokens).where(eq(serviceTokens.tenantId, IDS.tenantB))
    ).toHaveLength(0);
  });

  it('withServiceAuth answers 401 with no detail and calls the handler with the tenant on success', async () => {
    const { token } = await issueServiceToken(ctx.ownerA(), { label: 'n8n', scopes: [] }, { db });
    const route = withServiceAuth(async (_req, svc) => Response.json({ tenantId: svc.tenantId }), {
      db
    });
    {
      const bad = await route(
        new Request('http://x/api/service/t', { headers: { authorization: bearer('nope') } })
      );
      expect(bad.status).toBe(401);
      expect(await bad.json()).toEqual({ error: 'unauthorized' });
      const ok = await route(
        new Request('http://x/api/service/t', { headers: { authorization: bearer(token) } })
      );
      expect(ok.status).toBe(200);
      expect(await ok.json()).toEqual({ tenantId: IDS.tenantA });
    }
  });

  it('F-89 service contact route returns only the token tenant contact and refuses missing scope or token', async () => {
    const scoped = await issueServiceToken(
      ctx.ownerA(),
      { label: 'route-test', scopes: ['contacts:read'] },
      { db }
    );
    const route = (id: string, token?: string) =>
      getServiceContact(
        new Request(
          `http://localhost/api/service/contacts/${id}`,
          token ? { headers: { authorization: bearer(token) } } : undefined
        ),
        { params: Promise.resolve({ id }) }
      );
    const own = await route(contactA, scoped.token);
    expect(own.status).toBe(200);
    expect((await own.json()).contact.contact.id).toBe(contactA);
    const foreign = await route(contactB, scoped.token);
    expect(foreign.status).toBe(404);
    expect(await route(contactA)).toMatchObject({ status: 401 });

    const unscoped = await issueServiceToken(
      ctx.ownerA(),
      { label: 'no-scope', scopes: [] },
      { db }
    );
    expect(await route(contactA, unscoped.token)).toMatchObject({ status: 401 });
    await revokeServiceToken(ctx.ownerA(), scoped.id, { db });
    expect(await route(contactA, scoped.token)).toMatchObject({ status: 401 });
  });
});
