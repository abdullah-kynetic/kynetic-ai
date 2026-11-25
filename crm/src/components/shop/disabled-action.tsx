import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

export const DISABLED_NOTE = 'Turns on when this is connected';

/**
 * An action that exists on the screen but cannot be used yet. It is visibly disabled and always says
 * why, so nobody presses it expecting a text, a call or an email to go out. Nothing is wired to it.
 */
export function DisabledAction({
  children,
  note = DISABLED_NOTE,
  id,
  variant = 'outline'
}: {
  children: ReactNode;
  note?: string;
  id: string;
  variant?: 'default' | 'outline' | 'secondary';
}) {
  const noteId = `${id}-note`;
  return (
    <span
      className='inline-flex max-w-full flex-col items-start gap-1'
      data-testid='disabled-action'
    >
      <Button type='button' variant={variant} disabled aria-describedby={noteId}>
        {children}
      </Button>
      <span id={noteId} className='text-muted-foreground text-xs'>
        {note}
      </span>
    </span>
  );
}
