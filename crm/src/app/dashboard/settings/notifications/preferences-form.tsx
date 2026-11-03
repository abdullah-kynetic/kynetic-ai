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
  action_needed: 'Action needed'
};

export function PreferencesForm({ initial }: { initial: Pref[] }) {
  const [prefs, setPrefs] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    const res = await fetch('/api/settings/notifications', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ preferences: prefs })
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setStatus({ ok: false, text: body.error?.message ?? 'Could not save.' });
    setPrefs(body.preferences);
    setStatus({ ok: true, text: 'Preferences saved.' });
  }

  return (
    <form onSubmit={save} className='max-w-xl space-y-4'>
      <fieldset className='space-y-3'>
        <legend className='text-sm font-medium'>Email me about</legend>
        {prefs.map((p) => (
          <label key={p.kind} className='flex items-center gap-3 text-sm'>
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
      <Button type='submit' disabled={busy}>
        Save preferences
      </Button>
      <p role='status' className={status?.ok === false ? 'text-destructive text-sm' : 'text-sm'}>
        {status?.text}
      </p>
    </form>
  );
}
