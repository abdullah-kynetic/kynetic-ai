import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb } from '@/server/db/client';
import type { Actor } from '@/server/auth/permissions';
import {
  listOwnSupportRequests,
  listSupportQueue,
  setSupportRequestStatus,
  submitSupportRequest
} from '@/server/support';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';

// M20-06: a client submits, Kynetic staff see it across clients, status is tracked and audited.

let tdb: TestDatabase;
let db: ReturnType<typeof createDb>;
const ownerA: Actor = {
  userId: IDS.ownerA,
  kyneticRole: null,
  membership: { tenantId: IDS.tenantA, role: 'owner', canExport: true, canBulkDelete: true },
  viewAs: null
};
const ownerB: Actor = {
  userId: IDS.ownerB,
  kyneticRole: null,
  membership: { tenantId: IDS.tenantB, role: 'owner', canExport: true, canBulkDelete: true },
  viewAs: null
};
const admin = { userId: IDS.admin, role: 'admin' as const };
const va = { userId: IDS.va, role: 'va' as const };

beforeAll(async () => {
  tdb = await createTestDatabase();
  await seedTwoTenants(tdb.admin);
  db = createDb(tdb.app);
});
afterAll(async () => tdb?.drop());

describe('M20-06 support requests', () => {
  it('lets a client submit and see only its own requests', async () => {
    const { id } = await submitSupportRequest(
      ctx.ownerA(),
      ownerA,
      { subject: 'Calls stopped', body: 'Alex has not called new leads since Monday.' },
      { db }
    );
    await submitSupportRequest(
      ctx.ownerB(),
      ownerB,
      { subject: 'Invoice question', body: 'Which month does the invoice cover?' },
      { db }
    );
    const mine = await listOwnSupportRequests(ctx.ownerA(), ownerA, { db });
    expect(mine.map((r) => r.id)).toContain(id);
    expect(mine.map((r) => r.subject)).not.toContain('Invoice question');
    expect(mine.find((r) => r.id === id)).toMatchObject({ status: 'open', resolvedAt: null });
    const theirs = await listOwnSupportRequests(ctx.ownerB(), ownerB, { db });
    expect(theirs.map((r) => r.subject)).toContain('Invoice question');
    expect(theirs.map((r) => r.subject)).not.toContain('Calls stopped');
  });

  it('rejects empty, oversized and unknown-field submissions', async () => {
    for (const input of [
      { subject: '  ', body: 'text' },
      { subject: 'x', body: '' },
      { subject: 'x'.repeat(201), body: 'text' },
      { subject: 'x', body: 'y'.repeat(5001) },
      { subject: 'x', body: 'y', status: 'resolved' },
      { subject: 'x', body: 'y', tenantId: IDS.tenantB }
    ])
      await expect(submitSupportRequest(ctx.ownerA(), ownerA, input, { db })).rejects.toMatchObject(
        { code: 'VALIDATION_FAILED' }
      );
  });

  it('refuses a user from another tenant', async () => {
    await expect(
      submitSupportRequest(ctx.ownerA(), ownerB, { subject: 'x', body: 'y' }, { db })
    ).rejects.toBeDefined();
  });

  it('shows staff every client request and lets them change status with an audit row', async () => {
    const queue = await listSupportQueue(admin, { db });
    expect(new Set(queue.map((r) => r.tenantId))).toEqual(new Set([IDS.tenantA, IDS.tenantB]));
    expect(queue[0]).toMatchObject({ status: 'open' });
    const target = queue.find((r) => r.tenantId === IDS.tenantA && r.subject === 'Calls stopped')!;

    await setSupportRequestStatus(va, target.id, 'in_progress', { db });
    await setSupportRequestStatus(admin, target.id, 'resolved', { db });

    const own = (await listOwnSupportRequests(ctx.ownerA(), ownerA, { db })).find(
      (r) => r.id === target.id
    )!;
    expect(own).toMatchObject({ status: 'resolved' });
    expect(own.resolvedAt).not.toBeNull();
    const audits = await tdb.admin`
      select before, after from audit_log
      where action = 'support.status' and entity_id = ${target.id} order by created_at`;
    expect(audits.map((a) => a.after.status)).toEqual(['in_progress', 'resolved']);
    expect(audits[1]!.before.status).toBe('in_progress');
    const sorted = await listSupportQueue(admin, { db });
    expect(sorted[sorted.length - 1]).toMatchObject({ id: target.id, status: 'resolved' });

    await setSupportRequestStatus(admin, target.id, 'open', { db });
    const [row] = await tdb.admin`select resolved_at from support_requests where id = ${target.id}`;
    expect(row!.resolved_at).toBeNull();
  });

  it('rejects bad status values and unknown requests', async () => {
    const [{ id }] = await tdb.admin`select id from support_requests limit 1`;
    await expect(setSupportRequestStatus(admin, id, 'closed', { db })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED'
    });
    await expect(
      setSupportRequestStatus(admin, crypto.randomUUID(), 'resolved', { db })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('keeps clients out of the queue and out of status changes at the database', async () => {
    const [{ id }] = await tdb.admin`select id from support_requests limit 1`;
    await expect(
      listSupportQueue({ userId: IDS.ownerA, role: 'owner' as never }, { db })
    ).rejects.toBeDefined();
    await expect(
      setSupportRequestStatus({ userId: IDS.ownerA, role: 'owner' as never }, id, 'resolved', {
        db
      })
    ).rejects.toBeDefined();
    // The app role cannot update or delete rows directly, whatever the tenant context.
    await expect(
      tdb.app.begin(async (tx) => {
        await tx`select set_config('app.tenant_id', ${IDS.tenantA}, true), set_config('app.role', 'owner', true)`;
        await tx`update support_requests set status = 'resolved' where id = ${id}`;
      })
    ).rejects.toThrow(/permission denied/);
  });
});
