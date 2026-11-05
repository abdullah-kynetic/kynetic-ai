'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Props = { state: 'enrol' | 'challenge' };

async function post(path: string, body: unknown): Promise<{ ok: boolean; data: unknown }> {
  const res = await fetch(`/api/auth/two-factor/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  return { ok: res.ok, data: await res.json().catch(() => ({})) };
}

export function TwoFactorForm({ state }: Props) {
  const [setup, setSetup] = useState<{ uri: string; key: string; codes: string[] } | null>(null);
  const [useRecovery, setUseRecovery] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function begin() {
    setBusy(true);
    setError('');
    const { ok, data } = await post('enable', {});
    setBusy(false);
    if (!ok) return setError('Could not start setup. Try again, or ask another admin to reset it.');
    const d = data as { totpURI: string; backupCodes: string[] };
    setSetup({
      uri: d.totpURI,
      key: new URL(d.totpURI).searchParams.get('secret') ?? '',
      codes: d.backupCodes
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { ok } = await post(useRecovery ? 'verify-backup-code' : 'verify-totp', { code });
    setBusy(false);
    if (!ok) return setError('That code did not work.');
    window.location.assign('/dashboard');
  }

  const form = (
    <form onSubmit={submit} className='flex flex-col gap-3'>
      <Label htmlFor='code'>{useRecovery ? 'Recovery code' : '6-digit code from your app'}</Label>
      <Input
        id='code'
        value={code}
        onChange={(e) => setCode(e.target.value)}
        inputMode={useRecovery ? 'text' : 'numeric'}
        autoComplete='one-time-code'
        required
      />
      <Button type='submit' disabled={busy}>
        {state === 'enrol' ? 'Confirm and finish' : 'Verify'}
      </Button>
      {state === 'challenge' && (
        <Button type='button' variant='outline' onClick={() => setUseRecovery(!useRecovery)}>
          {useRecovery ? 'Use an authenticator code' : 'Use a recovery code'}
        </Button>
      )}
    </form>
  );

  return (
    <div className='flex flex-col gap-4'>
      {state === 'enrol' && !setup && (
        <>
          <p className='text-muted-foreground text-sm'>
            Kynetic staff sign in with an authenticator app on top of Google.
          </p>
          <Button onClick={begin} disabled={busy}>
            Start setup
          </Button>
        </>
      )}
      {state === 'enrol' && setup && (
        <>
          <p className='text-sm'>
            Add this key to your authenticator app, or open the link on your phone:
          </p>
          <code className='bg-muted rounded p-2 text-sm break-all'>{setup.key}</code>
          <a className='text-sm underline' href={setup.uri}>
            Open in authenticator app
          </a>
          <div>
            <p className='text-sm font-medium'>Recovery codes (shown once, each works once)</p>
            <ul className='bg-muted mt-1 grid grid-cols-2 gap-1 rounded p-2 font-mono text-sm'>
              {setup.codes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
          {form}
        </>
      )}
      {state === 'challenge' && form}
      {error && (
        <p role='alert' className='text-destructive text-sm'>
          {error}
        </p>
      )}
    </div>
  );
}
