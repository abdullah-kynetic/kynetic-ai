import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAgencyLead, getAgencyWorkspace } from '@/server/agency';
import { loadSalesSide, markDealWon, setDealColumn } from '@/server/agency/pipeline';
import { createDb, type Db } from '@/server/db/client';
import { stopJobs } from '@/server/jobs';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { IDS, seedTwoTenants } from '../helpers/fixtures';

let t: TestDatabase;
let db: Db;
let dealId: string;
const caller = { id: IDS.admin, kyneticRole: 'admin' as const };

beforeAll(async () => {
  t = await createTestDatabase({ jobs: true });
  await seedTwoTenants(t.admin);
  db = createDb(t.app);
  Object.assign(process.env, {
    APP_BASE_URL: 'https://dev.kyneticai.com',
    DATABASE_URL: t.urls.app,
    DATABASE_URL_WORKER: t.urls.worker,
    DATABASE_URL_AUTH: t.authUrl,
    BETTER_AUTH_SECRET: 'x'.repeat(32),
    APP_ENCRYPTION_KEY: 'y'.repeat(32),
    PROVIDER_MODE: 'stub',
    OUTBOUND_ENABLED: 'false'
  });
  await getAgencyWorkspace(caller, true, { db });
  const lead = await createAgencyLead(
    caller,
    {
      firstName: 'Pipeline Prospect',
      email: 'pipeline@example.test',
      direction: 'inbound',
      channel: 'form'
    },
    { db }
  );
  dealId = (lead as { dealId?: string }).dealId ?? '';
});
afterAll(async () => {
  await stopJobs();
  await t?.drop();
});

const find = async () => {
  const { deals, leadRows } = await loadSalesSide(caller, { db });
  return {
    deal: deals.find((d) => d.name === 'Pipeline Prospect'),
    lead: leadRows.find((l) => l.name === 'Pipeline Prospect')
  };
};

describe('sales pipeline moves', () => {
  it('starts on the leads tab, moves to Audit pending then Proposal', async () => {
    expect((await find()).lead?.state).toBe('new');
    await setDealColumn(caller, dealId, 'audit_pending', { db });
    expect((await find()).deal?.column).toBe('audit_pending');
    await setDealColumn(caller, dealId, 'proposal', { db });
    expect((await find()).deal?.column).toBe('proposal');
  });

  it('declining needs a reason and sends the person back to the leads tab', async () => {
    await expect(setDealColumn(caller, dealId, 'declined', { db })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED'
    });
    await setDealColumn(caller, dealId, 'declined', { db, reason: 'Too expensive' });
    const { deal, lead } = await find();
    expect(deal).toBeUndefined();
    expect(lead).toMatchObject({ state: 'declined', reason: 'Too expensive' });
  });

  it('a won deal leaves the pipeline (the client account carries it)', async () => {
    await markDealWon(caller, dealId, { db });
    const { deal, lead } = await find();
    expect(deal).toBeUndefined();
    expect(lead).toBeUndefined();
  });
});
