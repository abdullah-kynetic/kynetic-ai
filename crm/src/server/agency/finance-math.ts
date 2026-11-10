import { currentPacificMonth, pacificMonth } from './pacific-time';

export type WonDealAmount = { cents: number; wonAt: string; title: string };
export type DatedAmount = { cents: number; on: string; label: string; deleted?: boolean };

export type MonthRow = {
  month: string;
  wonCents: number;
  manualCents: number;
  revenueCents: number;
  expenseCents: number;
  netCents: number;
};

export type FinanceSummary = {
  month: string;
  revenueCents: number;
  expenseCents: number;
  netCents: number;
};

function add(map: Map<string, MonthRow>, month: string): MonthRow {
  const existing = map.get(month);
  if (existing) return existing;
  const row: MonthRow = {
    month,
    wonCents: 0,
    manualCents: 0,
    revenueCents: 0,
    expenseCents: 0,
    netCents: 0
  };
  map.set(month, row);
  return row;
}

/** Monthly revenue from won deals plus manual entries, minus live expenses. Amounts stay in cents. */
export function buildFinanceMonths(
  won: readonly WonDealAmount[],
  manual: readonly DatedAmount[],
  expenses: readonly DatedAmount[]
): MonthRow[] {
  const map = new Map<string, MonthRow>();
  for (const deal of won) {
    const row = add(map, pacificMonth(deal.wonAt));
    row.wonCents += deal.cents;
  }
  for (const entry of manual) {
    if (entry.deleted) continue;
    const row = add(map, pacificMonth(entry.on));
    row.manualCents += entry.cents;
  }
  for (const expense of expenses) {
    if (expense.deleted) continue;
    const row = add(map, pacificMonth(expense.on));
    row.expenseCents += expense.cents;
  }
  for (const row of map.values()) {
    row.revenueCents = row.wonCents + row.manualCents;
    row.netCents = row.revenueCents - row.expenseCents;
  }
  return [...map.values()].sort((a, b) => (a.month < b.month ? 1 : a.month > b.month ? -1 : 0));
}

export function financeSummaryForMonth(
  months: readonly MonthRow[],
  month = currentPacificMonth()
): FinanceSummary {
  const row = months.find((item) => item.month === month);
  return {
    month,
    revenueCents: row?.revenueCents ?? 0,
    expenseCents: row?.expenseCents ?? 0,
    netCents: row?.netCents ?? 0
  };
}
