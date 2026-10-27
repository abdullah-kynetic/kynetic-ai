import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FakeEmailProvider } from '@/server/adapters/email/fake';
import { createDb, type Db } from '@/server/db/client';
import {
  countMyUnread,
  deliverNotificationEmail,
  listMyNotifications,
  markAllMyNotificationsRead,
  markNotificationRead,
  notify,
  NOTIFICATION_TABS
} from '@/server/notifications';
import { withTenant } from '@/server/tenancy';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let tdb: TestDatabase;
let db: Db;
let workerDb: Db;
const queued: { tenantId: string; notificationId: string }[] = [];
const enqueueEmail = async (_tx: unknown, n: { tenantId: string; notificationId: string }) => {
  queued.push(n);
};
const deps = (provider: FakeEmailProvider) => ({
  db: workerDb,
  provider,
  fromAddress: 'notifications@mail.example.test',
  baseUrl: 'https://portal.example.test'
});

beforeAll(async () => {
  tdb = await createTestDatabase();
  await seedTwoTenants(tdb.admin);
  db = createDb(tdb.app);
  workerDb = createDb(tdb.worker);
});
afterAll(async () => {
  await tdb?.drop();
});

describe('F-35 notifications (M7-04)', () => {
  it('a new lead raises the unread count by one, and opening it lowers it', async () => {
    const before = await withTenant(ctx.ownerA(), countMyUnread, { db });
    const { id } = await withTenant(
      ctx.ownerA(),
      (tx) =>
        notify(
          tx,
          { userId: IDS.ownerA, type: 'new_lead', title: 'M7-04 lead', link: '/leads' },
          { enqueueEmail }
        ),
      { db }
    );
    expect(await withTenant(ctx.ownerA(), countMyUnread, { db })).toBe(before + 1);
    expect(await withTenant(ctx.ownerA(), (tx) => markNotificationRead(tx, id), { db })).toBe(true);
    expect(await withTenant(ctx.ownerA(), countMyUnread, { db })).toBe(before);
  });

  it('queues the email job with the notification, in the same transaction', async () => {
    queued.length = 0;
    const { id } = await withTenant(
      ctx.ownerA(),
      (tx) => notify(tx, { userId: IDS.ownerA, type: 'booked', title: 'Booked' }, { enqueueEmail }),
      { db }
    );
    expect(queued).toEqual([{ tenantId: IDS.tenantA, notificationId: id }]);
  });

  it('user A cannot read or mark user B notifications (own only)', async () => {
    const { id } = await withTenant(
      ctx.staffA(),
      (tx) =>
        notify(tx, { userId: IDS.staffA, type: 'task_due', title: 'Staff only' }, { enqueueEmail }),
      { db }
    );
    const ownerSees = await withTenant(
      ctx.ownerA(),
      (tx) => listMyNotifications(tx, { limit: 200 }),
      { db }
    );
    expect(ownerSees.some((n) => n.id === id)).toBe(false);
    expect(await withTenant(ctx.ownerA(), (tx) => markNotificationRead(tx, id), { db })).toBe(
      false
    );
  });

  it('tenant B never sees tenant A notifications', async () => {
    const seen = await withTenant(ctx.ownerB(), (tx) => listMyNotifications(tx, { limit: 200 }), {
      db
    });
    expect(seen.every((n) => n.tenantId === IDS.tenantB)).toBe(true);
    expect(seen.some((n) => n.title === 'M7-04 lead')).toBe(false);
  });

  it('tabs filter by type, and unread filters by read state', async () => {
    await withTenant(
      ctx.staffA(),
      async (tx) => {
        await notify(tx, { userId: IDS.staffA, type: 'hot_lead', title: 'Hot' }, { enqueueEmail });
        await notify(
          tx,
          { userId: IDS.staffA, type: 'report_ready', title: 'Report' },
          { enqueueEmail }
        );
      },
      { db }
    );
    const leads = await withTenant(
      ctx.staffA(),
      (tx) => listMyNotifications(tx, { kinds: NOTIFICATION_TABS.leads.kinds }),
      { db }
    );
    expect(leads.map((n) => n.kind)).toContain('hot_lead');
    expect(leads.every((n) => ['new_lead', 'hot_lead'].includes(n.kind))).toBe(true);
    const changed = await withTenant(ctx.staffA(), markAllMyNotificationsRead, { db });
    expect(changed).toBeGreaterThan(0);
    expect(
      await withTenant(ctx.staffA(), (tx) => listMyNotifications(tx, { unreadOnly: true }), { db })
    ).toEqual([]);
  });

  it('emails the addressed user through the adapter, once even if the job retries', async () => {
    const { id } = await withTenant(
      ctx.ownerA(),
      (tx) =>
        notify(
          tx,
          {
            userId: IDS.staffA,
            type: 'task_due',
            title: 'Call back due',
            body: 'Smith <b>',
            link: '/tasks'
          },
          { enqueueEmail }
        ),
      { db }
    );
    const provider = new FakeEmailProvider();
    const job = { tenantId: IDS.tenantA, notificationId: id };
    expect(await deliverNotificationEmail(job, deps(provider))).toBe(1);
    await deliverNotificationEmail(job, deps(provider));
    expect(provider.sent).toHaveLength(1);
    const mail = provider.sent[0];
    expect(mail).toMatchObject({
      to: 'staff-a@example.test',
      fromName: 'Tenant A',
      fromAddress: 'notifications@mail.example.test',
      subject: 'Call back due'
    });
    expect(mail.text).toContain('https://portal.example.test/tasks');
    expect(mail.html).toContain('Smith &lt;b&gt;');
  });

  it('a notification for every owner emails the owners and not staff', async () => {
    const { id } = await withTenant(
      ctx.ownerA(),
      (tx) => notify(tx, { type: 'report_ready', title: 'Report ready' }, { enqueueEmail }),
      { db }
    );
    const provider = new FakeEmailProvider();
    await deliverNotificationEmail({ tenantId: IDS.tenantA, notificationId: id }, deps(provider));
    expect(provider.sent.map((m) => m.to)).toEqual(['owner-a@example.test']);
  });

  it('a job for another tenant id sends nothing', async () => {
    const { id } = await withTenant(
      ctx.ownerA(),
      (tx) => notify(tx, { userId: IDS.ownerA, type: 'booked', title: 'A only' }, { enqueueEmail }),
      { db }
    );
    const provider = new FakeEmailProvider();
    expect(
      await deliverNotificationEmail({ tenantId: IDS.tenantB, notificationId: id }, deps(provider))
    ).toBe(0);
    expect(provider.sent).toEqual([]);
  });
});
