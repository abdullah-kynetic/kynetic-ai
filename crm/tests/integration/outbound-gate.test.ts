import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { createDb, type Db } from '@/server/db/client';
import { activities, contacts } from '@/server/db/schema';
import { recordConsent } from '@/server/consent';
import { checkOutbound, enrollInSequence } from '@/server/outbound';
import type { OutboundRequest } from '@/server/outbound';
import { withTenant } from '@/server/tenancy';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let tdb: TestDatabase;
let db: Db;

const MIDDAY = new Date('2026-10-26T18:00:00Z'); // 11:00 PDT, tenant A
const LATE = new Date('2026-10-27T05:00:00Z'); // 22:00 PDT

beforeAll(async () => {
  tdb = await createTestDatabase();
  await seedTwoTenants(tdb.admin);
  db = createDb(tdb.app);
});
afterAll(async () => {
  await tdb?.drop();
});

let seq = 0;
let callSeq = 0;
async function newContact() {
  seq += 1;
  const [c] = await withTenant(
    ctx.ownerA(),
    (tx) =>
      tx
        .insert(contacts)
        .values({
          tenantId: IDS.tenantA,
          firstName: `Gate ${seq}`,
          primaryPhoneE164: `+1555555${String(3000 + seq)}`
        })
        .returning(),
    { db }
  );
  return c;
}
async function consented(channel: 'phone_call' | 'sms' = 'phone_call') {
  const c = await newContact();
  await recordConsent(
    ctx.ownerA(),
    {
      contactId: c.id,
      channel,
      source: 'form',
      capturedText: 'ok',
      capturedAt: new Date('2026-10-01T00:00:00Z')
    },
    { db }
  );
  return c;
}
const gate = (
  contactId: string,
  over: Partial<OutboundRequest> = {},
  opts: Parameters<typeof checkOutbound>[3] = {},
  now = MIDDAY
) =>
  checkOutbound(
    ctx.ownerA(),
    { contactId, channel: 'phone_call', module: 'alex_core', ...over },
    now,
    { db, outboundEnabled: true, ...opts }
  );
const admin = () => tdb.admin;
const blockedLog = async (contactId: string) =>
  withTenant(
    ctx.ownerA(),
    (tx) =>
      tx
        .select({ summary: activities.summary })
        .from(activities)
        .where(and(eq(activities.contactId, contactId), eq(activities.type, 'system'))),
    { db }
  );

describe('OutboundGate', () => {
  it('allows a consented call when every switch is on', async () => {
    const c = await consented();
    expect(await gate(c.id)).toEqual({ allowed: true });
  });

  it('refuses everything with the kill switch on, before any other check', async () => {
    const c = await consented();
    expect(await gate(c.id, {}, { outboundEnabled: false })).toEqual({
      allowed: false,
      reason: 'outbound_disabled'
    });
    expect((await blockedLog(c.id)).map((r) => r.summary)).toEqual([
      'blocked: outbound_disabled (phone_call)'
    ]);
  });

  it('defaults the kill switch to OUTBOUND_ENABLED, which is false', async () => {
    const c = await consented();
    const prev = { ...process.env };
    Object.assign(process.env, {
      APP_BASE_URL: 'http://localhost:3000',
      DATABASE_URL: 'postgres://x',
      DATABASE_URL_AUTH: 'postgres://x',
      BETTER_AUTH_SECRET: 'x'.repeat(32),
      APP_ENCRYPTION_KEY: 'y'.repeat(32)
    });
    delete process.env.OUTBOUND_ENABLED;
    try {
      const d = await checkOutbound(
        ctx.ownerA(),
        { contactId: c.id, channel: 'phone_call', module: 'alex_core' },
        MIDDAY,
        { db }
      );
      expect(d).toEqual({ allowed: false, reason: 'outbound_disabled' });
    } finally {
      process.env = prev;
    }
  });

  it('refuses a suspended tenant', async () => {
    const c = await consented();
    await admin()`update tenants set status = 'suspended' where id = ${IDS.tenantA}`;
    try {
      expect(await gate(c.id)).toEqual({ allowed: false, reason: 'tenant_suspended' });
    } finally {
      await admin()`update tenants set status = 'active' where id = ${IDS.tenantA}`;
    }
  });

  it('refuses when the module is off or was never enabled', async () => {
    const c = await consented();
    expect(await gate(c.id, { module: 'reactivation' })).toEqual({
      allowed: false,
      reason: 'module_off'
    });
  });

  it('refuses calls and texts while Alex is paused, but not email', async () => {
    const call = await consented();
    const email = await consented('phone_call');
    await admin()`update alex_configs set paused = true where tenant_id = ${IDS.tenantA}`;
    try {
      expect(await gate(call.id)).toEqual({ allowed: false, reason: 'alex_paused' });
      expect(await gate(email.id, { channel: 'sms' })).toEqual({
        allowed: false,
        reason: 'alex_paused'
      });
      const e = await newContact();
      await recordConsent(
        ctx.ownerA(),
        {
          contactId: e.id,
          channel: 'email',
          source: 'form',
          capturedText: 'ok',
          capturedAt: new Date('2026-10-01T00:00:00Z')
        },
        { db }
      );
      expect(await gate(e.id, { channel: 'email' })).toEqual({ allowed: true });
    } finally {
      await admin()`update alex_configs set paused = false where tenant_id = ${IDS.tenantA}`;
    }
  });

  it('denies SMS until a number has an approved A2P campaign', async () => {
    const c = await consented('sms');
    expect(await gate(c.id, { channel: 'sms' })).toEqual({
      allowed: false,
      reason: 'sms_not_approved'
    });
    await admin()`update phone_numbers set a2p_status = 'approved' where tenant_id = ${IDS.tenantA}`;
    try {
      expect(await gate(c.id, { channel: 'sms' })).toEqual({ allowed: true });
      await admin()`update phone_numbers set released_at = now() where tenant_id = ${IDS.tenantA}`;
      expect(await gate(c.id, { channel: 'sms' })).toEqual({
        allowed: false,
        reason: 'sms_not_approved'
      });
    } finally {
      await admin()`update phone_numbers set a2p_status = 'not_registered', released_at = null where tenant_id = ${IDS.tenantA}`;
    }
  });

  describe('rate caps', () => {
    const addCalls = async (contactId: string, startedAt: Date[]) => {
      for (const at of startedAt) {
        await admin()`insert into calls (tenant_id, contact_id, provider, provider_call_id, direction, started_at)
          values (${IDS.tenantA}, ${contactId}, 'fake', ${`cap-${contactId}-${(callSeq += 1)}`}, 'outbound', ${at.toISOString()})`;
      }
    };
    const ago = (h: number) => new Date(MIDDAY.getTime() - h * 3_600_000);

    it('allows two calls in a day and refuses the third attempt after three', async () => {
      const c = await consented();
      await addCalls(c.id, [ago(1), ago(2)]);
      expect(await gate(c.id)).toEqual({ allowed: true });
      await addCalls(c.id, [ago(3)]);
      expect(await gate(c.id)).toEqual({ allowed: false, reason: 'rate_cap' });
    });

    it('refuses a seventh call in a week even when the day is clear', async () => {
      const c = await consented();
      await addCalls(c.id, [ago(30), ago(54), ago(78), ago(102), ago(126), ago(150)]);
      expect(await gate(c.id)).toEqual({ allowed: false, reason: 'rate_cap' });
    });

    it('ignores inbound calls and other contacts', async () => {
      const c = await consented();
      const other = await newContact();
      await addCalls(other.id, [ago(1), ago(2), ago(3)]);
      await admin()`insert into calls (tenant_id, contact_id, provider, provider_call_id, direction, started_at)
        values (${IDS.tenantA}, ${c.id}, 'fake', ${`in-${c.id}`}, 'inbound', ${ago(1).toISOString()})`;
      expect(await gate(c.id)).toEqual({ allowed: true });
    });

    it('enforces a per-tenant hourly cap only when one is supplied', async () => {
      const c = await consented();
      const other = await newContact();
      await addCalls(other.id, [new Date(MIDDAY.getTime() - 600_000)]);
      expect(await gate(c.id)).toEqual({ allowed: true });
      expect(await gate(c.id, {}, { tenantHourlyCallCap: 1 })).toEqual({
        allowed: false,
        reason: 'rate_cap'
      });
    });
  });

  it('passes consent denials through from canContact', async () => {
    const none = await newContact();
    expect(await gate(none.id)).toEqual({ allowed: false, reason: 'no_consent' });
    const c = await consented();
    expect(await gate(c.id, {}, {}, LATE)).toMatchObject({ allowed: false, reason: 'quiet_hours' });
  });

  it('does not leak or log for another tenant’s contact', async () => {
    const b = await tdb.admin`select id from contacts where tenant_id = ${IDS.tenantB} limit 1`;
    expect(await gate(b[0].id, {}, { outboundEnabled: false })).toEqual({
      allowed: false,
      reason: 'outbound_disabled'
    });
    const rows =
      await tdb.admin`select 1 from activities where contact_id = ${b[0].id} and type = 'system' and summary like 'blocked%'`;
    expect(rows.length).toBe(0);
  });

  it('enrollInSequence is a stub that reports not_available', async () => {
    const c = await consented();
    expect(await enrollInSequence(ctx.ownerA(), { contactId: c.id, sequenceKey: 'x' })).toEqual({
      status: 'not_available'
    });
  });
});
