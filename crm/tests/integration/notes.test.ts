import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { listActivities } from '@/server/activity';
import { ModuleDisabledError } from '@/server/modules';
import {
  createNote,
  deleteNote,
  listNotes,
  listTeammates,
  setNotePinned,
  updateNote
} from '@/server/notes';
import { ValidationError } from '@/server/errors';
import { ctx, IDS, seedTwoTenants, type SeededTenant } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let tdb: TestDatabase;
let opts: { db: Db };
let a: SeededTenant;
let b: SeededTenant;

beforeAll(async () => {
  tdb = await createTestDatabase();
  ({ a, b } = await seedTwoTenants(tdb.admin));
  opts = { db: createDb(tdb.app) };
  await setCrm(true);
  await setCrm(true, IDS.tenantB);
});
afterAll(async () => {
  await tdb?.drop();
});

const setCrm = (enabled: boolean, tenant: string = IDS.tenantA) =>
  tdb.admin`insert into tenant_modules (tenant_id, module_key, enabled, level)
    values (${tenant}, 'crm', ${enabled}, 'lite')
    on conflict (tenant_id, module_key) do update set enabled = ${enabled}, level = 'lite'`;

const mention = (id: string, label: string) =>
  `<span data-mention="${id}" class="mention">@${label}</span>`;

const mentionNotes = (userId: string) =>
  tdb.admin`select title, body, link, kind from notifications
    where user_id = ${userId} and kind = 'mention' order by created_at`;

describe('notes (F-22)', () => {
  it('is refused while the crm module is off, and writes nothing', async () => {
    await setCrm(false);
    await expect(
      createNote(ctx.ownerA(), { contactId: a.contactId, html: '<p>hi</p>' }, opts)
    ).rejects.toBeInstanceOf(ModuleDisabledError);
    await expect(listNotes(ctx.ownerA(), { contactId: a.contactId }, opts)).rejects.toBeInstanceOf(
      ModuleDisabledError
    );
    const [{ n }] = await tdb.admin`select count(*)::int n from notes where body_text = 'hi'`;
    expect(n).toBe(0);
    await setCrm(true);
  });

  it('sanitizes on save: a script tag never reaches the database', async () => {
    const note = await createNote(
      ctx.ownerA(),
      {
        contactId: a.contactId,
        html: '<p onclick="x()">Roof is <strong>leaking</strong><script>alert(1)</script></p>'
      },
      opts
    );
    expect(note.html).toBe('<p>Roof is <strong>leaking</strong></p>');
    const [row] = await tdb.admin`select body_text, body_json from notes where id = ${note.id}`;
    expect(JSON.stringify(row.body_json)).not.toContain('script');
    expect(row.body_text).toBe('Roof is leaking');
  });

  it('sanitizes on read: a dirty row written another way is cleaned in the list', async () => {
    const [row] = await tdb.admin`insert into notes (tenant_id, body_text, body_json, contact_id)
      values (${IDS.tenantA}, 'x', ${tdb.admin.json({ html: '<p>ok</p><script>bad()</script>' })}, ${a.contactId})
      returning id`;
    const list = await listNotes(ctx.ownerA(), { contactId: a.contactId }, opts);
    expect(list.find((n) => n.id === row.id)?.html).toBe('<p>ok</p>');
  });

  it('rejects an empty note and a note with no parent', async () => {
    await expect(
      createNote(ctx.ownerA(), { contactId: a.contactId, html: '<p> </p>' }, opts)
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(createNote(ctx.ownerA(), { html: '<p>x</p>' }, opts)).rejects.toBeInstanceOf(
      ValidationError
    );
  });

  it('a mention notifies the teammate once through notify(), with a link to the contact', async () => {
    const note = await createNote(
      ctx.ownerA(),
      {
        contactId: a.contactId,
        html: `<p>${mention(IDS.staffA, 'Staff')} please call back</p>`
      },
      opts
    );
    const rows = await mentionNotes(IDS.staffA);
    expect(rows).toHaveLength(1);
    expect(rows[0].link).toBe(`/dashboard/contacts/${a.contactId}#notes`);
    expect(rows[0].body).toBe('@Staff please call back');
    const mentions = await tdb.admin`select user_id from note_mentions where note_id = ${note.id}`;
    expect(mentions.map((m) => m.user_id)).toEqual([IDS.staffA]);
  });

  it('mentioning yourself does not notify you', async () => {
    await createNote(
      ctx.ownerA(),
      { contactId: a.contactId, html: `<p>${mention(IDS.ownerA, 'Owner')} reminder</p>` },
      opts
    );
    expect(await mentionNotes(IDS.ownerA)).toHaveLength(0);
  });

  it('a mention of someone in another tenant becomes plain text: no row, no notification', async () => {
    const note = await createNote(
      ctx.ownerA(),
      { contactId: a.contactId, html: `<p>${mention(IDS.ownerB, 'Outsider')} hello</p>` },
      opts
    );
    expect(note.html).toBe('<p>@Outsider hello</p>');
    expect(await mentionNotes(IDS.ownerB)).toHaveLength(0);
    const mentions = await tdb.admin`select 1 from note_mentions where note_id = ${note.id}`;
    expect(mentions).toHaveLength(0);
  });

  it('editing notifies only the people the edit adds', async () => {
    const before = (await mentionNotes(IDS.staffA)).length;
    const note = await createNote(
      ctx.ownerA(),
      { contactId: a.contactId, html: '<p>draft</p>' },
      opts
    );
    await updateNote(
      ctx.ownerA(),
      note.id,
      { html: `<p>${mention(IDS.staffA, 'Staff')} look</p>` },
      opts
    );
    expect(await mentionNotes(IDS.staffA)).toHaveLength(before + 1);
    // Saving again with the same mention does not ping again.
    await updateNote(
      ctx.ownerA(),
      note.id,
      { html: `<p>${mention(IDS.staffA, 'Staff')} look closely</p>` },
      opts
    );
    expect(await mentionNotes(IDS.staffA)).toHaveLength(before + 1);
    // Dropping the mention removes the link row.
    await updateNote(ctx.ownerA(), note.id, { html: '<p>never mind</p>' }, opts);
    const left = await tdb.admin`select 1 from note_mentions where note_id = ${note.id}`;
    expect(left).toHaveLength(0);
  });

  it('a pinned note sorts to the top, whatever its age', async () => {
    const old = await createNote(
      ctx.ownerA(),
      { contactId: a.contactId, html: '<p>old</p>' },
      opts
    );
    await createNote(ctx.ownerA(), { contactId: a.contactId, html: '<p>newer</p>' }, opts);
    expect((await listNotes(ctx.ownerA(), { contactId: a.contactId }, opts))[0].id).not.toBe(
      old.id
    );
    await setNotePinned(ctx.ownerA(), old.id, true, opts);
    const list = await listNotes(ctx.ownerA(), { contactId: a.contactId }, opts);
    expect(list[0].id).toBe(old.id);
    expect(list[0].pinned).toBe(true);
    await setNotePinned(ctx.ownerA(), old.id, false, opts);
    expect((await listNotes(ctx.ownerA(), { contactId: a.contactId }, opts))[0].id).not.toBe(
      old.id
    );
  });

  it('adds a note to the contact timeline', async () => {
    const note = await createNote(ctx.ownerA(), { contactId: a.contactId, html: '<p>t</p>' }, opts);
    const page = await listActivities(
      ctx.ownerA(),
      { contactId: a.contactId, types: ['note'] },
      opts
    );
    expect(page.items.some((i) => i.refId === note.id && i.actor.id === IDS.ownerA)).toBe(true);
  });

  it('works on a deal and a company too', async () => {
    const [company] = await tdb.admin`select id from companies where tenant_id = ${IDS.tenantA}`;
    await createNote(ctx.ownerA(), { dealId: a.dealId, html: '<p>deal note</p>' }, opts);
    await createNote(ctx.ownerA(), { companyId: company.id, html: '<p>co note</p>' }, opts);
    expect((await listNotes(ctx.ownerA(), { dealId: a.dealId }, opts)).map((n) => n.text)).toEqual([
      'deal note'
    ]);
    expect(
      (await listNotes(ctx.ownerA(), { companyId: company.id }, opts)).map((n) => n.text)
    ).toEqual(['co note']);
  });

  it("staff may pin but not edit or delete someone else's note; an owner may", async () => {
    const note = await createNote(
      ctx.ownerA(),
      { contactId: a.contactId, html: '<p>mine</p>' },
      opts
    );
    await expect(setNotePinned(ctx.staffA(), note.id, true, opts)).resolves.toMatchObject({
      pinned: true
    });
    await expect(
      updateNote(ctx.staffA(), note.id, { html: '<p>x</p>' }, opts)
    ).rejects.toMatchObject({
      code: 'FORBIDDEN'
    });
    await expect(deleteNote(ctx.staffA(), note.id, opts)).rejects.toMatchObject({
      code: 'FORBIDDEN'
    });
    const theirs = await createNote(
      ctx.staffA(),
      { contactId: a.contactId, html: '<p>staff</p>' },
      opts
    );
    await updateNote(ctx.staffA(), theirs.id, { html: '<p>staff edit</p>' }, opts);
    await deleteNote(ctx.ownerA(), theirs.id, opts);
    expect(
      (await listNotes(ctx.ownerA(), { contactId: a.contactId }, opts)).some(
        (n) => n.id === theirs.id
      )
    ).toBe(false);
    const [row] = await tdb.admin`select deleted_at from notes where id = ${theirs.id}`;
    expect(row.deleted_at).not.toBeNull();
  });

  it('writes audit rows for create, update and delete', async () => {
    const note = await createNote(
      ctx.ownerA(),
      { contactId: a.contactId, html: '<p>audit</p>' },
      opts
    );
    await updateNote(ctx.ownerA(), note.id, { html: '<p>audit 2</p>' }, opts);
    await deleteNote(ctx.ownerA(), note.id, opts);
    const rows =
      await tdb.admin`select action from audit_log where entity = 'note' and entity_id = ${note.id} order by created_at`;
    expect(rows.map((r) => r.action)).toEqual(['note.create', 'note.update', 'note.delete']);
  });

  it("keeps tenants apart: B cannot read, edit, delete or attach to A's records", async () => {
    const note = await createNote(
      ctx.ownerA(),
      { contactId: a.contactId, html: '<p>secret</p>' },
      opts
    );
    expect(await listNotes(ctx.ownerB(), { contactId: a.contactId }, opts)).toEqual([]);
    await expect(updateNote(ctx.ownerB(), note.id, { pinned: true }, opts)).rejects.toMatchObject({
      code: 'NOT_FOUND'
    });
    await expect(deleteNote(ctx.ownerB(), note.id, opts)).rejects.toMatchObject({
      code: 'NOT_FOUND'
    });
    await expect(
      createNote(ctx.ownerB(), { contactId: a.contactId, html: '<p>x</p>' }, opts)
    ).rejects.toBeInstanceOf(ValidationError);
    // B's own contact is fine.
    await expect(
      createNote(ctx.ownerB(), { contactId: b.contactId, html: '<p>ok</p>' }, opts)
    ).resolves.toBeTruthy();
  });

  it("lists only this tenant's members as mentionable", async () => {
    const team = await listTeammates(ctx.ownerA(), opts);
    expect(team.map((t) => t.id).toSorted()).toEqual([IDS.ownerA, IDS.staffA].toSorted());
  });
});
