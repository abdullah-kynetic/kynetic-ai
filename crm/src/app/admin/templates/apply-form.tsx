'use client';

import { Button } from '@/components/ui/button';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import * as React from 'react';
import { applyTemplate, type ApplyState } from './actions';

export function ApplyTemplateForm(props: {
  kind: 'industry' | 'system';
  templateKey: string;
  tenants: { id: string; name: string }[];
  needsLevel?: boolean;
}) {
  const [state, action, pending] = React.useActionState<ApplyState, FormData>(applyTemplate, {
    status: 'idle'
  });
  return (
    <form action={action} className='mt-4 grid gap-3'>
      <input type='hidden' name='kind' value={props.kind} />
      <input type='hidden' name='templateKey' value={props.templateKey} />
      <label className='grid gap-1 text-sm' htmlFor={`tenant-${props.templateKey}`}>
        Client
        <NativeSelect
          id={`tenant-${props.templateKey}`}
          name='tenantId'
          required
          defaultValue={props.tenants[0]?.id ?? ''}
        >
          {props.tenants.length === 0 ? (
            <NativeSelectOption value=''>No clients yet</NativeSelectOption>
          ) : (
            props.tenants.map((tenant) => (
              <NativeSelectOption key={tenant.id} value={tenant.id}>
                {tenant.name}
              </NativeSelectOption>
            ))
          )}
        </NativeSelect>
      </label>
      {props.needsLevel && (
        <label className='grid gap-1 text-sm' htmlFor={`level-${props.templateKey}`}>
          CRM capability set
          <NativeSelect id={`level-${props.templateKey}`} name='crmLevel' defaultValue='lite'>
            <NativeSelectOption value='lite'>Core capabilities</NativeSelectOption>
            <NativeSelectOption value='full'>Extended capabilities</NativeSelectOption>
          </NativeSelect>
        </label>
      )}
      <Button
        type='submit'
        disabled={pending || props.tenants.length === 0}
        className='min-h-11 w-fit'
      >
        Apply to client
      </Button>
      {state.status === 'applied' && (
        <p role='status' className='text-sm'>
          {state.changed ? 'Applied.' : 'Already applied. Nothing changed.'}
          {state.detail ? ` ${state.detail}` : ''}
        </p>
      )}
      {state.status === 'error' && (
        <p role='alert' className='text-destructive text-sm'>
          {state.message}
        </p>
      )}
    </form>
  );
}
