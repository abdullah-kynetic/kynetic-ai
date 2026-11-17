'use client';

import { useEffect, useRef, useState } from 'react';
import { StatusPill, type Tone } from './today-block';

export type Kpi = { label: string; value: number; unit: string; tone: Tone; word: string };

const COUNT_MS = 240;

/** Counts up once on mount. Renders the real number first, and never animates under reduced motion. */
function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const frame = useRef(0);
  useEffect(() => {
    if (value <= 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / COUNT_MS);
      setShown(Math.round(value * (1 - (1 - t) ** 3)));
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [value]);
  return (
    <>
      <span aria-hidden='true'>{shown}</span>
      <span className='sr-only'>{value}</span>
    </>
  );
}

export function TodayKpis({ items }: { items: Kpi[] }) {
  return (
    <ul
      aria-label='Today in numbers'
      className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 [&>li]:min-w-0'
    >
      {items.map((kpi) => (
        <li key={kpi.label} className='bg-card flex flex-col gap-2 rounded-xl border p-5'>
          <span className='text-muted-foreground text-[13px] font-medium'>{kpi.label}</span>
          <span className='text-4xl/[1.05] font-semibold tracking-tight tabular-nums'>
            <CountUp value={kpi.value} />
          </span>
          <span className='flex items-center gap-2'>
            <StatusPill tone={kpi.tone}>{kpi.word}</StatusPill>
            <span className='text-muted-foreground text-xs'>{kpi.unit}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
