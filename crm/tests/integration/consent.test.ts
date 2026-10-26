import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { createDb, type Db } from '@/server/db/client';
import { activities, consents, contacts } from '@/server/db/schema';
import { addDncEntry, canContact, recordConsent, revokeConsent } from '@/server/consent';
import type { ConsentChannel, ContactDecision } from '@/server/consent';
import { withTenant } from '@/server/tenancy';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let tdb: TestDatabase;
let db: Db;

// Tenant A is in America/Los_Angeles (PDT until 2026-11-01).
const MIDDAY = new Date('2026-10-26T18:00:00Z'); // 11:00 PDT
const LATE = new Date('2026-10-27T05:00:00Z'); // 22:00 PDT
const NEXT_OPEN = new Date('2026-10-27T15:00:00Z'); // 08:00 PDT

beforeAll(async () => {
  tdb = await createTestDatabase();
  await seedTwoTenants(tdb.admin);
  db = createDb(tdb.app);
});
afterAll(async () => {
  await tdb?.drop();
});

let seq = 0;
async function newContact(over: Partial<typeof contacts.$inferInsert> = {}) {
  seq += 1;
  const [c] = await withTenant(
    ctx.ownerA(),
    (tx) =>
      tx
        .insert(contacts)
        .values({
          tenantId: IDS.tenantA,
          firstName: `Case ${seq}`,
          primaryPhoneE164: `+1555555${String(2000 + seq)}`,
          ...over
        })
        .returning(),
    { db }
  );
  return c;
}
const grant = (contactId: string, channel: ConsentChannel, at = '2026-10-01T00:00:00Z') =>
  recordConsent(
    ctx.ownerA(),
    {
      contactId,
      channel,
      source: 'form',
      capturedText: 'I agree to be called',
      capturedAt: new Date(at)
    },
    { db }
  );
const check = (contactId: string, channel: ConsentChannel, now = MIDDAY, purpose?: string) =>
  canContact(ctx.ownerA(), contactId, channel, now, { db, purpose });

type Case = {
  name: string;
  channel: ConsentChannel;
  now?: Date;
  contact?: Partial<typeof contacts.$inferInsert>;
  setup?: (contactId: string, phone: string) => Promise<unknown>;
  expected: ContactDecision;
};

const cases: Case[] = [
  {
    name: 'no consent row',
    channel: 'phone_call',
    expected: { allowed: false, reason: 'no_consent' }
  },
  {
    name: 'consent for another channel does not cover this one',
    channel: 'sms',
    setup: (id) => grant(id, 'phone_call'),
    expected: { allowed: false, reason: 'no_consent' }
  },
  {
    name: 'phone consent in business hours',
    channel: 'phone_call',
    setup: (id) => grant(id, 'phone_call'),
    expected: { allowed: true }
  },
  {
    name: 'sms consent in business hours',
    channel: 'sms',
    setup: (id) => grant(id, 'sms'),
    expected: { allowed: true }
  },
  {
    name: 'email consent is not subject to quiet hours',
    channel: 'email',
    now: LATE,
    setup: (id) => grant(id, 'email'),
    expected: { allowed: true }
  },
  {
    name: 'call at 22:00 lead-local is deferred to 08:00',
    channel: 'phone_call',
    now: LATE,
    setup: (id) => grant(id, 'phone_call'),
    expected: { allowed: false, reason: 'quiet_hours', retryAt: NEXT_OPEN }
  },
  {
    name: 'sms at 22:00 lead-local is deferred to 08:00',
    channel: 'sms',
    now: LATE,
    setup: (id) => grant(id, 'sms'),
    expected: { allowed: false, reason: 'quiet_hours', retryAt: NEXT_OPEN }
  },
  {
    name: 'contact timezone beats the tenant timezone (Eastern at 11:00 PDT is 14:00 EDT)',
    channel: 'phone_call',
    contact: { timezone: 'America/New_York' },
    now: new Date('2026-10-27T01:30:00Z'), // 21:30 EDT, 18:30 PDT
    setup: (id) => grant(id, 'phone_call'),
    expected: { allowed: false, reason: 'quiet_hours', retryAt: new Date('2026-10-27T12:00:00Z') }
  },
  {
    name: 'unusable contact timezone falls back to the tenant timezone',
    channel: 'phone_call',
    contact: { timezone: 'Not/AZone' },
    setup: (id) => grant(id, 'phone_call'),
    expected: { allowed: true }
  },
  {
    name: 'revoked by staff',
    channel: 'phone_call',
    setup: async (id) => {
      await grant(id, 'phone_call');
      return revokeConsent(
        ctx.ownerA(),
        {
          contactId: id,
          channel: 'phone_call',
          source: 'staff',
          capturedAt: new Date('2026-10-02T00:00:00Z')
        },
        { db }
      );
    },
    expected: { allowed: false, reason: 'consent_revoked' }
  },
  {
    name: 'sms STOP',
    channel: 'sms',
    setup: async (id) => {
      await grant(id, 'sms');
      return revokeConsent(
        ctx.ownerA(),
        {
          contactId: id,
          channel: 'sms',
          source: 'sms_keyword',
          capturedAt: new Date('2026-10-02T00:00:00Z')
        },
        { db }
      );
    },
    expected: { allowed: false, reason: 'opted_out' }
  },
  {
    name: 'STOP on sms leaves phone consent alone',
    channel: 'phone_call',
    setup: async (id) => {
      await grant(id, 'phone_call');
      await grant(id, 'sms');
      return revokeConsent(
        ctx.ownerA(),
        { contactId: id, channel: 'sms', source: 'sms_keyword' },
        { db }
      );
    },
    expected: { allowed: true }
  },
  {
    name: 'consent granted again after a revoke works',
    channel: 'phone_call',
    setup: async (id) => {
      await grant(id, 'phone_call', '2026-10-01T00:00:00Z');
      await revokeConsent(
        ctx.ownerA(),
        {
          contactId: id,
          channel: 'phone_call',
          source: 'staff',
          capturedAt: new Date('2026-10-02T00:00:00Z')
        },
        { db }
      );
      return grant(id, 'phone_call', '2026-10-03T00:00:00Z');
    },
    expected: { allowed: true }
  },
  {
    name: 'grant and revoke with the same timestamp resolves to revoked',
    channel: 'phone_call',
    setup: async (id) => {
      await grant(id, 'phone_call', '2026-10-02T00:00:00Z');
      return revokeConsent(
        ctx.ownerA(),
        {
          contactId: id,
          channel: 'phone_call',
          source: 'staff',
          capturedAt: new Date('2026-10-02T00:00:00Z')
        },
        { db }
      );
    },
    expected: { allowed: false, reason: 'consent_revoked' }
  },
  {
    name: 'internal DNC by contact blocks calls despite consent',
    channel: 'phone_call',
    setup: async (id, phone) => {
      await grant(id, 'phone_call');
      return addDncEntry(ctx.ownerA(), { e164: phone, contactId: id, source: 'opt_out' }, { db });
    },
    expected: { allowed: false, reason: 'internal_dnc' }
  },
  {
    name: 'internal DNC by contact blocks sms too',
    channel: 'sms',
    setup: async (id, phone) => {
      await grant(id, 'sms');
      return addDncEntry(ctx.ownerA(), { e164: phone, contactId: id, source: 'opt_out' }, { db });
    },
    expected: { allowed: false, reason: 'internal_dnc' }
  },
  {
    name: 'internal DNC does not block email',
    channel: 'email',
    setup: async (id, phone) => {
      await grant(id, 'email');
      return addDncEntry(ctx.ownerA(), { e164: phone, contactId: id, source: 'opt_out' }, { db });
    },
    expected: { allowed: true }
  },
  {
    name: 'a DNC number with no contact link still blocks the contact that owns it',
    channel: 'phone_call',
    setup: async (id, phone) => {
      await grant(id, 'phone_call');
      return addDncEntry(ctx.ownerA(), { e164: phone, source: 'import' }, { db });
    },
    expected: { allowed: false, reason: 'internal_dnc' }
  },
  {
    name: 'DNC beats quiet hours',
    channel: 'phone_call',
    now: LATE,
    setup: async (id, phone) => {
      await grant(id, 'phone_call');
      return addDncEntry(ctx.ownerA(), { e164: phone, contactId: id, source: 'staff' }, { db });
    },
    expected: { allowed: false, reason: 'internal_dnc' }
  }
];

describe('canContact (table-driven)', () => {
  it.each(cases)('$name', async (c) => {
    const contact = await newContact(c.contact);
    await c.setup?.(contact.id, contact.primaryPhoneE164 as string);
    expect(await check(contact.id, c.channel, c.now)).toEqual(c.expected);
  });

  it('is unknown_timezone when neither the contact nor the tenant has a valid zone', async () => {
    const contact = await newContact({ timezone: 'Not/AZone' });
    await grant(contact.id, 'phone_call');
    await tdb.admin`update tenants set timezone = 'Not/AZone' where id = ${IDS.tenantA}`;
    try {
      expect(await check(contact.id, 'phone_call')).toEqual({
        allowed: false,
        reason: 'unknown_timezone'
      });
    } finally {
      await tdb.admin`update tenants set timezone = 'America/Los_Angeles' where id = ${IDS.tenantA}`;
    }
  });

  it('applies a stricter per-state window on top of the default', async () => {
    const contact = await newContact({ address: { state: 'tx' }, timezone: 'America/Chicago' });
    await grant(contact.id, 'phone_call');
    const now = new Date('2026-10-26T14:30:00Z'); // 09:30 CDT
    const stateWindows = { TX: { startMinute: 10 * 60, endMinute: 20 * 60 } };
    expect(await canContact(ctx.ownerA(), contact.id, 'phone_call', now, { db })).toEqual({
      allowed: true
    });
    expect(
      await canContact(ctx.ownerA(), contact.id, 'phone_call', now, { db, stateWindows })
    ).toEqual({
      allowed: false,
      reason: 'quiet_hours',
      retryAt: new Date('2026-10-26T15:00:00Z')
    });
  });

  it("does not see another tenant's contact", async () => {
    const [b] = await tdb.admin`select id from contacts where tenant_id = ${IDS.tenantB}`;
    expect(await check(b.id, 'phone_call')).toEqual({ allowed: false, reason: 'no_consent' });
  });

  it('a deleted contact has no consent', async () => {
    const contact = await newContact();
    await grant(contact.id, 'phone_call');
    await tdb.admin`update contacts set deleted_at = now() where id = ${contact.id}`;
    expect(await check(contact.id, 'phone_call')).toEqual({ allowed: false, reason: 'no_consent' });
  });
});

describe('decision log', () => {
  it('writes a blocked activity for a deny and records purpose', async () => {
    const contact = await newContact();
    await check(contact.id, 'sms', MIDDAY, 'speed_to_lead');
    const rows = await withTenant(
      ctx.ownerA(),
      (tx) => tx.select().from(activities).where(eq(activities.contactId, contact.id)),
      { db }
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].summary).toBe('blocked: no_consent (sms)');
    expect(rows[0].meta).toMatchObject({
      allowed: false,
      reason: 'no_consent',
      purpose: 'speed_to_lead'
    });
  });

  it('writes an allow activity, and skips it when audit is false', async () => {
    const contact = await newContact();
    await grant(contact.id, 'phone_call');
    await check(contact.id, 'phone_call');
    await canContact(ctx.ownerA(), contact.id, 'phone_call', MIDDAY, { db, audit: false });
    const rows = await withTenant(
      ctx.ownerA(),
      (tx) => tx.select().from(activities).where(eq(activities.contactId, contact.id)),
      { db }
    );
    expect(rows.map((r) => r.summary)).toEqual(['contact allowed: phone_call']);
  });

  it('runs inside the caller transaction when given one', async () => {
    const contact = await newContact();
    await expect(
      withTenant(
        ctx.ownerA(),
        async (tx) => {
          await canContact(ctx.ownerA(), contact.id, 'sms', MIDDAY, { tx });
          throw new Error('roll back');
        },
        { db }
      )
    ).rejects.toThrow('roll back');
    const rows = await withTenant(
      ctx.ownerA(),
      (tx) => tx.select().from(activities).where(eq(activities.contactId, contact.id)),
      { db }
    );
    expect(rows).toHaveLength(0);
  });
});

describe('recording', () => {
  it('rejects staff and form consent without wording or basis', async () => {
    const contact = await newContact();
    await expect(
      recordConsent(
        ctx.ownerA(),
        { contactId: contact.id, channel: 'sms', source: 'staff' },
        { db }
      )
    ).rejects.toThrow();
  });

  it('revoking appends a row and leaves the original grant untouched', async () => {
    const contact = await newContact();
    await grant(contact.id, 'sms');
    await revokeConsent(
      ctx.ownerA(),
      { contactId: contact.id, channel: 'sms', source: 'staff' },
      { db }
    );
    const rows = await withTenant(
      ctx.ownerA(),
      (tx) =>
        tx
          .select()
          .from(consents)
          .where(and(eq(consents.contactId, contact.id), eq(consents.channel, 'sms'))),
      { db }
    );
    expect(rows.map((r) => r.kind).toSorted()).toEqual(['express_written', 'opt_out']);
    expect(rows.find((r) => r.kind === 'express_written')?.revokedAt).toBeNull();
  });

  it('adding the same DNC number twice is a no-op', async () => {
    const contact = await newContact();
    const e164 = contact.primaryPhoneE164 as string;
    await addDncEntry(ctx.ownerA(), { e164, source: 'staff' }, { db });
    await addDncEntry(ctx.ownerA(), { e164, source: 'staff' }, { db });
    const [{ n }] =
      await tdb.admin`select count(*)::int as n from dnc_entries where e164 = ${e164}`;
    expect(n).toBe(1);
  });

  it('tenant B cannot record consent for tenant A contact', async () => {
    const contact = await newContact();
    await expect(
      recordConsent(
        ctx.ownerB(),
        { contactId: contact.id, channel: 'sms', source: 'form', capturedText: 'x' },
        { db }
      )
    ).rejects.toThrow();
  });
});
