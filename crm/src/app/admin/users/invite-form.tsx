'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { notify } from '@/lib/notify';
import * as React from 'react';
import { inviteUserAction } from './actions';

/** Invite a client owner or staff member into a tenant (F-61). Admin and VA. */
export function InviteForm({ tenants }: { tenants: { id: string; name: string }[] }) {
  const formRef = React.useRef<HTMLFormElement>(null);
  const [pending, start] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const errorId = React.useId();

  return (
    <form
      ref={formRef}
      className='flex flex-wrap items-end gap-3'
      action={(data) =>
        start(async () => {
          const res = await inviteUserAction(data);
          if (res.ok) {
            setError(null);
            notify.success(res.message);
            formRef.current?.reset();
          } else setError(res.message);
        })
      }
    >
      <div className='space-y-1.5'>
        <Label htmlFor='invite-email'>Email</Label>
        <Input
          id='invite-email'
          name='email'
          type='email'
          required
          autoComplete='off'
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
        />
      </div>
      <div className='space-y-1.5'>
        <Label htmlFor='invite-tenant'>Client</Label>
        <NativeSelect id='invite-tenant' name='tenantId' required defaultValue=''>
          <NativeSelectOption value='' disabled>
            Choose a client
          </NativeSelectOption>
          {tenants.map((t) => (
            <NativeSelectOption key={t.id} value={t.id}>
              {t.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className='space-y-1.5'>
        <Label htmlFor='invite-role'>Role</Label>
        <NativeSelect id='invite-role' name='role' defaultValue='staff'>
          <NativeSelectOption value='owner'>Owner</NativeSelectOption>
          <NativeSelectOption value='staff'>Staff</NativeSelectOption>
        </NativeSelect>
      </div>
      <Button type='submit' disabled={pending}>
        {pending ? 'Inviting…' : 'Send invite'}
      </Button>
      {error && (
        <p id={errorId} role='alert' className='text-destructive w-full text-sm'>
          {error}
        </p>
      )}
    </form>
  );
}
