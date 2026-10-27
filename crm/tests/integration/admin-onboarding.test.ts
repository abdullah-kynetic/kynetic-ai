import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FakeEmailProvider } from '@/server/adapters/email/fake';
import { onboardTenant, sendOwnerInvite, hashToken } from '@/server/admin/onboarding';
import { createDb, type Db } from '@/server/db/client';
import { IDS, seedTwoTenants } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let tdb: TestDatabase;
let db: Db;
const admin = () => ({ userId: IDS.admin, role: 'admin' as const });
const va = () => ({ userId: IDS.va, role: 'va' as const });

const form = (over: Record<string, unknown> = {}) => ({
  businessName: 'Summit Roofing',
  ownerEmail: 'Owner@Summit.test',
  phone: '(415) 555-0100',
  industry: 'roofing',
  timezone: 'America/Los_Angeles',
  hours: { days: ['mon', 'tue', 'wed', 'thu', 'fri'], open: '08:00', close: '17:00' },
  serviceZips: ['94107', '94110'],
  primaryColor: '#D9662A',
  plan: 'founding',
  tier: 'T2',
  modules: ['alex_core', 'followup_bundle'],
  crmLevel: 'lite',
  ...over
});

beforeAll(async () => {
  tdb = await createTestDatabase();
  await seedTwoTenants(tdb.admin);
  db = createDb(tdb.app);
});
afterAll(async () => {
  await tdb?.drop();
});

const count = async (table: string, tenant: string) =>
  (
    await tdb.admin.unsafe(`select count(*)::int as n from ${table} where tenant_id = $1`, [tenant])
  )[0]!.n as number;

describe('M8a-02 onboarding form (F-55)', () => {
  it('creates tenant, invite, modules, profile, checklist and audit rows in one action, fast', async () => {
    const started = Date.now();
    const r = await onboardTenant(admin(), form(), { db });
    expect(Date.now() - started).toBeLessThan(30_000);
    expect(r.slug).toBe('summit-roofing');

    const [t] = await tdb.admin`select * from tenants where id = ${r.tenantId}`;
    expect(t).toMatchObject({
      name: 'Summit Roofing',
      plan: 'founding',
      pricing_tier: 'T2',
      status: 'onboarding',
      transfer_number_e164: '+14155550100',
      primary_color: '#D9662A'
    });
    expect(t!.business_hours.mon).toEqual({ open: '08:00', close: '17:00' });
    expect(t!.business_hours.sat).toBeNull();
    expect(t!.service_area).toEqual({ zips: ['94107', '94110'] });
    expect(t!.services).toContain('Roof repair');

    const inv =
      await tdb.admin`select email, role, accepted_at from invitations where tenant_id = ${r.tenantId}`;
    expect(inv).toHaveLength(1);
    expect(inv[0]).toMatchObject({ email: 'owner@summit.test', role: 'owner', accepted_at: null });

    const mods =
      await tdb.admin`select module_key, enabled, level from tenant_modules where tenant_id = ${r.tenantId} order by module_key`;
    expect(Object.fromEntries(mods.map((m) => [m.module_key, `${m.enabled}:${m.level}`]))).toEqual({
      platform: 'true:',
      alex_core: 'true:',
      followup_bundle: 'true:',
      quote_followup: 'true:',
      reactivation: 'true:',
      missed_call_textback: 'true:',
      crm: 'true:lite'
    });

    expect(await count('pipelines', r.tenantId)).toBe(1);
    expect(await count('alex_configs', r.tenantId)).toBe(1);

    const steps =
      await tdb.admin`select step_key, status, client_visible, module_key from onboarding_steps where tenant_id = ${r.tenantId}`;
    const byKey = Object.fromEntries(steps.map((s) => [s.step_key, s]));
    expect(byKey.tenant_created!.status).toBe('done');
    expect(byKey.owner_invited!.status).toBe('todo');
    expect(byKey.go_live).toBeDefined();
    // Module-specific steps exist for enabled modules only; credentials stay internal.
    expect(byKey.test_call).toBeDefined();
    expect(byKey.quote_followup_setup).toBeDefined();
    expect(byKey.opm_access).toBeUndefined();
    expect(byKey.twilio_number!.client_visible).toBe(false);

    const actions = (
      await tdb.admin`select action from audit_log where tenant_id = ${r.tenantId} order by id`
    ).map((a) => a.action);
    expect(actions).toEqual(
      expect.arrayContaining(['tenant.create', 'tenant.onboard', 'module.toggle'])
    );
  });

  it('refuses a VA, a client user and a malformed form without writing anything', async () => {
    const before = (await tdb.admin`select count(*)::int as n from tenants`)[0]!.n;
    await expect(
      onboardTenant(va(), form({ businessName: 'VA Co' }), { db })
    ).rejects.toMatchObject({
      code: 'FORBIDDEN'
    });
    await expect(onboardTenant(admin(), form({ phone: '12' }), { db })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED'
    });
    await expect(
      onboardTenant(admin(), form({ modules: ['not_a_module'] }), { db })
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    await expect(
      onboardTenant(admin(), { ...form(), unknownField: 1 }, { db })
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect((await tdb.admin`select count(*)::int as n from tenants`)[0]!.n).toBe(before);
  });

  it('a failure midway leaves nothing partially created', async () => {
    const before = (await tdb.admin`select count(*)::int as n from tenants`)[0]!.n;
    await expect(
      onboardTenant(admin(), form({ businessName: 'Half Built', ownerEmail: 'half@built.test' }), {
        db,
        afterTenantCreated: async () => {
          throw new Error('injected');
        }
      })
    ).rejects.toThrow('injected');
    expect((await tdb.admin`select count(*)::int as n from tenants`)[0]!.n).toBe(before);
    expect(
      (
        await tdb.admin`select count(*)::int as n from invitations where email = 'half@built.test'`
      )[0]!.n
    ).toBe(0);
    expect(
      (await tdb.admin`select count(*)::int as n from audit_log where entity_id = 'half-built'`)[0]!
        .n
    ).toBe(0);
  });

  it('rejects a duplicate slug and a duplicate owner email with a clear message', async () => {
    await expect(
      onboardTenant(admin(), form({ ownerEmail: 'someone@else.test' }), { db })
    ).rejects.toMatchObject({ code: 'CONFLICT', fieldErrors: { slug: ['in_use'] } });
    await expect(
      onboardTenant(admin(), form({ businessName: 'Other Co', ownerEmail: 'owner@summit.test' }), {
        db
      })
    ).rejects.toMatchObject({ code: 'CONFLICT', fieldErrors: { ownerEmail: ['in_use'] } });
    // An existing user (the seeded tenant A owner) counts too.
    const [u] = await tdb.admin`select email from users where id = ${IDS.ownerA}`;
    await expect(
      onboardTenant(admin(), form({ businessName: 'Third Co', ownerEmail: u!.email }), { db })
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('sends the invite only on approval, to the owner on record, with a fresh single-use token', async () => {
    const r = await onboardTenant(
      admin(),
      form({
        businessName: 'Approval Co',
        ownerEmail: 'boss@approval.test',
        modules: [],
        crmLevel: undefined
      }),
      { db }
    );
    const email = new FakeEmailProvider();
    expect(email.sent).toHaveLength(0); // creating the tenant sends nothing

    const deps = {
      db,
      email,
      baseUrl: 'https://app.example.test/',
      fromAddress: 'hello@kynetic.test'
    };
    await sendOwnerInvite(admin(), r.tenantId, deps);
    expect(email.sent).toHaveLength(1);
    const sent = email.sent[0]!;
    expect(sent.to).toBe('boss@approval.test');
    expect(sent.text).toContain('Approval Co');
    const token = new URL(/https:\/\/\S+/.exec(sent.text)![0]).searchParams.get('invite')!;

    const invs =
      await tdb.admin`select token_hash, revoked_at from invitations where tenant_id = ${r.tenantId} order by created_at`;
    expect(invs).toHaveLength(2);
    expect(invs[0]!.revoked_at).not.toBeNull();
    expect(invs[1]!.revoked_at).toBeNull();
    expect(invs[1]!.token_hash).toBe(hashToken(token));
    expect(
      JSON.stringify(await tdb.admin`select * from audit_log where tenant_id = ${r.tenantId}`)
    ).not.toContain(token);
    expect(
      (
        await tdb.admin`select status from onboarding_steps where tenant_id = ${r.tenantId} and step_key = 'owner_invited'`
      )[0]!.status
    ).toBe('done');

    // A second approval replaces the first link.
    await sendOwnerInvite(admin(), r.tenantId, deps);
    expect(
      (
        await tdb.admin`select count(*)::int as n from invitations where tenant_id = ${r.tenantId} and revoked_at is null`
      )[0]!.n
    ).toBe(1);

    await expect(sendOwnerInvite(va(), r.tenantId, deps)).rejects.toMatchObject({
      code: 'FORBIDDEN'
    });
    await expect(
      sendOwnerInvite(admin(), '99999999-9999-4999-8999-999999999999', deps)
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('the new tenant is isolated: another tenant cannot read its checklist or invite', async () => {
    const [{ id }] = await tdb.admin`select id from tenants where slug = 'summit-roofing'`;
    const rows = await tdb.app.begin(async (tx) => {
      await tx`select set_config('app.role','owner',true), set_config('app.user_id',${IDS.ownerB},true), set_config('app.tenant_id',${IDS.tenantB},true)`;
      return tx`select (select count(*) from onboarding_steps where tenant_id = ${id})::int as steps,
                       (select count(*) from invitations where tenant_id = ${id})::int as invites`;
    });
    expect(rows[0]).toEqual({ steps: 0, invites: 0 });
  });
});
