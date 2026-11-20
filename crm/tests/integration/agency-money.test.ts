import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAgencyLead, getAgencyPipeline, moveAgencyDeal } from '@/server/agency';
import { createAgencyInvoice, saveAgencyTerms } from '@/server/agency/billing';
import { getMoneyOverview, lastMonths } from '@/server/agency/money';
import { agencyAdmin, setupAgency } from '../helpers/agency';
import { IDS } from '../helpers/fixtures';
import type { Db } from '@/server/db/client';

let agency: Awaited<ReturnType<typeof setupAgency>>;
let db: Db;
const now = new Date('2026-11-18T20:00:00Z');

beforeAll(async () => {
  agency = await setupAgency();
  db = agency.db;
});
afterAll(async () => {
  await agency?.close();
});

describe('Money overview', () => {
  it('lists the last six months oldest first across a year boundary', () => {
    expect(lastMonths('2026-02', 6)).toEqual([
      '2025-09',
      '2025-10',
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02'
    ]);
  });

  it('is all zeros with a full six-month trend when nothing is recorded', async () => {
    const empty = await getMoneyOverview(agencyAdmin, { db, now });
    expect(empty.mrrCents).toBe(0);
    expect(empty.outstanding.totalCents).toBe(0);
    expect(empty.recurringClients).toEqual([]);
    expect(empty.trend).toHaveLength(6);
    expect(empty.trend.at(-1)!.month).toBe('2026-11');
  });

  it('computes MRR from won deals, outstanding from unpaid invoices and collected from revenue', async () => {
    const { stages } = await getAgencyPipeline(agencyAdmin, { db });
    const won = stages.find((s) => s.isWon)!;
    const mk = async (name: string, monthly: number) => {
      const lead = await createAgencyLead(
        agencyAdmin,
        {
          firstName: name,
          email: `${name.toLowerCase().replaceAll(' ', '-')}@example.test`,
          direction: 'inbound',
          channel: 'form'
        },
        { db }
      );
      await saveAgencyTerms(
        agencyAdmin,
        {
          dealId: lead.dealId,
          currency: 'USD',
          setupCents: 0,
          monthlyCents: monthly,
          installments: []
        },
        { db }
      );
      return lead.dealId;
    };
    const wonDeal = await mk('Money Won', 90_000);
    const openDeal = await mk('Money Still Open', 50_000);
    await moveAgencyDeal(agencyAdmin, wonDeal, won.id, { db });
    await createAgencyInvoice(
      agencyAdmin,
      { dealId: wonDeal, kind: 'monthly', period: '2026-11', dueOn: '2026-11-25' },
      { db }
    );
    await createAgencyInvoice(
      agencyAdmin,
      { dealId: openDeal, kind: 'monthly', period: '2026-11', dueOn: '2026-11-25' },
      { db }
    );
    await agency.test
      .admin`update agency_invoice_drafts set status = 'past_due' where deal_id = ${openDeal}`;
    await agency.test
      .admin`update agency_invoice_drafts set status = 'open' where deal_id = ${wonDeal}`;
    await agency.test
      .admin`insert into agency_revenue_entries (tenant_id, received_on, amount_cents, note, created_by)
      values (${agency.tenantId}, '2026-11-05', 70000, 'Synthetic', ${IDS.admin}),
             (${agency.tenantId}, '2026-10-05', 30000, 'Synthetic', ${IDS.admin})`;
    const data = await getMoneyOverview(agencyAdmin, { db, now });
    expect(data.mrrCents).toBe(90_000);
    expect(data.recurringClients.map((c) => c.name)).toEqual(['Money Won']);
    expect(data.outstanding).toMatchObject({
      openCents: 90_000,
      pastDueCents: 50_000,
      draftCents: 0,
      totalCents: 140_000,
      invoices: 2
    });
    expect(data.collectedCents).toBeGreaterThanOrEqual(70_000);
    expect(data.trend.find((t) => t.month === '2026-10')!.revenueCents).toBe(30_000);
  });
});
