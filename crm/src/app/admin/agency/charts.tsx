'use client';

import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

const ratesConfig = {
  pickRate: { label: 'Pick rate', color: 'var(--chart-1)' },
  replyRate: { label: 'Reply rate', color: 'var(--chart-2)' }
};

export type RatesPoint = { day: string; pickRate: number | null; replyRate: number | null };

/** Thirty-day pick and reply rate trend; each day is null, not zero, when nothing happened. */
export function AgencyRatesLine({ points }: { points: RatesPoint[] }) {
  const active = points.filter((p) => p.pickRate !== null || p.replyRate !== null);
  if (!active.length) {
    return (
      <p className='text-muted-foreground text-sm'>
        No calls or outreach in the last thirty days, so there is no rate line yet.
      </p>
    );
  }
  return (
    <div className='min-w-0'>
      <ChartContainer
        config={ratesConfig}
        className='h-56 w-full'
        role='img'
        aria-label='Thirty-day pick and reply rate line chart'
      >
        <LineChart data={points} accessibilityLayer>
          <CartesianGrid vertical={false} />
          <XAxis dataKey='day' tickFormatter={(v: string) => v.slice(5)} minTickGap={30} />
          <YAxis
            domain={[0, 1]}
            tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
            width={40}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Line
            type='monotone'
            dataKey='pickRate'
            stroke='var(--color-pickRate)'
            strokeWidth={2}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
          <Line
            type='monotone'
            dataKey='replyRate'
            stroke='var(--color-replyRate)'
            strokeDasharray='5 3'
            strokeWidth={2}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
        </LineChart>
      </ChartContainer>
      <p className='text-muted-foreground mt-1 text-sm'>
        Pick rate: solid line · Reply rate: dashed line
      </p>
      <details className='mt-2 text-sm'>
        <summary className='flex min-h-11 cursor-pointer items-center'>View daily rates</summary>
        <table className='w-full text-left'>
          <caption className='sr-only'>Thirty-day pick and reply rates</caption>
          <thead>
            <tr>
              <th scope='col'>Day</th>
              <th scope='col'>Pick rate</th>
              <th scope='col'>Reply rate</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.day}>
                <th scope='row'>{p.day}</th>
                <td>{p.pickRate === null ? '—' : `${(p.pickRate * 100).toFixed(1)}%`}</td>
                <td>{p.replyRate === null ? '—' : `${(p.replyRate * 100).toFixed(1)}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

const sourceConfig = { count: { label: 'Leads', color: 'var(--chart-1)' } };
const sourceLabel = (direction: string, channel: string) =>
  `${direction === 'inbound' ? 'Inbound' : 'Outbound'} · ${channel.replaceAll('_', ' ')}`;

/** Horizontal bar list of lead sources with the counts as a text fallback. */
export function AgencySourceBars({
  counts
}: {
  counts: { direction: string; channel: string; count: number }[];
}) {
  const rows = counts.map((c) => ({
    label: sourceLabel(c.direction, c.channel),
    value: c.count
  }));
  if (rows.every((r) => r.value === 0)) {
    return <p className='text-muted-foreground text-sm'>No leads yet.</p>;
  }
  return (
    <div className='min-w-0'>
      <ChartContainer
        config={sourceConfig}
        className='h-64 w-full'
        role='img'
        aria-label='Lead source bar chart'
      >
        <BarChart data={rows} layout='vertical' margin={{ left: 8, right: 16 }} accessibilityLayer>
          <CartesianGrid horizontal={false} />
          <XAxis type='number' allowDecimals={false} />
          <YAxis dataKey='label' type='category' width={110} tickLine={false} axisLine={false} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey='count' fill='var(--color-count)' radius={4} isAnimationActive={false} />
        </BarChart>
      </ChartContainer>
      <details className='mt-2 text-sm'>
        <summary className='flex min-h-11 cursor-pointer items-center'>View source counts</summary>
        <table className='w-full text-left'>
          <caption className='sr-only'>Lead source counts</caption>
          <thead>
            <tr>
              <th scope='col'>Source</th>
              <th scope='col'>Leads</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <th scope='row'>{r.label}</th>
                <td>{r.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
