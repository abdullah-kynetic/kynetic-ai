'use client';

import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

// Neutral steps for every month, the accent only on the latest month's revenue (the number being tracked).
const config = {
  revenueCents: { label: 'Revenue', color: 'var(--chart-4)' },
  expenseCents: { label: 'Expenses', color: 'var(--muted-foreground)' }
};
const usdWhole = (cents: number) => `$${Math.round(cents / 100).toLocaleString('en-US')}`;
const usdAxis = (cents: number) => {
  const dollars = cents / 100;
  return Math.abs(dollars) >= 1000 ? `$${Number((dollars / 1000).toFixed(1))}k` : `$${dollars}`;
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
  // Oldest month first, so time runs left to right whatever order the caller sends.
  const rows = months
    .map((m) => ({
      month: m.month,
      revenueCents: m.revenueCents,
      expenseCents: m.expenseCents
    }))
    .toSorted((a, b) => a.month.localeCompare(b.month));
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
          <YAxis tickFormatter={usdAxis} width={48} />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, name) => (
                  <span className='flex w-full justify-between gap-4'>
                    <span className='text-muted-foreground'>
                      {config[name as keyof typeof config]?.label ?? name}
                    </span>
                    <span className='font-mono font-medium tabular-nums'>
                      {usdWhole(Number(value))}
                    </span>
                  </span>
                )}
              />
            }
          />
          <Bar
            dataKey='revenueCents'
            fill='var(--color-revenueCents)'
            radius={4}
            isAnimationActive={false}
          >
            {rows.map((row, index) => (
              <Cell
                key={row.month}
                fill={index === rows.length - 1 ? 'var(--chart-1)' : 'var(--color-revenueCents)'}
              />
            ))}
          </Bar>
          <Bar
            dataKey='expenseCents'
            fill='var(--color-expenseCents)'
            fillOpacity={0.5}
            radius={4}
            isAnimationActive={false}
          />
        </BarChart>
      </ChartContainer>
      <p className='text-muted-foreground mt-1 text-sm'>
        Revenue is the first bar of each Pacific month and expenses the second. The accent marks the
        latest month.
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
