'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { TranscriptLine } from '@/server/calls/detail';
import { useEffect, useState } from 'react';

export const CALL_TIME_EVENT = 'call-time';
export const CALL_SEEK_EVENT = 'call-seek';

function stamp(s: number): string {
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

/** Highlights the line being played and seeks the player when a timed line is clicked. */
export function Transcript({ lines }: { lines: TranscriptLine[] | null }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const onTime = (e: Event) => setNow((e as CustomEvent<number>).detail);
    window.addEventListener(CALL_TIME_EVENT, onTime);
    return () => window.removeEventListener(CALL_TIME_EVENT, onTime);
  }, []);

  const current =
    now == null || !lines
      ? -1
      : lines.reduce((acc, l, i) => (l.startS != null && l.startS <= now ? i : acc), -1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transcript</CardTitle>
      </CardHeader>
      <CardContent>
        {lines === null ? (
          <p role='status' className='text-muted-foreground text-sm'>
            Transcript is still processing. It appears here when Alex finishes the call summary.
          </p>
        ) : (
          <ol className='flex flex-col gap-3 text-sm'>
            {lines.map((l, i) => (
              <li
                key={i}
                aria-current={i === current ? 'true' : undefined}
                className='data-[current=true]:bg-muted -mx-2 flex gap-3 rounded-md px-2 py-1'
                data-current={i === current}
              >
                {l.startS != null ? (
                  <button
                    type='button'
                    aria-label={`Play from ${stamp(l.startS)}`}
                    className='text-primary-text focus-visible:ring-ring w-10 shrink-0 rounded text-start tabular-nums underline-offset-2 hover:underline focus-visible:ring-2'
                    onClick={() =>
                      window.dispatchEvent(new CustomEvent(CALL_SEEK_EVENT, { detail: l.startS }))
                    }
                  >
                    {stamp(l.startS)}
                  </button>
                ) : null}
                <span>
                  {l.speaker ? <strong className='font-medium'>{l.speaker}: </strong> : null}
                  {l.text}
                </span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
