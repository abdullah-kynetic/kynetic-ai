import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { listActivities, recordActivity, type ActivityType } from '@/server/activity';
import { createContact } from '@/server/contacts';
import { ValidationError } from '@/server/errors';
import { stopJobs } from '@/server/jobs';
import { withTenant } from '@/server/tenancy';
import { ctx, IDS, seedTwoTenants, type SeededTenant } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let tdb: TestDatabase;
let opts: { db: Db };
let a: SeededTenant;
let b: SeededTenant;
let contactId: string;

const at = (minutes: number) => new Date(Date.UTC(2026, 9, 1, 12, minutes));

async function add(
  type: ActivityType,
  minute: number,
  actor: { type: 'user' | 'alex' | 'automation' | 'system'; id?: string },
  target: { contactId?: string; dealId?: string } = { contactId }
) {
  return withTenant(
    ctx.ownerA(),
    (tx) =>
      recordActivity(tx, {
        ...target,
        type,
        summary: `${type} at ${minute}`,
        actor,
        occurredAt: at(minute)
      }),
    opts
  );
}

beforeAll(async () => {
  tdb = await createTestDatabase({ jobs: true });
  ({ a, b } = await seedTwoTenants(tdb.admin));
  opts = { db: createDb(tdb.app) };
  process.env.APP_BASE_URL = 'http://localhost:3000';
  process.env.DATABASE_URL = tdb.urls.app;
  process.env.DATABASE_URL_WORKER = tdb.urls.worker;
  process.env.DATABASE_URL_AUTH = tdb.authUrl;
  process.env.BETTER_AUTH_SECRET = 'x'.repeat(32);
  process.env.APP_ENCRYPTION_KEY = 'y'.repeat(32);
  contactId = (
    await createContact(ctx.ownerA(), { firstName: 'Tim', phones: ['415-555-0141'] }, opts)
  ).id;
  await tdb.admin`update users set name = 'Owen Owner' where id = ${IDS.ownerA}`;
  await add('call', 1, { type: 'alex' });
  await add('sms', 2, { type: 'alex' });
  await add('note', 3, { type: 'user', id: IDS.ownerA });
  await add('stage_change', 4, { type: 'automation' });
  await add('call', 5, { type: 'user', id: IDS.ownerA });
});
afterAll(async () => {
  await stopJobs();
  await tdb?.drop();
});

describe('M3-01 activities read API (F-19)', () => {
  it('lists a contact timeline newest first with the actor', async () => {
    const page = await listActivities(ctx.ownerA(), { contactId }, opts);
    const own = page.items.filter((i) => i.summary.includes(' at '));
    expect(own.map((i) => i.summary)).toEqual([
      'call at 5',
      'stage_change at 4',
      'note at 3',
      'sms at 2',
      'call at 1'
    ]);
    expect(own[0].actor.type).toBe('user');
    expect(own[0].actor.name).toBe('Owen Owner');
    expect(own[1].actor).toMatchObject({ type: 'automation', name: null });
    expect(own[3].actor.type).toBe('alex');
  });

  it('F-19: the type filter returns only those types', async () => {
    const page = await listActivities(ctx.ownerA(), { contactId, types: ['call'] }, opts);
    expect(page.items.map((i) => i.type)).toEqual(['call', 'call']);
    const two = await listActivities(ctx.ownerA(), { contactId, types: ['call', 'sms'] }, opts);
    expect(new Set(two.items.map((i) => i.type))).toEqual(new Set(['call', 'sms']));
  });

  it('pages with a cursor without repeating or skipping rows', async () => {
    const first = await listActivities(
      ctx.ownerA(),
      { contactId, types: ['call', 'sms', 'note', 'stage_change'], limit: 2 },
      opts
    );
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).toBeTruthy();
    const second = await listActivities(
      ctx.ownerA(),
      {
        contactId,
        types: ['call', 'sms', 'note', 'stage_change'],
        limit: 2,
        cursor: first.nextCursor!
      },
      opts
    );
    const third = await listActivities(
      ctx.ownerA(),
      {
        contactId,
        types: ['call', 'sms', 'note', 'stage_change'],
        limit: 2,
        cursor: second.nextCursor!
      },
      opts
    );
    const all = [...first.items, ...second.items, ...third.items].map((i) => i.summary);
    expect(all).toEqual(['call at 5', 'stage_change at 4', 'note at 3', 'sms at 2', 'call at 1']);
    expect(third.nextCursor).toBeNull();
  });

  it('lists a deal timeline', async () => {
    await add('stage_change', 6, { type: 'user', id: IDS.ownerA }, { dealId: a.dealId });
    const page = await listActivities(ctx.ownerA(), { dealId: a.dealId }, opts);
    expect(page.items.some((i) => i.summary === 'stage_change at 6')).toBe(true);
    expect(page.items.every((i) => i.dealId === a.dealId)).toBe(true);
  });

  it("F-72: another tenant's ids give an empty timeline", async () => {
    expect((await listActivities(ctx.ownerA(), { contactId: b.contactId }, opts)).items).toEqual(
      []
    );
    expect((await listActivities(ctx.ownerB(), { contactId }, opts)).items).toEqual([]);
    expect((await listActivities(ctx.ownerA(), { dealId: b.dealId }, opts)).items).toEqual([]);
  });

  it('rejects bad input', async () => {
    await expect(listActivities(ctx.ownerA(), {}, opts)).rejects.toBeInstanceOf(ValidationError);
    await expect(
      listActivities(ctx.ownerA(), { contactId, dealId: a.dealId }, opts)
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      listActivities(ctx.ownerA(), { contactId, cursor: 'nope' }, opts)
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
