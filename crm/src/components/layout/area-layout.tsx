'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import type { Area } from '@/config/area-nav';
import { HeadingLevelProvider } from './heading-level';

/** Shared frame for an area dashboard and all of its sub-pages. */
export function AreaLayout({ area, children }: { area: Area; children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className='mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 pt-2 pb-8 md:px-6 md:pt-4'>
      <header className='space-y-2'>
        <h1 className='text-[28px]/[1.15] font-medium tracking-[-0.01em] md:text-[32px]/[1.1]'>
          {area.title}
        </h1>
        <p className='text-muted-foreground text-[15px]'>{area.description}</p>
      </header>
      {area.tabs.length > 0 && (
        <nav
          aria-label={`${area.title} pages`}
          className='-mx-4 overflow-x-auto border-b px-4 md:mx-0 md:px-0'
        >
          <div className='flex min-w-max gap-1'>
            {area.tabs.map((tab) => {
              const selected =
                pathname === tab.href ||
                (area.href === '/dashboard/settings' &&
                  tab.href === area.href &&
                  pathname === '/dashboard/settings/business') ||
                (tab.href !== area.href && pathname.startsWith(`${tab.href}/`));
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-current={selected ? 'page' : undefined}
                  className={`focus-visible:ring-ring inline-flex min-h-11 items-center whitespace-nowrap rounded-t-md px-3 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none ${selected ? 'border-primary text-foreground border-b-2' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
      <div className='min-w-0'>
        <HeadingLevelProvider value='h2'>{children}</HeadingLevelProvider>
      </div>
    </div>
  );
}
