'use client';

import { startViewAsAction, type ViewAsActionResult } from '@/app/view-as/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import * as React from 'react';

/** One client's start form: the reason is required, and the action refuses without it. */
export function StartViewAsForm({
  tenantId,
  tenantName
}: {
  tenantId: string;
  tenantName: string;
}) {
  const [state, action, pending] = React.useActionState<{ error?: string }, FormData>(
    async (_prev, formData) => ((await startViewAsAction(formData)) as ViewAsActionResult) ?? {},
    {}
  );
  const reasonId = React.useId();
  const errorId = React.useId();
  return (
    <form action={action} className='flex flex-col gap-2 sm:flex-row sm:items-start'>
      <input type='hidden' name='tenantId' value={tenantId} />
      <div className='flex-1 space-y-1'>
        <label htmlFor={reasonId} className='sr-only'>
          Reason for viewing {tenantName} (required)
        </label>
        <Input
          id={reasonId}
          name='reason'
          required
          minLength={10}
          maxLength={500}
          autoComplete='off'
          placeholder='Reason, e.g. checking the booking the owner reported'
          aria-invalid={Boolean(state.error)}
          aria-describedby={state.error ? errorId : undefined}
        />
        {state.error && (
          <p id={errorId} role='alert' className='text-destructive text-sm'>
            {state.error}
          </p>
        )}
      </div>
      <Button type='submit' disabled={pending} aria-busy={pending}>
        {pending ? 'Starting…' : 'View as client'}
      </Button>
    </form>
  );
}
