import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type Tone = 'alert' | 'attention' | 'gain' | 'neutral';

const pillTone: Record<Tone, string> = {
  alert: 'bg-alert-soft text-alert',
  attention: 'bg-attention-soft text-attention',
  gain: 'bg-gain-soft text-gain',
  neutral: 'bg-neutral-soft text-neutral'
};
const dotTone: Record<Tone, string> = {
  alert: 'bg-alert',
  attention: 'bg-attention',
  gain: 'bg-gain',
  neutral: 'bg-neutral'
};

/** Soft fill, coloured text and a dot; meaning is always in the words too. */
export function StatusPill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        pillTone[tone]
      )}
    >
      <span aria-hidden='true' className={cn('size-1.5 rounded-full', dotTone[tone])} />
      {children}
    </span>
  );
}
