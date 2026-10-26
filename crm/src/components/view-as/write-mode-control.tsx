'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  disableWriteModeAction,
  enableWriteModeAction,
  type ViewAsActionResult
} from '@/app/view-as/actions';
import * as React from 'react';

/** Admin-only switch to write mode (second reason, 30 minutes) and back. VAs never see it. */
export function WriteModeControl({ writeUntil }: { writeUntil: string | null }) {
  const [state, action, pending] = React.useActionState<{ error?: string }, FormData>(
    async (_prev, formData) =>
      ((await enableWriteModeAction(formData)) as ViewAsActionResult) ?? {},
    {}
  );
  const errorId = React.useId();

  if (writeUntil) {
    return (
      <form action={disableWriteModeAction} className='flex items-center gap-2'>
        <span className='text-xs'>
          Write mode until{' '}
          <time dateTime={writeUntil} suppressHydrationWarning>
            {new Date(writeUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </time>
        </span>
        <Button type='submit' size='sm' variant='secondary'>
          Back to read-only
        </Button>
      </form>
    );
  }
  return (
    <details className='relative'>
      <summary className='focus-visible:ring-ring cursor-pointer rounded px-2 py-1 text-xs underline focus-visible:ring-2'>
        Enable write mode
      </summary>
      <form
        action={action}
        className='bg-card text-card-foreground absolute end-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] space-y-3 rounded-lg border p-4 shadow-md'
      >
        <label htmlFor='write-reason' className='block text-sm font-medium'>
          Why do you need to edit as this client? (required)
        </label>
        <Input
          id='write-reason'
          name='reason'
          required
          minLength={10}
          maxLength={500}
          autoComplete='off'
          aria-invalid={Boolean(state.error)}
          aria-describedby={state.error ? errorId : undefined}
        />
        <p className='text-muted-foreground text-xs'>
          Write mode lasts 30 minutes and is logged. Exports, user and module changes, billing and
          the Alex prompt stay closed.
        </p>
        {state.error && (
          <p id={errorId} role='alert' className='text-destructive text-sm'>
            {state.error}
          </p>
        )}
        <Button type='submit' disabled={pending} aria-busy={pending}>
          {pending ? 'Enabling…' : 'Enable write mode'}
        </Button>
      </form>
    </details>
  );
}
