import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FakeStorage } from '@/server/adapters/storage/fake';
import { setStorage } from '@/server/adapters/storage';
import type { Actor } from '@/server/auth/permissions';
import { createDb, type Db } from '@/server/db/client';
import {
  commitImportBatch,
  createImportBatch,
  dryRunImportBatch,
  listImportBatches,
  undoImportBatch
} from '@/server/imports';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';

// P1-6: a client cannot import into another tenant, and every step of a client import is in the
// audit log under the owner and their tenant.

let tdb: TestDatabase;
let db: Db;
const storage = new FakeStorage();

const tenantActor = (userId: string, tenantId: string, role: 'owner' | 'staff'): Actor => ({
  userId,
  kyneticRole: null,
  membership: { tenantId, role, canExport: false, canBulkDelete: false },
  viewAs: null
});
const ownerA = tenantActor(IDS.ownerA, IDS.tenantA, 'owner');
const ownerB = tenantActor(IDS.ownerB, IDS.tenantB, 'owner');

beforeAll(async () => {
  tdb = await createTestDatabase();
  await seedTwoTenants(tdb.admin);
  db = createDb(tdb.app);
  setStorage(storage);
});
afterAll(async () => {
  setStorage(undefined);
  await tdb?.drop();
});

const intake = (file: Uint8Array, name: string, fileType: 'csv' | 'xlsx') => ({
  fileName: name,
  fileType,
  entity: 'contact' as const,
  importedSource: 'client_upload',
  mapping: {},
  duplicateRule: 'skip' as const
});

describe('P1-6 tenant guard and audit for client import', () => {
  it('refuses an owner who asks to import into another tenant', async () => {
    const file = new TextEncoder().encode('phone\n4155550777');
    const before =
      await tdb.admin`select count(*)::int as n from import_batches where tenant_id = ${IDS.tenantA}`;
    // Tenant B's owner names tenant A in the context (a spoofed tenant id).
    await expect(
      createImportBatch(ctx.ownerA(), ownerB, intake(file, 'x.csv', 'csv'), file, { db })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const after =
      await tdb.admin`select count(*)::int as n from import_batches where tenant_id = ${IDS.tenantA}`;
    expect(after[0]!.n).toBe(before[0]!.n);
  });

  it("hides another tenant's batch from every step", async () => {
    const file = new TextEncoder().encode('phone\n4155550778');
    const batch = await createImportBatch(
      ctx.ownerA(),
      ownerA,
      intake(file, 'a-only.csv', 'csv'),
      file,
      { db }
    );
    // Tenant B's owner, in tenant B, uses tenant A's batch id: not found, and nothing is read.
    await expect(
      dryRunImportBatch(ctx.ownerB(), ownerB, batch.id, { phone: 'phone' }, { db })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(commitImportBatch(ctx.ownerB(), ownerB, batch.id, { db })).rejects.toMatchObject({
      code: 'NOT_FOUND'
    });
    await expect(undoImportBatch(ctx.ownerB(), ownerB, batch.id, { db })).rejects.toMatchObject({
      code: 'NOT_FOUND'
    });
    expect((await listImportBatches(ctx.ownerB(), ownerB, { db })).map((b) => b.id)).not.toContain(
      batch.id
    );
  });

  it('writes the client import to the audit log under the owner and their tenant', async () => {
    const file = new TextEncoder().encode('first,phone\nAudit,415-555-0721');
    const batch = await createImportBatch(
      ctx.ownerA(),
      ownerA,
      intake(file, 'audit.csv', 'csv'),
      file,
      { db }
    );
    await dryRunImportBatch(
      ctx.ownerA(),
      ownerA,
      batch.id,
      { firstName: 'first', phone: 'phone' },
      { db }
    );
    await commitImportBatch(ctx.ownerA(), ownerA, batch.id, { db });
    await undoImportBatch(ctx.ownerA(), ownerA, batch.id, { db });
    const rows = await tdb.admin`select action, actor_user_id, tenant_id from audit_log
      where entity = 'import_batch' and entity_id = ${batch.id} order by created_at`;
    expect(rows.map((r) => r.action)).toEqual([
      'import.create',
      'import.dry_run',
      'import.commit',
      expect.stringMatching(/^import\.undo/)
    ]);
    expect(rows.every((r) => r.actor_user_id === IDS.ownerA && r.tenant_id === IDS.tenantA)).toBe(
      true
    );
  });
});
