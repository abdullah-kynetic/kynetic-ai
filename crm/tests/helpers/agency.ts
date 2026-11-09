import { createDb } from '@/server/db/client';
import { getAgencyWorkspace } from '@/server/agency';
import { stopJobs } from '@/server/jobs';
import { createTestDatabase } from './db';
import { IDS, seedTwoTenants } from './fixtures';
export const agencyAdmin = { id: IDS.admin, kyneticRole: 'admin' as const };
export async function setupAgency() {
  const test = await createTestDatabase({ jobs: true });
  const seeded = await seedTwoTenants(test.admin);
  Object.assign(process.env, {
    APP_BASE_URL: 'https://dev.kyneticai.com',
    DATABASE_URL: test.urls.app,
    DATABASE_URL_WORKER: test.urls.worker,
    DATABASE_URL_AUTH: test.authUrl,
    BETTER_AUTH_SECRET: 'x'.repeat(32),
    APP_ENCRYPTION_KEY: 'y'.repeat(32),
    PROVIDER_MODE: 'stub',
    OUTBOUND_ENABLED: 'false'
  });
  const db = createDb(test.app),
    tenantId = (await getAgencyWorkspace(agencyAdmin, true, { db }))!.tenantId;
  return {
    test,
    db,
    tenantId,
    seeded,
    close: async () => {
      await stopJobs();
      await test.drop();
    }
  };
}
