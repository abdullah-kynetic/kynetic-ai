import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  approveAutomationEdit,
  getAutomationEditState,
  proposeAutomationEdit,
  rejectAutomationEdit
} from '@/server/automations';
import type { Actor } from '@/server/auth/permissions';
import { stopJobs } from '@/server/jobs';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';

// P6-5. An edited automation is versioned, validated and audited, and an invalid edit is refused.
let tdb: TestDatabase;
const owner: Actor = {
  userId: IDS.ownerA,
  kyneticRole: null,
  membership: { tenantId: IDS.tenantA, role: 'owner', canExport: true, canBulkDelete: true },
  viewAs: null
};
const staff: Actor = {
  ...owner,
  userId: IDS.staffA,
  membership: { ...owner.membership!, role: 'staff' }
};
const admin: Actor = { userId: IDS.admin, kyneticRole: 'admin', membership: null, viewAs: null };
const adminCtx = { tenantId: IDS.tenantA, userId: IDS.admin, role: 'admin' as const };
const good = [
  {
    channel: 'sms',
    delayMinutes: 0,
    body: 'Hi, thanks for your quote request. Reply STOP to opt out.'
  },
  { channel: 'sms', delayMinutes: 1440, body: 'Checking in on your quote. Any questions?' }
];
const KEY = 'quote_followup';

beforeAll(async () => {
  tdb = await createTestDatabase({ jobs: true });
  await seedTwoTenants(tdb.admin);
  await tdb.admin`insert into automation_templates (key, module_key, label) values ('quote_followup','quote_followup','Quote follow-up') on conflict do nothing`;
  Object.assign(process.env, {
    APP_BASE_URL: 'http://localhost:3000',
    DATABASE_URL: tdb.urls.app,
    DATABASE_URL_WORKER: tdb.urls.worker,
    DATABASE_URL_AUTH: tdb.authUrl,
    BETTER_AUTH_SECRET: 'x'.repeat(32),
    APP_ENCRYPTION_KEY: 'y'.repeat(32)
  });
});
afterAll(async () => {
  await stopJobs();
  await tdb?.drop();
});

const stepRows = () =>
  tdb.admin`select position, delay_minutes, body from automation_steps s join automations a on a.id = s.automation_id
    where a.tenant_id = ${IDS.tenantA} and a.template_key = ${KEY} order by position`;
const audits = async () =>
  (
    await tdb.admin`select action from audit_log where tenant_id = ${IDS.tenantA} and action like 'automation.edit%' order by created_at`
  ).map((r) => r.action);

describe('editable automations', () => {
  it('refuses invalid edits, each with its reason, and stores nothing', async () => {
    const cases: [string, unknown, string][] = [
      [
        'no opt-out on message one',
        [{ ...good[0], body: 'Thanks for your quote request.' }],
        'steps.0.body'
      ],
      [
        'placeholder',
        [{ ...good[0], body: 'Hi {{name}}. Reply STOP to opt out.' }],
        'steps.0.body'
      ],
      [
        'link shortener',
        [{ ...good[0], body: 'See bit.ly/abc. Reply STOP to opt out.' }],
        'steps.0.body'
      ],
      ['too soon', [good[0], { ...good[1], delayMinutes: 5 }], 'steps.1.delayMinutes'],
      ['too long', [{ ...good[0], body: 'x'.repeat(321) }], 'steps.0.body'],
      ['email channel', [{ ...good[0], channel: 'email' }], 'steps.0.channel'],
      ['no steps', [], 'steps'],
      ['seven steps', Array(7).fill(good[0]), 'steps']
    ];
    for (const [name, steps] of cases) {
      const err = await proposeAutomationEdit(ctx.ownerA(), owner, KEY, steps, {
        db: undefined
      }).catch((e) => e);
      expect(err?.name, name).toBe('ValidationError');
    }
    await expect(
      proposeAutomationEdit(ctx.ownerA(), owner, 'speed_to_lead', good)
    ).rejects.toThrow();
    expect((await getAutomationEditState(ctx.ownerA(), KEY)).history).toHaveLength(0);
  });

  it('only owners propose and only a Kynetic admin decides', async () => {
    await expect(
      proposeAutomationEdit(
        { ...ctx.ownerA(), userId: IDS.staffA, role: 'staff' },
        staff,
        KEY,
        good
      )
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const v = await proposeAutomationEdit(ctx.ownerA(), owner, KEY, good);
    await expect(approveAutomationEdit(ctx.ownerA(), owner, v.id)).rejects.toMatchObject({
      code: 'FORBIDDEN'
    });
    await expect(rejectAutomationEdit(ctx.ownerA(), owner, v.id)).rejects.toMatchObject({
      code: 'FORBIDDEN'
    });
  });

  it('a proposal changes nothing until approved, then versions, applies and audits', async () => {
    expect(await stepRows()).toHaveLength(0);
    const state = await getAutomationEditState(ctx.ownerA(), KEY);
    expect(state.pending?.version).toBe(1);
    expect(await audits()).toEqual(['automation.edit_proposed']);
    const done = await approveAutomationEdit(adminCtx, admin, state.pending!.id, 'Looks fine');
    expect(done).toMatchObject({
      status: 'approved',
      decidedBy: IDS.admin,
      decisionNote: 'Looks fine'
    });
    const rows = await stepRows();
    expect(rows.map((r) => [r.position, r.delay_minutes])).toEqual([
      [1, 0],
      [2, 1440]
    ]);
    expect(rows[0].body).toContain('Reply STOP');
    expect(await audits()).toEqual(['automation.edit_proposed', 'automation.edit_approved']);
    // Editing never switches the sequence on.
    const [a] =
      await tdb.admin`select enabled from automations where template_key = ${KEY} and tenant_id = ${IDS.tenantA}`;
    expect(a.enabled).toBe(false);
    await expect(approveAutomationEdit(adminCtx, admin, done.id)).rejects.toMatchObject({
      code: 'CONFLICT'
    });
  });

  it('a second edit becomes version 2; a new proposal replaces a waiting one; reject keeps the live steps', async () => {
    const first = await proposeAutomationEdit(ctx.ownerA(), owner, KEY, [good[0]]);
    expect(first.version).toBe(2);
    const second = await proposeAutomationEdit(ctx.ownerA(), owner, KEY, [
      { ...good[0], body: 'Hello again. Reply STOP to opt out.' }
    ]);
    expect(second.version).toBe(3);
    const mid = await getAutomationEditState(ctx.ownerA(), KEY);
    expect(mid.history.map((v) => [v.version, v.status])).toEqual([
      [3, 'pending'],
      [2, 'superseded'],
      [1, 'approved']
    ]);
    await rejectAutomationEdit(adminCtx, admin, second.id, 'Not now');
    expect(await stepRows()).toHaveLength(2);
    const third = await proposeAutomationEdit(ctx.ownerA(), owner, KEY, [
      { ...good[0], body: 'Fresh wording. Reply STOP to opt out.' }
    ]);
    await approveAutomationEdit(adminCtx, admin, third.id);
    expect((await stepRows()).map((r) => r.body)).toEqual([
      'Fresh wording. Reply STOP to opt out.'
    ]);
    const h = (await getAutomationEditState(ctx.ownerA(), KEY)).history;
    expect(h.map((v) => [v.version, v.status])).toEqual([
      [4, 'approved'],
      [3, 'rejected'],
      [2, 'superseded'],
      [1, 'superseded']
    ]);
    expect(await audits()).toContain('automation.edit_rejected');
  });

  it('is tenant-scoped: tenant B sees none of tenant A’s versions', async () => {
    const b = await getAutomationEditState(ctx.ownerB(), KEY);
    expect(b.history).toHaveLength(0);
  });
});
