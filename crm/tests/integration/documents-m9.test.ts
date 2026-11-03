import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FakeStorage } from '@/server/adapters/storage/fake';
import { createDb } from '@/server/db/client';
import {
  getTenantDocumentUrl,
  listTenantDocuments,
  uploadTenantDocument
} from '@/server/documents';
import type { Actor } from '@/server/auth/permissions';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';

let tdb: TestDatabase;
let db: ReturnType<typeof createDb>;
const storage = new FakeStorage();
const adminActor: Actor = {
  userId: IDS.admin,
  kyneticRole: 'admin',
  membership: null,
  viewAs: null
};
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

beforeAll(async () => {
  tdb = await createTestDatabase();
  await seedTwoTenants(tdb.admin);
  db = createDb(tdb.app);
});

afterAll(async () => tdb?.drop());

describe('F-103 tenant documents', () => {
  it('lets the admin upload a PDF and only the owning tenant download it', async () => {
    const pdf = new TextEncoder().encode('%PDF-1.7\nsynthetic document');
    const document = await uploadTenantDocument(
      { tenantId: IDS.tenantA, userId: IDS.admin, role: 'admin' },
      adminActor,
      { title: 'Synthetic proposal', kind: 'proposal', fileName: 'proposal.pdf' },
      pdf,
      { db, storage }
    );
    expect(await listTenantDocuments(ctx.ownerA(), ownerA, { db })).toContainEqual(
      expect.objectContaining({ id: document.id, title: 'Synthetic proposal' })
    );
    const { url } = await getTenantDocumentUrl(ctx.ownerA(), ownerA, document.id, { db, storage });
    expect(storage.fetchSigned(url)?.body).toEqual(pdf);
    await expect(
      getTenantDocumentUrl(ctx.ownerB(), ownerB, document.id, { db, storage })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(
      await tdb.admin`select tenant_id, file_key from tenant_documents where id = ${document.id}`
    ).toMatchObject([
      { tenant_id: IDS.tenantA, file_key: `${IDS.tenantA}/documents/${document.id}/document.pdf` }
    ]);
  });

  it('refuses a non-PDF upload', async () => {
    await expect(
      uploadTenantDocument(
        { tenantId: IDS.tenantA, userId: IDS.admin, role: 'admin' },
        adminActor,
        { title: 'Unsafe file', kind: 'other', fileName: 'unsafe.txt' },
        new TextEncoder().encode('not a PDF'),
        { db, storage }
      )
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });
});
