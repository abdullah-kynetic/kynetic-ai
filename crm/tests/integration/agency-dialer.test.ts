import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createAgencyLead,
  getAgencyPipeline,
  getAgencyWorkspace,
  moveAgencyDeal
} from '@/server/agency';
import { getAgencyDialer, logAgencyCall, markAgencyDnc } from '@/server/agency/dialer';
import {
  assignAgencyCampaign,
  createAgencyCampaign,
  listAgencyCampaigns
} from '@/server/agency/campaigns';
import { NEVER_DIAL_NUMBERS } from '@/server/agency/dialer-policy';
import { agencyCallAttempts, agencyCampaignLeads } from '@/server/db/schema';
import { createDb, type Db } from '@/server/db/client';
import { stopJobs } from '@/server/jobs';
import { withTenant } from '@/server/tenancy';
import { IDS, ctx, seedTwoTenants } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
let tdb: TestDatabase;
let db: Db;
let tenantId: string;
let foreignContact: string;
let allowed: string;
const blocked: string[] = [];
const admin = { id: IDS.admin, kyneticRole: 'admin' as const };
let seq = 0;
async function lead(name: string, extra: Record<string, unknown> = {}) {
  seq++;
  return createAgencyLead(
    admin,
    {
      firstName: name,
      email: `dial-${seq}@example.test`,
      direction: 'outbound',
      channel: 'cold_call',
      phone: `+120255501${String(seq).padStart(2, '0')}`,
      state: 'CA',
      ...extra
    },
    { db }
  );
}
const log = (contactId: string, outcome = 'no_answer') => ({
  eventId: crypto.randomUUID(),
  contactId,
  outcome,
  notes: ''
});
beforeAll(async () => {
  tdb = await createTestDatabase({ jobs: true });
  const { a } = await seedTwoTenants(tdb.admin);
  foreignContact = a.contactId;
  db = createDb(tdb.app);
  Object.assign(process.env, {
    APP_BASE_URL: 'http://localhost:3000',
    DATABASE_URL: tdb.urls.app,
    DATABASE_URL_WORKER: tdb.urls.worker,
    DATABASE_URL_AUTH: tdb.authUrl,
    BETTER_AUTH_SECRET: 'synthetic-dialer-auth-00000000000000000',
    APP_ENCRYPTION_KEY: 'synthetic-dialer-encryption-00000000000',
    OUTBOUND_ENABLED: 'false'
  });
  tenantId = (await getAgencyWorkspace(admin, true, { db }))!.tenantId;
});
afterAll(async () => {
  await stopJobs();
  await tdb?.drop();
});
describe('M16-03/M16-04/M16-06 F-05/F-19 human queue and campaigns', () => {
  it('hides protected businesses/numbers, FL/OK, DNC, unknown state, unsafe numbers and closed leads', async () => {
    allowed = (await lead('Allowed synthetic')).contactId;
    for (const state of ['FL', 'OK'])
      blocked.push((await lead(`Excluded ${state}`, { state })).contactId);
    blocked.push((await lead('Unknown region', { state: undefined })).contactId);
    blocked.push((await lead('No phone', { phone: undefined })).contactId);
    blocked.push((await lead('AM-1 Roofing synthetic')).contactId);
    blocked.push((await lead('Email list', { channel: 'email' })).contactId);
    const protectedNumber = await lead('Renamed protected business');
    await tdb.admin`update contacts set primary_phone_e164 = ${[...NEVER_DIAL_NUMBERS][0]} where id = ${protectedNumber.contactId}`;
    blocked.push(protectedNumber.contactId);
    const unsafe = await lead('Nonfictional number');
    await tdb.admin`update contacts set primary_phone_e164 = '+12025550299' where id = ${unsafe.contactId}`;
    blocked.push(unsafe.contactId);
    const dnc = await lead('Contact DNC');
    await markAgencyDnc(admin, dnc.contactId, { db });
    blocked.push(dnc.contactId);
    const listed = await lead('Number DNC');
    const [phone] =
      await tdb.admin`select primary_phone_e164 from contacts where id = ${listed.contactId}`;
    await tdb.admin`insert into dnc_entries (tenant_id, e164, source) values (${tenantId}, ${phone!.primary_phone_e164}, 'staff')`;
    blocked.push(listed.contactId);
    const opted = await lead('Phone opted out');
    await tdb.admin`insert into consents (tenant_id, contact_id, channel, kind, source) values (${tenantId}, ${opted.contactId}, 'phone_call', 'opt_out', 'call')`;
    blocked.push(opted.contactId);
    const closed = await lead('Closed won');
    const pipeline = await getAgencyPipeline(admin, { db });
    await moveAgencyDeal(admin, closed.dealId, pipeline.stages.find((s) => s.isWon)!.id, { db });
    blocked.push(closed.contactId);
    const result = await getAgencyDialer(admin, undefined, { db });
    expect(result.remaining).toBe(1);
    expect(result.next?.id).toBe(allowed);
    expect(JSON.stringify(result)).not.toContain([...NEVER_DIAL_NUMBERS][0]);
    for (const id of blocked)
      await expect(logAgencyCall(admin, log(id), { db })).rejects.toMatchObject({
        code: 'CONFLICT'
      });
    expect(await tdb.admin`select id from agency_call_attempts`).toHaveLength(0);
  });
  it('saves one timestamped manual activity under concurrent retries, then advances the queue', async () => {
    const input = log(allowed, 'interested');
    const at = new Date('2026-11-01T12:00:00Z');
    const results = await Promise.all([
      logAgencyCall(admin, input, { db, now: at }),
      logAgencyCall(admin, input, { db, now: at })
    ]);
    expect(results.filter((r) => !r.duplicate)).toHaveLength(1);
    expect(new Set(results.map((r) => r.id)).size).toBe(1);
    const [saved] =
      await tdb.admin`select outcome, logged_at, logged_by from agency_call_attempts where contact_id = ${allowed}`;
    expect(saved!.outcome).toBe('interested');
    expect(new Date(saved!.logged_at).toISOString()).toBe(at.toISOString());
    expect(saved!.logged_by).toBe(IDS.admin);
    expect(
      await tdb.admin`select id from activities where ref_table = 'agency_call_attempts'`
    ).toHaveLength(1);
    expect((await getAgencyDialer(admin, undefined, { db })).next).toBeNull();
    await expect(
      logAgencyCall(admin, { ...input, notes: 'Changed body' }, { db })
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(logAgencyCall(admin, log(allowed), { db })).rejects.toMatchObject({
      code: 'CONFLICT'
    });
    expect(await tdb.admin`select id from calls where tenant_id = ${tenantId}`).toHaveLength(0);
  });
  it('rechecks a newly marked DNC before saving and marks DNC without logging a call', async () => {
    const contact = await lead('Stale queue');
    expect((await getAgencyDialer(admin, undefined, { db })).next?.id).toBe(contact.contactId);
    await markAgencyDnc(admin, contact.contactId, { db });
    await markAgencyDnc(admin, contact.contactId, { db });
    await expect(logAgencyCall(admin, log(contact.contactId), { db })).rejects.toMatchObject({
      code: 'CONFLICT'
    });
    expect(
      await tdb.admin`select id from agency_call_attempts where contact_id = ${contact.contactId}`
    ).toHaveLength(0);
    expect(
      await tdb.admin`select id from audit_log where action = 'agency.contact.dnc' and entity_id = ${contact.contactId}`
    ).toHaveLength(1);
    const afterCall = await lead('Asked to stop');
    const input = log(afterCall.contactId, 'dnc');
    await logAgencyCall(admin, input, { db });
    expect((await logAgencyCall(admin, input, { db })).duplicate).toBe(true);
    const [row] =
      await tdb.admin`select do_not_call_at from contacts where id = ${afterCall.contactId}`;
    expect(row!.do_not_call_at).not.toBeNull();
  });
  it('creates unique campaigns, assigns idempotently, filters the queue and summarizes member outcomes', async () => {
    const first = await createAgencyCampaign(
      admin,
      { name: 'Synthetic cold calls', script: 'Draft: a synthetic question.' },
      { db }
    );
    const second = await createAgencyCampaign(
      admin,
      { name: 'Synthetic second group', script: 'Draft: another question.' },
      { db }
    );
    await expect(
      createAgencyCampaign(admin, { name: 'SYNTHETIC COLD CALLS', script: 'Draft' }, { db })
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    const prospect = await lead('Campaign prospect');
    await assignAgencyCampaign(admin, first.id, prospect.contactId, { db });
    await assignAgencyCampaign(admin, first.id, prospect.contactId, { db });
    await assignAgencyCampaign(admin, first.id, allowed, { db });
    const filtered = await getAgencyDialer(admin, first.id, { db });
    expect(filtered.next?.id).toBe(prospect.contactId);
    expect(filtered.script).toBe(first.script);
    expect((await getAgencyDialer(admin, second.id, { db })).next).toBeNull();
    const summary = (await listAgencyCampaigns(admin, { db })).find((c) => c.id === first.id)!;
    expect(summary).toMatchObject({ assigned: 2, logged: 1, outcomes: { interested: 1 } });
    expect(
      await tdb.admin`select * from agency_campaign_leads where campaign_id = ${first.id}`
    ).toHaveLength(2);
    await expect(
      assignAgencyCampaign(admin, first.id, foreignContact, { db })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      assignAgencyCampaign(admin, crypto.randomUUID(), allowed, { db })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(getAgencyDialer(admin, crypto.randomUUID(), { db })).rejects.toMatchObject({
      code: 'NOT_FOUND'
    });
  });
  it('rolls back an attempt when timeline persistence fails', async () => {
    const contact = await lead('Rollback candidate');
    const input = log(contact.contactId);
    await tdb.admin
      .unsafe(`CREATE FUNCTION reject_manual_activity() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.ref_table = 'agency_call_attempts' THEN RAISE EXCEPTION 'synthetic failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER reject_manual_activity BEFORE INSERT ON activities FOR EACH ROW EXECUTE FUNCTION reject_manual_activity();`);
    try {
      await expect(logAgencyCall(admin, input, { db })).rejects.toThrow();
    } finally {
      await tdb.admin.unsafe(
        'DROP TRIGGER reject_manual_activity ON activities; DROP FUNCTION reject_manual_activity();'
      );
    }
    expect(
      await tdb.admin`select id from agency_call_attempts where contact_id = ${contact.contactId}`
    ).toHaveLength(0);
  });
  it('enforces role/module/tenant boundaries and immutable manual history', async () => {
    for (const caller of [
      { id: IDS.va, kyneticRole: 'va' as const },
      { id: IDS.ownerA, kyneticRole: null },
      { id: IDS.ownerA, kyneticRole: 'admin' as const }
    ]) {
      await expect(getAgencyDialer(caller, undefined, { db })).rejects.toMatchObject({
        code: 'FORBIDDEN'
      });
      await expect(logAgencyCall(caller, log(allowed), { db })).rejects.toMatchObject({
        code: 'FORBIDDEN'
      });
      await expect(listAgencyCampaigns(caller, { db })).rejects.toMatchObject({
        code: 'FORBIDDEN'
      });
    }
    await expect(logAgencyCall(admin, log(foreignContact), { db })).rejects.toMatchObject({
      code: 'NOT_FOUND'
    });
    expect(
      await withTenant(ctx.ownerA(), (tx) => tx.select().from(agencyCallAttempts), { db })
    ).toHaveLength(0);
    const [campaign] = await tdb.admin`select id from agency_campaigns limit 1`;
    await expect(
      withTenant(
        ctx.ownerA(),
        (tx) =>
          tx
            .insert(agencyCampaignLeads)
            .values({ tenantId: IDS.tenantA, campaignId: campaign!.id, contactId: foreignContact }),
        { db }
      )
    ).rejects.toThrow();
    const [grants] =
      await tdb.admin`select has_table_privilege('kynetic_app', 'agency_call_attempts', 'UPDATE') as updates, has_table_privilege('kynetic_worker', 'agency_call_attempts', 'DELETE') as deletes`;
    expect(grants).toEqual({ updates: false, deletes: false });
    await tdb.admin`update tenant_modules set enabled = false where tenant_id = ${tenantId} and module_key = 'crm'`;
    try {
      await expect(getAgencyDialer(admin, undefined, { db })).rejects.toMatchObject({
        code: 'MODULE_DISABLED'
      });
    } finally {
      await tdb.admin`update tenant_modules set enabled = true where tenant_id = ${tenantId} and module_key = 'crm'`;
    }
  });
});
