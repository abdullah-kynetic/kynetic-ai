'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import * as React from 'react';
import { archiveTemplate, saveTemplateFromClient, type AccountTemplateState } from './actions';

function Feedback({ state, done }: { state: AccountTemplateState; done: string }) {
  if (state.status === 'error')
    return (
      <p role='alert' className='text-destructive text-sm'>
        {state.message}
      </p>
    );
  if (state.status === 'idle') return null;
  return (
    <p role='status' className='text-sm'>
      {done}
    </p>
  );
}

export function SaveAccountTemplateForm({ tenants }: { tenants: { id: string; name: string }[] }) {
  const [state, action, pending] = React.useActionState<AccountTemplateState, FormData>(
    saveTemplateFromClient,
    { status: 'idle' }
  );
  return (
    <form action={action} className='grid gap-3 sm:max-w-xl'>
      <label className='grid gap-1 text-sm' htmlFor='account-template-tenant'>
        Copy the setup of
        <NativeSelect
          id='account-template-tenant'
          name='tenantId'
          required
          defaultValue={tenants[0]?.id ?? ''}
        >
          {tenants.length === 0 ? (
            <NativeSelectOption value=''>No clients yet</NativeSelectOption>
          ) : (
            tenants.map((tenant) => (
              <NativeSelectOption key={tenant.id} value={tenant.id}>
                {tenant.name}
              </NativeSelectOption>
            ))
          )}
        </NativeSelect>
      </label>
      <label className='grid gap-1 text-sm' htmlFor='account-template-name'>
        Template name
        <Input
          id='account-template-name'
          name='name'
          required
          maxLength={80}
          placeholder='Remodeler starter'
        />
      </label>
      <label className='grid gap-1 text-sm' htmlFor='account-template-description'>
        Notes (optional)
        <Textarea id='account-template-description' name='description' maxLength={500} rows={2} />
      </label>
      <Button type='submit' disabled={pending || tenants.length === 0} className='min-h-11 w-fit'>
        Save as template
      </Button>
      <Feedback
        state={state}
        done={state.status === 'saved' ? `Saved "${state.name}". Pick it on New client.` : ''}
      />
    </form>
  );
}

export function ArchiveAccountTemplateButton({ id, name }: { id: string; name: string }) {
  const [state, action, pending] = React.useActionState<AccountTemplateState, FormData>(
    archiveTemplate,
    { status: 'idle' }
  );
  return (
    <form action={action} className='grid gap-2'>
      <input type='hidden' name='templateId' value={id} />
      <Button
        type='submit'
        variant='outline'
        disabled={pending}
        className='min-h-11 w-fit'
        aria-label={`Archive ${name}`}
      >
        Archive
      </Button>
      <Feedback state={state} done='Archived.' />
    </form>
  );
}
