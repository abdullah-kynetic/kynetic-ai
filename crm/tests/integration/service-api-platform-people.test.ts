import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Db } from '@/server/db/client';
import { stopJobs } from '@/server/jobs';
import { issueAdminKey } from '@/server/admin/admin-api-keys';
import { GET as usersRoute } from '@/app/api/service/platform/users/route';
import { POST as deactivateRoute } from '@/app/api/service/platform/users/[id]/deactivate/route';
import { POST as reactivateRoute } from '@/app/api/service/platform/users/[id]/reactivate/route';
import { PUT as roleRoute } from '@/app/api/service/platform/users/[id]/role/route';
import { GET as supportRoute } from '@/app/api/service/platform/support/route';
import { GET as auditRoute } from '@/app/api/service/platform/audit/route';
import { GET as backupsRoute, POST as backupRun } from '@/app/api/service/platform/backups/route';
import { IDS } from '../helpers/fixtures';
import { setupAgency } from '../helpers/agency';

// E4: staff users, support queue, audit search and backups, through the owner's admin key. Your own
// account cannot be changed here. The audit search never returns key hashes.

let setup: Awaited<ReturnType<typeof setupAgency>>;
let adminKey: string;
const STAFF_ID = 'dddddddd-0000-4000-8000-000000000001';
const owner = { id: IDS.admin, kyneticRole: 'admin' as const };
const ownerEmail = 'admin@example.test';
const bearer = () => ({ authorization: `Bearer ${adminKey}`, 'content-type': 'application/json' });
const ctxId = (id: string) => ({ params: Promise.resolve({ id }) });

beforeAll(async () => {
  setup = await setupAgency();
  await setup.test.admin`insert into users (id, email, kynetic_role, email_verified) values
    (${IDS.admin}, ${ownerEmail}, 'admin', true) on conflict (id) do update set email_verified = true`;
  await setup.test.admin`insert into users (id, email, kynetic_role, email_verified) values
    (${STAFF_ID}, 'staff-e4@example.test', 'va', true) on conflict (id) do nothing`;
  (globalThis as typeof globalThis & { __kyneticDb?: Db }).__kyneticDb = setup.db;
  adminKey = (
    await issueAdminKey(owner, { label: 'e4', allowedCidrs: [] }, { db: setup.db, ownerEmail })
  ).key;
});
afterAll(async () => {
  await stopJobs();
  delete (globalThis as typeof globalThis & { __kyneticDb?: Db }).__kyneticDb;
  await setup?.close();
});

describe('service API platform staff, support, audit and backups (E4)', () => {
  it('lists staff users and deactivates and reactivates one, idempotently', async () => {
    const list = await usersRoute(
      new Request('http://localhost/api/service/platform/users', { headers: bearer() })
    );
    expect(list.status).toBe(200);
    const off = await deactivateRoute(
      new Request(`http://localhost/api/service/platform/users/${STAFF_ID}/deactivate`, {
        method: 'POST',
        headers: bearer()
      }),
      ctxId(STAFF_ID)
    );
    expect(off.status).toBe(200);
    const offAgain = await deactivateRoute(
      new Request(`http://localhost/api/service/platform/users/${STAFF_ID}/deactivate`, {
        method: 'POST',
        headers: bearer()
      }),
      ctxId(STAFF_ID)
    );
    expect(offAgain.status).toBe(200);
    const on = await reactivateRoute(
      new Request(`http://localhost/api/service/platform/users/${STAFF_ID}/reactivate`, {
        method: 'POST',
        headers: bearer()
      }),
      ctxId(STAFF_ID)
    );
    expect(on.status).toBe(200);
  });

  it('refuses to change the role of your own account', async () => {
    const res = await roleRoute(
      new Request(`http://localhost/api/service/platform/users/${IDS.admin}/role`, {
        method: 'PUT',
        headers: bearer(),
        body: JSON.stringify({ role: 'va' })
      }),
      ctxId(IDS.admin)
    );
    expect(res.status).toBe(403);
  });

  it('reads the support queue, backups, and queues a backup', async () => {
    const support = await supportRoute(
      new Request('http://localhost/api/service/platform/support', { headers: bearer() })
    );
    expect(support.status).toBe(200);
    const backups = await backupsRoute(
      new Request('http://localhost/api/service/platform/backups', { headers: bearer() })
    );
    expect(backups.status).toBe(200);
    const run = await backupRun(
      new Request('http://localhost/api/service/platform/backups', {
        method: 'POST',
        headers: bearer()
      })
    );
    expect(run.status).toBe(202);
  });

  it('searches the audit log and never returns key hashes', async () => {
    const res = await auditRoute(
      new Request('http://localhost/api/service/platform/audit?page=1', { headers: bearer() })
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toMatch(/key_hash|keyHash/);
  });
});
