import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  getAdminChecklist,
  loadSetupProgress,
  markGoLive,
  updateChecklistStep
} from '@/server/admin/checklist';
import { onboardTenant } from '@/server/admin/onboarding';
import { createDb, type Db } from '@/server/db/client';
import { withTenant } from '@/server/tenancy';
import { IDS, seedTwoTenants } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let tdb: TestDatabase;
let db: Db;
let tenantId: string;
const admin = () => ({ userId: IDS.admin, role: 'admin' as const });
const va = () => ({ userId: IDS.va, role: 'va' as const });
const owner = () => ({ tenantId, userId: IDS.ownerA, role: 'owner' as const });

beforeAll(async () => {
  tdb = await createTestDatabase();
  await seedTwoTenants(tdb.admin);
  db = createDb(tdb.app);
  ({ tenantId } = await onboardTenant(
    admin(),
    {
      businessName: 'Checklist Roofing',
      ownerEmail: 'owner@checklist.test',
      phone: '(415) 555-0101',
      industry: 'roofing',
      timezone: 'America/Los_Angeles',
      hours: { days: ['mon', 'tue'], open: '08:00', close: '17:00' },
      serviceZips: ['94107'],
      plan: 'founding',
      modules: ['alex_core']
    },
    { db }
  ));
});
afterAll(async () => {
  await tdb?.drop();
});

describe('M8a-08 onboarding checklist (F-100)', () => {
  it('shows an owner only client-visible steps, with no notes or internal steps', async () => {
    await updateChecklistStep(
      admin(),
      tenantId,
      'twilio_number',
      { note: 'vendor id 123' },
      { db }
    );
    const progress = await loadSetupProgress(owner(), { db });
    const titles = progress!.steps.map((s) => s.title);
    expect(titles).toContain('Test call');
    expect(titles).not.toContain('Twilio number');
    expect(JSON.stringify(progress)).not.toContain('vendor id');
    // The database policy holds even for a direct query under the owner role.
    const raw = await withTenant(
      owner(),
      (tx) => tx.execute(`select step_key from onboarding_steps where not client_visible`),
      { db }
    );
    expect(raw).toHaveLength(0);
  });

  it('lets an owner read but not write the checklist', async () => {
    const res = await withTenant(
      owner(),
      (tx) =>
        tx.execute(
          `update onboarding_steps set status = 'done' where step_key = 'test_call' returning 1`
        ),
      { db }
    );
    expect(res).toHaveLength(0);
    const [row] =
      await tdb.admin`select status from onboarding_steps where tenant_id = ${tenantId} and step_key = 'test_call'`;
    expect(row!.status).toBe('todo');
  });

  it('lets admin and VA update steps, stamping done_at and auditing', async () => {
    await updateChecklistStep(
      va(),
      tenantId,
      'test_call',
      { status: 'doing', dueDate: '2026-11-01' },
      { db }
    );
    await updateChecklistStep(
      admin(),
      tenantId,
      'test_call',
      { status: 'done', ownerUserId: IDS.admin },
      { db }
    );
    const c = await getAdminChecklist(va(), tenantId, { db });
    const step = c.steps.find((s) => s.stepKey === 'test_call')!;
    expect(step).toMatchObject({ status: 'done', dueDate: '2026-11-01', ownerUserId: IDS.admin });
    expect(step.doneAt).not.toBeNull();
    const audits =
      await tdb.admin`select count(*)::int as n from audit_log where tenant_id = ${tenantId} and action = 'onboarding_step.update'`;
    expect(audits[0]!.n).toBeGreaterThanOrEqual(3);
  });

  it('refuses a client role, bad input and the go_live step through the update function', async () => {
    await expect(
      updateChecklistStep(
        { userId: IDS.ownerA, role: 'owner' as never },
        tenantId,
        'test_call',
        { status: 'done' },
        { db }
      )
    ).rejects.toBeDefined();
    await expect(
      updateChecklistStep(admin(), tenantId, 'test_call', {}, { db })
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    await expect(
      updateChecklistStep(admin(), tenantId, 'go_live', { status: 'done' }, { db })
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    await expect(
      updateChecklistStep(admin(), tenantId, 'nope', { status: 'done' }, { db })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('blocks go-live until every other step is done, and only an admin can mark it', async () => {
    await expect(markGoLive(admin(), tenantId, { db })).rejects.toMatchObject({ code: 'CONFLICT' });
    const c = await getAdminChecklist(admin(), tenantId, { db });
    for (const s of c.steps) {
      if (s.stepKey !== 'go_live' && s.status !== 'done') {
        await updateChecklistStep(
          admin(),
          tenantId,
          s.stepKey,
          { status: s.stepKey === 'import_done' ? 'n/a' : 'done' },
          { db }
        );
      }
    }
    await expect(markGoLive(va(), tenantId, { db })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const at = await markGoLive(admin(), tenantId, { db });
    expect(new Date(at).getTime()).toBeGreaterThan(0);
    const [t] = await tdb.admin`select status, go_live_at from tenants where id = ${tenantId}`;
    expect(t).toMatchObject({ status: 'active' });
    expect(t!.go_live_at).not.toBeNull();
    await expect(markGoLive(admin(), tenantId, { db })).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('removes the owner card after go-live', async () => {
    expect(await loadSetupProgress(owner(), { db })).toBeNull();
    const c = await getAdminChecklist(admin(), tenantId, { db });
    expect(c.goLiveAt).not.toBeNull();
  });
});
