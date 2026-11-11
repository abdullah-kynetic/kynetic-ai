'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import type { ClientUsageDay } from '@/server/client-usage';

const config = {
  calls: { label: 'Calls', color: 'var(--chart-1)' },
  sms: { label: 'Texts', color: 'var(--chart-2)' },
  emails: { label: 'Emails', color: 'var(--chart-3)' }
};

/** Daily quantities only. Costs and provider prices never reach this page. */
export function UsageChart({ days }: { days: ClientUsageDay[] }) {
  const name = 'Daily usage';
  return (
    <section aria-label={name} className='min-w-0 rounded-xl bg-card p-4 ring-1 ring-foreground/10'>
      <h2 className='font-medium'>{name}</h2>
      {!days.length ? (
        <p className='text-muted-foreground mt-3 text-sm'>No usage recorded for this month.</p>
      ) : (
        <>
          <ChartContainer
            config={config}
            className='mt-3 h-64 w-full'
            role='img'
            aria-label={`${name} chart`}
          >
            <BarChart data={days} accessibilityLayer>
              <CartesianGrid vertical={false} />
              <XAxis dataKey='day' tickFormatter={(v: string) => v.slice(5)} minTickGap={24} />
              <YAxis allowDecimals={false} width={32} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey='calls' fill='var(--color-calls)' isAnimationActive={false} />
              <Bar dataKey='sms' fill='var(--color-sms)' isAnimationActive={false} />
              <Bar dataKey='emails' fill='var(--color-emails)' isAnimationActive={false} />
            </BarChart>
          </ChartContainer>
          <details className='mt-2 text-sm'>
            <summary className='flex min-h-11 cursor-pointer items-center'>View daily usage</summary>
            <table className='w-full text-left'>
              <caption className='sr-only'>{name} data</caption>
              <thead>
                <tr>
                  <th scope='col'>Date</th>
                  <th scope='col'>Calls</th>
                  <th scope='col'>Texts</th>
                  <th scope='col'>Emails</th>
                  <th scope='col'>Minutes</th>
                </tr>
              </thead>
              <tbody>
                {days.map((d) => (
                  <tr key={d.day}>
                    <th scope='row'>{d.day}</th>
                    <td>{d.calls}</td>
                    <td>{d.sms}</td>
                    <td>{d.emails}</td>
                    <td>{d.minutes}</td>
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
