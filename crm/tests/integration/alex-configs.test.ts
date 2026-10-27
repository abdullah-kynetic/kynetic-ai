import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import {
  AlexConfigMissingError,
  getAlexConfig,
  getAlexSettingsView,
  isAlexPaused,
  updateClientAlexSettings
} from '@/server/alex';
import { withTenant } from '@/server/tenancy';
import { ctx, seedTwoTenants } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { IDS } from '../helpers/fixtures';

let tdb: TestDatabase;
let db: Db;

beforeAll(async () => {
  tdb = await createTestDatabase();
  await seedTwoTenants(tdb.admin);
  // Tenant creation seeds a paused row; replace it with a fully configured one.
  await tdb.admin`update alex_configs set provider = 'elevenlabs', agent_ref = 'agent_secret_ref',
    voice = 'voice_1', prompt_version = 3, greeting = 'Hi, this is Alex',
    questions = '[{"text":"What needs fixing?"}]'::jsonb,
    call_windows = '{"start":"09:00","end":"17:00"}'::jsonb, retry = '{"per_day":3}'::jsonb,
    transfer_number_e164 = '+15551230000', paused = false where tenant_id = ${IDS.tenantA}`;
  await tdb.admin`insert into alex_prompts (tenant_id, version, body, is_active)
    values (${IDS.tenantA}, 99, 'SECRET RAW PROMPT', false)`;
  db = createDb(tdb.app);
});
afterAll(async () => {
  await tdb?.drop();
});

describe('alex_configs service', () => {
  it('owner sees the settings view without internal fields or the raw prompt', async () => {
    const view = await withTenant(ctx.ownerA(), (tx) => getAlexSettingsView(tx), { db });
    expect(view).toMatchObject({
      greeting: 'Hi, this is Alex',
      callWindows: { start: '09:00', end: '17:00' },
      transferNumber: '+15551230000',
      paused: false
    });
    const json = JSON.stringify(view);
    for (const hidden of [
      'agent_secret_ref',
      'elevenlabs',
      'voice_1',
      'per_day',
      'SECRET RAW PROMPT'
    ]) {
      expect(json).not.toContain(hidden);
    }
    expect(Object.keys(view!).sort()).toEqual(
      [
        'bookingRules',
        'callWindows',
        'greeting',
        'paused',
        'questions',
        'transferNumber',
        'updatedAt'
      ].sort()
    );
  });

  it('only returns the context tenant row', async () => {
    const row = await withTenant(ctx.ownerA(), (tx) => getAlexConfig(tx), { db });
    expect(row?.tenantId).toBe(IDS.tenantA);
    expect(row).not.toHaveProperty('body');
  });

  it('does not expose the raw prompt table to an owner', async () => {
    const rows = await withTenant(
      ctx.ownerA(),
      (tx) => tx.execute(sql`select body from alex_prompts`),
      { db }
    );
    expect(Array.from(rows)).toHaveLength(0);
  });

  it('reports paused state; no config counts as paused', async () => {
    expect(await withTenant(ctx.ownerA(), (tx) => isAlexPaused(tx), { db })).toBe(false);
    await tdb.admin`delete from alex_configs where tenant_id = ${IDS.tenantB}`;
    // tenant B owner context: no config row
    const noConfig = await withTenant(
      { tenantId: IDS.tenantB, userId: IDS.ownerB, role: 'owner' as const },
      (tx) => isAlexPaused(tx),
      { db }
    );
    expect(noConfig).toBe(true);
  });
});

describe('client Alex settings write (F-42, M9-10)', () => {
  const ownerA = () => ctx.ownerA();

  it('owner pauses Alex and changes call hours; other fields stay put; change is audited', async () => {
    const view = await withTenant(
      ownerA(),
      (tx) =>
        updateClientAlexSettings(
          tx,
          { paused: true, callWindows: { start: '10:00', end: '16:30' } },
          IDS.ownerA
        ),
      { db }
    );
    expect(view.paused).toBe(true);
    expect(view.callWindows).toMatchObject({ start: '10:00', end: '16:30' });

    const [row] = await tdb.admin`select * from alex_configs where tenant_id = ${IDS.tenantA}`;
    expect(row).toMatchObject({
      greeting: 'Hi, this is Alex',
      provider: 'elevenlabs',
      agent_ref: 'agent_secret_ref',
      voice: 'voice_1',
      prompt_version: 3,
      transfer_number_e164: '+15551230000',
      paused: true,
      updated_by: IDS.ownerA
    });
    expect(row!.questions).toEqual([{ text: 'What needs fixing?' }]);
    expect(row!.retry).toEqual({ per_day: 3 });

    const audits =
      await tdb.admin`select * from audit_log where action = 'alex.settings.client_update'`;
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      tenant_id: IDS.tenantA,
      actor_user_id: IDS.ownerA,
      before: { paused: false, callWindows: { start: '09:00', end: '17:00' } },
      after: { paused: true, callWindows: { start: '10:00', end: '16:30' } }
    });
    expect(await withTenant(ownerA(), (tx) => isAlexPaused(tx), { db })).toBe(true);
  });

  it('rejects every other field and invalid hours; nothing changes', async () => {
    const attempts: unknown[] = [
      { greeting: 'Hacked' },
      { paused: false, provider: 'x' },
      { prompt: 'x' },
      { transferNumber: '+15550000000' },
      { callWindows: { start: '10:00', end: '16:00', extra: 1 } },
      { callWindows: { start: '17:00', end: '09:00' } },
      { callWindows: { start: '25:00', end: '26:00' } },
      {}
    ];
    for (const a of attempts) {
      await expect(
        withTenant(ownerA(), (tx) => updateClientAlexSettings(tx, a as never, IDS.ownerA), { db })
      ).rejects.toThrow();
    }
    const [row] =
      await tdb.admin`select greeting, provider, paused from alex_configs where tenant_id = ${IDS.tenantA}`;
    expect(row).toMatchObject({
      greeting: 'Hi, this is Alex',
      provider: 'elevenlabs',
      paused: true
    });
  });

  it('writes only the context tenant', async () => {
    const [b] =
      await tdb.admin`select paused, call_windows from alex_configs where tenant_id = ${IDS.tenantB}`;
    expect(b).toBeUndefined(); // tenant B row was deleted by the earlier test
    await expect(
      withTenant(
        { tenantId: IDS.tenantB, userId: IDS.ownerB, role: 'owner' as const },
        (tx) => updateClientAlexSettings(tx, { paused: false }, IDS.ownerB),
        { db }
      )
    ).rejects.toBeInstanceOf(AlexConfigMissingError);
    const [a] = await tdb.admin`select paused from alex_configs where tenant_id = ${IDS.tenantA}`;
    expect(a!.paused).toBe(true);
  });
});
