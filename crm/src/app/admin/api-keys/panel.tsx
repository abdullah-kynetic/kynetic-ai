'use client';

import { useState, useTransition } from 'react';
import type { AdminKeySummary } from '@/server/admin/admin-api-keys';
import { issueAdminKeyAction, revokeAdminKeyAction, setServiceApiEnabledAction } from './actions';

export function AdminKeyPanel({ keys, enabled }: { keys: AdminKeySummary[]; enabled: boolean }) {
  const [rows, setRows] = useState(keys);
  const [on, setOn] = useState(enabled);
  const [key, setKey] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();

  return (
    <div className='grid max-w-3xl gap-8'>
      <section className='grid gap-3 rounded border p-4'>
        <h2 className='text-lg font-medium'>Stop all keys</h2>
        <p className='text-sm text-muted-foreground'>
          {on
            ? 'The API and MCP are on. Turning them off makes every client token and admin key answer 401 until you turn them back on.'
            : 'The API and MCP are OFF. Every client token and admin key is being refused.'}
        </p>
        <button
          className='min-h-11 rounded border px-4'
          type='button'
          disabled={pending}
          onClick={() => {
            if (on && !window.confirm('Stop every API and MCP key now?')) return;
            startTransition(async () => {
              const result = await setServiceApiEnabledAction(!on);
              if (!result.ok) setMessage(result.message);
              else setOn(!on);
            });
          }}
        >
          {on ? 'Turn everything off' : 'Turn everything back on'}
        </button>
      </section>
      <form
        className='grid gap-3 rounded border p-4'
        onSubmit={(event) => {
          event.preventDefault();
          const formElement = event.currentTarget;
          const form = new FormData(formElement);
          const label = String(form.get('label') ?? '');
          const allowedCidrs = String(form.get('cidrs') ?? '')
            .split(/[\s,]+/)
            .filter(Boolean);
          setKey(null);
          setMessage('');
          startTransition(async () => {
            const result = await issueAdminKeyAction({ label, allowedCidrs });
            if (!result.ok) {
              setMessage(result.message);
              return;
            }
            setKey(result.key);
            setRows((current) => [
              {
                id: result.id,
                label,
                allowedCidrs,
                createdAt: new Date().toISOString(),
                lastUsedAt: null,
                revokedAt: null
              },
              ...current
            ]);
            formElement.reset();
          });
        }}
      >
        <h2 className='text-lg font-medium'>Issue an admin key</h2>
        <p className='text-sm text-muted-foreground'>
          An admin key holds every permission and acts for the client named on each request. Lock it
          to the MCP server&apos;s address so it is useless anywhere else.
        </p>
        <label className='grid gap-1'>
          Label
          <input className='min-h-11 rounded border px-3' name='label' required maxLength={80} />
        </label>
        <label className='grid gap-1'>
          Allowed addresses (IPs or CIDRs, separated by spaces or commas)
          <input className='min-h-11 rounded border px-3 font-mono' name='cidrs' />
        </label>
        <button className='min-h-11 rounded border px-4' type='submit' disabled={pending}>
          Issue key
        </button>
        {message && <p role='alert'>{message}</p>}
        {key && (
          <div role='status' className='grid gap-2'>
            <p>Copy this key now. It will not be shown again.</p>
            <input className='min-h-11 rounded border px-3 font-mono' readOnly value={key} />
          </div>
        )}
      </form>
      <section className='grid gap-3'>
        <h2 className='text-lg font-medium'>Keys</h2>
        {rows.map((row) => (
          <article key={row.id} className='grid gap-1 rounded border p-4'>
            <h3 className='font-medium'>{row.label}</h3>
            <p className='text-sm text-muted-foreground'>
              {row.revokedAt ? 'Revoked' : 'Active'} ·{' '}
              {row.allowedCidrs.length ? row.allowedCidrs.join(', ') : 'Any address'}
            </p>
            <p className='text-sm text-muted-foreground'>
              Created {new Date(row.createdAt).toLocaleDateString()} · Last used{' '}
              {row.lastUsedAt ? new Date(row.lastUsedAt).toLocaleString() : 'never'}
            </p>
            {!row.revokedAt && (
              <button
                className='min-h-11 rounded border px-4'
                type='button'
                disabled={pending}
                onClick={() => {
                  if (!window.confirm('Revoke this key? Calls with it will get 401.')) return;
                  startTransition(async () => {
                    const result = await revokeAdminKeyAction(row.id);
                    if (!result.ok) {
                      setMessage(result.message);
                      return;
                    }
                    setRows((current) =>
                      current.map((item) =>
                        item.id === row.id ? { ...item, revokedAt: new Date().toISOString() } : item
                      )
                    );
                  });
                }}
              >
                Revoke
              </button>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}
