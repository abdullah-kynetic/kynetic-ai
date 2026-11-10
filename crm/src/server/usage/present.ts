import { neutralizeCsvCell } from '../contacts/export';

export type UsageRow = {
  tenantId: string;
  tenantName: string;
  callCount: number;
  callSeconds: number;
  callCostCents: number;
  smsCount: number;
  emailCount: number;
  messageCostCents: number;
  costUnknown: boolean;
  monthlyFeeCents: number | null;
  capCents: number | null;
};

export type CapStatus = 'no_cap' | 'under' | 'watch' | 'reached';

export function providerCostCents(
  row: Pick<UsageRow, 'callCostCents' | 'messageCostCents'>
): number {
  return row.callCostCents + row.messageCostCents;
}

export function marginCents(row: UsageRow): number | null {
  if (row.monthlyFeeCents == null) return null;
  return row.monthlyFeeCents - providerCostCents(row);
}

/** 80% of the cap, or the cap itself when it is zero. */
export function capStatus(row: UsageRow): CapStatus {
  if (row.capCents == null) return 'no_cap';
  const cost = providerCostCents(row);
  if (cost >= row.capCents) return 'reached';
  if (row.capCents === 0 || cost * 100 >= row.capCents * 80) return 'watch';
  return 'under';
}

export function capStatusLabel(status: CapStatus): string {
  if (status === 'no_cap') return 'No cap';
  if (status === 'under') return 'Under cap';
  if (status === 'watch') return 'At 80% or more';
  return 'Cap reached';
}

export function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.trunc(cents));
  const dollars = Math.floor(abs / 100).toLocaleString('en-US');
  const rem = String(abs % 100).padStart(2, '0');
  return `${sign}$${dollars}.${rem}`;
}

export function minutesLabel(seconds: number): string {
  return (seconds / 60).toFixed(1);
}

const CSV_HEADERS = [
  'client',
  'minutes',
  'calls',
  'sms',
  'emails',
  'provider_cost_cents',
  'cost_unknown',
  'monthly_fee_cents',
  'margin_cents',
  'cap_cents',
  'cap_status'
] as const;

export function usageCsv(rows: UsageRow[]): string {
  const lines = [CSV_HEADERS.join(',')];
  for (const row of rows) {
    const margin = marginCents(row);
    lines.push(
      [
        row.tenantName,
        minutesLabel(row.callSeconds),
        row.callCount,
        row.smsCount,
        row.emailCount,
        providerCostCents(row),
        row.costUnknown ? 'yes' : 'no',
        row.monthlyFeeCents ?? '',
        margin ?? '',
        row.capCents ?? '',
        capStatusLabel(capStatus(row))
      ]
        .map((cell) => neutralizeCsvCell(cell))
        .join(',')
    );
  }
  return `${lines.join('\n')}\n`;
}

export function monthStartParam(value: string | undefined, now = new Date()): string {
  const match = /^(\d{4})-(\d{2})$/.exec(value ?? '');
  if (match) return `${match[1]}-${match[2]}-01`;
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}
