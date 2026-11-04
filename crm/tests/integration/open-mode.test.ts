import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getSessionUser, requireUser } from '@/server/auth';
import { createDb } from '@/server/db/client';
import { decideAdminAccess } from '@/server/admin';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { seedTwoTenants } from '../helpers/fixtures';

// Regression: seeded privileged users never become anonymous identities.
let tdb: TestDatabase;
const asCookie = (persona?: string) =>
  new Headers(persona ? { cookie: `kynetic_open_as=${persona}` } : {});

beforeAll(async () => {
  tdb = await createTestDatabase();
  await seedTwoTenants(tdb.admin);
});
afterAll(async () => tdb?.drop());

describe('persona cookies do not authenticate', () => {
  it.each([undefined, 'admin', 'va', 'owner', 'staff', 'root', '%invalid'])(
    'requires a session despite existing users and cookie %s',
    async (persona) => {
      const db = createDb(tdb.auth);
      expect(await getSessionUser(asCookie(persona), { db })).toBeNull();
      expect(
        await decideAdminAccess(asCookie(persona), {
          getUser: (h) => getSessionUser(h, { db })
        })
      ).toEqual({ kind: 'sign_in' });
      await expect(requireUser(asCookie(persona), { deps: { db } })).rejects.toThrow(
        'Not signed in'
      );
    }
  );
});
