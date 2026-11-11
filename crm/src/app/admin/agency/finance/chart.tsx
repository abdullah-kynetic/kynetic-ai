'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

const config = {
  revenueCents: { label: 'Revenue', color: 'var(--chart-1)' },
  expenseCents: { label: 'Expenses', color: 'var(--chart-2)' }
};

export type FinanceMonth = {
  month: string;
  revenueCents: number;
  expenseCents: number;
  netCents: number;
};

/** Grouped monthly revenue and expense bars with the amounts as a text fallback. */
export function FinanceMonthsChart({ months }: { months: FinanceMonth[] }) {
  if (!months.length || months.every((m) => m.revenueCents === 0 && m.expenseCents === 0)) {
    return (
      <p className='text-muted-foreground text-sm'>
        No revenue or expenses recorded yet, so there is no monthly chart.
      </p>
    );
  }
  const rows = months.map((m) => ({
    month: m.month,
    revenueCents: m.revenueCents,
    expenseCents: m.expenseCents
  }));
  return (
    <div className='min-w-0'>
      <ChartContainer
        config={config}
        className='h-64 w-full'
        role='img'
        aria-label='Monthly revenue versus expenses bar chart'
      >
        <BarChart data={rows} accessibilityLayer>
          <CartesianGrid vertical={false} />
          <XAxis dataKey='month' />
          <YAxis
            tickFormatter={(v: number) =>
              `${v >= 1000 || v <= -1000 ? `${Math.round(v / 1000)}k` : v}`
            }
            width={44}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar
            dataKey='revenueCents'
            fill='var(--color-revenueCents)'
            radius={4}
            isAnimationActive={false}
          />
          <Bar
            dataKey='expenseCents'
            fill='var(--color-expenseCents)'
            radius={4}
            isAnimationActive={false}
          />
        </BarChart>
      </ChartContainer>
      <p className='text-muted-foreground mt-1 text-sm'>
        Revenue: first bar · Expenses: second bar, per Pacific month.
      </p>
      <details className='mt-2 text-sm'>
        <summary className='flex min-h-11 cursor-pointer items-center'>
          View monthly amounts
        </summary>
        <table className='w-full text-left'>
          <caption className='sr-only'>Monthly revenue and expenses</caption>
          <thead>
            <tr>
              <th scope='col'>Month</th>
              <th scope='col'>Revenue</th>
              <th scope='col'>Expenses</th>
              <th scope='col'>Net</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.month}>
                <th scope='row'>{m.month}</th>
                <td>${(m.revenueCents / 100).toLocaleString('en-US')}</td>
                <td>${(m.expenseCents / 100).toLocaleString('en-US')}</td>
                <td>${(m.netCents / 100).toLocaleString('en-US')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
