import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import {
  createContact,
  getContact,
  mergeContacts,
  NotFoundError,
  previewMerge,
  findDuplicates
} from '@/server/contacts';
import { canContact } from '@/server/consent';
import { ValidationError } from '@/server/errors';
import { stopJobs } from '@/server/jobs';
import { ctx, seedTwoTenants } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let tdb: TestDatabase;
let db: Db;
let opts: { db: Db };
let a: Awaited<ReturnType<typeof seedTwoTenants>>['a'];
let b: Awaited<ReturnType<typeof seedTwoTenants>>['b'];

beforeAll(async () => {
  tdb = await createTestDatabase({ jobs: true });
  ({ a, b } = await seedTwoTenants(tdb.admin));
  db = createDb(tdb.app);
  opts = { db };
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

const pair = async (n: number) => {
  const survivor = await createContact(
    ctx.ownerA(),
    { firstName: 'Sam', phones: [`415-555-02${n}1`], tags: ['hot'] },
    opts
  );
  const loser = await createContact(
    ctx.ownerA(),
    {
      firstName: 'Samuel',
      lastName: 'Lee',
      phones: [`415-555-02${n}1`, `415-555-02${n}2`],
      emails: [`sam${n}@example.test`],
      tags: ['Hot', 'roof']
    },
    { ...opts, acknowledgeDuplicates: true }
  );
  return { survivor, loser };
};

describe('M1-08 merge contacts (F-07)', () => {
  it('moves deals, notes, activities and the rest, soft-removes the loser, audits and emits', async () => {
    const { survivor, loser } = await pair(1);
    const admin = tdb.admin;
    await admin`insert into notes (tenant_id, body_text, contact_id) values (${a.tenantId}, 'n1', ${loser.id})`;
    await admin`insert into tasks (tenant_id, title, contact_id) values (${a.tenantId}, 't1', ${loser.id})`;
    await admin`insert into activities (tenant_id, contact_id, type, summary, actor_type) values (${a.tenantId}, ${loser.id}, 'system', 'old', 'system')`;
    await admin`insert into deal_contacts (tenant_id, deal_id, contact_id, role) values (${a.tenantId}, ${a.dealId}, ${loser.id}, 'spouse')`;
    await admin`insert into deal_contacts (tenant_id, deal_id, contact_id, role) values (${a.tenantId}, ${a.dealId}, ${survivor.id}, 'homeowner')`.catch(
      () => {}
    );

    const preview = await previewMerge(
      ctx.ownerA(),
      { survivorId: survivor.id, loserId: loser.id },
      opts
    );
    expect(preview.counts).toMatchObject({
      notes: 1,
      tasks: 1,
      activities: 1,
      deals: 1
    });

    const res = await mergeContacts(
      ctx.ownerA(),
      { survivorId: survivor.id, loserId: loser.id },
      opts
    );
    expect(res.moved).toMatchObject({ notes: 1, tasks: 1, activities: 1 });

    const [n] = await admin`select count(*)::int c from notes where contact_id = ${survivor.id}`;
    expect(n.c).toBe(1);
    const [left] =
      await admin`select (select count(*) from notes where contact_id = ${loser.id})::int + (select count(*) from tasks where contact_id = ${loser.id})::int + (select count(*) from deal_contacts where contact_id = ${loser.id})::int c`;
    expect(left.c).toBe(0);
    const [dc] =
      await admin`select count(*)::int c from deal_contacts where deal_id = ${a.dealId} and contact_id = ${survivor.id}`;
    expect(dc.c).toBe(1);

    const gone =
      await admin`select merged_into_id, deleted_at from contacts where id = ${loser.id}`;
    expect(gone[0].merged_into_id).toBe(survivor.id);
    expect(gone[0].deleted_at).not.toBeNull();
    await expect(getContact(ctx.ownerA(), loser.id, opts)).rejects.toBeInstanceOf(NotFoundError);

    const kept = await getContact(ctx.ownerA(), survivor.id, opts);
    expect(kept.phones).toEqual(['+14155550211', '+14155550212']);
    expect(kept.emails).toEqual(['sam1@example.test']);
    expect(kept.tags).toEqual(['hot', 'roof']);
    expect(kept.firstName).toBe('Sam');
    expect(kept.lastName).toBe('Lee');

    const au =
      await admin`select after from audit_log where action = 'contact.merge' and entity_id = ${survivor.id}`;
    expect(au).toHaveLength(1);
    const act =
      await admin`select ref_id, meta from activities where contact_id = ${survivor.id} and summary like 'Merged%'`;
    expect(act[0].ref_id).toBe(loser.id);
    expect(act[0].meta.loserId).toBe(loser.id);
    const ev =
      await admin`select data from pgboss.job where name = 'event.dispatch' and data->>'name' = 'contact.merged' and data->'payload'->>'survivorId' = ${survivor.id}`;
    expect(ev).toHaveLength(1);
    expect(await findDuplicates(ctx.ownerA(), { phones: ['+14155550212'] }, opts)).toHaveLength(1);
  });

  it('carries an opt-out to the survivor and never carries a grant', async () => {
    const { survivor, loser } = await pair(2);
    const admin = tdb.admin;
    await admin`insert into consents (tenant_id, contact_id, channel, kind, source, captured_at) values (${a.tenantId}, ${loser.id}, 'sms', 'express_written', 'form', now() - interval '2 days')`;
    await admin`insert into consents (tenant_id, contact_id, channel, kind, source, captured_at) values (${a.tenantId}, ${loser.id}, 'sms', 'opt_out', 'sms_keyword', now() - interval '1 day')`;
    await admin`insert into consents (tenant_id, contact_id, channel, kind, source, captured_text) values (${a.tenantId}, ${loser.id}, 'email', 'express_written', 'staff', 'verbal')`;

    const res = await mergeContacts(
      ctx.ownerA(),
      { survivorId: survivor.id, loserId: loser.id },
      opts
    );
    expect(res.carriedOptOuts).toEqual(['sms']);
    const rows = await admin`select channel, kind from consents where contact_id = ${survivor.id}`;
    expect(rows).toEqual([{ channel: 'sms', kind: 'opt_out' }]);
    const loserRows = await admin`select 1 from consents where contact_id = ${loser.id}`;
    expect(loserRows).toHaveLength(3);
    const d = await canContact(ctx.ownerA(), survivor.id, 'sms', new Date(), opts);
    expect(d.allowed).toBe(false);
  });

  it('rejects the same contact, a deleted or already merged contact, and another tenant', async () => {
    const { survivor, loser } = await pair(3);
    await expect(
      mergeContacts(ctx.ownerA(), { survivorId: survivor.id, loserId: survivor.id }, opts)
    ).rejects.toBeInstanceOf(ValidationError);
    await mergeContacts(ctx.ownerA(), { survivorId: survivor.id, loserId: loser.id }, opts);
    await expect(
      mergeContacts(ctx.ownerA(), { survivorId: survivor.id, loserId: loser.id }, opts)
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      mergeContacts(ctx.ownerB(), { survivorId: survivor.id, loserId: b.contactId }, opts)
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('leaves both contacts untouched when the merge is refused', async () => {
    const { survivor } = await pair(4);
    await expect(
      mergeContacts(ctx.ownerA(), { survivorId: survivor.id, loserId: b.contactId }, opts)
    ).rejects.toBeInstanceOf(NotFoundError);
    const [row] =
      await tdb.admin`select merged_into_id, deleted_at from contacts where id in (${survivor.id}, ${b.contactId})`;
    expect(row.merged_into_id).toBeNull();
    expect(row.deleted_at).toBeNull();
  });

  it('refuses a read-only view-as session', async () => {
    const { survivor, loser } = await pair(6);
    await expect(
      mergeContacts(
        { ...ctx.adminViewingA(), readOnly: true },
        { survivorId: survivor.id, loserId: loser.id },
        opts
      )
    ).rejects.toThrow();
    const [row] = await tdb.admin`select merged_into_id from contacts where id = ${loser.id}`;
    expect(row.merged_into_id).toBeNull();
  });
});
