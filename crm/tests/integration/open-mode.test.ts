import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getSessionUser, requireUser } from '@/server/auth';
import { createDb } from '@/server/db/client';
import { decideAdminAccess } from '@/server/admin';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { IDS, seedTwoTenants } from '../helpers/fixtures';

// Open mode (Abdullah, 2026-11-02): no sign-in. A plain cookie picks which existing user a request acts as.
let tdb: TestDatabase;
const asCookie = (persona?: string) =>
  new Headers(persona ? { cookie: `kynetic_open_as=${persona}` } : {});

beforeAll(async () => {
  tdb = await createTestDatabase();
  await seedTwoTenants(tdb.admin);
});
afterAll(async () => tdb?.drop());

describe('open mode', () => {
  it('needs no cookie, session or sign-in, and defaults to the Kynetic admin', async () => {
    const user = await getSessionUser(asCookie(), { db: createDb(tdb.auth) });
    expect(user).toMatchObject({ id: IDS.admin, kyneticRole: 'admin', twoFactor: 'verified' });
    const access = await decideAdminAccess(asCookie(), {
      getUser: (h) => getSessionUser(h, { db: createDb(tdb.auth) })
    });
    expect(access.kind).toBe('ok');
  });

  it('switches between support, owner and team member by cookie', async () => {
    const db = createDb(tdb.auth);
    expect((await getSessionUser(asCookie('va'), { db }))?.id).toBe(IDS.va);
    const owner = await getSessionUser(asCookie('owner'), { db });
    expect(owner).toMatchObject({ kyneticRole: null, twoFactor: 'not_required' });
    const staff = await getSessionUser(asCookie('staff'), { db });
    expect(staff?.kyneticRole).toBeNull();
    expect(staff?.id).not.toBe(owner?.id);
  });

  it('ignores an unknown cookie value and a disabled user', async () => {
    const db = createDb(tdb.auth);
    expect((await getSessionUser(asCookie('root'), { db }))?.id).toBe(IDS.admin);
    await tdb.admin`update users set disabled_at = now() where id = ${IDS.admin}`;
    expect((await getSessionUser(asCookie('admin'), { db }))?.kyneticRole).toBe('va');
    await tdb.admin`update users set disabled_at = null where id = ${IDS.admin}`;
  });

  it('requireUser still throws only when the database has no users', async () => {
    const user = await requireUser(asCookie('owner'), { deps: { db: createDb(tdb.auth) } });
    expect(user.id).toBeTruthy();
  });
});
