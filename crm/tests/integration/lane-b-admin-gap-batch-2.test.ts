import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createAgencyLead,
  getAgencyPipeline,
  listAgencyLeads,
  moveAgencyDeal
} from '@/server/agency';
import { getAgencyRateSeries, getAgencyRates } from '@/server/agency/inbox';
import { setupAgency, agencyAdmin as caller } from '../helpers/agency';
import { IDS, seedTwoTenants } from '../helpers/fixtures';

let a: Awaited<ReturnType<typeof setupAgency>>, form: { contactId: string; dealId: string };

beforeAll(async () => {
  a = await setupAgency();
  form = await createAgencyLead(
    caller,
    {
      firstName: 'Batch Two Form',
      email: 'batchtwo-form@example.test',
      direction: 'inbound',
      channel: 'form',
      state: 'TX'
    },
    { db: a.db }
  );
  await createAgencyLead(
    caller,
    {
      firstName: 'Batch Two Cold',
      email: 'batchtwo-cold@example.test',
      direction: 'outbound',
      channel: 'cold_call'
    },
    { db: a.db }
  );
});

afterAll(async () => a.close());

describe('Lane B admin gap batch 2', () => {
  it('shows lead state, stage name and lost reason, and filters by source and stage', async () => {
    const pipeline = await getAgencyPipeline(caller, { db: a.db });
    const lostStage = pipeline.stages.find((s) => s.name === 'Lost')!;
    await moveAgencyDeal(caller, form.dealId, lostStage.id, {
      db: a.db,
      lostReason: 'Budget'
    });

    const all = await listAgencyLeads(caller, {}, { db: a.db });
    const names = all.leads.map((l) => l.firstName);
    expect(names).toContain('Batch Two Form');
    expect(names).toContain('Batch Two Cold');
    // Contacts from the client tenants never leak into the agency workspace list.
    expect(JSON.stringify(all.leads)).not.toContain('Synthetic Brand Co');

    const inbound = await listAgencyLeads(caller, { direction: 'inbound' }, { db: a.db });
    expect(inbound.leads.map((l) => l.firstName)).toContain('Batch Two Form');
    expect(inbound.leads.map((l) => l.firstName)).not.toContain('Batch Two Cold');

    const lost = await listAgencyLeads(caller, { stageId: lostStage.id }, { db: a.db });
    expect(lost.leads.map((l) => l.firstName)).toEqual(['Batch Two Form']);
    const lead = lost.leads[0]!;
    expect(lead.state).toBe('TX');
    expect(lead.deal).toMatchObject({ stageName: 'Lost', lostReason: 'Budget' });

    const emptyStage = await listAgencyLeads(
      caller,
      { stageId: pipeline.stages.find((s) => s.isWon)!.id },
      { db: a.db }
    );
    expect(emptyStage.leads).toHaveLength(0);
  });

  it('computes the seven-day and thirty-day rates from the same outcome rules', async () => {
    const attempts = [
      { outcome: 'connected', at: new Date('2026-11-09T18:00:00Z') },
      { outcome: 'no_answer', at: new Date('2026-11-09T19:00:00Z') },
      { outcome: 'connected', at: new Date('2026-10-25T18:00:00Z') }
    ];
    for (const attempt of attempts) {
      const [contact] = await a.test.admin`
        insert into contacts (tenant_id, first_name, emails, phones)
        values (${a.tenantId}, 'Rates Prospect', ${['rates@example.test']}, ${['+12125550181']})
        returning id`;
      await a.test.admin`
        insert into agency_call_attempts (tenant_id, contact_id, event_id, request_hash, outcome, logged_at, logged_by)
        values (${a.tenantId}, ${contact!.id}, gen_random_uuid(), ${'a'.repeat(64)}, ${attempt.outcome}, ${attempt.at.toISOString()}, ${IDS.admin})`;
    }
    const week = await getAgencyRates(caller, { db: a.db, now: new Date('2026-11-10T12:00:00Z') });
    expect(week).toMatchObject({ attempted: 2, picked: 1, pickRate: 0.5 });
    const month = await getAgencyRates(caller, {
      db: a.db,
      now: new Date('2026-11-10T12:00:00Z'),
      days: 30
    });
    expect(month).toMatchObject({ attempted: 3, picked: 2, pickRate: 2 / 3 });

    const series = await getAgencyRateSeries(caller, {
      db: a.db,
      now: new Date('2026-11-10T12:00:00Z')
    });
    expect(series.points).toHaveLength(30);
    const nov9 = series.points.find((p) => p.day === '2026-11-09')!;
    expect(nov9).toMatchObject({ pickRate: 0.5 });
    const oct25 = series.points.find((p) => p.day === '2026-10-25')!;
    expect(oct25).toMatchObject({ pickRate: 1 });
    expect(
      series.points.every(
        (p) => ['2026-11-09', '2026-10-25'].includes(p.day) || p.pickRate === null
      )
    ).toBe(true);
  });
});
