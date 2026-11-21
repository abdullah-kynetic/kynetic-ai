import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { stopJobs } from '@/server/jobs';
import { issueServiceToken } from '@/server/service-auth';
import { GET as listRoute, POST as createRoute } from '@/app/api/service/appointments/route';
import { GET as getRoute, PATCH as patchRoute } from '@/app/api/service/appointments/[id]/route';
import { POST as cancelRoute } from '@/app/api/service/appointments/[id]/cancel/route';
import { GET as availabilityRoute } from '@/app/api/service/appointments/availability/route';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let tdb: TestDatabase;
let db: Db;
let keyN = 0;

const headers = (token?: string, key: string | null = `key-${Date.now()}-${keyN++}`) => ({
  'content-type': 'application/json',
  ...(token ? { authorization: `Bearer ${token}` } : {}),
  ...(key ? { 'idempotency-key': key } : {})
});
const body = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v));

async function token(who: 'A' | 'B', scopes: string[]) {
  const c = who === 'A' ? ctx.ownerA() : ctx.ownerB();
  return issueServiceToken(c, { label: 'test', scopes }, { db });
}

// Monday 2030-03-04. Business hours are 09:00 to 17:00 UTC, Monday to Friday.
const day = '2030-03-04';
const at = (hhmm: string) => `${day}T${hhmm}:00.000Z`;

const book = (v: unknown, t?: string) =>
  createRoute(
    new Request('http://localhost/api/service/appointments', {
      method: 'POST',
      headers: headers(t),
      body: body(v)
    })
  );
const detail = (id: string, t?: string) =>
  getRoute(
    new Request(`http://localhost/api/service/appointments/${id}`, {
      headers: headers(t, null)
    }),
    { params: Promise.resolve({ id }) }
  );
const reschedule = (id: string, v: unknown, t?: string) =>
  patchRoute(
    new Request(`http://localhost/api/service/appointments/${id}`, {
      method: 'PATCH',
      headers: headers(t),
      body: body(v)
    }),
    { params: Promise.resolve({ id }) }
  );
const cancel = (id: string, t?: string) =>
  cancelRoute(
    new Request(`http://localhost/api/service/appointments/${id}/cancel`, {
      method: 'POST',
      headers: headers(t),
      body: ''
    }),
    { params: Promise.resolve({ id }) }
  );
const availability = (qs: string, t?: string) =>
  availabilityRoute(
    new Request(`http://localhost/api/service/appointments/availability${qs}`, {
      headers: headers(t, null)
    })
  );
const list = (qs: string, t?: string) =>
  listRoute(
    new Request(`http://localhost/api/service/appointments${qs}`, { headers: headers(t, null) })
  );

const counts = async () => {
  const [r] = await tdb.admin`select
    (select count(*) from appointments)::int as appointments,
    (select count(*) from audit_log where action = 'appointment.cancel')::int as cancels`;
  return r!;
};

beforeAll(async () => {
  tdb = await createTestDatabase({ jobs: true });
  await seedTwoTenants(tdb.admin);
  await tdb.admin`insert into tenant_modules (tenant_id, module_key, enabled, level)
    values (${IDS.tenantA}, 'crm', true, 'full')`;
  const weekday = { open: '09:00', close: '17:00' };
  const hours = { mon: [weekday], tue: [weekday], wed: [weekday], thu: [weekday], fri: [weekday] };
  await tdb.admin`update tenants set business_hours = ${tdb.admin.json(hours)}, timezone = 'UTC'
    where id = ${IDS.tenantA}`;
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

describe('appointments: auth and scope', () => {
  it('401 without a token; reads need appointments:read, writes need appointments:write', async () => {
    expect((await list('')).status).toBe(401);
    const readOnly = await token('A', ['appointments:read']);
    expect((await list('', readOnly.token)).status).toBe(200);
    expect(
      (await book({ startsAt: at('10:00'), endsAt: at('10:30') }, readOnly.token)).status
    ).toBe(401);
  });
});

describe('appointments: book and read', () => {
  it('books inside business hours with a DTO and no contact details', async () => {
    const t = await token('A', ['appointments:read', 'appointments:write']);
    const c = await counts();
    const res = await book({ startsAt: at('10:00'), endsAt: at('10:30') }, t.token);
    expect(res.status).toBe(201);
    const data = (await res.json()).data;
    expect(data).toMatchObject({ status: 'scheduled', bookedBy: 'user' });
    expect((await counts()).appointments).toBe(c.appointments + 1);
    expect((await detail(data.id, t.token)).status).toBe(200);
  });

  it('a time outside business hours is a 400 and nothing is written', async () => {
    const t = await token('A', ['appointments:write']);
    const c = await counts();
    expect((await book({ startsAt: at('20:00'), endsAt: at('20:30') }, t.token)).status).toBe(400);
    expect(await counts()).toEqual(c);
  });

  it('a slot that clashes with a booking is a 409', async () => {
    const t = await token('A', ['appointments:write']);
    const c = await counts();
    expect((await book({ startsAt: at('10:15'), endsAt: at('10:45') }, t.token)).status).toBe(409);
    expect(await counts()).toEqual(c);
  });

  it('availability leaves out the booked slot and returns free slots in business hours', async () => {
    const t = await token('A', ['appointments:read']);
    const res = await availability(
      `?from=${at('09:00')}&to=${at('12:00')}&durationMinutes=30`,
      t.token
    );
    expect(res.status).toBe(200);
    const slots: string[] = (await res.json()).data.slots;
    expect(slots).toContain(at('09:00'));
    expect(slots).not.toContain(at('10:00'));
  });
});

describe('appointments: reschedule and cancel', () => {
  it('reschedule into business hours works; outside them is a 400', async () => {
    const t = await token('A', ['appointments:write']);
    const made = (
      await (await book({ startsAt: at('13:00'), endsAt: at('13:30') }, t.token)).json()
    ).data;
    expect(
      (await reschedule(made.id, { startsAt: at('14:00'), endsAt: at('14:30') }, t.token)).status
    ).toBe(200);
    expect(
      (await reschedule(made.id, { startsAt: at('21:00'), endsAt: at('21:30') }, t.token)).status
    ).toBe(400);
    expect((await reschedule(made.id, {}, t.token)).status).toBe(400);
  });

  it('cancel is idempotent: the second cancel changes nothing and writes no second audit row', async () => {
    const t = await token('A', ['appointments:write']);
    const made = (
      await (await book({ startsAt: at('15:00'), endsAt: at('15:30') }, t.token)).json()
    ).data;
    const first = await cancel(made.id, t.token);
    expect(first.status).toBe(200);
    expect((await first.json()).data.status).toBe('cancelled');
    const c = await counts();
    const again = await cancel(made.id, t.token);
    expect(again.status).toBe(200);
    expect((await again.json()).data.status).toBe('cancelled');
    expect((await counts()).cancels).toBe(c.cancels);
  });
});

describe('appointments: tenant isolation', () => {
  it("another tenant's appointment is a 404 and nothing changes", async () => {
    const t = await token('A', ['appointments:read', 'appointments:write']);
    const [other] =
      await tdb.admin`insert into appointments (tenant_id, starts_at, ends_at, status, booked_by)
      values (${IDS.tenantB}, ${at('11:00')}, ${at('11:30')}, 'scheduled', 'user') returning id`;
    const c = await counts();
    expect((await detail(other!.id, t.token)).status).toBe(404);
    expect((await reschedule(other!.id, { notes: 'x' }, t.token)).status).toBe(404);
    expect((await cancel(other!.id, t.token)).status).toBe(404);
    expect(await counts()).toEqual(c);
  });
});
