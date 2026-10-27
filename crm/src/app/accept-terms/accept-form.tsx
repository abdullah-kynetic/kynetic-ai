'use client';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import * as React from 'react';
import { acceptTerms } from './actions';

export function AcceptForm() {
  const [state, action, pending] = React.useActionState<{ error?: string }, FormData>(
    async (_prev, formData) => (await acceptTerms(formData)) ?? {},
    {}
  );
  const errorId = React.useId();

  return (
    <form action={action} className='mt-6 space-y-4'>
      <div className='flex items-start gap-3'>
        <Checkbox
          id='accept'
          name='accept'
          aria-invalid={Boolean(state.error)}
          aria-describedby={state.error ? errorId : undefined}
        />
        <label htmlFor='accept' className='text-sm leading-5'>
          I have read and accept the Terms of Service and the Privacy Policy.
        </label>
      </div>
      {state.error && (
        <p id={errorId} role='alert' className='text-destructive text-sm'>
          {state.error}
        </p>
      )}
      <Button type='submit' disabled={pending}>
        {pending ? 'Saving…' : 'Accept and continue'}
      </Button>
    </form>
  );
}
