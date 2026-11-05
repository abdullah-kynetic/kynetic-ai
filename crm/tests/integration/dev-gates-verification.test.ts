import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedDemoTenants } from '@/server/db/seed/demo';
import { verifyDevGates } from '@/server/leads/verify-dev-gates';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let db: TestDatabase;
const config = {
  APP_BASE_URL: 'https://dev.kyneticai.com',
  PROVIDER_MODE: 'stub' as const,
  OUTBOUND_ENABLED: false,
  ELEVENLABS_LIVE_ENABLED: false,
  DEV_PERSONA_SWITCHING: false
};
beforeAll(async () => {
  db = await createTestDatabase();
  await seedDemoTenants(db.admin);
});
afterAll(async () => {
  await db?.drop();
});

async function snapshot() {
  const [counts] =
    await db.admin`select (select count(*)::int from contacts) as contacts, (select count(*)::int from consents) as consents, (select count(*)::int from activities) as activities`;
  const modules =
    await db.admin`select tenant_id, module_key, config from tenant_modules order by tenant_id, module_key`;
  const [role] = await db.admin`select current_user as role`;
  return { counts, modules: Array.from(modules), role: role.role };
}
describe('deployed dev gate verification is isolated and rolls back', () => {
  it('exercises consent, quiet hours and both switches under worker RLS without persisting fixtures', async () => {
    const before = await snapshot();
    expect(await verifyDevGates(db.admin, config)).toEqual({
      consent: 'blocked',
      quiet_hours: 'deferred',
      global_kill: 'blocked',
      tenant_kill: 'blocked',
      fixtures: 'rolled_back',
      provider_requests: 0
    });
    expect(await snapshot()).toEqual(before);
  });
  it('refuses non-dev URLs, live providers, outbound enablement or persona switching before fixtures', async () => {
    const before = await snapshot();
    for (const over of [
      { APP_BASE_URL: 'https://portal.kyneticai.com' },
      { PROVIDER_MODE: 'live' as const },
      { OUTBOUND_ENABLED: true },
      { ELEVENLABS_LIVE_ENABLED: true },
      { DEV_PERSONA_SWITCHING: true }
    ])
      await expect(verifyDevGates(db.admin, { ...config, ...over })).rejects.toThrow();
    expect(await snapshot()).toEqual(before);
  });
  it('refuses a database containing any non-synthetic tenant', async () => {
    await db.admin`insert into tenants (slug, name, plan, timezone) values ('not-a-dev-tenant', 'Synthetic refusal fixture', 'founding', 'America/Los_Angeles')`;
    const before = await snapshot();
    await expect(verifyDevGates(db.admin, config)).rejects.toThrow('Preview refused');
    expect(await snapshot()).toEqual(before);
  });
});
