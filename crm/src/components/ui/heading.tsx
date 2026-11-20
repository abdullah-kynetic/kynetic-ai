'use client';

import { createElement } from 'react';
import { usePageHeadingTag } from '@/components/layout/heading-level';

interface HeadingProps {
  title: string;
  description: string;
}

export function Heading({ title, description }: HeadingProps) {
  const tag = usePageHeadingTag();
  return (
    <div>
      <div className='flex items-center gap-2'>
        {createElement(
          tag,
          {
            className:
              'text-[28px]/[1.15] font-medium tracking-[-0.01em] md:text-[32px]/[1.1] md:tracking-[-0.015em]'
          },
          title
        )}
      </div>
      <p className='text-muted-foreground text-sm'>{description}</p>
    </div>
  );
}
