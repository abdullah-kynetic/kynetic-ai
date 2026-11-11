'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

const config = {
  cost: { label: 'Provider cost', color: 'var(--chart-2)' },
  margin: { label: 'Margin', color: 'var(--chart-1)' }
};

export type UsageChartRow = {
  tenantName: string;
  providerCostCents: number;
  marginCents: number | null;
  feeRecorded: boolean;
};

/**
 * Stacked provider cost and margin per client; the stack reaches the recorded fee.
 * Clients without a recorded fee show cost only.
 */
export function CostVsFeeChart({ rows }: { rows: UsageChartRow[] }) {
  const active = rows.filter((r) => r.providerCostCents > 0 || r.feeRecorded);
  if (!active.length) {
    return (
      <p className='text-muted-foreground text-sm'>
        No cost or fee recorded for this month, so there is no chart.
      </p>
    );
  }
  const data = rows.map((r) => ({
    client: r.tenantName,
    cost: r.providerCostCents / 100,
    margin: r.marginCents == null ? null : r.marginCents / 100
  }));
  return (
    <div className='min-w-0'>
      <ChartContainer
        config={config}
        className='h-64 w-full'
        role='img'
        aria-label='Provider cost versus recorded fee stacked bar chart'
      >
        <BarChart data={data} accessibilityLayer>
          <CartesianGrid vertical={false} />
          <XAxis dataKey='client' tickFormatter={(v: string) => v} minTickGap={10} />
          <YAxis
            tickFormatter={(v: number) =>
              `${v >= 1000 || v <= -1000 ? `${Math.round(v / 1000)}k` : v}`
            }
            width={44}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar
            dataKey='cost'
            stackId='usage'
            fill='var(--color-cost)'
            radius={4}
            isAnimationActive={false}
          />
          <Bar
            dataKey='margin'
            stackId='usage'
            fill='var(--color-margin)'
            radius={4}
            isAnimationActive={false}
          />
        </BarChart>
      </ChartContainer>
      <p className='text-muted-foreground mt-1 text-sm'>
        Provider cost plus margin stacks to the recorded fee. Clients without a recorded fee show
        cost only.
      </p>
      <details className='mt-2 text-sm'>
        <summary className='flex min-h-11 cursor-pointer items-center'>View chart amounts</summary>
        <table className='w-full text-left'>
          <caption className='sr-only'>Provider cost and fee per client</caption>
          <thead>
            <tr>
              <th scope='col'>Client</th>
              <th scope='col'>Provider cost</th>
              <th scope='col'>Margin</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.tenantName}>
                <th scope='row'>{r.tenantName}</th>
                <td>${(r.providerCostCents / 100).toLocaleString('en-US')}</td>
                <td>
                  {r.marginCents == null
                    ? 'Not recorded'
                    : `$${(r.marginCents / 100).toLocaleString('en-US')}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
