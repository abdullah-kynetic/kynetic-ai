import { sql } from 'drizzle-orm';
import type { StaffCaller } from '../admin/users';
import type { Db } from '../db/client';
import { getAgencyFinance } from './finance';
import { currentPacificMonth } from './pacific-time';
import { inAgency } from './index';

type Options = { db?: Db; now?: Date };

export type MoneyOverview = {
  month: string;
  mrrCents: number;
  recurringClients: { dealId: string; name: string; monthlyCents: number }[];
  collectedCents: number;
  expenseCents: number;
  netCents: number;
  outstanding: {
    openCents: number;
    pastDueCents: number;
    draftCents: number;
    totalCents: number;
    invoices: number;
  };
  trend: { month: string; revenueCents: number; expenseCents: number; netCents: number }[];
};

/** Last `count` Pacific months ending at `month`, oldest first, as YYYY-MM. */
export function lastMonths(month: string, count: number): string[] {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (count - 1 - i), 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  });
}

/**
 * Revenue dashboard numbers for the agency workspace. MRR is the monthly fee on terms for won
 * deals. Collected is the Finance revenue for the Pacific month (won deals and manual entries
 * received). Outstanding is invoice drafts that are open, past due or not yet sent.
 */
export async function getMoneyOverview(
  caller: StaffCaller,
  opts: Options = {}
): Promise<MoneyOverview> {
  const month = currentPacificMonth(opts.now);
  const finance = await getAgencyFinance(caller, opts);
  const { recurring, invoices } = await inAgency(
    caller,
    async (tx) => ({
      recurring: Array.from(
        await tx.execute<{ deal_id: string; title: string; monthly_cents: number }>(sql`
          select t.deal_id, d.title, t.monthly_cents from agency_deal_terms t
          join deals d on d.id = t.deal_id and d.deleted_at is null
          join pipeline_stages s on s.id = d.stage_id and s.is_won
          where t.monthly_cents > 0 order by t.monthly_cents desc, d.title`)
      ),
      invoices: Array.from(
        await tx.execute<{ status: string; cents: string; n: string }>(sql`
          select status, sum(amount_cents)::bigint as cents, count(*)::int as n
          from agency_invoice_drafts where status <> 'paid' group by status`)
      )
    }),
    opts
  );
  const byStatus = (status: string) =>
    Number(invoices.find((r) => r.status === status)?.cents ?? 0);
  const row = finance.months.find((m) => m.month === month);
  const outstanding = {
    openCents: byStatus('open'),
    pastDueCents: byStatus('past_due'),
    draftCents: byStatus('draft'),
    totalCents: byStatus('open') + byStatus('past_due') + byStatus('draft'),
    invoices: invoices.reduce((sum, r) => sum + Number(r.n), 0)
  };
  return {
    month,
    mrrCents: recurring.reduce((sum, r) => sum + r.monthly_cents, 0),
    recurringClients: recurring.map((r) => ({
      dealId: r.deal_id,
      name: r.title,
      monthlyCents: r.monthly_cents
    })),
    collectedCents: row?.revenueCents ?? 0,
    expenseCents: row?.expenseCents ?? 0,
    netCents: row?.netCents ?? 0,
    outstanding,
    trend: lastMonths(month, 6).map((m) => {
      const found = finance.months.find((x) => x.month === m);
      return {
        month: m,
        revenueCents: found?.revenueCents ?? 0,
        expenseCents: found?.expenseCents ?? 0,
        netCents: found?.netCents ?? 0
      };
    })
  };
}
