'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import * as React from 'react';
import { approveInvite, onboardClient, type OnboardState, type SendState } from './actions';

const DAY_LABELS = [
  ['mon', 'Mon'],
  ['tue', 'Tue'],
  ['wed', 'Wed'],
  ['thu', 'Thu'],
  ['fri', 'Fri'],
  ['sat', 'Sat'],
  ['sun', 'Sun']
] as const;

const MODULES = [
  ['alex_core', 'Alex (speed-to-lead calls)'],
  ['quote_followup', 'Quote follow-up'],
  ['after_hours', 'After-hours coverage'],
  ['missed_call_textback', 'Missed-call text-back'],
  ['reactivation', 'Lead reactivation'],
  ['followup_bundle', 'Follow-up bundle (quote follow-up, reactivation, text-back)'],
  ['opm', 'Online presence']
] as const;

const INDUSTRIES = [
  ['roofing', 'Roofing'],
  ['restoration', 'Restoration'],
  ['hvac', 'HVAC'],
  ['plumbing', 'Plumbing'],
  ['general', 'Other home service']
] as const;

const ZONES = [
  ['America/New_York', 'Eastern'],
  ['America/Chicago', 'Central'],
  ['America/Denver', 'Mountain'],
  ['America/Phoenix', 'Arizona'],
  ['America/Los_Angeles', 'Pacific'],
  ['America/Anchorage', 'Alaska'],
  ['Pacific/Honolulu', 'Hawaii']
] as const;

function FieldRow({
  id,
  label,
  error,
  hint,
  children
}: {
  id: string;
  label: string;
  error?: string[];
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className='flex flex-col gap-1.5'>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className='text-muted-foreground text-xs'>{hint}</p>}
      {error && (
        <p role='alert' className='text-destructive text-xs'>
          Check this field.
        </p>
      )}
    </div>
  );
}

export function OnboardingForm() {
  const [state, action, pending] = React.useActionState<OnboardState, FormData>(onboardClient, {
    status: 'idle'
  });
  if (state.status === 'created') return <Created state={state} />;
  const fe = state.status === 'error' ? state.fieldErrors : undefined;

  return (
    <form action={action} className='grid max-w-3xl gap-6'>
      {state.status === 'error' && (
        <p role='alert' className='text-destructive text-sm'>
          {state.message}
        </p>
      )}
      <div className='grid gap-4 sm:grid-cols-2'>
        <FieldRow id='businessName' label='Business name' error={fe?.businessName}>
          <Input id='businessName' name='businessName' required maxLength={200} />
        </FieldRow>
        <FieldRow
          id='slug'
          label='Web address (optional)'
          error={fe?.slug}
          hint='Lowercase letters, numbers and dashes. Made from the name if empty.'
        >
          <Input id='slug' name='slug' pattern='[a-z0-9\-]{3,40}' />
        </FieldRow>
        <FieldRow id='ownerEmail' label='Owner email' error={fe?.ownerEmail}>
          <Input id='ownerEmail' name='ownerEmail' type='email' required />
        </FieldRow>
        <FieldRow
          id='phone'
          label='Owner phone'
          error={fe?.phone}
          hint='Alex transfers live calls here.'
        >
          <Input id='phone' name='phone' type='tel' required />
        </FieldRow>
        <FieldRow id='industry' label='Industry template' error={fe?.industry}>
          <NativeSelect id='industry' name='industry' defaultValue='roofing'>
            {INDUSTRIES.map(([v, l]) => (
              <NativeSelectOption key={v} value={v}>
                {l}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </FieldRow>
        <FieldRow id='timezone' label='Time zone' error={fe?.timezone}>
          <NativeSelect id='timezone' name='timezone' defaultValue='America/Los_Angeles'>
            {ZONES.map(([v, l]) => (
              <NativeSelectOption key={v} value={v}>
                {l}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </FieldRow>
      </div>

      <fieldset className='grid gap-3'>
        <legend className='text-sm font-medium'>Business hours</legend>
        <div className='flex flex-wrap gap-4'>
          {DAY_LABELS.map(([v, l]) => (
            <div key={v} className='flex items-center gap-2'>
              <Checkbox
                id={`day-${v}`}
                name='days'
                value={v}
                defaultChecked={v !== 'sat' && v !== 'sun'}
              />
              <Label htmlFor={`day-${v}`}>{l}</Label>
            </div>
          ))}
        </div>
        {fe?.hours && (
          <p role='alert' className='text-destructive text-xs'>
            Pick at least one day, and open before close.
          </p>
        )}
        <div className='flex gap-4'>
          <FieldRow id='open' label='Opens'>
            <Input id='open' name='open' type='time' defaultValue='08:00' required />
          </FieldRow>
          <FieldRow id='close' label='Closes'>
            <Input id='close' name='close' type='time' defaultValue='17:00' required />
          </FieldRow>
        </div>
      </fieldset>

      <div className='grid gap-4 sm:grid-cols-2'>
        <FieldRow
          id='serviceZips'
          label='Service area zip codes'
          error={fe?.serviceZips}
          hint='Separate with commas or spaces.'
        >
          <Input id='serviceZips' name='serviceZips' />
        </FieldRow>
        <FieldRow id='primaryColor' label='Brand color' error={fe?.primaryColor}>
          <Input id='primaryColor' name='primaryColor' type='color' defaultValue='#d9662a' />
        </FieldRow>
        <FieldRow
          id='logoUrl'
          label='Logo link (optional)'
          error={fe?.logoUrl}
          hint='An https link. Uploads come with branding settings.'
        >
          <Input id='logoUrl' name='logoUrl' type='url' />
        </FieldRow>
        <FieldRow id='plan' label='Plan' error={fe?.plan}>
          <NativeSelect id='plan' name='plan' defaultValue='founding'>
            <NativeSelectOption value='founding'>Founding</NativeSelectOption>
            <NativeSelectOption value='value'>Value</NativeSelectOption>
          </NativeSelect>
        </FieldRow>
        <FieldRow id='tier' label='Value tier' error={fe?.tier}>
          <NativeSelect id='tier' name='tier' defaultValue=''>
            <NativeSelectOption value=''>Not set yet</NativeSelectOption>
            <NativeSelectOption value='T1'>T1 (under $15K jobs)</NativeSelectOption>
            <NativeSelectOption value='T2'>T2 ($15K to $30K)</NativeSelectOption>
            <NativeSelectOption value='T3'>T3 ($30K and up)</NativeSelectOption>
          </NativeSelect>
        </FieldRow>
        <FieldRow id='crmLevel' label='CRM capability set (internal)' error={fe?.crmLevel}>
          <NativeSelect id='crmLevel' name='crmLevel' defaultValue=''>
            <NativeSelectOption value=''>None (base portal, CRM not configured)</NativeSelectOption>
            <NativeSelectOption value='lite'>Core CRM capabilities (internal flag: lite)</NativeSelectOption>
            <NativeSelectOption value='full'>Extended CRM capabilities: custom fields, bulk actions (internal flag: full)</NativeSelectOption>
          </NativeSelect>
        </FieldRow>
      </div>

      <fieldset className='grid gap-2'>
        <legend className='text-sm font-medium'>Modules</legend>
        {MODULES.map(([v, l]) => (
          <div key={v} className='flex items-center gap-2'>
            <Checkbox id={`mod-${v}`} name='modules' value={v} defaultChecked={v === 'alex_core'} />
            <Label htmlFor={`mod-${v}`}>{l}</Label>
          </div>
        ))}
      </fieldset>

      <div>
        <Button type='submit' disabled={pending}>
          {pending ? 'Creating…' : 'Create client'}
        </Button>
      </div>
    </form>
  );
}

function Created({ state }: { state: Extract<OnboardState, { status: 'created' }> }) {
  const [send, setSend] = React.useState<SendState>({ status: 'idle' });
  const [busy, setBusy] = React.useState(false);
  return (
    <div className='grid max-w-2xl gap-4'>
      <p role='status' className='text-sm'>
        Client <strong>{state.slug}</strong> was created with its checklist. Nothing has been sent
        to {state.ownerEmail} yet.
      </p>
      <div className='rounded-lg border p-4'>
        <p className='text-sm font-medium'>Invite email (draft)</p>
        <p className='text-muted-foreground mt-1 text-sm'>Subject: {state.draft.subject}</p>
        <pre className='mt-2 text-sm whitespace-pre-wrap'>{state.draft.body}</pre>
      </div>
      {send.status === 'sent' ? (
        <p role='status' className='text-sm'>
          Invite sent to {state.ownerEmail}. It works once and expires in 7 days.
        </p>
      ) : (
        <div className='flex items-center gap-3'>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setSend(await approveInvite(state.tenantId));
              setBusy(false);
            }}
          >
            {busy ? 'Sending…' : 'Approve and send'}
          </Button>
          <span className='text-muted-foreground text-xs'>You can also send it later.</span>
        </div>
      )}
      {send.status === 'error' && (
        <p role='alert' className='text-destructive text-sm'>
          {send.message}
        </p>
      )}
      <Link
        href={`/admin/clients/${state.tenantId}/checklist`}
        className='text-primary-text text-sm underline-offset-4 hover:underline'
      >
        Open the setup checklist
      </Link>
    </div>
  );
}
