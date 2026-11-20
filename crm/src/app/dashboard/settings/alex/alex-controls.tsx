'use client';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import * as React from 'react';
import { saveAlexSettings, type AlexSettingsState } from './actions';

/** The two things an owner can change: pause Alex and call hours. Everything else is a request to Kynetic. */
export function AlexControls({
  paused,
  start,
  end
}: {
  paused: boolean;
  start: string;
  end: string;
}) {
  const [pausedValue, setPausedValue] = React.useState(paused);
  const [startValue, setStartValue] = React.useState(start);
  const [endValue, setEndValue] = React.useState(end);
  const saved = React.useRef({ paused, start, end });
  const [state, action, pending] = React.useActionState<AlexSettingsState, FormData>(
    async (previous, formData) => {
      const result = await saveAlexSettings(previous, formData);
      if (result.saved) {
        saved.current = {
          paused: formData.get('paused') === 'on',
          start: String(formData.get('start')),
          end: String(formData.get('end'))
        };
      }
      return result;
    },
    {}
  );
  const errorId = React.useId();

  return (
    <form action={action} className='space-y-5'>
      {state.error && (
        <div
          id={errorId}
          role='alert'
          className='border-destructive/40 bg-destructive/10 text-destructive rounded-lg border p-4 text-sm'
        >
          <strong>Alex settings were not saved.</strong> {state.error}
        </div>
      )}
      <div className='flex items-center gap-3'>
        <Checkbox
          id='paused'
          name='paused'
          checked={pausedValue}
          onCheckedChange={(checked) => setPausedValue(checked === true)}
        />
        <label htmlFor='paused' className='text-sm leading-5'>
          Pause Alex. No calls start while paused.
        </label>
      </div>
      <div className='flex flex-wrap gap-4'>
        <div className='space-y-1'>
          <label htmlFor='start' className='text-sm'>
            Calls start at
          </label>
          <Input
            id='start'
            name='start'
            type='time'
            value={startValue}
            onChange={(event) => setStartValue(event.target.value)}
            required
          />
        </div>
        <div className='space-y-1'>
          <label htmlFor='end' className='text-sm'>
            Calls stop at
          </label>
          <Input
            id='end'
            name='end'
            type='time'
            value={endValue}
            onChange={(event) => setEndValue(event.target.value)}
            required
          />
        </div>
      </div>
      {state.saved && (
        <p role='status' className='text-sm'>
          Saved.
        </p>
      )}
      <div className='flex flex-wrap gap-3'>
        <Button type='submit' disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </Button>
        <Button
          type='reset'
          variant='outline'
          disabled={pending}
          onClick={() => {
            setPausedValue(saved.current.paused);
            setStartValue(saved.current.start);
            setEndValue(saved.current.end);
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
