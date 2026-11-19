'use client';

import { Button } from '@/components/ui/button';
import { useState } from 'react';

type Pref = { kind: string; emailEnabled: boolean };

const LABELS: Record<string, string> = {
  new_lead: 'New lead',
  hot_lead: 'Hot lead',
  booked: 'Appointment booked',
  task_due: 'Task due',
  deal_won: 'Deal won',
  report_ready: 'Report ready',
  action_needed: 'Action needed',
  mention: 'Mention',
  support_reply: 'Support reply',
  support_request: 'Support request'
};

export function PreferencesForm({ initial }: { initial: Pref[] }) {
  const [prefs, setPrefs] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch('/api/settings/notifications', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ preferences: prefs })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return setStatus({ ok: false, text: body.error?.message ?? 'Could not save.' });
      setPrefs(body.preferences);
      setStatus({ ok: true, text: 'Preferences saved.' });
    } catch {
      setStatus({ ok: false, text: 'Check your connection and try again.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className='w-full max-w-xl space-y-4'>
      {status?.ok === false && (
        <div
          role='alert'
          className='border-destructive/40 bg-destructive/10 text-destructive rounded-lg border p-4 text-sm'
        >
          <strong>Preferences were not saved.</strong> {status.text}
        </div>
      )}
      <fieldset className='bg-card space-y-1 rounded-[var(--radius-card)] border p-4 sm:p-6'>
        <legend className='sr-only'>Email me about</legend>
        <p className='pb-2 font-semibold' aria-hidden='true'>
          Email me about
        </p>
        {prefs.map((p) => (
          <label key={p.kind} className='flex min-h-11 items-center gap-3 border-t py-2 text-sm'>
            <input
              type='checkbox'
              checked={p.emailEnabled}
              disabled={busy}
              onChange={(e) =>
                setPrefs((all) =>
                  all.map((x) => (x.kind === p.kind ? { ...x, emailEnabled: e.target.checked } : x))
                )
              }
            />
            {LABELS[p.kind] ?? p.kind}
          </label>
        ))}
      </fieldset>
      <div className='flex flex-wrap items-center gap-3'>
        <Button type='submit' disabled={busy}>
          Save preferences
        </Button>
        <Button
          type='button'
          variant='outline'
          disabled={busy}
          onClick={() => {
            setPrefs(initial);
            setStatus(null);
          }}
        >
          Cancel
        </Button>
        {status?.ok && (
          <p role='status' className='text-sm'>
            {status.text}
          </p>
        )}
      </div>
    </form>
  );
}
