'use client';

import { totpQrMatrix } from '@/components/auth/totp-qr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { useState } from 'react';

type Props = { state: 'enrol' | 'challenge' };

function TotpQr({ uri }: { uri: string }) {
  const matrix = totpQrMatrix(uri);
  return (
    <div
      role='img'
      aria-label='Authenticator QR code'
      className='inline-grid self-center rounded-md bg-white p-2'
      style={{ gridTemplateColumns: `repeat(${matrix.length}, 4px)` }}
    >
      {matrix.map((row, y) =>
        row.map((dark, x) => (
          <span
            key={`${y}-${x}`}
            className={dark ? 'bg-black' : 'bg-white'}
            style={{ width: 4, height: 4 }}
          />
        ))
      )}
    </div>
  );
}

async function post(path: string, body: unknown): Promise<{ ok: boolean; data: unknown }> {
  const res = await fetch(`/api/auth/two-factor/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  return { ok: res.ok, data: await res.json().catch(() => ({})) };
}

export function TwoFactorForm({ state }: Props) {
  const [setup, setSetup] = useState<{ uri: string; key: string } | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function begin() {
    setBusy(true);
    setError('');
    const { ok, data } = await post('enable', {});
    setBusy(false);
    if (!ok) return setError('Could not start setup. Try again, or ask another admin to reset it.');
    const d = data as { totpURI?: string; backupCodes?: unknown };
    if (typeof d.totpURI !== 'string' || d.backupCodes !== undefined) {
      return setError('Could not start setup. Try again, or ask another admin to reset it.');
    }
    let key = '';
    try {
      key = new URL(d.totpURI).searchParams.get('secret') ?? '';
    } catch {
      key = '';
    }
    setSetup({ uri: d.totpURI, key });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { ok } = await post('verify-totp', { code });
    setBusy(false);
    if (!ok) return setError('That code did not work.');
    window.location.assign('/dashboard');
  }

  const form = (
    <form onSubmit={submit} className='flex flex-col gap-3'>
      <Label htmlFor='code'>6-digit code from your app</Label>
      <Input
        id='code'
        value={code}
        onChange={(e) => setCode(e.target.value)}
        inputMode='numeric'
        autoComplete='one-time-code'
        required
        className='h-11'
      />
      <Button type='submit' className='h-11' disabled={busy}>
        {state === 'enrol' ? 'Confirm and finish' : 'Verify'}
      </Button>
    </form>
  );

  return (
    <div className='flex flex-col gap-4'>
      {state === 'enrol' && !setup && (
        <>
          <p className='text-muted-foreground text-sm'>
            Kynetic staff sign in with an authenticator app on top of Google. Scan the QR code with
            the app. There are no backup codes.
          </p>
          <Button className='h-11' onClick={begin} disabled={busy}>
            Start setup
          </Button>
        </>
      )}
      {state === 'enrol' && setup && (
        <>
          <p className='text-sm'>
            Scan this code with your authenticator app, then enter the code it shows.
          </p>
          <TotpQr uri={setup.uri} />
          {!showKey ? (
            <Button
              type='button'
              variant='outline'
              className='h-11'
              onClick={() => setShowKey(true)}
            >
              Can&apos;t scan the code?
            </Button>
          ) : (
            <div>
              <p className='text-muted-foreground text-sm'>Enter this key in your app.</p>
              <code className='bg-muted mt-1 block rounded p-2 text-sm break-all'>{setup.key}</code>
            </div>
          )}
          {form}
        </>
      )}
      {state === 'challenge' && form}
      {error && (
        <p role='alert' className='text-destructive text-sm'>
          {error}
        </p>
      )}
      <p className='text-muted-foreground text-sm'>
        <Link className='underline' href='/sign-in/help'>
          Can&apos;t sign in?
        </Link>
      </p>
    </div>
  );
}
