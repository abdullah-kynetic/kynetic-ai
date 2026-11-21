import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Db } from '@/server/db/client';
import { stopJobs } from '@/server/jobs';
import { issueAdminKey } from '@/server/admin/admin-api-keys';
import { GET as flagsRoute } from '@/app/api/service/platform/runtime-flags/route';
import { PUT as roleRoute } from '@/app/api/service/platform/users/[id]/role/route';
import { IDS } from '../helpers/fixtures';
import { setupAgency } from '../helpers/agency';

// Read-only runtime flags, and the owner's own account is protected from role changes through the API.

let setup: Awaited<ReturnType<typeof setupAgency>>;
let adminKey: string;
const owner = { id: IDS.admin, kyneticRole: 'admin' as const };
const ownerEmail = 'admin@example.test';
const bearer = () => ({ authorization: `Bearer ${adminKey}`, 'content-type': 'application/json' });

beforeAll(async () => {
  setup = await setupAgency();
  await setup.test.admin`insert into users (id, email, kynetic_role, email_verified) values
    (${IDS.admin}, ${ownerEmail}, 'admin', true) on conflict (id) do update set email_verified = true`;
  (globalThis as typeof globalThis & { __kyneticDb?: Db }).__kyneticDb = setup.db;
  adminKey = (
    await issueAdminKey(owner, { label: 'rt', allowedCidrs: [] }, { db: setup.db, ownerEmail })
  ).key;
});
afterAll(async () => {
  await stopJobs();
  delete (globalThis as typeof globalThis & { __kyneticDb?: Db }).__kyneticDb;
  await setup?.close();
});

describe('service API runtime flags and owner protection (E)', () => {
  it('reads provider mode and outbound switch, read-only', async () => {
    const res = await flagsRoute(
      new Request('http://localhost/api/service/platform/runtime-flags', { headers: bearer() })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(['live', 'stub']).toContain(body.data.providerMode);
    expect(typeof body.data.outboundEnabled).toBe('boolean');
  });

  it('will not change the owner account role through the API', async () => {
    const res = await roleRoute(
      new Request(`http://localhost/api/service/platform/users/${IDS.admin}/role`, {
        method: 'PUT',
        headers: bearer(),
        body: JSON.stringify({ role: null })
      }),
      { params: Promise.resolve({ id: IDS.admin }) }
    );
    expect(res.status).toBe(403);
  });
});
