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

let tdb: TestDatabase;
let db: Db;
const bearer = (t: string) => `Bearer ${t}`;

beforeAll(async () => {
  tdb = await createTestDatabase();
  await seedTwoTenants(tdb.admin);
  db = createDb(tdb.app);
});
afterAll(async () => {
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
});
