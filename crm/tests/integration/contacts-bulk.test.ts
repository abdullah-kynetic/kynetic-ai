import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Actor } from '@/server/auth/permissions';
import {
  BULK_MAX_CONTACTS,
  bulkCapabilities,
  bulkUpdateContacts,
  type BulkContactsInput,
  createContact,
  getContact,
  NotFoundError
} from '@/server/contacts';
import { createDb, type Db } from '@/server/db/client';
import { ValidationError } from '@/server/errors';
import { stopJobs } from '@/server/jobs';
import type { TenantContextInput } from '@/server/tenancy';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let tdb: TestDatabase;
let opts: { db: Db };

beforeAll(async () => {
  tdb = await createTestDatabase({ jobs: true });
  await seedTwoTenants(tdb.admin);
  opts = { db: createDb(tdb.app) };
  process.env.APP_BASE_URL = 'http://localhost:3000';
  process.env.DATABASE_URL = tdb.urls.app;
  process.env.DATABASE_URL_WORKER = tdb.urls.worker;
  process.env.DATABASE_URL_AUTH = tdb.authUrl;
  process.env.BETTER_AUTH_SECRET = 'x'.repeat(32);
  process.env.APP_ENCRYPTION_KEY = 'y'.repeat(32);
});
afterAll(async () => {
  await stopJobs();
  await tdb?.drop();
});

const setCrm = async (tenantId: string, enabled: boolean, level: 'lite' | 'full') => {
  await tdb.admin`insert into tenant_modules (tenant_id, module_key, enabled, level)
    values (${tenantId}, 'crm', ${enabled}, ${level})
    on conflict (tenant_id, module_key) do update set enabled = excluded.enabled, level = excluded.level`;
};

const member = (
  tenantId: string,
  userId: string,
  role: 'owner' | 'staff',
  flags: { canBulkDelete?: boolean } = {}
): Actor => ({
  userId,
  kyneticRole: null,
  membership: {
    tenantId,
    role,
    canExport: false,
    canBulkDelete: flags.canBulkDelete ?? false
  },
  viewAs: null
});
const ownerA = () => member(IDS.tenantA, IDS.ownerA, 'owner');
const staffA = (canBulkDelete = false) =>
  member(IDS.tenantA, IDS.staffA, 'staff', { canBulkDelete });

let n = 0;
async function makeContacts(count: number, tenant: TenantContextInput = ctx.ownerA()) {
  const rows = [];
  for (let i = 0; i < count; i++) {
    const k = String(++n).padStart(4, '0');
    rows.push(
      await createContact(
        tenant,
        { firstName: `Bulk${k}`, phones: [`+1415555${k}`], tags: ['seed'] },
        opts
      )
    );
  }
  return rows;
}
const auditRows = (action: string) =>
  tdb.admin`select * from audit_log where action = ${action} order by created_at`;

describe('M1-07 bulk actions (F-08)', () => {
  it('F-08: assigns an owner to 20 selected contacts in one audited operation', async () => {
    await setCrm(IDS.tenantA, true, 'full');
    const rows = await makeContacts(20);
    const ids = rows.map((r) => r.id);
    const res = await bulkUpdateContacts(
      ctx.ownerA(),
      ownerA(),
      { ids, action: { type: 'owner', ownerId: IDS.staffA } },
      opts
    );
    expect(res).toMatchObject({ type: 'owner', requested: 20, changed: 20 });
    for (const id of ids) {
      expect((await getContact(ctx.ownerA(), id, opts)).ownerId).toBe(IDS.staffA);
    }
    const [bulk, ...rest] = await auditRows('contact.bulk.owner');
    expect(rest).toHaveLength(0);
    expect(bulk.actor_user_id).toBe(IDS.ownerA);
    expect((bulk.after as { contactIds: string[] }).contactIds.sort()).toEqual([...ids].sort());
    // Each contact also keeps its own history row.
    const per = await tdb.admin`select entity_id from audit_log
      where action = 'contact.update' and entity_id = any(${ids})`;
    expect(per).toHaveLength(20);
  });

  it('tags: adds and removes (ignoring case); an already-tagged contact does not count as changed', async () => {
    const [a, b] = await makeContacts(2);
    await bulkUpdateContacts(
      ctx.ownerA(),
      ownerA(),
      { ids: [a.id], action: { type: 'tag', add: ['VIP'], remove: [] } },
      opts
    );
    const res = await bulkUpdateContacts(
      ctx.ownerA(),
      ownerA(),
      {
        ids: [a.id, b.id],
        action: { type: 'tag', add: ['vip'], remove: ['SEED'] }
      },
      opts
    );
    expect(res.changed).toBe(2);
    expect((await getContact(ctx.ownerA(), a.id, opts)).tags).toEqual(['VIP']);
    expect((await getContact(ctx.ownerA(), b.id, opts)).tags).toEqual(['vip']);
  });

  it('status: changes status and skips rows already in it', async () => {
    const [a, b] = await makeContacts(2);
    await bulkUpdateContacts(
      ctx.ownerA(),
      ownerA(),
      { ids: [a.id], action: { type: 'status', status: 'working' } },
      opts
    );
    const res = await bulkUpdateContacts(
      ctx.ownerA(),
      ownerA(),
      { ids: [a.id, b.id], action: { type: 'status', status: 'working' } },
      opts
    );
    expect(res).toMatchObject({ requested: 2, changed: 1 });
  });

  it('delete: soft-deletes every selected contact and emits contact.deleted for each', async () => {
    const rows = await makeContacts(3);
    const ids = rows.map((r) => r.id);
    const res = await bulkUpdateContacts(
      ctx.ownerA(),
      ownerA(),
      { ids, action: { type: 'delete' } },
      opts
    );
    expect(res.changed).toBe(3);
    for (const id of ids) {
      await expect(getContact(ctx.ownerA(), id, opts)).rejects.toBeInstanceOf(NotFoundError);
    }
    const ev = await tdb.admin`select data from pgboss.job
      where name = 'event.dispatch' and data->>'name' = 'contact.deleted'`;
    const deleted = new Set(
      ev.map((e) => (e.data as { payload: { contactId: string } }).payload.contactId)
    );
    for (const id of ids) expect(deleted.has(id)).toBe(true);
    expect(await auditRows('contact.bulk.delete')).toHaveLength(1);
  });

  it('SEC-T-10: staff without the bulk-delete toggle is refused; with it, allowed', async () => {
    const [a] = await makeContacts(1);
    await expect(
      bulkUpdateContacts(
        ctx.staffA(),
        staffA(false),
        { ids: [a.id], action: { type: 'delete' } },
        opts
      )
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(await getContact(ctx.ownerA(), a.id, opts)).toBeTruthy();
    // Staff may still tag, assign and change status.
    await expect(
      bulkUpdateContacts(
        ctx.staffA(),
        staffA(false),
        { ids: [a.id], action: { type: 'status', status: 'booked' } },
        opts
      )
    ).resolves.toMatchObject({ changed: 1 });
    await expect(
      bulkUpdateContacts(
        ctx.staffA(),
        staffA(true),
        { ids: [a.id], action: { type: 'delete' } },
        opts
      )
    ).resolves.toMatchObject({ changed: 1 });
  });

  it('a Kynetic VA and an actor outside the tenant are refused', async () => {
    const [a] = await makeContacts(1);
    const va: Actor = {
      userId: IDS.va,
      kyneticRole: 'va',
      membership: null,
      viewAs: null
    };
    const input = {
      ids: [a.id],
      action: { type: 'status', status: 'lost' }
    } satisfies BulkContactsInput;
    await expect(bulkUpdateContacts(ctx.ownerA(), va, input, opts)).rejects.toMatchObject({
      code: 'FORBIDDEN'
    });
    await expect(
      bulkUpdateContacts(ctx.ownerA(), member(IDS.tenantB, IDS.ownerB, 'owner'), input, opts)
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('is all or nothing: one unknown, deleted or other-tenant id fails the whole call', async () => {
    const [a, b] = await makeContacts(2);
    const [other] = await makeContacts(1, ctx.ownerB());
    const input = (ids: string[]) =>
      ({ ids, action: { type: 'status', status: 'dead' } }) satisfies BulkContactsInput;
    await expect(
      bulkUpdateContacts(ctx.ownerA(), ownerA(), input([a.id, other.id]), opts)
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      bulkUpdateContacts(ctx.ownerA(), ownerA(), input([a.id, crypto.randomUUID()]), opts)
    ).rejects.toBeInstanceOf(NotFoundError);
    await bulkUpdateContacts(
      ctx.ownerA(),
      ownerA(),
      { ids: [b.id], action: { type: 'delete' } },
      opts
    );
    await expect(
      bulkUpdateContacts(ctx.ownerA(), ownerA(), input([a.id, b.id]), opts)
    ).rejects.toBeInstanceOf(NotFoundError);
    expect((await getContact(ctx.ownerA(), a.id, opts)).status).toBe('new');
    expect((await getContact(ctx.ownerB(), other.id, opts)).status).toBe('new');
  });

  it('rejects an owner who is not a member, an empty list, too many ids, and unknown keys', async () => {
    const [a] = await makeContacts(1);
    await expect(
      bulkUpdateContacts(
        ctx.ownerA(),
        ownerA(),
        {
          ids: [a.id],
          action: { type: 'owner', ownerId: crypto.randomUUID() }
        },
        opts
      )
    ).rejects.toMatchObject({ fieldErrors: { ownerId: ['not_a_member'] } });
    const bad = (body: unknown) => bulkUpdateContacts(ctx.ownerA(), ownerA(), body as never, opts);
    await expect(bad({ ids: [], action: { type: 'delete' } })).rejects.toBeInstanceOf(
      ValidationError
    );
    await expect(
      bad({
        ids: Array.from({ length: BULK_MAX_CONTACTS + 1 }, () => crypto.randomUUID()),
        action: { type: 'delete' }
      })
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      bad({ ids: [a.id], action: { type: 'status', status: 'nope' } })
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      bad({ ids: [a.id], action: { type: 'delete' }, tenantId: IDS.tenantB })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('enrol-in-sequence is a stub: it reports not_available and writes nothing', async () => {
    const [a] = await makeContacts(1);
    const res = await bulkUpdateContacts(
      ctx.ownerA(),
      ownerA(),
      { ids: [a.id], action: { type: 'enroll', sequenceKey: 'speed_to_lead' } },
      opts
    );
    expect(res).toEqual({
      type: 'enroll',
      requested: 1,
      changed: 0,
      enroll: { status: 'not_available' }
    });
    expect(await auditRows('contact.bulk.enroll')).toHaveLength(0);
  });

  it('F-85: CRM Lite and no CRM are refused with MODULE_DISABLED and nothing is written', async () => {
    const [a] = await makeContacts(1);
    const input = {
      ids: [a.id],
      action: { type: 'status', status: 'won' }
    } satisfies BulkContactsInput;
    for (const [enabled, level] of [
      [true, 'lite'],
      [false, 'full']
    ] as const) {
      await setCrm(IDS.tenantA, enabled, level);
      await expect(bulkUpdateContacts(ctx.ownerA(), ownerA(), input, opts)).rejects.toMatchObject({
        code: 'MODULE_DISABLED',
        status: 403
      });
      expect(await bulkCapabilities(ctx.ownerA(), ownerA(), opts)).toEqual({
        edit: false,
        delete: false,
        enroll: false
      });
    }
    expect((await getContact(ctx.ownerA(), a.id, opts)).status).toBe('new');
    // Tenant B never had the module and A's flag does not leak across.
    await setCrm(IDS.tenantA, true, 'full');
    const [b] = await makeContacts(1, ctx.ownerB());
    await expect(
      bulkUpdateContacts(
        ctx.ownerB(),
        member(IDS.tenantB, IDS.ownerB, 'owner'),
        { ids: [b.id], action: { type: 'status', status: 'won' } },
        opts
      )
    ).rejects.toMatchObject({ code: 'MODULE_DISABLED' });
  });

  it('capabilities follow the matrix: staff sees delete only with the toggle', async () => {
    await setCrm(IDS.tenantA, true, 'full');
    expect(await bulkCapabilities(ctx.ownerA(), ownerA(), opts)).toEqual({
      edit: true,
      delete: true,
      enroll: true
    });
    expect(await bulkCapabilities(ctx.staffA(), staffA(false), opts)).toMatchObject({
      edit: true,
      delete: false
    });
    expect(await bulkCapabilities(ctx.staffA(), staffA(true), opts)).toMatchObject({
      delete: true
    });
  });
});
