'use client';

import { createElement } from 'react';
import { usePageHeadingTag } from '@/components/layout/heading-level';
import { InfoButton } from '@/components/ui/info-button';
import type { InfobarContent } from '@/components/ui/infobar';

interface HeadingProps {
  title: string;
  description: string;
  infoContent?: InfobarContent;
}

export function Heading({ title, description, infoContent }: HeadingProps) {
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
        {infoContent && (
          <div className='pt-1'>
            <InfoButton content={infoContent} />
          </div>
        )}
      </div>
      <p className='text-muted-foreground text-sm'>{description}</p>
    </div>
  );
}
