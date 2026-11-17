import Link from 'next/link';
import type { ReactNode } from 'react';
import { buttonVariants } from '@/components/ui/button';
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

/** One block: the heading is a direct child so the block reads as one region. */
export function TodayBlock({
  title,
  action,
  children
}: {
  title: string;
  action?: { href: string; label: string };
  children: ReactNode;
}) {
  const id = `today-${title.toLowerCase().replaceAll(' ', '-')}`;
  return (
    <section
      className='bg-card text-card-foreground flex flex-col gap-4 rounded-xl border p-6'
      aria-labelledby={id}
    >
      <h2 id={id} className='text-lg font-semibold tracking-tight'>
        {title}
      </h2>
      {children}
      {action ? (
        <div className='mt-auto pt-2'>
          <Link
            href={action.href}
            className={cn(
              buttonVariants({ variant: 'default' }),
              'bg-foreground text-background hover:bg-foreground/90'
            )}
          >
            {action.label}
          </Link>
        </div>
      ) : null}
    </section>
  );
}

export function NothingNeedsYou() {
  return (
    <p className='text-muted-foreground flex items-center gap-2 text-sm'>
      <StatusPill tone='gain'>Clear</StatusPill>
      Nothing needs you.
    </p>
  );
}

export function TodayLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className='underline underline-offset-4'>
      {children}
    </Link>
  );
}
