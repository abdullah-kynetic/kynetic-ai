'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Member = {
  userId: string;
  email: string;
  name: string | null;
  role: 'owner' | 'staff';
  canExport: boolean;
  canBulkDelete: boolean;
};
type Invite = { id: string; email: string; expiresAt: string };

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, message: json?.error?.message as string | undefined };
}

export function TeamManager({ initial }: { initial: { members: Member[]; invites: Invite[] } }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function run(p: Promise<{ ok: boolean; message?: string }>) {
    const r = await p;
    setError(r.ok ? null : (r.message ?? 'Something went wrong.'));
    if (r.ok) router.refresh();
    return r.ok;
  }

  return (
    <div className='max-w-2xl space-y-8'>
      {error && (
        <p role='alert' className='text-destructive text-sm'>
          {error}
        </p>
      )}
      <section aria-labelledby='members' className='space-y-3'>
        <h2 id='members' className='text-lg font-semibold'>
          Members
        </h2>
        <ul className='divide-y rounded-md border'>
          {initial.members.map((m) => (
            <li key={m.userId} className='flex flex-wrap items-center gap-3 p-3 text-sm'>
              <span className='min-w-0 flex-1 truncate'>
                {m.name ?? m.email} <span className='text-muted-foreground'>({m.role})</span>
              </span>
              {m.role === 'staff' && (
                <>
                  <label className='flex items-center gap-2'>
                    <input
                      type='checkbox'
                      className='size-5'
                      checked={m.canExport}
                      onChange={(e) =>
                        run(
                          call(`/api/settings/team/${m.userId}`, 'PATCH', {
                            canExport: e.target.checked
                          })
                        )
                      }
                    />
                    Can export
                  </label>
                  <label className='flex items-center gap-2'>
                    <input
                      type='checkbox'
                      className='size-5'
                      checked={m.canBulkDelete}
                      onChange={(e) =>
                        run(
                          call(`/api/settings/team/${m.userId}`, 'PATCH', {
                            canBulkDelete: e.target.checked
                          })
                        )
                      }
                    />
                    Can bulk delete
                  </label>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => run(call(`/api/settings/team/${m.userId}`, 'DELETE'))}
                  >
                    Remove
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby='invites' className='space-y-3'>
        <h2 id='invites' className='text-lg font-semibold'>
          Invite staff
        </h2>
        <form
          className='flex flex-wrap items-end gap-3'
          onSubmit={async (e) => {
            e.preventDefault();
            if (await run(call('/api/settings/team/invites', 'POST', { email }))) setEmail('');
          }}
        >
          <div className='space-y-1'>
            <Label htmlFor='invite-email'>Email</Label>
            <Input
              id='invite-email'
              type='email'
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <Button type='submit'>Send invite</Button>
        </form>
        {initial.invites.length > 0 && (
          <ul className='divide-y rounded-md border'>
            {initial.invites.map((i) => (
              <li key={i.id} className='flex items-center gap-3 p-3 text-sm'>
                <span className='flex-1 truncate'>{i.email}</span>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => run(call('/api/settings/team/invites', 'DELETE', { id: i.id }))}
                >
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
