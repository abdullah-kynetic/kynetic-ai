/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- scrollable table regions must be keyboard focusable (WCAG 2.1.1) */
import { headers } from 'next/headers';
import { forbidden } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { StatusPill } from '@/components/ui/status-pill';
import { decideAdminAccess, listUsageMonth } from '@/server/admin';
import { CostVsFeeChart, type UsageChartRow } from './usage-charts';
import {
  capStatus,
  capStatusLabel,
  formatCents,
  llmCostCents,
  marginCents,
  minutesLabel,
  providerCostCents
} from '@/server/usage';

export const dynamic = 'force-dynamic';

const statusColor: Record<string, string> = {
  no_cap: 'bg-[var(--gain)]',
  under: 'bg-[var(--gain)]',
  watch: 'bg-[var(--attention)]',
  reached: 'bg-[var(--alert)]'
};

function CapUsageBar({
  costCents,
  capCents,
  status
}: {
  costCents: number;
  capCents: number;
  status: ReturnType<typeof capStatus>;
}) {
  const pct = capCents === 0 ? 100 : Math.min(100, Math.round((costCents / capCents) * 100));
  return (
    <div className='min-w-32 max-w-52'>
      <div
        role='img'
        aria-label={`${capStatusLabel(status)}: ${pct}% of the monthly spend cap`}
        className='bg-surface-sunken relative h-2 w-full overflow-hidden rounded-full'
      >
        <div
          className={`h-full ${statusColor[status] ?? 'bg-[var(--gain)]'}`}
          style={{ width: `${pct}%` }}
        />
        <div
          aria-hidden
          className='absolute inset-y-0 left-[80%] w-0.5 bg-foreground/70'
          title='80% watch threshold'
        />
      </div>
      <p className='text-muted-foreground text-xs'>
        {capStatusLabel(status)} · {pct}% of cap
      </p>
    </div>
  );
}

export default async function UsagePage({
  searchParams
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok') forbidden();
  const query = await searchParams;
  const { month, rows } = await listUsageMonth(
    { userId: access.user.id, role: access.role },
    query.month
  );
  const empty = rows.every(
    (row) =>
      row.callCount === 0 && row.smsCount === 0 && row.emailCount === 0 && row.llmCostMicros === 0
  );
  const totalCost = rows.reduce((sum, row) => sum + providerCostCents(row), 0);
  const totalAi = rows.reduce((sum, row) => sum + llmCostCents(row), 0);
  const feeRows = rows.filter((row) => row.monthlyFeeCents != null);
  const totalFees = feeRows.reduce((sum, row) => sum + (row.monthlyFeeCents ?? 0), 0);
  const totalMargin = feeRows.reduce((sum, row) => sum + (marginCents(row) ?? 0), 0);
  const stats: [string, string][] = [
    ['Provider cost', formatCents(totalCost)],
    ['AI cost', formatCents(totalAi)],
    ['Recorded fees', feeRows.length ? formatCents(totalFees) : 'Not recorded'],
    ['Margin', feeRows.length ? formatCents(totalMargin) : 'Not recorded']
  ];
  return (
    <div className='mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 pt-2 pb-8 md:px-6 md:pt-4'>
      <PageHeader
        title='Usage'
        description='Minutes, messages, provider cost, and the fee already recorded for each client. Clients do not see this page.'
      />
      <dl className=' grid gap-3 sm:grid-cols-2 lg:grid-cols-4' aria-label={`Totals for ${month}`}>
        {stats.map(([label, value]) => (
          <div key={label} className='bg-card rounded-[var(--radius-card)] border p-5'>
            <dt className='text-muted-foreground text-sm'>{label}</dt>
            <dd className='mt-1 text-2xl font-semibold tabular-nums'>{value}</dd>
          </div>
        ))}
      </dl>
      <form className=' flex flex-wrap items-end gap-3' method='get'>
        <label className='grid gap-1 text-sm'>
          Month
          <input
            className='bg-card min-h-11 rounded-[var(--radius-control)] border px-3'
            name='month'
            type='month'
            defaultValue={month}
          />
        </label>
        <button
          className='bg-secondary text-secondary-foreground min-h-11 rounded-[var(--radius-control)] px-4 font-medium'
          type='submit'
        >
          Show month
        </button>
        <a
          className='inline-flex min-h-11 items-center px-2 font-medium underline underline-offset-4'
          href={`/admin/usage/export?month=${month}`}
        >
          Download CSV
        </a>
      </form>
      {empty ? <p className='text-muted-foreground '>No usage recorded for {month}.</p> : null}
      {!empty && (
        <section
          aria-label='Cost versus recorded fee'
          className='bg-card  rounded-[var(--radius-card)] border p-5'
        >
          <h2 className='mb-3 font-semibold'>Cost vs fee by client</h2>
          <CostVsFeeChart
            rows={rows.map((row): UsageChartRow => ({
              tenantName: row.tenantName,
              providerCostCents: providerCostCents(row),
              marginCents: marginCents(row),
              feeRecorded: row.monthlyFeeCents != null
            }))}
          />
        </section>
      )}
      <div
        className='bg-card overflow-x-auto rounded-[var(--radius-card)] border'
        role='region'
        aria-label='Usage by client'
        tabIndex={0}
      >
        <table className='w-full text-sm'>
          <thead className='bg-surface-sunken'>
            <tr>
              <th className='text-muted-foreground p-3 text-start font-medium'>Client</th>
              <th className='text-muted-foreground p-3 text-start font-medium'>Minutes</th>
              <th className='text-muted-foreground p-3 text-start font-medium'>Calls</th>
              <th className='text-muted-foreground p-3 text-start font-medium'>SMS</th>
              <th className='text-muted-foreground p-3 text-start font-medium'>Emails</th>
              <th className='text-muted-foreground p-3 text-start font-medium'>Provider cost</th>
              <th className='text-muted-foreground p-3 text-start font-medium'>AI cost</th>
              <th className='text-muted-foreground p-3 text-start font-medium'>AI cap</th>
              <th className='text-muted-foreground p-3 text-start font-medium'>Recorded fee</th>
              <th className='text-muted-foreground p-3 text-start font-medium'>Margin</th>
              <th className='text-muted-foreground p-3 text-start font-medium'>Cap</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const margin = marginCents(row);
              return (
                <tr key={row.tenantId} className='border-t'>
                  <td className='p-3'>{row.tenantName}</td>
                  <td className='p-3'>{minutesLabel(row.callSeconds)}</td>
                  <td className='p-3'>{row.callCount}</td>
                  <td className='p-3'>{row.smsCount}</td>
                  <td className='p-3'>{row.emailCount}</td>
                  <td className='p-3'>
                    {formatCents(providerCostCents(row))}
                    {row.costUnknown ? (
                      <>
                        {' '}
                        · <StatusPill tone='attention'>cost unknown</StatusPill>
                      </>
                    ) : (
                      ''
                    )}
                  </td>
                  <td className='p-3'>{formatCents(llmCostCents(row))}</td>
                  <td className='p-3'>
                    {row.llmCapCents == null ? 'Default' : formatCents(row.llmCapCents)}
                  </td>
                  <td className='p-3'>
                    {row.monthlyFeeCents == null
                      ? 'Not recorded'
                      : formatCents(row.monthlyFeeCents)}
                  </td>
                  <td className='p-3'>{margin == null ? 'Not recorded' : formatCents(margin)}</td>
                  <td className='p-3'>
                    {row.capCents == null ? (
                      'No cap'
                    ) : (
                      <CapUsageBar
                        costCents={providerCostCents(row)}
                        capCents={row.capCents}
                        status={capStatus(row)}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
