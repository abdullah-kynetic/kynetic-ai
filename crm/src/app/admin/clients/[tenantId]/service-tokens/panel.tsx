'use client';

import { useState, useTransition } from 'react';
import { SERVICE_TOKEN_SCOPES } from '@/server/service-auth/scopes';
import { SCOPE_GROUPS, SCOPE_PRESETS } from '@/server/service-auth/scope-groups';
import type { ServiceTokenSummary } from '@/server/admin/service-tokens';
import { issueServiceTokenAction, revokeServiceTokenAction } from './actions';

export function ServiceTokenPanel({
  tenantId,
  tokens
}: {
  tenantId: string;
  tokens: ServiceTokenSummary[];
}) {
  const [rows, setRows] = useState(tokens);
  const [token, setToken] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();

  return (
    <div className='grid max-w-3xl gap-8'>
      <form
        className='grid gap-3 rounded border p-4'
        onSubmit={(event) => {
          event.preventDefault();
          const formElement = event.currentTarget;
          const form = new FormData(formElement);
          const scopes = SERVICE_TOKEN_SCOPES.filter(
            (scope) => form.get(`scope-${scope}`) === 'on'
          );
          setToken(null);
          setMessage('');
          startTransition(async () => {
            const result = await issueServiceTokenAction(tenantId, {
              label: String(form.get('label') ?? ''),
              scopes
            });
            if (!result.ok) {
              setMessage(result.message);
              return;
            }
            setToken(result.token);
            setRows((current) => [
              {
                id: result.id,
                label: String(form.get('label') ?? ''),
                scopes,
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
        <h2 className='text-lg font-medium'>Issue a token</h2>
        <p className='text-sm text-muted-foreground'>
          The token is shown once. The portal stores only its hash. A token can read or write this
          client only, and only the scopes you select.
        </p>
        <label className='grid gap-1'>
          Label
          <input className='min-h-11 rounded border px-3' name='label' required maxLength={80} />
        </label>
        <div className='flex flex-wrap gap-2'>
          {SCOPE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type='button'
              className='min-h-11 rounded border px-3 text-sm'
              onClick={(event) => {
                const form = event.currentTarget.form;
                if (!form) return;
                for (const scope of SERVICE_TOKEN_SCOPES) {
                  const box = form.elements.namedItem(`scope-${scope}`) as HTMLInputElement | null;
                  if (box) box.checked = (preset.scopes as readonly string[]).includes(scope);
                }
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
        {SCOPE_GROUPS.map((group) => (
          <fieldset key={group.id} className='grid gap-1 rounded border p-3'>
            <legend className='px-1 font-medium'>{group.label}</legend>
            <p className='text-sm text-muted-foreground'>{group.hint}</p>
            {group.scopes.map((scope) => (
              <label key={scope} className='flex min-h-11 items-center gap-2'>
                <input name={`scope-${scope}`} type='checkbox' />
                {scope}
              </label>
            ))}
          </fieldset>
        ))}
        <button className='min-h-11 rounded border px-4' type='submit' disabled={pending}>
          Issue token
        </button>
        {message && <p role='alert'>{message}</p>}
        {token && (
          <div role='status' className='grid gap-2'>
            <p>Copy this token now. It will not be shown again.</p>
            <input className='min-h-11 rounded border px-3 font-mono' readOnly value={token} />
          </div>
        )}
      </form>
      <section className='grid gap-3'>
        <h2 className='text-lg font-medium'>Tokens</h2>
        {rows.map((row) => (
          <article key={row.id} className='grid gap-1 rounded border p-4'>
            <h3 className='font-medium'>{row.label}</h3>
            <p className='text-sm text-muted-foreground'>
              {row.revokedAt ? 'Revoked' : 'Active'} · {row.scopes.join(', ') || 'No scopes'}
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
                  if (!window.confirm('Revoke this token? n8n calls with it will get 401.')) return;
                  startTransition(async () => {
                    const result = await revokeServiceTokenAction(tenantId, row.id);
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
