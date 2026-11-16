import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getTodayData } from '@/server/admin';
import { createAgencyLead } from '@/server/agency';
import { setupAgency } from '../helpers/agency';
import type { Db } from '@/server/db/client';
import { IDS } from '../helpers/fixtures';

let agency: Awaited<ReturnType<typeof setupAgency>>;
let db: Db;

beforeAll(async () => {
  agency = await setupAgency();
  db = agency.db;
});

afterAll(async () => {
  await agency?.close();
});

describe('admin Today data', () => {
  it('uses the Human dialer queue for callbacks and next leads', async () => {
    const callback = await createAgencyLead(
      { id: IDS.admin, kyneticRole: 'admin' },
      {
        firstName: 'Today callback',
        email: 'today-callback@example.test',
        direction: 'outbound',
        channel: 'cold_call',
        phone: '+12025550121',
        state: 'CA'
      },
      { db }
    );
    await createAgencyLead(
      { id: IDS.admin, kyneticRole: 'admin' },
      {
        firstName: 'Today next lead',
        email: 'today-next@example.test',
        direction: 'outbound',
        channel: 'cold_call',
        phone: '+12025550122',
        state: 'CA'
      },
      { db }
    );
    const now = new Date();
    await agency.test.admin`insert into tasks (tenant_id, title, contact_id, due_at)
      values (${agency.tenantId}, 'Scheduled callback', ${callback.contactId}, ${new Date(now.getTime() - 60_000).toISOString()})`;
    const today = await getTodayData({ userId: IDS.admin, role: 'admin' }, { db, now });
    expect(today.salesToday?.dialer.next).toMatchObject({
      name: 'Today callback',
      callbackDue: true
    });
    expect(today.salesToday?.dialer.callbacksDue).toEqual([
      { id: callback.contactId, name: 'Today callback' }
    ]);
  });

  it('does not put admin-only data in a VA response', async () => {
    const admin = await getTodayData({ userId: IDS.admin, role: 'admin' }, { db });
    const va = await getTodayData({ userId: IDS.va, role: 'va' }, { db });
    expect(admin.needsYouNow).not.toBeNull();
    expect(admin.salesToday).not.toBeNull();
    expect(admin.dailySummary).not.toBeNull();
    expect(va.needsYouNow).toBeNull();
    expect(va.salesToday).toBeNull();
    expect(va.dailySummary).toBeNull();
    expect(va.clientsNeedingAttention).toBeDefined();
    expect(va.support).toBeDefined();
  });
});
