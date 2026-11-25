'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { AwaySettings } from '@/server/shop';
import { saveAwayAction, type AwayState } from './actions';

export function AwayForm({ saved }: { saved: AwaySettings }) {
  const [state, action, pending] = useActionState<AwayState, FormData>(saveAwayAction, {});
  // The checkboxes are controlled so a form reset after a refused save cannot untick them.
  const [on, setOn] = useState({
    enabled: saved.enabled,
    dailySummary: saved.dailySummary,
    urgentCalls: saved.alerts.urgentCalls,
    quoteReplies: saved.alerts.quoteReplies,
    pickupsWaiting: saved.alerts.pickupsWaiting
  });
  // Dates are plain inputs: after a refused save keep what was typed, otherwise show what is stored.
  const settings = state.values ?? saved;
  const check = (name: keyof typeof on, label: string, hint?: string) => (
    <div className='flex min-h-11 items-center gap-1'>
      <Checkbox
        id={`away-${name}`}
        name={name}
        checked={on[name]}
        onCheckedChange={(v) => setOn((p) => ({ ...p, [name]: v === true }))}
      />
      <div className='grid gap-0.5'>
        <Label htmlFor={`away-${name}`}>{label}</Label>
        {hint ? <p className='text-muted-foreground text-xs'>{hint}</p> : null}
      </div>
    </div>
  );
  const err = state.errors ?? {};
  return (
    <form
      action={action}
      className='bg-card grid max-w-xl gap-5 rounded-[var(--radius-card)] border p-4 sm:p-5'
    >
      {check('enabled', 'Away mode is on')}
      <div className='grid gap-4 sm:grid-cols-2'>
        <div className='grid gap-1.5'>
          <Label htmlFor='away-from'>First day away</Label>
          <Input
            id='away-from'
            name='from'
            type='date'
            defaultValue={settings.from ?? ''}
            aria-invalid={err.from ? true : undefined}
            aria-describedby={err.from ? 'away-from-error' : undefined}
          />
          {err.from ? (
            <p id='away-from-error' className='text-destructive text-sm'>
              {err.from}
            </p>
          ) : null}
        </div>
        <div className='grid gap-1.5'>
          <Label htmlFor='away-until'>Last day away</Label>
          <Input
            id='away-until'
            name='until'
            type='date'
            defaultValue={settings.until ?? ''}
            aria-invalid={err.until ? true : undefined}
            aria-describedby={err.until ? 'away-until-error' : undefined}
          />
          {err.until ? (
            <p id='away-until-error' className='text-destructive text-sm'>
              {err.until}
            </p>
          ) : null}
        </div>
      </div>
      <fieldset className='grid gap-3'>
        <legend className='mb-1 text-sm font-medium'>Alert me about</legend>
        {check('urgentCalls', 'Urgent calls')}
        {check('quoteReplies', 'A customer replying to a quote')}
        {check('pickupsWaiting', 'A finished car nobody has picked up')}
      </fieldset>
      {check('dailySummary', 'Send me a daily summary while I am away')}
      <div className='flex flex-wrap items-center gap-3'>
        <Button type='submit' disabled={pending}>
          {pending ? 'Saving…' : 'Save away mode'}
        </Button>
        <p className='text-muted-foreground text-xs'>
          Saved as a setting only. Nothing is sent and the phones do not change.
        </p>
      </div>
      {state.saved ? (
        <p role='status' className='text-sm' data-testid='away-saved'>
          Saved. Away mode is {on.enabled ? 'on' : 'off'} on this page; nothing outside the portal
          changed.
        </p>
      ) : null}
    </form>
  );
}
