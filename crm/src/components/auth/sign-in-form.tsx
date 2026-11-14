'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Label } from '@/components/ui/label';
import { authClient } from '@/lib/auth-client';
import Link from 'next/link';
import { useState } from 'react';

const SENT = 'If you have access, we sent a code to that email. It expires in 10 minutes.';

type Mode = 'login' | 'signup' | 'help';

export function SignInForm({
  googleEnabled,
  mode,
  nextPath = null
}: {
  googleEnabled: boolean;
  mode: Mode;
  /** Already checked with safeNextPath. Staff Google returns here after sign-in. */
  nextPath?: string | null;
}) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [phase, setPhase] = useState<'email' | 'code'>('email');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await fetch('/api/auth/email-otp/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: email.trim() })
    });
    setBusy(false);
    if (res.status === 429) {
      setError('Too many attempts. Wait a minute and try again.');
      return;
    }
    if (!res.ok) {
      setError('Enter the email address you were invited with.');
      return;
    }
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    setMessage(data.message || SENT);
    setPhase('code');
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await fetch('/api/auth/email-otp/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), code })
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      next?: string;
      message?: string;
    };
    setBusy(false);
    if (res.status === 429) {
      setError('Too many attempts. Wait a minute and try again.');
      return;
    }
    if (!res.ok || !data.ok || !data.next) {
      setError(data.message || 'That code did not work. Request a new one.');
      return;
    }
    window.location.assign(
      (data.next === '/dashboard' || data.next === '/admin') && nextPath ? nextPath : data.next
    );
  }

  const google = googleEnabled && mode !== 'help' && (
    <>
      <Button
        type='button'
        variant='outline'
        className='h-11 w-full'
        onClick={() =>
          authClient.signIn.social({
            provider: 'google',
            callbackURL: nextPath ?? '/',
            errorCallbackURL: nextPath
              ? `/sign-in?error=google&next=${encodeURIComponent(nextPath)}`
              : '/sign-in?error=google'
          })
        }
      >
        Continue with Google
      </Button>
      <p className='text-muted-foreground text-xs'>Kynetic admins and VAs sign in with Google.</p>
      <div className='text-muted-foreground flex items-center gap-3 text-xs'>
        <span className='bg-border h-px flex-1' />
        or
        <span className='bg-border h-px flex-1' />
      </div>
    </>
  );

  if (phase === 'code') {
    return (
      <div className='space-y-4'>
        <p role='status' className='text-sm'>
          {message}
        </p>
        <form onSubmit={verify} className='space-y-3'>
          <Label htmlFor='code'>Confirmation code</Label>
          <InputOTP
            id='code'
            maxLength={6}
            value={code}
            onChange={setCode}
            inputMode='numeric'
            autoComplete='one-time-code'
            containerClassName='justify-between'
          >
            <InputOTPGroup>
              {Array.from({ length: 6 }, (_, index) => (
                <InputOTPSlot key={index} index={index} className='size-11 text-base' />
              ))}
            </InputOTPGroup>
          </InputOTP>
          {error && (
            <p role='alert' className='text-destructive text-sm'>
              {error}
            </p>
          )}
          <Button type='submit' className='h-11 w-full' disabled={busy || code.length !== 6}>
            {busy ? 'Checking…' : 'Continue'}
          </Button>
        </form>
        <Button
          type='button'
          variant='outline'
          className='h-11 w-full'
          disabled={busy}
          onClick={() => {
            setCode('');
            setError('');
            setPhase('email');
          }}
        >
          Use a different email
        </Button>
      </div>
    );
  }

  const submit =
    mode === 'help'
      ? 'Email me a new code'
      : mode === 'signup'
        ? 'Email me a code'
        : 'Email me a code';

  return (
    <div className='space-y-5'>
      {google}
      <form onSubmit={send} className='space-y-3'>
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
        {error && (
          <p role='alert' className='text-destructive text-sm'>
            {error}
          </p>
        )}
        <Button type='submit' className='h-11 w-full' disabled={busy}>
          {busy ? 'Sending…' : submit}
        </Button>
      </form>
      {mode === 'login' && (
        <p className='text-muted-foreground text-center text-sm'>
          <Link className='underline' href='/sign-up'>
            First time? Sign up
          </Link>
          <span aria-hidden='true'> · </span>
          <Link className='underline' href='/sign-in/help'>
            Can&apos;t sign in?
          </Link>
        </p>
      )}
      {mode === 'signup' && (
        <p className='text-muted-foreground text-center text-sm'>
          <Link className='underline' href='/sign-in'>
            Already have access? Log in
          </Link>
        </p>
      )}
    </div>
  );
}
