import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Actor } from '@/server/auth';
import { flagCall, getCallDetail } from '@/server/calls';
import { stopJobs } from '@/server/jobs';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { ctx, IDS, seedTwoTenants, type SeededTenant } from '../helpers/fixtures';

let db: TestDatabase;
let a: SeededTenant;

beforeAll(async () => {
  db = await createTestDatabase({ jobs: true });
  ({ a } = await seedTwoTenants(db.admin));
  process.env.APP_BASE_URL = 'http://localhost:3000';
  process.env.BETTER_AUTH_SECRET = 'x'.repeat(32);
  process.env.APP_ENCRYPTION_KEY = 'y'.repeat(32);
  process.env.DATABASE_URL = db.urls.app;
  process.env.DATABASE_URL_WORKER = db.urls.worker;
  process.env.DATABASE_URL_AUTH = db.authUrl;
});
afterAll(async () => {
  await stopJobs();
  await db?.drop();
});

const actor = (tenantId: string, role: 'owner' | 'staff', userId: string): Actor => ({
  userId,
  kyneticRole: null,
  membership: { tenantId, role, canExport: false, canBulkDelete: false },
  viewAs: null
});
const ownerA = actor(IDS.tenantA, 'owner', IDS.ownerA);

let n = 0;
async function insertCall(over: { transcript?: string | null; recordingKey?: string | null } = {}) {
  n += 1;
  const [row] = await db.admin`
    insert into calls (tenant_id, contact_id, provider, provider_call_id, direction, started_at,
      duration_s, outcome, sentiment, summary, transcript, extracted, recording_key, disclosure_given)
    values (${IDS.tenantA}, ${a.contactId}, 'elevenlabs', ${`conv_detail_${n}`}, 'outbound',
      '2026-10-26T10:00:00Z', 84, 'booked', 'positive', 'Agreed to an estimate.',
      ${over.transcript === undefined ? 'Alex: Hi\nLead: Yes' : over.transcript},
      ${db.admin.json({ service: 'roof repair' })}, ${over.recordingKey ?? null}, true)
    returning id`;
  return row.id as string;
}

beforeEach(async () => {
  await db.admin`update tenant_modules set enabled = true where tenant_id = ${IDS.tenantA} and module_key = 'alex_core'`;
});

describe('M4-11 call detail', () => {
  it('returns the call with transcript, summary and extracted fields, and no storage key', async () => {
    const id = await insertCall({ recordingKey: `${IDS.tenantA}/calls/x.mp3` });
    const d = await getCallDetail(ownerA, ctx.ownerA(), id);
    expect(d).toMatchObject({
      id,
      outcome: 'booked',
      summary: 'Agreed to an estimate.',
      extracted: { service: 'roof repair' },
      hasRecording: true,
      disclosureGiven: true,
      flagged: false
    });
    expect(d.transcript).toHaveLength(2);
    expect(JSON.stringify(d)).not.toContain('calls/x.mp3');
  });

  it('shows a pending transcript as null', async () => {
    const id = await insertCall({ transcript: null });
    expect((await getCallDetail(ownerA, ctx.ownerA(), id)).transcript).toBeNull();
  });

  it('another tenant gets 404; a user without a membership is forbidden; module off is refused', async () => {
    const id = await insertCall();
    await expect(
      getCallDetail(actor(IDS.tenantB, 'owner', IDS.ownerB), ctx.ownerB(), id)
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      getCallDetail(
        { userId: IDS.ownerB, kyneticRole: null, membership: null, viewAs: null },
        ctx.ownerA(),
        id
      )
    ).rejects.toMatchObject({ name: 'ForbiddenError' });
    await db.admin`update tenant_modules set enabled = false where tenant_id = ${IDS.tenantA} and module_key = 'alex_core'`;
    await expect(getCallDetail(ownerA, ctx.ownerA(), id)).rejects.toMatchObject({
      name: 'ModuleDisabledError'
    });
  });

  it('flagging sets calls.flagged, audits it and notifies Kynetic once', async () => {
    const id = await insertCall();
    const r = await flagCall(ownerA, ctx.ownerA(), id, { reason: '  Wrong price quoted  ' });
    expect(r).toEqual({ flagged: true, alreadyFlagged: false });

    const [row] = await db.admin`select * from calls where id = ${id}`;
    expect(row).toMatchObject({
      flagged: true,
      flagged_by: IDS.ownerA,
      flag_note: 'Wrong price quoted'
    });
    expect(row.flagged_at).not.toBeNull();

    const audits =
      await db.admin`select * from audit_log where action = 'call.flag' and entity_id = ${id}`;
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ tenant_id: IDS.tenantA, actor_user_id: IDS.ownerA });

    const jobs = () =>
      db.admin`select count(*)::int as n from pgboss.job where name = 'event.dispatch' and data->>'name' = 'call.flagged' and data->'payload'->>'callId' = ${id}`;
    expect((await jobs())[0].n).toBe(1);

    // A second flag keeps the first reason and does not notify again.
    const again = await flagCall(ownerA, ctx.ownerA(), id, { reason: 'Other' });
    expect(again.alreadyFlagged).toBe(true);
    expect((await db.admin`select flag_note from calls where id = ${id}`)[0].flag_note).toBe(
      'Wrong price quoted'
    );
    expect((await jobs())[0].n).toBe(1);
  });

  it('a flag needs no reason, staff can flag, and another tenant cannot', async () => {
    const id = await insertCall();
    await flagCall(actor(IDS.tenantA, 'staff', IDS.staffA), ctx.staffA(), id, {});
    expect((await db.admin`select flag_note, flagged from calls where id = ${id}`)[0]).toEqual({
      flag_note: null,
      flagged: true
    });
    const other = await insertCall();
    await expect(
      flagCall(actor(IDS.tenantB, 'owner', IDS.ownerB), ctx.ownerB(), other, {})
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect((await db.admin`select flagged from calls where id = ${other}`)[0].flagged).toBe(false);
  });

  it('rejects an over-long reason', async () => {
    const id = await insertCall();
    await expect(
      flagCall(ownerA, ctx.ownerA(), id, { reason: 'x'.repeat(1001) })
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });
});
