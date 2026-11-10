'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import * as React from 'react';
import { saveGuaranteeBaseline, type GuaranteeState } from './guarantee-actions';

export function GuaranteeForm(props: {
  tenantId: string;
  baseline: number | null;
  startDate: string | null;
  measured: number | null;
}) {
  const [state, action, pending] = React.useActionState<GuaranteeState, FormData>(
    saveGuaranteeBaseline,
    { status: 'idle' }
  );
  return (
    <form action={action} className='mt-4 grid gap-3 sm:grid-cols-2'>
      <input type='hidden' name='tenantId' value={props.tenantId} />
      <div className='flex flex-col gap-1.5'>
        <Label htmlFor='guarantee-start'>Measurement start</Label>
        <Input
          id='guarantee-start'
          name='startDate'
          type='date'
          defaultValue={props.startDate ?? ''}
        />
        <p className='text-muted-foreground text-xs'>The 30-day count starts on this date.</p>
      </div>
      <div className='flex flex-col gap-1.5'>
        <Label htmlFor='guarantee-baseline'>Last month&apos;s booked appointments</Label>
        <Input
          id='guarantee-baseline'
          name='baseline'
          type='number'
          min={0}
          step={1}
          defaultValue={props.baseline ?? ''}
          placeholder={
            props.measured === null ? 'Measured after a start date' : String(props.measured)
          }
        />
        <p className='text-muted-foreground text-xs'>
          Leave blank to use the count from the 30 days before the start date
          {props.measured === null ? '' : ` (${props.measured})`}.
        </p>
      </div>
      <div className='sm:col-span-2'>
        <Button type='submit' disabled={pending} className='min-h-11'>
          Save guarantee baseline
        </Button>
        {state.status === 'saved' && (
          <p role='status' className='mt-2 text-sm'>
            Saved.
          </p>
        )}
        {state.status === 'error' && (
          <p role='alert' className='text-destructive mt-2 text-sm'>
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
