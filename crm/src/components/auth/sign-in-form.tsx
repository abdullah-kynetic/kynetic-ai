'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authClient } from '@/lib/auth-client';
import { useState } from 'react';

const DESTINATION = '/dashboard';

type Status = 'idle' | 'sending' | 'sent' | 'error';

export function SignInForm({ googleEnabled }: { googleEnabled: boolean }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    const { error } = await authClient.signIn.magicLink({
      email: email.trim(),
      callbackURL: DESTINATION,
      errorCallbackURL: '/sign-in?error=link'
    });
    // The same answer for every address, so the page never says whether an account exists.
    setStatus(error && error.status !== 403 ? 'error' : 'sent');
  }

  if (status === 'sent') {
    return (
      <div role='status' className='space-y-2'>
        <h2 className='text-lg font-semibold'>Check your email</h2>
        <p className='text-muted-foreground text-sm'>
          If that address can sign in, a link is on its way. It works once and expires in 15
          minutes.
        </p>
      </div>
    );
  }

  return (
    <div className='space-y-5'>
      {googleEnabled && (
        <>
          <Button
            type='button'
            variant='outline'
            className='h-11 w-full'
            onClick={() =>
              authClient.signIn.social({
                provider: 'google',
                callbackURL: DESTINATION,
                errorCallbackURL: '/sign-in?error=google'
              })
            }
          >
            Continue with Google
          </Button>
          <div className='text-muted-foreground flex items-center gap-3 text-xs'>
            <span className='bg-border h-px flex-1' />
            or
            <span className='bg-border h-px flex-1' />
          </div>
        </>
      )}
      <form onSubmit={sendLink} className='space-y-3'>
        <div className='space-y-1.5'>
          <Label htmlFor='email'>Work email</Label>
          <Input
            id='email'
            name='email'
            type='email'
            inputMode='email'
            autoComplete='email'
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className='h-11 text-base'
          />
        </div>
        {status === 'error' && (
          <p role='alert' className='text-destructive text-sm'>
            We could not send the link. Check the address and try again.
          </p>
        )}
        <Button type='submit' className='h-11 w-full' disabled={status === 'sending'}>
          {status === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
        </Button>
      </form>
    </div>
  );
}
