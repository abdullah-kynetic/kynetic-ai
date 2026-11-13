import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import {
  contactFacets,
  createContact,
  deleteContact,
  NO_OWNER,
  searchContacts,
  type SearchContactsInput
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
  // createContact emits events through pg-boss, which reads the env.
  process.env.APP_BASE_URL = 'http://localhost:3000';
  process.env.DATABASE_URL = tdb.urls.app;
  process.env.DATABASE_URL_WORKER = tdb.urls.worker;
  process.env.DATABASE_URL_AUTH = tdb.authUrl;
  process.env.BETTER_AUTH_SECRET = 'x'.repeat(32);
  process.env.APP_ENCRYPTION_KEY = 'y'.repeat(32);
  // The fixtures leave one contact per tenant; this suite starts from known rows only.
  await tdb.admin`update contacts set deleted_at = now()`;
});
afterAll(async () => {
  await stopJobs();
  await tdb?.drop();
});

const ids = (r: { rows: { id: string }[] }) => r.rows.map((x) => x.id);

describe('M1-02 leads list query (F-05)', () => {
  const made: Record<string, string> = {};

  beforeAll(async () => {
    const add = async (key: string, input: Parameters<typeof createContact>[1]) => {
      made[key] = (
        await createContact(ctx.ownerA(), input, { ...opts, acknowledgeDuplicates: true })
      ).id;
    };
    await add('ana', {
      firstName: 'Ana',
      lastName: 'Lopez',
      phones: ['(415) 555-0101'],
      status: 'new',
      source: 'facebook',
      tags: ['Roof'],
      ownerId: IDS.ownerA
    });
    await add('ben', {
      firstName: 'Ben',
      lastName: 'Ng',
      emails: ['ben@example.test'],
      status: 'working',
      source: 'angi',
      tags: ['gutter'],
      ownerId: IDS.staffA
    });
    await add('cara', {
      firstName: 'Cara',
      phones: ['415-555-0199'],
      status: 'booked',
      source: 'facebook',
      tags: ['roof', 'vip']
    });
    await add('gone', { firstName: 'Gone', phones: ['415-555-0177'], source: 'facebook' });
    await deleteContact(ctx.ownerA(), made.gone, opts);
    await add('other', { firstName: 'Ana', phones: ['415-555-0101'], source: 'facebook' });
    // Same name and source in tenant B: never visible to tenant A.
    made.otherTenant = (
      await createContact(
        ctx.ownerB(),
        { firstName: 'Ana', phones: ['415-555-0101'], source: 'facebook' },
        opts
      )
    ).id;
    await tdb.admin`update contacts set created_at = '2026-10-01T12:00:00Z' where id = ${made.ana}`;
    await tdb.admin`update contacts set created_at = '2026-10-10T12:00:00Z' where id = ${made.ben}`;
    await tdb.admin`update contacts set created_at = '2026-10-20T12:00:00Z' where id in (${made.cara}, ${made.other})`;
  });

  const search = (input: SearchContactsInput) => searchContacts(ctx.ownerA(), input, opts);

  it('lists only live contacts in the caller tenant, with totals and owner names', async () => {
    const r = await search({});
    expect(r.total).toBe(4);
    expect(ids(r)).not.toContain(made.gone);
    expect(ids(r)).not.toContain(made.otherTenant);
    const ana = r.rows.find((x) => x.id === made.ana);
    expect(ana?.ownerName).toBe('owner-a@example.test');
    const b = await searchContacts(ctx.ownerB(), {}, opts);
    expect(ids(b)).toEqual([made.otherTenant]);
  });

  it('filters by status and source together', async () => {
    const r = await search({ statuses: ['new', 'booked'], sources: ['facebook'] });
    expect(ids(r).toSorted()).toEqual([made.ana, made.cara, made.other].toSorted());
    const r2 = await search({ statuses: ['working'], sources: ['facebook'] });
    expect(r2.total).toBe(0);
  });

  it('filters by tag ignoring case, by owner (including no owner) and by created date', async () => {
    expect(ids(await search({ tags: ['ROOF'] })).toSorted()).toEqual(
      [made.ana, made.cara].toSorted()
    );
    expect(ids(await search({ owners: [IDS.staffA] }))).toEqual([made.ben]);
    expect(ids(await search({ owners: [NO_OWNER] })).toSorted()).toEqual(
      [made.cara, made.other].toSorted()
    );
    expect(ids(await search({ createdFrom: '2026-10-05', createdTo: '2026-10-10' }))).toEqual([
      made.ben
    ]);
    expect((await search({ createdTo: '2026-10-01' })).rows.map((x) => x.id)).toEqual([made.ana]);
  });

  it('searches name, email and a phone fragment typed with punctuation', async () => {
    expect(ids(await search({ q: 'lopez' }))).toEqual([made.ana]);
    expect(ids(await search({ q: 'BEN@example' }))).toEqual([made.ben]);
    expect(ids(await search({ q: '(555) 0199' }))).toEqual([made.cara]);
    // LIKE wildcards in the query are literal.
    expect((await search({ q: '%' })).total).toBe(0);
  });

  it('sorts by name both ways and pages with a stable order', async () => {
    const asc = await search({ sort: { field: 'name', desc: false } });
    expect(asc.rows.map((x) => x.firstName)).toEqual(['Ana', 'Ana', 'Ben', 'Cara']);
    const desc = await search({ sort: { field: 'name', desc: true } });
    expect(desc.rows[0].firstName).toBe('Cara');
    const p1 = await search({ sort: { field: 'createdAt', desc: false }, perPage: 10, page: 1 });
    expect(p1.pageCount).toBe(1);
    expect(p1.rows[0].id).toBe(made.ana);
    expect(p1.total).toBe(4);
    expect(Object.keys(p1.rows[0])).not.toContain('matchTotal');
    const p2 = await search({ perPage: 10, page: 2 });
    expect(p2.rows).toEqual([]);
    expect(p2.total).toBe(4);
  });

  it('rejects unknown keys, a bad page size and a bad date', async () => {
    await expect(search({ perPage: 7 })).rejects.toBeInstanceOf(ValidationError);
    await expect(search({ createdFrom: '10/01/2026' })).rejects.toBeInstanceOf(ValidationError);
    await expect(search({ nope: 1 } as SearchContactsInput)).rejects.toBeInstanceOf(
      ValidationError
    );
  });

  it('facets list sources, tags (one spelling per tag) and tenant members only', async () => {
    const f = await contactFacets(ctx.ownerA(), opts);
    expect(f.sources).toEqual(['angi', 'facebook']);
    expect(f.tags.map((t) => t.toLowerCase())).toEqual(['gutter', 'roof', 'vip']);
    expect(f.owners.map((o) => o.id).toSorted()).toEqual([IDS.ownerA, IDS.staffA].toSorted());
    const fb = await contactFacets(ctx.ownerB(), opts);
    expect(fb.owners.map((o) => o.id)).toEqual([IDS.ownerB]);
  });
});

describe('M1-02 performance: 10,000 contacts, p95 under 500 ms (TESTING performance budget)', () => {
  beforeAll(async () => {
    await tdb.admin`
      insert into contacts (tenant_id, first_name, last_name, phones, primary_phone_e164, emails, primary_email,
                            status, source, tags, owner_id, created_at, updated_at)
      select ${IDS.tenantA}::uuid, 'Lead' || g, 'Perf' || (g % 97),
             array['+1415' || lpad(g::text, 7, '0')], '+1415' || lpad(g::text, 7, '0'),
             array['lead' || g || '@example.test'], 'lead' || g || '@example.test',
             (array['new','working','booked','won','lost','dead'])[1 + g % 6],
             (array['facebook','angi','google_lsa','website','manual'])[1 + g % 5],
             case when g % 3 = 0 then array['roof'] else array['gutter','siding'] end,
             case when g % 2 = 0 then ${IDS.ownerA}::uuid else null end,
             now() - (g || ' minutes')::interval, now() - (g || ' seconds')::interval
      from generate_series(1, 10000) as g`;
    await tdb.admin`analyze contacts`;
  });

  it('every list shape the page issues stays under 500 ms at p95', async () => {
    const shapes: SearchContactsInput[] = [
      {},
      { statuses: ['new', 'working'], sources: ['facebook', 'angi'] },
      { q: 'perf4' },
      { q: '415000' },
      { tags: ['roof'], owners: [IDS.ownerA] },
      { owners: [NO_OWNER], sort: { field: 'name', desc: false } },
      { createdFrom: '2020-01-01', sort: { field: 'status', desc: true }, perPage: 50 },
      { page: 400, perPage: 20 }
    ];
    const times: number[] = [];
    for (let round = 0; round < 5; round++) {
      for (const s of shapes) {
        const t0 = performance.now();
        const r = await searchContacts(ctx.ownerA(), s, opts);
        times.push(performance.now() - t0);
        expect(r.total).toBeGreaterThanOrEqual(0);
      }
    }
    times.sort((a, b) => a - b);
    const p95 = times[Math.ceil(times.length * 0.95) - 1];
    expect(p95).toBeLessThan(500);
    const all = await searchContacts(ctx.ownerA(), {}, opts);
    expect(all.total).toBeGreaterThanOrEqual(10_000);
  });
});
