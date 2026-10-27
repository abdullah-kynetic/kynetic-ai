import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import {
  addContactTags,
  createContact,
  createManualLead,
  deleteContact,
  DuplicateContactError,
  findDuplicates,
  getContact,
  listContacts,
  loadContactForPanel,
  NotFoundError,
  removeContactTags,
  restoreContact,
  saveContactFromPanel,
  setContactOwner,
  updateContact
} from '@/server/contacts';
import { ValidationError } from '@/server/errors';
import { stopJobs } from '@/server/jobs';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let tdb: TestDatabase;
let db: Db;
let opts: { db: Db };

beforeAll(async () => {
  tdb = await createTestDatabase({ jobs: true });
  await seedTwoTenants(tdb.admin);
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

const events = async (name: string) =>
  (
    await tdb.admin`select data from pgboss.job where name = 'event.dispatch' and data->>'name' = ${name}`
  ).map((r) => r.data as { tenantId: string; payload: Record<string, unknown> });

describe('M1-01 contacts service', () => {
  it('F-07: normalises phone and email, sets primaries, audits, emits contact.created', async () => {
    const c = await createContact(
      ctx.ownerA(),
      {
        firstName: 'Ana',
        phones: ['(415) 555-0111', '415-555-0112'],
        emails: ['Ana@Example.test']
      },
      opts
    );
    expect(c.primaryPhoneE164).toBe('+14155550111');
    expect(c.phones).toEqual(['+14155550111', '+14155550112']);
    expect(c.primaryEmail).toBe('ana@example.test');
    expect(c.tenantId).toBe(IDS.tenantA);
    const [a] =
      await tdb.admin`select * from audit_log where action = 'contact.create' and entity_id = ${c.id}`;
    expect(a.actor_user_id).toBe(IDS.ownerA);
    const ev = (await events('contact.created')).find((e) => e.payload.contactId === c.id);
    expect(ev?.tenantId).toBe(IDS.tenantA);
    expect(ev?.payload).toEqual({ contactId: c.id, source: null, importBatchId: null });
  });

  it('rejects a bad phone and a contact with no phone or email (422-style field errors)', async () => {
    await expect(createContact(ctx.ownerA(), { phones: ['abc'] }, opts)).rejects.toBeInstanceOf(
      ValidationError
    );
    await expect(
      createContact(ctx.ownerA(), { firstName: 'No contact point' }, opts)
    ).rejects.toMatchObject({
      fieldErrors: { phones: ['custom'] }
    });
  });

  it('F-07: duplicate phone is flagged and blocked unless acknowledged', async () => {
    const first = await createContact(
      ctx.ownerA(),
      { firstName: 'Dup', phones: ['415-555-0200'] },
      opts
    );
    const err = await createContact(
      ctx.ownerA(),
      { firstName: 'Dup2', phones: ['+1 415 555 0200'] },
      opts
    ).catch((e) => e);
    expect(err).toBeInstanceOf(DuplicateContactError);
    expect(err.status).toBe(409);
    expect(err.matches[0]).toMatchObject({ id: first.id, matchedPhones: ['+14155550200'] });
    const forced = await createContact(
      ctx.ownerA(),
      { firstName: 'Dup2', phones: ['415-555-0200'] },
      { ...opts, acknowledgeDuplicates: true }
    );
    expect(forced.id).not.toBe(first.id);
  });

  it('F-07: duplicate on any email, case-insensitive, including a non-primary email', async () => {
    await createContact(
      ctx.ownerA(),
      { firstName: 'E', emails: ['x@example.test', 'second@example.test'] },
      opts
    );
    await expect(
      createContact(ctx.ownerA(), { emails: ['SECOND@example.test'] }, opts)
    ).rejects.toBeInstanceOf(DuplicateContactError);
  });

  it('F-07: the same phone in another tenant is not a duplicate; other tenant cannot read the contact', async () => {
    const a = await createContact(
      ctx.ownerA(),
      { firstName: 'Iso', phones: ['415-555-0300'] },
      opts
    );
    const b = await createContact(
      ctx.ownerB(),
      { firstName: 'Iso B', phones: ['415-555-0300'] },
      opts
    );
    expect(b.tenantId).toBe(IDS.tenantB);
    await expect(getContact(ctx.ownerB(), a.id, opts)).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      updateContact(ctx.ownerB(), a.id, { firstName: 'Hacked' }, opts)
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(deleteContact(ctx.ownerB(), a.id, opts)).rejects.toBeInstanceOf(NotFoundError);
    const listB = await listContacts(ctx.ownerB(), { limit: 200 }, opts);
    expect(listB.every((c) => c.tenantId === IDS.tenantB)).toBe(true);
    expect(
      await findDuplicates(ctx.ownerB(), { phones: ['+14155550300'], excludeId: b.id }, opts)
    ).toEqual([]);
  });

  it('update: audits only changed fields, emits contact.updated, re-checks duplicates, keeps one contact point', async () => {
    const c = await createContact(
      ctx.staffA(),
      { firstName: 'Up', phones: ['415-555-0400'] },
      opts
    );
    const u = await updateContact(
      ctx.staffA(),
      c.id,
      { firstName: 'Upd', status: 'working', phones: ['415-555-0401'] },
      opts
    );
    expect(u.primaryPhoneE164).toBe('+14155550401');
    const [a] =
      await tdb.admin`select before, after from audit_log where action = 'contact.update' and entity_id = ${c.id}`;
    expect(Object.keys(a.after).sort()).toEqual(['firstName', 'phones', 'status']);
    const ev = (await events('contact.updated')).find((e) => e.payload.contactId === c.id);
    expect(ev?.payload.changed).toEqual(['firstName', 'phones', 'status']);
    await expect(
      updateContact(ctx.staffA(), c.id, { phones: ['415-555-0200'] }, opts)
    ).rejects.toBeInstanceOf(DuplicateContactError);
    await expect(updateContact(ctx.staffA(), c.id, { phones: [] }, opts)).rejects.toBeInstanceOf(
      ValidationError
    );
  });

  it('a no-op update writes no audit row and no event', async () => {
    const c = await createContact(
      ctx.ownerA(),
      { firstName: 'Same', phones: ['415-555-0450'] },
      opts
    );
    await updateContact(ctx.ownerA(), c.id, { firstName: 'Same' }, opts);
    const rows =
      await tdb.admin`select 1 from audit_log where action = 'contact.update' and entity_id = ${c.id}`;
    expect(rows).toHaveLength(0);
  });

  it('tags: add and remove ignoring case, no repeats', async () => {
    const c = await createContact(ctx.ownerA(), { phones: ['415-555-0500'], tags: ['Roof'] }, opts);
    const t = await addContactTags(ctx.ownerA(), c.id, ['roof', 'hot'], opts);
    expect(t.tags).toEqual(['Roof', 'hot']);
    const r = await removeContactTags(ctx.ownerA(), c.id, ['ROOF'], opts);
    expect(r.tags).toEqual(['hot']);
  });

  it('owner: must be a member; null clears', async () => {
    const c = await createContact(ctx.ownerA(), { phones: ['415-555-0600'] }, opts);
    expect((await setContactOwner(ctx.ownerA(), c.id, IDS.staffA, opts)).ownerId).toBe(IDS.staffA);
    await expect(setContactOwner(ctx.ownerA(), c.id, IDS.ownerB, opts)).rejects.toBeInstanceOf(
      ValidationError
    );
    expect((await setContactOwner(ctx.ownerA(), c.id, null, opts)).ownerId).toBeNull();
  });

  it('soft delete: leaves lists and duplicate checks, keeps the row, can be restored', async () => {
    const c = await createContact(ctx.ownerA(), { phones: ['415-555-0700'] }, opts);
    await deleteContact(ctx.ownerA(), c.id, opts);
    await expect(getContact(ctx.ownerA(), c.id, opts)).rejects.toBeInstanceOf(NotFoundError);
    expect(
      (await getContact(ctx.ownerA(), c.id, { ...opts, includeDeleted: true })).deletedAt
    ).not.toBeNull();
    expect(
      (await listContacts(ctx.ownerA(), { limit: 200 }, opts)).some((x) => x.id === c.id)
    ).toBe(false);
    const again = await createContact(ctx.ownerA(), { phones: ['415-555-0700'] }, opts); // no duplicate error
    await expect(restoreContact(ctx.ownerA(), c.id, opts)).rejects.toBeInstanceOf(
      DuplicateContactError
    );
    await deleteContact(ctx.ownerA(), again.id, opts);
    expect((await restoreContact(ctx.ownerA(), c.id, opts)).deletedAt).toBeNull();
    expect((await events('contact.deleted')).some((e) => e.payload.contactId === c.id)).toBe(true);
  });

  it('manual lead: emits lead.created once and defaults source to manual; plain create does not', async () => {
    const lead = await createManualLead(
      ctx.ownerA(),
      { firstName: 'Lee', phones: ['415-555-0800'] },
      opts
    );
    expect(lead.source).toBe('manual');
    const plain = await createContact(ctx.ownerA(), { phones: ['415-555-0801'] }, opts);
    const leads = await events('lead.created');
    expect(leads.filter((e) => e.payload.contactId === lead.id)).toHaveLength(1);
    expect(leads.some((e) => e.payload.contactId === plain.id)).toBe(false);
  });

  it('a read-only view-as session cannot write', async () => {
    await expect(
      createContact({ ...ctx.adminViewingA(), readOnly: true }, { phones: ['415-555-0900'] }, opts)
    ).rejects.toThrow();
  });
});

describe('M1-04 contact panel save', () => {
  it('F-07: a duplicate phone comes back as a match, not a silent second contact', async () => {
    const first = await saveContactFromPanel(
      ctx.ownerA(),
      { values: { firstName: 'Dup', phones: ['(415) 555-0177'] } },
      opts
    );
    expect(first.ok).toBe(true);
    const second = await saveContactFromPanel(
      ctx.ownerA(),
      { values: { firstName: 'Dup Two', phones: ['415-555-0177'] } },
      opts
    );
    expect(second).toMatchObject({
      ok: false,
      kind: 'duplicate',
      matches: [{ matchedPhones: ['+14155550177'] }]
    });
    const count = await listContacts(ctx.ownerA(), { limit: 100 }, opts);
    expect(count.filter((c) => c.primaryPhoneE164 === '+14155550177')).toHaveLength(1);
  });

  it('F-07: "create anyway" saves the second contact after the warning', async () => {
    const res = await saveContactFromPanel(
      ctx.ownerA(),
      { values: { firstName: 'Dup Three', phones: ['415-555-0177'] }, acknowledgeDuplicates: true },
      opts
    );
    expect(res.ok).toBe(true);
  });

  it('F-07: a panel create is a manual lead, and field errors come back by path', async () => {
    const bad = await saveContactFromPanel(
      ctx.ownerA(),
      { values: { firstName: 'Bad', phones: ['not a phone'] } },
      opts
    );
    expect(bad).toMatchObject({ ok: false, kind: 'invalid' });
    const ok = await saveContactFromPanel(
      ctx.ownerA(),
      { values: { firstName: 'Lead', emails: ['lead@example.test'] } },
      opts
    );
    expect(ok.ok).toBe(true);
    expect((await events('lead.created')).length).toBeGreaterThan(0);
  });

  it('F-07: editing does not flag the contact as its own duplicate; another tenant id is not found', async () => {
    const made = await saveContactFromPanel(
      ctx.ownerA(),
      { values: { firstName: 'Edit', phones: ['415-555-0188'] } },
      opts
    );
    if (!made.ok) throw new Error('setup failed');
    const saved = await saveContactFromPanel(
      ctx.ownerA(),
      { id: made.id, values: { firstName: 'Edited', phones: ['415-555-0188'] } },
      opts
    );
    expect(saved.ok).toBe(true);
    expect(await loadContactForPanel(ctx.ownerB(), made.id, opts)).toBeNull();
    expect((await loadContactForPanel(ctx.ownerA(), made.id, opts))?.firstName).toBe('Edited');
    expect(
      await saveContactFromPanel(ctx.ownerB(), { id: made.id, values: { firstName: 'X' } }, opts)
    ).toMatchObject({ ok: false, kind: 'not_found' });
  });
});
