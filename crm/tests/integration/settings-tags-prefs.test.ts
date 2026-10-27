import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FakeEmailProvider } from '@/server/adapters/email/fake';
import type { Actor } from '@/server/auth/permissions';
import { addContactTags, createContact, getContact } from '@/server/contacts';
import { createDb, type Db } from '@/server/db/client';
import { AppError, ValidationError } from '@/server/errors';
import {
  deliverNotificationEmail,
  listMyPreferences,
  notify,
  setMyPreferences
} from '@/server/notifications';
import { stopJobs } from '@/server/jobs';
import { createTag, deleteTag, listTags, renameTag } from '@/server/settings';
import { withTenant } from '@/server/tenancy';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let tdb: TestDatabase;
let opts: { db: Db };
let workerDb: Db;

const actorOf = (role: 'owner' | 'staff'): Actor => ({
  userId: role === 'owner' ? IDS.ownerA : IDS.staffA,
  kyneticRole: null,
  membership: { tenantId: IDS.tenantA, role, canExport: false, canBulkDelete: false },
  viewAs: null
});
const owner = () => actorOf('owner');
const names = (rows: { name: string }[]) => rows.map((r) => r.name);

beforeAll(async () => {
  tdb = await createTestDatabase({ jobs: true });
  await seedTwoTenants(tdb.admin);
  await tdb.admin`insert into tenant_modules (tenant_id, module_key, enabled, level) values (${IDS.tenantA}, 'crm', true, 'lite')`;
  opts = { db: createDb(tdb.app) };
  workerDb = createDb(tdb.worker);
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

describe('M9-11 tag settings (F-43)', () => {
  it('a new tag can be applied to a contact and shows its count', async () => {
    await createTag(ctx.ownerA(), owner(), { name: 'Priority' }, opts);
    expect(await listTags(ctx.ownerA(), opts)).toContainEqual({
      name: 'Priority',
      contactCount: 0,
      registered: true
    });
    const c = await createContact(
      ctx.ownerA(),
      { firstName: 'Tag Test', phones: ['+14155550101'] },
      opts
    );
    await addContactTags(ctx.ownerA(), c.id, ['priority', 'roof'], opts);
    const rows = await listTags(ctx.ownerA(), opts);
    expect(rows.find((r) => r.name === 'Priority')).toMatchObject({
      contactCount: 1,
      registered: true
    });
    expect(rows.find((r) => r.name === 'roof')).toMatchObject({
      contactCount: 1,
      registered: false
    });
  });

  it('refuses a duplicate tag ignoring case', async () => {
    await expect(createTag(ctx.ownerA(), owner(), { name: 'vip' }, opts)).rejects.toBeInstanceOf(
      ValidationError
    );
  });

  it('rename rewrites contacts, and renaming onto another tag merges without repeats', async () => {
    const c = await createContact(
      ctx.ownerA(),
      { firstName: 'Both', phones: ['+14155550102'], tags: ['Old', 'New'] },
      opts
    );
    const d = await createContact(
      ctx.ownerA(),
      { firstName: 'One', phones: ['+14155550103'], tags: ['old'] },
      opts
    );
    await renameTag(ctx.ownerA(), owner(), { from: 'Old', to: 'New' }, opts);
    expect((await getContact(ctx.ownerA(), c.id, opts)).tags).toEqual(['New']);
    expect((await getContact(ctx.ownerA(), d.id, opts)).tags).toEqual(['New']);
    expect(names(await listTags(ctx.ownerA(), opts))).not.toContain('Old');
  });

  it('delete removes the tag from contacts and the registry, contacts stay', async () => {
    const c = await createContact(
      ctx.ownerA(),
      { firstName: 'Del', phones: ['+14155550104'], tags: ['gone', 'keep'] },
      opts
    );
    await createTag(ctx.ownerA(), owner(), { name: 'gone' }, opts).catch(() => undefined);
    await deleteTag(ctx.ownerA(), owner(), { name: 'GONE' }, opts);
    expect((await getContact(ctx.ownerA(), c.id, opts)).tags).toEqual(['keep']);
    expect(names(await listTags(ctx.ownerA(), opts))).not.toContain('gone');
    await expect(deleteTag(ctx.ownerA(), owner(), { name: 'gone' }, opts)).rejects.toMatchObject({
      code: 'NOT_FOUND'
    });
  });

  it('is owner and admin only, needs CRM Lite, and is tenant scoped', async () => {
    await expect(
      createTag(ctx.staffA(), actorOf('staff'), { name: 'x' }, opts)
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(listTags(ctx.ownerB(), opts)).rejects.toBeInstanceOf(AppError);
    const audit = await tdb.admin`select action from audit_log where tenant_id = ${IDS.tenantA}
      and action like 'tag.%'`;
    expect(audit.map((r) => r.action)).toEqual(
      expect.arrayContaining(['tag.create', 'tag.rename', 'tag.delete'])
    );
  });
});

describe('M9-11 notification preferences (F-36)', () => {
  const enqueueEmail = async () => undefined;
  const send = async (userId: string, type: 'new_lead' | 'booked' | 'task_due' | 'task_due') => {
    const { id } = await withTenant(
      ctx.ownerA(),
      (tx) => notify(tx, { userId, type, title: `T ${type}` }, { enqueueEmail }),
      opts
    );
    const provider = new FakeEmailProvider();
    const sent = await deliverNotificationEmail(
      { tenantId: IDS.tenantA, notificationId: id },
      {
        db: workerDb,
        provider,
        fromAddress: 'n@mail.example.test',
        baseUrl: 'https://p.example.test'
      }
    );
    return { sent, provider };
  };

  it('defaults to email on for every type', async () => {
    const prefs = await listMyPreferences(ctx.staffA(), opts);
    expect(prefs.length).toBe(7);
    expect(prefs.every((p) => p.emailEnabled)).toBe(true);
  });

  it('delivery follows the preference: off skips the email, other types still send', async () => {
    await setMyPreferences(
      ctx.staffA(),
      { preferences: [{ kind: 'new_lead', emailEnabled: false }] },
      opts
    );
    expect((await send(IDS.staffA, 'new_lead')).sent).toBe(0);
    expect((await send(IDS.staffA, 'booked')).sent).toBe(1);
    await setMyPreferences(
      ctx.staffA(),
      { preferences: [{ kind: 'new_lead', emailEnabled: true }] },
      opts
    );
    expect((await send(IDS.staffA, 'new_lead')).sent).toBe(1);
  });

  it("one user's choice never changes another user's", async () => {
    await setMyPreferences(
      ctx.staffA(),
      { preferences: [{ kind: 'task_due', emailEnabled: false }] },
      opts
    );
    expect(
      (await listMyPreferences(ctx.ownerA(), opts)).find((p) => p.kind === 'task_due')?.emailEnabled
    ).toBe(true);
  });

  it('an owner broadcast skips only the owners who opted out', async () => {
    await setMyPreferences(
      ctx.ownerA(),
      { preferences: [{ kind: 'new_lead', emailEnabled: false }] },
      opts
    );
    const { id } = await withTenant(
      ctx.ownerA(),
      (tx) => notify(tx, { type: 'new_lead', title: 'All owners' }, { enqueueEmail }),
      opts
    );
    const sent = await deliverNotificationEmail(
      { tenantId: IDS.tenantA, notificationId: id },
      {
        db: workerDb,
        provider: new FakeEmailProvider(),
        fromAddress: 'n@mail.example.test',
        baseUrl: 'https://p.example.test'
      }
    );
    expect(sent).toBe(0);
  });

  it('rejects an unknown type', async () => {
    await expect(
      setMyPreferences(
        ctx.ownerA(),
        { preferences: [{ kind: 'nope' as never, emailEnabled: true }] },
        opts
      )
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
