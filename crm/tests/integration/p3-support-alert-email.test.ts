import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FakeEmailProvider } from '@/server/adapters/email/fake';
import { createDb, type Db } from '@/server/db/client';
import {
  deliverNotificationEmail,
  notify,
  setMyPreferences,
  type NotificationType
} from '@/server/notifications';
import { withTenant } from '@/server/tenancy';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

// P3-5: support alerts email nobody unless the server flag and the person's setting are both on.

let tdb: TestDatabase;
let db: Db;
let workerDb: Db;
const noQueue = async () => undefined;
const deps = (provider: FakeEmailProvider, supportEnabled: boolean) => ({
  db: workerDb,
  provider,
  fromAddress: 'notifications@mail.example.test',
  baseUrl: 'https://portal.example.test',
  supportEnabled
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

async function reply(type: NotificationType = 'support_reply') {
  const { id } = await withTenant(
    ctx.ownerA(),
    (tx) =>
      notify(
        tx,
        { userId: IDS.ownerA, type, title: 'Kynetic replied', body: 'hello' },
        { enqueueEmail: noQueue }
      ),
    { db }
  );
  return { tenantId: IDS.tenantA, notificationId: id };
}

describe('support alert email', () => {
  it('sends nothing when the server flag is off, even if the person turned it on', async () => {
    await setMyPreferences(
      ctx.ownerA(),
      { preferences: [{ kind: 'support_reply', emailEnabled: true }] },
      { db }
    );
    const p = new FakeEmailProvider();
    expect(await deliverNotificationEmail(await reply(), deps(p, false))).toBe(0);
    expect(p.sent).toHaveLength(0);
  });

  it('sends nothing when the flag is on but the person kept the setting off', async () => {
    await setMyPreferences(
      ctx.ownerA(),
      { preferences: [{ kind: 'support_reply', emailEnabled: false }] },
      { db }
    );
    const p = new FakeEmailProvider();
    expect(await deliverNotificationEmail(await reply(), deps(p, true))).toBe(0);
    expect(p.sent).toHaveLength(0);
  });

  it('sends one email when both are on', async () => {
    await setMyPreferences(
      ctx.ownerA(),
      { preferences: [{ kind: 'support_reply', emailEnabled: true }] },
      { db }
    );
    const p = new FakeEmailProvider();
    expect(await deliverNotificationEmail(await reply(), deps(p, true))).toBe(1);
    expect(p.sent[0]).toMatchObject({ to: 'owner-a@example.test', subject: 'Kynetic replied' });
  });

  it('never emails the staff alert about a new request to client users', async () => {
    await setMyPreferences(
      ctx.ownerA(),
      { preferences: [{ kind: 'support_request', emailEnabled: true }] },
      { db }
    );
    const p = new FakeEmailProvider();
    expect(await deliverNotificationEmail(await reply('support_request'), deps(p, true))).toBe(0);
    expect(p.sent).toHaveLength(0);
  });
});
