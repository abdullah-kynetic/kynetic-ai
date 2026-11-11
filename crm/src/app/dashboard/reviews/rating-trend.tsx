'use client';

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

const COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)'
];

type Row = { month: string; values: Record<string, number | null> };

/** Monthly average rating per review source. The table below the chart is the text fallback. */
export function RatingTrend({ rows, sources }: { rows: Row[]; sources: string[] }) {
  const keys = sources.map((_, i) => `source${i}`);
  const config = Object.fromEntries(
    sources.map((source, i) => [keys[i]!, { label: source, color: COLORS[i % COLORS.length]! }])
  );
  const data = rows.map((row) => {
    const out: Record<string, number | string | null> = { month: row.month };
    sources.forEach((source, i) => {
      out[keys[i]!] = row.values[source] ?? null;
    });
    return out;
  });
  const name = 'Rating trend by source';
  return (
    <section aria-label={name} className='min-w-0 rounded-xl bg-card p-4 ring-1 ring-foreground/10'>
      <h2 className='font-medium'>{name}</h2>
      {!rows.length || !sources.length ? (
        <p className='text-muted-foreground mt-3 text-sm'>
          No rating snapshots in this window yet.
        </p>
      ) : (
        <>
          <ChartContainer
            config={config}
            className='mt-3 h-64 w-full'
            role='img'
            aria-label={`${name} chart`}
          >
            <LineChart data={data} accessibilityLayer>
              <CartesianGrid vertical={false} />
              <XAxis dataKey='month' tickFormatter={(v: string) => v.slice(2)} minTickGap={20} />
              <YAxis domain={[0, 5]} width={32} allowDecimals />
              <ChartTooltip content={<ChartTooltipContent />} />
              {sources.map((source, i) => (
                <Line
                  key={source}
                  type='monotone'
                  dataKey={keys[i]!}
                  stroke={`var(--color-${keys[i]})`}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                  name={source}
                />
              ))}
            </LineChart>
          </ChartContainer>
          <ul className='text-muted-foreground mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs'>
            {sources.map((source, i) => (
              <li key={source} className='flex items-center gap-1.5'>
                <span
                  aria-hidden='true'
                  className='inline-block size-2.5 rounded-full'
                  style={{ background: COLORS[i % COLORS.length] }}
                />
                {source}
              </li>
            ))}
          </ul>
          <details className='mt-2 text-sm'>
            <summary className='flex min-h-11 cursor-pointer items-center'>View rating data</summary>
            <table className='w-full text-left'>
              <caption className='sr-only'>{name} data</caption>
              <thead>
                <tr>
                  <th scope='col'>Month</th>
                  {sources.map((s) => (
                    <th key={s} scope='col'>
                      {s}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.month}>
                    <th scope='row'>{row.month}</th>
                    {sources.map((s) => (
                      <td key={s}>{row.values[s] == null ? '–' : row.values[s]}</td>
                    ))}
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
