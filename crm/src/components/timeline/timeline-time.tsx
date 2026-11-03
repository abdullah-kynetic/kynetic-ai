'use client';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/** Relative time as the visible text, absolute time in the tooltip (DESIGN_SYSTEM, Timeline). */
export function TimelineTime({
  iso,
  relative,
  absolute
}: {
  iso: string;
  relative: string;
  absolute: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={<time dateTime={iso} className='text-muted-foreground text-xs' />}>
        {relative}
        <span className='sr-only'> ({absolute})</span>
      </TooltipTrigger>
      <TooltipContent>{absolute}</TooltipContent>
    </Tooltip>
  );
}
