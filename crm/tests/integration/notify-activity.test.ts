import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { activities, notifications } from '@/server/db/schema';
import { recordActivity } from '@/server/activity';
import {
  countMyUnread,
  listMyNotifications,
  markNotificationRead,
  notify
} from '@/server/notifications';
import { withTenant } from '@/server/tenancy';
import { ctx, IDS, seedTwoTenants, type SeededTenant } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let tdb: TestDatabase;
let db: Db;
let a: SeededTenant;
let b: SeededTenant;

beforeAll(async () => {
  tdb = await createTestDatabase();
  ({ a, b } = await seedTwoTenants(tdb.admin));
  db = createDb(tdb.app);
});
afterAll(async () => {
  await tdb?.drop();
});

class Rollback extends Error {}

describe('notify', () => {
  it('writes the row for the tenant in the context, in the caller transaction', async () => {
    const { id } = await withTenant(
      ctx.ownerA(),
      (tx) =>
        notify(tx, {
          userId: IDS.staffA,
          type: 'task_due',
          title: 'Call back due',
          link: '/tasks'
        }),
      { db }
    );
    const [row] = await tdb.admin`select * from notifications where id = ${id}`;
    expect(row).toMatchObject({
      tenant_id: IDS.tenantA,
      user_id: IDS.staffA,
      kind: 'task_due',
      title: 'Call back due',
      link: '/tasks',
      read_at: null
    });
  });

  it('rolls back with the caller transaction', async () => {
    await expect(
      withTenant(
        ctx.ownerA(),
        async (tx) => {
          await notify(tx, { userId: IDS.ownerA, type: 'booked', title: 'Rolled back' });
          throw new Rollback();
        },
        { db }
      )
    ).rejects.toBeInstanceOf(Rollback);
    const rows = await tdb.admin`select 1 from notifications where title = 'Rolled back'`;
    expect(rows).toHaveLength(0);
  });

  it('rejects an unknown type, an empty title and a user outside the tenant', async () => {
    await expect(
      withTenant(ctx.ownerA(), (tx) => notify(tx, { type: 'nope' as never, title: 'x' }), { db })
    ).rejects.toThrow();
    await expect(
      withTenant(ctx.ownerA(), (tx) => notify(tx, { type: 'booked', title: '  ' }), { db })
    ).rejects.toThrow();
    // ownerB has no membership in tenant A: the composite foreign key refuses it.
    await expect(
      withTenant(
        ctx.ownerA(),
        (tx) => notify(tx, { userId: IDS.ownerB, type: 'booked', title: 'Cross tenant' }),
        { db }
      )
    ).rejects.toThrow();
  });

  it('lets a user read only their own notifications and tenant-wide ones', async () => {
    await withTenant(
      ctx.ownerA(),
      async (tx) => {
        await notify(tx, { userId: IDS.ownerA, type: 'new_lead', title: 'For owner' });
        await notify(tx, { userId: IDS.staffA, type: 'new_lead', title: 'For staff' });
        await notify(tx, { type: 'report_ready', title: 'For every owner' });
      },
      { db }
    );
    const ownerTitles = (await withTenant(ctx.ownerA(), (tx) => listMyNotifications(tx), { db }))
      .map((r) => r.title)
      .sort();
    expect(ownerTitles).toContain('For owner');
    expect(ownerTitles).toContain('For every owner');
    expect(ownerTitles).not.toContain('For staff');
    const staffTitles = (
      await withTenant(ctx.staffA(), (tx) => listMyNotifications(tx), { db })
    ).map((r) => r.title);
    expect(staffTitles).toContain('For staff');
    expect(staffTitles).not.toContain('For owner');
  });

  it("marks read, drops the unread count, and refuses another user's row", async () => {
    const { id } = await withTenant(
      ctx.staffA(),
      (tx) => notify(tx, { userId: IDS.staffA, type: 'booked', title: 'Booked' }),
      { db }
    );
    const before = await withTenant(ctx.staffA(), (tx) => countMyUnread(tx), { db });
    expect(await withTenant(ctx.ownerA(), (tx) => markNotificationRead(tx, id), { db })).toBe(
      false
    );
    expect(await withTenant(ctx.staffA(), (tx) => markNotificationRead(tx, id), { db })).toBe(true);
    expect(await withTenant(ctx.staffA(), (tx) => countMyUnread(tx), { db })).toBe(before - 1);
  });

  it('does not show tenant A notifications to tenant B', async () => {
    const rows = await withTenant(ctx.ownerB(), (tx) => tx.select().from(notifications), { db });
    expect(rows.every((r) => r.tenantId === IDS.tenantB)).toBe(true);
  });
});

describe('recordActivity', () => {
  it('writes an activity row for the context tenant with the actor', async () => {
    const { id } = await withTenant(
      ctx.ownerA(),
      (tx) =>
        recordActivity(tx, {
          contactId: a.contactId,
          dealId: a.dealId,
          type: 'stage_change',
          refTable: 'deals',
          refId: a.dealId,
          summary: 'Moved to Estimate Booked',
          actor: { type: 'user', id: IDS.ownerA },
          meta: { from: 'New', to: 'Estimate Booked' }
        }),
      { db }
    );
    const [row] = await tdb.admin`select * from activities where id = ${id}`;
    expect(row).toMatchObject({
      tenant_id: IDS.tenantA,
      contact_id: a.contactId,
      deal_id: a.dealId,
      type: 'stage_change',
      ref_table: 'deals',
      summary: 'Moved to Estimate Booked',
      actor_type: 'user',
      actor_id: IDS.ownerA,
      meta: { from: 'New', to: 'Estimate Booked' }
    });
  });

  it('accepts a system actor with no id and an explicit time', async () => {
    const at = new Date('2026-10-01T12:00:00Z');
    const { id } = await withTenant(
      ctx.ownerA(),
      (tx) =>
        recordActivity(tx, {
          contactId: a.contactId,
          type: 'system',
          summary: 'Imported',
          actor: { type: 'system' },
          occurredAt: at
        }),
      { db }
    );
    const [row] = await tdb.admin`select actor_id, occurred_at from activities where id = ${id}`;
    expect(row.actor_id).toBeNull();
    expect(new Date(row.occurred_at as string).toISOString()).toBe(at.toISOString());
  });

  it('rolls back with the caller transaction', async () => {
    await expect(
      withTenant(
        ctx.ownerA(),
        async (tx) => {
          await recordActivity(tx, {
            contactId: a.contactId,
            type: 'note',
            summary: 'Rolled back activity',
            actor: { type: 'user', id: IDS.ownerA }
          });
          throw new Rollback();
        },
        { db }
      )
    ).rejects.toBeInstanceOf(Rollback);
    const rows = await tdb.admin`select 1 from activities where summary = 'Rolled back activity'`;
    expect(rows).toHaveLength(0);
  });

  it('refuses a contact from another tenant and invalid input', async () => {
    await expect(
      withTenant(
        ctx.ownerA(),
        (tx) =>
          recordActivity(tx, {
            contactId: b.contactId,
            type: 'note',
            summary: 'Cross tenant',
            actor: { type: 'user', id: IDS.ownerA }
          }),
        { db }
      )
    ).rejects.toThrow();
    await expect(
      withTenant(
        ctx.ownerA(),
        (tx) =>
          recordActivity(tx, { type: 'bogus' as never, summary: 'x', actor: { type: 'system' } }),
        { db }
      )
    ).rejects.toThrow();
    await expect(
      withTenant(
        ctx.ownerA(),
        (tx) => recordActivity(tx, { type: 'note', summary: '', actor: { type: 'system' } }),
        { db }
      )
    ).rejects.toThrow();
  });

  it('never exposes tenant B activities to tenant A', async () => {
    const rows = await withTenant(ctx.ownerA(), (tx) => tx.select().from(activities), { db });
    expect(rows.every((r) => r.tenantId === IDS.tenantA)).toBe(true);
  });
});
