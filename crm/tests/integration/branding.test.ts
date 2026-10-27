import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FakeStorage } from '@/server/adapters/storage/fake';
import { ForbiddenError, type Actor } from '@/server/auth';
import { getBranding, saveBranding } from '@/server/branding';
import { createDb, type Db } from '@/server/db/client';
import { ValidationError } from '@/server/errors';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';

let tdb: TestDatabase;
let db: Db;
const storage = new FakeStorage();

const owner = (tenantId: string, userId: string): Actor => ({
  userId,
  kyneticRole: null,
  membership: { tenantId, role: 'owner', canExport: false, canBulkDelete: false },
  viewAs: null
});
const staff: Actor = {
  userId: IDS.staffA,
  kyneticRole: null,
  membership: { tenantId: IDS.tenantA, role: 'staff', canExport: false, canBulkDelete: false },
  viewAs: null
};

beforeAll(async () => {
  tdb = await createTestDatabase();
  await seedTwoTenants(tdb.admin);
  db = createDb(tdb.app);
});
afterAll(async () => {
  await tdb?.drop();
});

const png = () =>
  sharp({ create: { width: 30, height: 30, channels: 4, background: '#2563eb' } })
    .png()
    .toBuffer();

describe('F-39 branding', () => {
  it('saves name, color and logo, audits, and leaves the other tenant alone', async () => {
    const before = await getBranding(ctx.ownerB(), { db });
    const saved = await saveBranding(
      ctx.ownerA(),
      owner(IDS.tenantA, IDS.ownerA),
      {
        name: 'Acme Roofing Co',
        primaryColor: '#2563EB',
        logo: { name: 'l.png', type: 'image/png', bytes: new Uint8Array(await png()) }
      },
      { db, storage }
    );
    expect(saved).toMatchObject({ name: 'Acme Roofing Co', primaryColor: '#2563eb' });
    expect(saved.logoKey).toMatch(new RegExp(`^tenants/${IDS.tenantA}/branding/logo-`));
    expect(await storage.get(saved.logoKey!)).not.toBeNull();
    expect(await getBranding(ctx.ownerB(), { db })).toEqual(before);
    const rows =
      await tdb.admin`select action, tenant_id from audit_log where action = 'branding.update'`;
    expect(rows).toHaveLength(1);
    expect(rows[0]!.tenant_id).toBe(IDS.tenantA);
  });

  it('refuses a low-contrast color and a bad file, and changes nothing', async () => {
    const a = owner(IDS.tenantA, IDS.ownerA);
    const was = await getBranding(ctx.ownerA(), { db });
    const err = (p: Promise<unknown>): Promise<any> => p.catch((e) => e);
    const low = await err(
      saveBranding(ctx.ownerA(), a, { name: 'X', primaryColor: '#ffd700' }, { db, storage })
    );
    expect(low).toBeInstanceOf(ValidationError);
    expect(low.fieldErrors.primaryColor).toEqual(['low_contrast']);
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>');
    const bad = await err(
      saveBranding(
        ctx.ownerA(),
        a,
        {
          name: 'X',
          primaryColor: null,
          logo: { name: 'l.svg', type: 'image/svg+xml', bytes: svg }
        },
        { db, storage }
      )
    );
    expect(bad.fieldErrors.logo).toEqual(['svg_not_allowed']);
    expect(await getBranding(ctx.ownerA(), { db })).toEqual(was);
  });

  it('is owner only', async () => {
    await expect(
      saveBranding(ctx.staffA(), staff, { name: 'Nope', primaryColor: null }, { db, storage })
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('removing the logo clears it and deletes the file', async () => {
    const cur = await getBranding(ctx.ownerA(), { db });
    const out = await saveBranding(
      ctx.ownerA(),
      owner(IDS.tenantA, IDS.ownerA),
      { name: cur.name, primaryColor: cur.primaryColor, removeLogo: true },
      { db, storage }
    );
    expect(out.logoKey).toBeNull();
    expect(await storage.get(cur.logoKey!)).toBeNull();
  });
});
