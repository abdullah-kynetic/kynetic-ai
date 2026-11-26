import * as React from 'react';

import { cn } from '@/lib/utils';

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot='textarea'
      className={cn(
        'flex field-sizing-content min-h-24 w-full rounded-md border border-transparent bg-secondary px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground hover:bg-muted focus-visible:border-input focus-visible:bg-card focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:border-transparent disabled:bg-muted disabled:text-muted-foreground read-only:border-transparent read-only:bg-transparent aria-invalid:border-destructive md:text-sm',
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
