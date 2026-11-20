'use client';

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

type Day = { day: string; leads: number; estimatesBooked: number };
const config = {
  leads: { label: 'Leads', color: 'var(--chart-1)' },
  estimatesBooked: { label: 'Booked', color: 'var(--muted-foreground)' }
};

export function DailyTrend({
  days,
  name = 'Daily leads and bookings'
}: {
  days: Day[];
  name?: string;
}) {
  return (
    <section aria-label={name} className='min-w-0 rounded-xl bg-card p-4 ring-1 ring-foreground/10'>
      <h2 className='font-medium'>{name}</h2>
      {!days.length ? (
        <p className='text-muted-foreground mt-3 text-sm'>No activity in this range.</p>
      ) : (
        <>
          <p className='text-muted-foreground mt-2 text-sm'>
            Leads: solid line · Booked: dashed line
          </p>
          <ChartContainer
            config={config}
            className='mt-3 h-64 w-full'
            role='img'
            aria-label={`${name} chart`}
          >
            <LineChart data={days} accessibilityLayer>
              <CartesianGrid vertical={false} />
              <XAxis dataKey='day' tickFormatter={(v: string) => v.slice(5)} minTickGap={30} />
              <YAxis allowDecimals={false} width={32} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line
                type='monotone'
                dataKey='leads'
                stroke='var(--color-leads)'
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type='monotone'
                dataKey='estimatesBooked'
                stroke='var(--color-estimatesBooked)'
                strokeDasharray='5 3'
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ChartContainer>
          <details className='mt-2 text-sm'>
            <summary className='flex min-h-11 cursor-pointer items-center'>View daily data</summary>
            <table className='w-full text-left'>
              <caption className='sr-only'>{name} data</caption>
              <thead>
                <tr>
                  <th scope='col'>Date</th>
                  <th scope='col'>Leads</th>
                  <th scope='col'>Booked</th>
                </tr>
              </thead>
              <tbody>
                {days.map((d) => (
                  <tr key={d.day}>
                    <th scope='row'>{d.day}</th>
                    <td>{d.leads}</td>
                    <td>{d.estimatesBooked}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </section>
  );
}

/** A ranked list with thin bars. The bar that matters carries the accent, the rest sit in neutral. */
export function CountChart({
  name,
  rows,
  empty,
  ranked = false,
  highlight = 'max'
}: {
  name: string;
  rows: { label: string; value: number }[];
  empty: string;
  /** Sort largest first (sources). Leave off for ordered steps (funnel, pipeline stages). */
  ranked?: boolean;
  highlight?: 'max' | 'last';
}) {
  const none = !rows.length || rows.every((r) => r.value === 0);
  const list = ranked ? rows.toSorted((a, b) => b.value - a.value) : rows;
  const top = Math.max(...list.map((r) => r.value), 1);
  const lead = highlight === 'last' ? list.length - 1 : list.findIndex((r) => r.value === top);
  return (
    <section
      aria-label={name}
      className='bg-card min-w-0 rounded-[var(--radius-card)] border p-4 sm:p-5'
    >
      <h2 className='text-base font-medium'>{name}</h2>
      {none ? (
        <p className='text-muted-foreground mt-3 text-sm'>{empty}</p>
      ) : (
        <ol className='mt-4 space-y-3'>
          {list.map((row, index) => (
            <li key={row.label}>
              <div className='flex items-baseline justify-between gap-3 text-sm'>
                <span className='min-w-0 truncate'>{row.label.replaceAll('_', ' ')}</span>
                <span className='text-muted-foreground font-mono text-xs tabular-nums'>
                  {row.value}
                </span>
              </div>
              <div className='bg-muted mt-1.5 h-1 overflow-hidden rounded-full' aria-hidden='true'>
                <div
                  className={`h-full rounded-full ${index === lead ? 'bg-chart-1' : 'bg-muted-foreground/40'}`}
                  style={{ width: `${Math.max((row.value / top) * 100, row.value ? 3 : 0)}%` }}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
