'use client';

import { createElement, type ReactNode } from 'react';
import { usePageHeadingTag } from './heading-level';

/** DESIGN.md page header: big plain title, one muted line, the page's one or two actions at the right. */
export function PageHeader({
  title,
  description,
  actions
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  const tag = usePageHeadingTag();
  return (
    <header className='flex flex-wrap items-start justify-between gap-4'>
      <div className='min-w-0'>
        {createElement(
          tag,
          {
            className:
              'text-[28px]/[1.15] font-medium tracking-[-0.01em] md:text-[32px]/[1.1] md:tracking-[-0.015em]'
          },
          title
        )}
        {description ? (
          <p className='text-muted-foreground mt-1 text-[15px]'>{description}</p>
        ) : null}
      </div>
      {actions ? <div className='flex shrink-0 items-center gap-2'>{actions}</div> : null}
    </header>
  );
}
