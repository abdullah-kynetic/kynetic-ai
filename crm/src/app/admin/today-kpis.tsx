'use client';

import { useEffect, useRef, useState } from 'react';
import { StatTiles } from '@/components/layout/stat-tiles';
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
    <StatTiles
      label='Today in numbers'
      tiles={items.map((kpi, index) => ({
        label: kpi.label,
        value: <CountUp value={kpi.value} />,
        key: index === 0,
        note: (
          <>
            <StatusPill tone={kpi.tone}>{kpi.word}</StatusPill>
            <span>{kpi.unit}</span>
          </>
        )
      }))}
    />
  );
}
