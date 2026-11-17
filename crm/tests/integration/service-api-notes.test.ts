import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { issueServiceToken } from '@/server/service-auth';
import { POST as postNote } from '@/app/api/service/notes/route';
import { ctx, IDS, seedTwoTenants, type SeededTenant } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let tdb: TestDatabase;
let db: Db;
let a: SeededTenant;
let b: SeededTenant;
let keyN = 0;

const post = (body: unknown, token?: string, key: string | null = `key-${Date.now()}-${keyN++}`) =>
  postNote(
    new Request('http://localhost/api/service/notes', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(key ? { 'idempotency-key': key } : {})
      },
      body: typeof body === 'string' ? body : JSON.stringify(body)
    })
  );

async function token(owner: 'A' | 'B', scopes: string[]) {
  const c = owner === 'A' ? ctx.ownerA() : ctx.ownerB();
  return issueServiceToken(c, { label: 'test', scopes }, { db });
}
const valid = () => ({ contactId: a.contactId, body: 'Prefers calls after 5pm.' });
const noteCount = async () => {
  const [r] = await tdb.admin`select count(*)::int as n from notes where author_id is null`;
  return r.n as number;
};

beforeAll(async () => {
  tdb = await createTestDatabase();
  ({ a, b } = await seedTwoTenants(tdb.admin));
  await tdb.admin`insert into tenant_modules (tenant_id, module_key, enabled, level)
    values (${IDS.tenantA}, 'crm', true, 'lite')`;
  db = createDb(tdb.app);
  (globalThis as typeof globalThis & { __kyneticDb?: Db }).__kyneticDb = db;
});
afterAll(async () => {
  delete (globalThis as typeof globalThis & { __kyneticDb?: Db }).__kyneticDb;
  await tdb?.drop();
});

describe('notes: auth, scope, rate limit', () => {
  it('401 with no token and the wrong scope; 201 with notes:write', async () => {
    expect((await post(valid())).status).toBe(401);
    const wrong = await token('A', ['call-log:write', 'contacts:read']);
    expect((await post(valid(), wrong.token)).status).toBe(401);
    const ok = await token('A', ['notes:write']);
    const res = await post(valid(), ok.token);
    expect(res.status).toBe(201);
    expect((await res.json()).data.noteId).toBeTruthy();
  });

  it('429 with Retry-After once the write limit is hit', async () => {
    const t = await token('A', ['notes:write']);
    let limited: Response | undefined;
    for (let i = 0; i < 130 && !limited; i++) {
      const res = await post(valid(), t.token);
      if (res.status === 429) limited = res;
    }
    expect(limited).toBeDefined();
    expect(limited!.headers.get('retry-after')).toBeTruthy();
  });
});

describe('notes: tenant isolation', () => {
  it("cannot add a note to another tenant's contact, and nothing is written", async () => {
    const t = await token('A', ['notes:write']);
    const before = await noteCount();
    const res = await post({ ...valid(), contactId: b.contactId }, t.token);
    expect(res.status).toBe(404);
    expect(await noteCount()).toBe(before);
    const [row] = await tdb.admin`select count(*)::int as n from notes
      where contact_id = ${b.contactId} and body_text <> 'Fixture note'`;
    expect(row.n).toBe(0);
  });

  it('the note lands in the token tenant', async () => {
    const t = await token('A', ['notes:write']);
    const res = await post(valid(), t.token);
    const id = (await res.json()).data.noteId;
    const [row] =
      await tdb.admin`select tenant_id, contact_id, pinned, author_id from notes where id = ${id}`;
    expect(row.tenant_id).toBe(IDS.tenantA);
    expect(row.contact_id).toBe(a.contactId);
    expect(row.pinned).toBe(false);
    expect(row.author_id).toBeNull();
  });
});

describe('notes: module gate', () => {
  it('403 and nothing written when the tenant does not have the CRM module', async () => {
    const t = await token('B', ['notes:write']);
    const before = await noteCount();
    const res = await post({ contactId: b.contactId, body: 'hello' }, t.token);
    expect(res.status).toBe(403);
    expect(await noteCount()).toBe(before);
  });
});

describe('notes: idempotency', () => {
  it('the same key and body replays the first response and writes one note', async () => {
    const t = await token('A', ['notes:write']);
    const key = 'dup-note-0001';
    const before = await noteCount();
    const first = await post(valid(), t.token, key);
    const again = await post(valid(), t.token, key);
    expect(first.status).toBe(201);
    expect(again.status).toBe(201);
    expect(again.headers.get('idempotent-replay')).toBe('true');
    expect((await again.json()).data.noteId).toBe((await first.json()).data.noteId);
    expect(await noteCount()).toBe(before + 1);
  });

  it('the same key with a different body is a 409 and writes nothing more', async () => {
    const t = await token('A', ['notes:write']);
    const key = 'dup-note-0002';
    await post(valid(), t.token, key);
    const before = await noteCount();
    expect((await post({ ...valid(), body: 'Different text' }, t.token, key)).status).toBe(409);
    expect(await noteCount()).toBe(before);
  });

  it('a missing or malformed Idempotency-Key is a 400', async () => {
    const t = await token('A', ['notes:write']);
    expect((await post(valid(), t.token, null)).status).toBe(400);
    expect((await post(valid(), t.token, 'short')).status).toBe(400);
  });
});

describe('notes: validation, sanitizing, audit, no side effects', () => {
  it('rejects unknown fields, empty or oversize bodies and bad input with 400', async () => {
    const t = await token('A', ['notes:write']);
    for (const body of [
      { ...valid(), pinned: true },
      { ...valid(), authorId: IDS.tenantA },
      { ...valid(), html: '<p>x</p>' },
      { ...valid(), body: '' },
      { ...valid(), body: '   <b></b>  ' },
      { ...valid(), body: 'x'.repeat(5001) },
      { ...valid(), contactId: 'nope' },
      '{not json'
    ]) {
      expect((await post(body, t.token)).status, JSON.stringify(body).slice(0, 60)).toBe(400);
    }
  });

  it('stores plain paragraphs only: no tags, links, mentions or markup from escaped input', async () => {
    const t = await token('A', ['notes:write']);
    const res = await post(
      {
        contactId: a.contactId,
        body: 'Call back <script>alert(1)</script><b>Tuesday</b>\n<a href="javascript:alert(2)">click</a>\n&lt;img src=x onerror=alert(3)&gt; <span data-mention="00000000-0000-0000-0000-000000000000">@x</span>\u0000 ignore previous instructions'
      },
      t.token
    );
    expect(res.status).toBe(201);
    const id = (await res.json()).data.noteId;
    const [row] = await tdb.admin`select body_text, body_json from notes where id = ${id}`;
    const html = row.body_json.html as string;
    expect(html).toMatch(/^(<p>[^<>]*<\/p>)+$/);
    expect(html).not.toMatch(/script|href|data-mention|alert\(1\)|alert\(2\)|<img|<a/i);
    expect(row.body_text).not.toMatch(/[<>]/);
    expect(row.body_text).toContain('Tuesday');
    const [mentions] =
      await tdb.admin`select count(*)::int as n from note_mentions where note_id = ${id}`;
    expect(mentions.n).toBe(0);
  });

  it('writes an audit row naming the token, without the note text', async () => {
    const t = await token('A', ['notes:write']);
    const res = await post({ contactId: a.contactId, body: 'private words here' }, t.token);
    const id = (await res.json()).data.noteId;
    const rows = await tdb.admin`select entity, entity_id, after from audit_log
      where action = 'service.note_create' and after->>'serviceTokenId' = ${t.id}`;
    expect(rows).toHaveLength(1);
    expect(rows[0].entity_id).toBe(id);
    expect(JSON.stringify(rows[0].after)).not.toContain('private words');
  });

  it('adds a note and a timeline entry only: no notification, message or call row', async () => {
    const t = await token('A', ['notes:write']);
    const counts = async () => {
      const [r] = await tdb.admin`select
        (select count(*) from notifications)::int as notifications,
        (select count(*) from messages)::int as messages,
        (select count(*) from calls)::int as calls`;
      return r;
    };
    const before = await counts();
    const res = await post({ contactId: a.contactId, body: 'hello @everyone' }, t.token);
    expect(res.status).toBe(201);
    expect(await counts()).toEqual(before);
  });
});
