import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  archiveAccountTemplate,
  captureAccountSnapshot,
  listAccountTemplates,
  saveAccountTemplate
} from '@/server/admin/account-templates';
import { onboardTenant } from '@/server/admin/onboarding';
import { createDb, type Db } from '@/server/db/client';
import { withTenant } from '@/server/tenancy';
import { IDS, seedTwoTenants } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let tdb: TestDatabase;
let db: Db;
const adminCtx = () => ({ userId: IDS.admin, role: 'admin' as const });
const admin = { id: IDS.admin, kyneticRole: 'admin' as const };
const va = { id: IDS.va, kyneticRole: 'va' as const };

const form = (over: Record<string, unknown> = {}) => ({
  businessName: 'Source Remodeling',
  ownerEmail: 'owner@source.test',
  phone: '(415) 555-0100',
  industry: 'remodeling',
  timezone: 'America/Chicago',
  hours: {
    days: ['mon', 'tue', 'wed', 'thu', 'fri'],
    open: '08:00',
    close: '17:00'
  },
  plan: 'founding',
  modules: ['alex_core', 'followup_bundle'],
  crmLevel: 'full',
  ...over
});

let sourceId: string;
let templateId: string;

beforeAll(async () => {
  tdb = await createTestDatabase();
  await seedTwoTenants(tdb.admin);
  db = createDb(tdb.app);

  sourceId = (await onboardTenant(adminCtx(), form(), { db })).tenantId;
  const a = tdb.admin;
  await a`update tenants set recording_disclosure = 'This call with Source Remodeling is recorded.' where id = ${sourceId}`;
  await a`insert into custom_field_defs (tenant_id, entity, key, label, type, options, filterable)
          values (${sourceId}, 'deal', 'project_type', 'Project type', 'select', ${a.json(['Kitchen', 'Bath'])}, true)`;
  await a`insert into tags (tenant_id, name) values (${sourceId}, 'Hot'), (${sourceId}, 'Referral')`;
  const [auto] =
    await a`insert into automations (tenant_id, kind, template_key, name, enabled, config)
          values (${sourceId}, 'template', 'quote_followup', 'Quote follow-up', true, ${a.json({ maxSteps: 3 })}) returning id`;
  await a`insert into automation_steps (tenant_id, automation_id, position, channel, delay_minutes, subject, body)
          values (${sourceId}, ${auto!.id}, 1, 'email', 1440, 'Your quote from Source Remodeling', 'Hi, Source Remodeling here about your quote.')`;
  await a`update alex_configs set greeting = 'Hi, this is Alex with Source Remodeling.', agent_ref = 'agent_secret_should_not_copy',
          questions = ${a.json(['What room?'])} where tenant_id = ${sourceId}`;
  // Customer data that must never travel with a template.
  await a`insert into contacts (tenant_id, first_name, last_name, phones) values (${sourceId}, 'Pat', 'Customer', '{+14155550199}')`;
});
afterAll(async () => {
  await tdb?.drop();
});

const rows = (table: string, tenant: string, cols = '*') =>
  tdb.admin.unsafe(`select ${cols} from ${table} where tenant_id = $1`, [tenant]);

describe('account templates (GHL-style snapshots)', () => {
  it('captures configuration only and swaps the business name for a token', async () => {
    const { snapshot } = await captureAccountSnapshot(admin, sourceId, { db });
    expect(snapshot.modules.map((m) => m.key).toSorted()).toEqual(
      [
        'alex_core',
        'crm',
        'followup_bundle',
        'missed_call_textback',
        'quote_followup',
        'reactivation'
      ].toSorted()
    );
    expect(snapshot.pipelines[0]!.stages.map((s) => s.name)).toContain('Design in progress');
    expect(snapshot.customFields).toHaveLength(1);
    expect(snapshot.tags.toSorted()).toEqual(['Hot', 'Referral']);
    expect(snapshot.automations[0]!.steps[0]!.body).toBe(
      'Hi, {{business_name}} here about your quote.'
    );
    expect(snapshot.alex!.greeting).toBe('Hi, this is Alex with {{business_name}}.');
    expect(JSON.stringify(snapshot)).not.toContain('agent_secret_should_not_copy');
    expect(JSON.stringify(snapshot)).not.toContain('Pat');
    expect(JSON.stringify(snapshot)).not.toContain('owner@source.test');
  });

  it('saves a template (admin only) and refuses a duplicate name', async () => {
    templateId = (
      await saveAccountTemplate(
        admin,
        { sourceTenantId: sourceId, name: 'Remodeler starter' },
        { db }
      )
    ).id;
    await expect(
      saveAccountTemplate(va, { sourceTenantId: sourceId, name: 'Nope' }, { db })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      saveAccountTemplate(admin, { sourceTenantId: sourceId, name: 'remodeler STARTER' }, { db })
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    const list = await listAccountTemplates(va, { db });
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ name: 'Remodeler starter', hasAlex: true });
    expect(list[0]!.counts).toMatchObject({
      customFields: 1,
      tags: 2,
      automations: 1
    });
  });

  it('preloads a new client from the template in the onboarding transaction', async () => {
    const r = await onboardTenant(
      adminCtx(),
      form({
        businessName: 'Second Home Builders',
        ownerEmail: 'owner@second.test',
        industry: 'roofing',
        modules: [],
        crmLevel: undefined,
        templateId
      }),
      { db }
    );
    const id = r.tenantId;

    const mods = await rows('tenant_modules', id, 'module_key, level');
    expect(Object.fromEntries(mods.map((m) => [m.module_key, m.level]))).toMatchObject({
      alex_core: '',
      followup_bundle: '',
      quote_followup: '',
      crm: 'full'
    });

    const stages = await tdb.admin`
      select s.name from pipeline_stages s join pipelines p on p.id = s.pipeline_id
      where s.tenant_id = ${id} and p.is_default order by s.position`;
    expect(stages.map((s) => s.name)).toContain('Design in progress');
    expect(await rows('pipelines', id)).toHaveLength(1);

    expect((await rows('custom_field_defs', id, 'key'))[0]).toMatchObject({
      key: 'project_type'
    });
    expect((await rows('tags', id, 'name')).map((t) => t.name).toSorted()).toEqual([
      'Hot',
      'Referral'
    ]);

    const autos = await rows('automations', id, 'id, enabled, template_key');
    expect(autos).toHaveLength(1);
    expect(autos[0]).toMatchObject({
      enabled: false,
      template_key: 'quote_followup'
    });
    const steps = await rows('automation_steps', id, 'subject, body');
    expect(steps[0]).toMatchObject({
      subject: 'Your quote from Second Home Builders',
      body: 'Hi, Second Home Builders here about your quote.'
    });

    const [alex] = await rows('alex_configs', id, 'greeting, agent_ref, paused, questions');
    expect(alex).toMatchObject({
      greeting: 'Hi, this is Alex with Second Home Builders.',
      agent_ref: null,
      paused: true,
      questions: ['What room?']
    });

    const [t] =
      await tdb.admin`select services, recording_disclosure from tenants where id = ${id}`;
    expect(t!.recording_disclosure).toBe('This call with Second Home Builders is recorded.');
    expect(t!.services).not.toContain('Roof repair');

    expect(await rows('contacts', id)).toHaveLength(0);
    const [aud] =
      await tdb.admin`select after from audit_log where action = 'tenant.onboard' and entity_id = ${id}`;
    expect(aud!.after).toMatchObject({ templateId, stages: 'template' });
  });

  it('a client session cannot read templates', async () => {
    const seen = await withTenant(
      { tenantId: IDS.tenantA, userId: IDS.ownerA, role: 'owner' },
      (tx) => tx.execute(`select count(*)::int as n from account_templates` as never),
      { db }
    ).catch((e: unknown) => e);
    // Either a permission error or zero rows: never the template.
    if (Array.isArray(seen)) expect((seen as { n: number }[])[0]!.n).toBe(0);
    else expect(seen).toBeInstanceOf(Error);
  });

  it('an archived template can no longer be used', async () => {
    await archiveAccountTemplate(admin, templateId, { db });
    expect(await listAccountTemplates(admin, { db })).toHaveLength(0);
    await expect(
      onboardTenant(
        adminCtx(),
        form({
          businessName: 'Third Co',
          ownerEmail: 'owner@third.test',
          templateId
        }),
        { db }
      )
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const [n] = await tdb.admin`select count(*)::int as n from tenants where slug = 'third-co'`;
    expect(n!.n).toBe(0);
  });
});
