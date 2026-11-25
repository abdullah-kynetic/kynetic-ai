'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { addWalkIn, type WalkInState } from '../actions';

export function WalkInForm() {
  const [state, action, pending] = useActionState<WalkInState, FormData>(addWalkIn, {});
  const v = state.values ?? {};
  const field = (
    name: 'name' | 'phone' | 'year' | 'make' | 'model',
    label: string,
    props: {
      type?: string;
      inputMode?: 'numeric' | 'tel';
      autoComplete?: string;
    } = {}
  ) => {
    const error = state.fieldErrors?.[name as 'name' | 'phone' | 'year'];
    return (
      <div className='grid gap-1.5'>
        <Label htmlFor={`walkin-${name}`}>{label}</Label>
        <Input
          id={`walkin-${name}`}
          name={name}
          defaultValue={v[name] ?? ''}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `walkin-${name}-error` : undefined}
          required={name === 'name' || name === 'phone'}
          {...props}
        />
        {error ? (
          <p id={`walkin-${name}-error`} className='text-destructive text-sm'>
            {error}
          </p>
        ) : null}
      </div>
    );
  };
  return (
    <form
      action={action}
      className='bg-card grid max-w-xl gap-4 rounded-[var(--radius-card)] border p-4 sm:p-5'
    >
      {state.error ? (
        <p role='alert' className='text-destructive text-sm'>
          {state.error}
        </p>
      ) : null}
      {field('name', 'Customer name', { autoComplete: 'off' })}
      {field('phone', 'Phone', {
        type: 'tel',
        inputMode: 'tel',
        autoComplete: 'off'
      })}
      <div className='grid gap-4 sm:grid-cols-3'>
        {field('year', 'Year', { inputMode: 'numeric' })}
        {field('make', 'Make')}
        {field('model', 'Model')}
      </div>
      <div className='flex items-center gap-3'>
        <Button type='submit' disabled={pending}>
          {pending ? 'Saving…' : 'Add walk-in'}
        </Button>
        <p className='text-muted-foreground text-xs'>Nothing is sent to the customer.</p>
      </div>
    </form>
  );
}
