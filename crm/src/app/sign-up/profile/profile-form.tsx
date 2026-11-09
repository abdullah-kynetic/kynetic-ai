'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { saveProfileName } from './actions';
import { useState } from 'react';

export function ProfileForm() {
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  return (
    <form
      className='space-y-3'
      action={async (formData) => {
        setPending(true);
        setError('');
        const result = await saveProfileName(formData);
        if (result && !result.ok) {
          setError(result.message);
          setPending(false);
        }
      }}
    >
      <div className='space-y-1.5'>
        <Label htmlFor='name'>Your name</Label>
        <Input
          id='name'
          name='name'
          autoComplete='name'
          required
          maxLength={200}
          className='h-11'
        />
      </div>
      {error && (
        <p role='alert' className='text-destructive text-sm'>
          {error}
        </p>
      )}
      <Button type='submit' className='h-11 w-full' disabled={pending}>
        {pending ? 'Saving…' : 'Continue'}
      </Button>
    </form>
  );
}
