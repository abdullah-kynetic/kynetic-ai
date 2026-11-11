'use client';

import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

type Day = { day: string; leads: number; estimatesBooked: number };
const config = {
  leads: { label: 'Leads', color: 'var(--chart-1)' },
  estimatesBooked: { label: 'Booked', color: 'var(--chart-2)' },
  value: { label: 'Count', color: 'var(--chart-1)' }
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

export function CountChart({
  name,
  rows,
  empty
}: {
  name: string;
  rows: { label: string; value: number }[];
  empty: string;
}) {
  return (
    <section aria-label={name} className='min-w-0 rounded-xl bg-card p-4 ring-1 ring-foreground/10'>
      <h2 className='font-medium'>{name}</h2>
      {!rows.length || rows.every((r) => r.value === 0) ? (
        <p className='text-muted-foreground mt-3 text-sm'>{empty}</p>
      ) : (
        <>
          <ChartContainer
            config={config}
            className='mt-3 h-64 w-full'
            role='img'
            aria-label={`${name} chart`}
          >
            <BarChart data={rows} layout='vertical' accessibilityLayer>
              <CartesianGrid horizontal={false} />
              <XAxis type='number' allowDecimals={false} />
              <YAxis
                dataKey='label'
                type='category'
                width={85}
                tickFormatter={(v: string) => v.replaceAll('_', ' ')}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey='value' fill='var(--color-value)' isAnimationActive={false} />
            </BarChart>
          </ChartContainer>
          <details className='mt-2 text-sm'>
            <summary className='flex min-h-11 cursor-pointer items-center'>
              View {name.toLowerCase()} data
            </summary>
            <table className='w-full text-left'>
              <caption className='sr-only'>{name} data</caption>
              <thead>
                <tr>
                  <th scope='col'>Category</th>
                  <th scope='col'>Count</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label}>
                    <th scope='row' className='break-all'>
                      {r.label.replaceAll('_', ' ')}
                    </th>
                    <td>{r.value}</td>
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
