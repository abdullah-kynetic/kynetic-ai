import Link from 'next/link';
import type { ReactNode } from 'react';

export function TodayBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      className='space-y-3 rounded-xl border bg-card p-4'
      aria-labelledby={`${title}-heading`}
    >
      <h2 id={`${title}-heading`} className='text-lg font-semibold'>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function NothingNeedsYou() {
  return <p className='text-muted-foreground text-sm'>Nothing needs you.</p>;
}

export function TodayLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className='underline'>
      {children}
    </Link>
  );
}
