'use client';

import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

type Stage = { id: string; name: string; deals: number; valueCents: number };

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0
});

export function PipelineFunnel({ stages }: { stages: Stage[] }) {
  const data = stages.map((stage) => ({ ...stage, value: stage.valueCents / 100 }));
  return (
    <div className='mt-3 grid gap-3'>
      <ChartContainer
        config={{ deals: { label: 'Deals', color: 'var(--primary)' } }}
        className='h-64 w-full min-w-0 aspect-auto'
      >
        <BarChart data={data} layout='vertical' margin={{ left: 8, right: 16 }} accessibilityLayer>
          <CartesianGrid horizontal={false} />
          <XAxis type='number' allowDecimals={false} />
          <YAxis dataKey='name' type='category' width={92} tickLine={false} axisLine={false} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey='deals' fill='var(--color-deals)' radius={4} />
        </BarChart>
      </ChartContainer>
      <ul className='space-y-2 text-sm' aria-label='Pipeline stage totals'>
        {stages.map((stage) => (
          <li key={stage.id} className='flex flex-wrap justify-between gap-x-3'>
            <span>{stage.name}</span>
            <span className='text-muted-foreground'>
              {stage.deals} {stage.deals === 1 ? 'deal' : 'deals'} ·{' '}
              {money.format(stage.valueCents / 100)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
