import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { stopJobs } from '@/server/jobs';
import { getStorage } from '@/server/adapters/storage';
import type { FakeStorage } from '@/server/adapters/storage/fake';
import { issueServiceToken } from '@/server/service-auth';
import { GET as listRoute, POST as uploadRoute } from '@/app/api/service/documents/route';
import { GET as urlRoute } from '@/app/api/service/documents/[id]/url/route';
import { DELETE as deleteRoute } from '@/app/api/service/documents/[id]/route';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

// C10 documents: scopes, PDF-only uploads, 413 for oversize, signed links and soft delete.

let tdb: TestDatabase;
let db: Db;
let keyN = 0;

const PDF = Buffer.from('%PDF-1.4\n% test document\n');
const pdfBase64 = PDF.toString('base64');

const headers = (token?: string, key: string | null = `doc-${Date.now()}-${keyN++}`) => ({
  'content-type': 'application/json',
  ...(token ? { authorization: `Bearer ${token}` } : {}),
  ...(key ? { 'idempotency-key': key } : {})
});
async function token(scopes: string[]) {
  return issueServiceToken(ctx.ownerA(), { label: 'test', scopes }, { db });
}
const withId = (id: string) => ({ params: Promise.resolve({ id }) });

beforeAll(async () => {
  tdb = await createTestDatabase({ jobs: true });
  await seedTwoTenants(tdb.admin);
  await tdb.admin`delete from tenant_modules where module_key = 'crm' and tenant_id in (${IDS.tenantA}, ${IDS.tenantB})`;
  await tdb.admin`insert into tenant_modules (tenant_id, module_key, enabled, level) values
    (${IDS.tenantA}, 'crm', true, 'full'),
    (${IDS.tenantB}, 'crm', true, 'full')`;
  db = createDb(tdb.app);
  Object.assign(process.env, {
    APP_BASE_URL: 'http://localhost:3000',
    DATABASE_URL: tdb.urls.app,
    DATABASE_URL_WORKER: tdb.urls.worker,
    DATABASE_URL_AUTH: tdb.authUrl,
    BETTER_AUTH_SECRET: 'integration-only-secret-not-real-000000000000',
    APP_ENCRYPTION_KEY: 'integration-only-encryption-key-not-real'
  });
  (globalThis as typeof globalThis & { __kyneticDb?: Db }).__kyneticDb = db;
});
afterAll(async () => {
  await stopJobs();
  delete (globalThis as typeof globalThis & { __kyneticDb?: Db }).__kyneticDb;
  await tdb?.drop();
});

const list = (t?: string) =>
  listRoute(new Request('http://localhost/api/service/documents', { headers: headers(t, null) }));
const upload = (body: unknown, t?: string, key?: string | null) =>
  uploadRoute(
    new Request('http://localhost/api/service/documents', {
      method: 'POST',
      headers: headers(t, key === undefined ? undefined : key),
      body: JSON.stringify(body)
    })
  );
const link = (id: string, t?: string) =>
  urlRoute(
    new Request(`http://localhost/api/service/documents/${id}/url`, { headers: headers(t, null) }),
    withId(id)
  );
const remove = (id: string, t?: string, key?: string | null) =>
  deleteRoute(
    new Request(`http://localhost/api/service/documents/${id}`, {
      method: 'DELETE',
      headers: headers(t, key === undefined ? undefined : key)
    }),
    withId(id)
  );
const doc = (over: Record<string, unknown> = {}) => ({
  title: 'Signed agreement',
  kind: 'agreement',
  fileName: 'agreement.pdf',
  contentBase64: pdfBase64,
  ...over
});

describe('service API documents (C10)', () => {
  it('needs documents:read to list and documents:write to upload or delete', async () => {
    const reader = await token(['documents:read']);
    expect((await list(reader.token)).status).toBe(200);
    // A token without the scope is treated as unauthenticated, as in every service route.
    expect((await upload(doc(), reader.token)).status).toBe(401);
    expect((await list(undefined)).status).toBe(401);
  });

  it('uploads a PDF, lists it, and returns a link that expires in about five minutes', async () => {
    const writer = await token(['documents:read', 'documents:write']);
    const created = await upload(doc(), writer.token);
    expect(created.status).toBe(201);
    const { data } = await created.json();
    const listed = await (await list(writer.token)).json();
    expect(listed.data.map((d: { id: string }) => d.id)).toContain(data.id);

    const res = await link(data.id, writer.token);
    expect(res.status).toBe(200);
    const { data: signed } = await res.json();
    const expires = Number(new URL(signed.url).searchParams.get('expires'));
    const seconds = expires - Math.floor(Date.now() / 1000);
    expect(seconds).toBeGreaterThan(240);
    expect(seconds).toBeLessThanOrEqual(310);
    const stored = (getStorage() as FakeStorage).fetchSigned(signed.url);
    expect(Buffer.from(stored!.body).toString('utf8')).toContain('%PDF-');
  });

  it('refuses a non-PDF type with 400', async () => {
    const writer = await token(['documents:write']);
    const res = await upload(doc({ fileName: 'agreement.docx' }), writer.token);
    expect(res.status).toBe(400);
    const notPdf = await upload(
      doc({ contentBase64: Buffer.from('hello world').toString('base64') }),
      writer.token
    );
    expect(notPdf.status).toBe(400);
  });

  it('refuses a file over the cap with 413', async () => {
    const writer = await token(['documents:write']);
    const big = Buffer.alloc(10 * 1024 * 1024 + 1, 0x20);
    big.write('%PDF-1.4', 0, 'ascii');
    const res = await upload(doc({ contentBase64: big.toString('base64') }), writer.token);
    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('a foreign tenant document is 404 for link and delete', async () => {
    const writerB = await token(['documents:read', 'documents:write']);
    const made = await upload(doc({ title: 'Tenant A only' }), writerB.token);
    const { data } = await made.json();
    const foreign = await link(data.id, writerB.token);
    expect(foreign.status).toBe(200); // same tenant token, sanity check
    const bad = await tokenForOtherTenant();
    expect((await link(data.id, bad)).status).toBe(404);
    expect((await remove(data.id, bad)).status).toBe(404);
  });

  it('soft delete hides the document and its link returns 404', async () => {
    const writer = await token(['documents:read', 'documents:write']);
    const { data } = await (await upload(doc({ title: 'To remove' }), writer.token)).json();
    expect((await remove(data.id, writer.token)).status).toBe(200);
    expect((await link(data.id, writer.token)).status).toBe(404);
    const listed = await (await list(writer.token)).json();
    expect(listed.data.map((d: { id: string }) => d.id)).not.toContain(data.id);
  });

  it('a repeated upload with the same Idempotency-Key does not store a second document', async () => {
    const writer = await token(['documents:write', 'documents:read']);
    const key = `doc-idem-${Date.now()}`;
    const first = await upload(doc({ title: 'Once' }), writer.token, key);
    const second = await upload(doc({ title: 'Once' }), writer.token, key);
    expect(first.status).toBe(201);
    expect(second.status).toBe(first.status);
    const listed = await (await list(writer.token)).json();
    expect(listed.data.filter((d: { title: string }) => d.title === 'Once')).toHaveLength(1);
  });
});

async function tokenForOtherTenant() {
  const { token: t } = await issueServiceToken(
    ctx.ownerB(),
    { label: 'other', scopes: ['documents:read', 'documents:write'] },
    { db }
  );
  return t;
}
