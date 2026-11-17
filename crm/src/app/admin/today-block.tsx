import Link from 'next/link';
import type { ReactNode } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { StatusPill, type Tone } from '@/components/ui/status-pill';

export { StatusPill, type Tone };

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
      className='bg-card text-card-foreground flex flex-col gap-4 rounded-[var(--radius-card)] border p-6'
      aria-labelledby={id}
    >
      <h2 id={id} className='text-lg font-semibold tracking-tight'>
        {title}
      </h2>
      {children}
      {action ? (
        <div className='mt-auto pt-2'>
          <Link href={action.href} className={buttonVariants({ variant: 'default' })}>
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
