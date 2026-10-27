'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';

const DAYS = [
  ['mon', 'Monday'],
  ['tue', 'Tuesday'],
  ['wed', 'Wednesday'],
  ['thu', 'Thursday'],
  ['fri', 'Friday'],
  ['sat', 'Saturday'],
  ['sun', 'Sunday']
] as const;

type Win = { open: string; close: string };
type Initial = {
  timezone: string;
  businessHours: Partial<Record<(typeof DAYS)[number][0], Win[]>>;
  serviceArea: { type?: string; zips?: string[]; centerZip?: string; miles?: number };
  services: string[];
  transferNumber: string | null;
};

/** One window per day in this form; days with two windows keep the extra window until edited. */
export function BusinessForm({ initial, canEdit }: { initial: Initial; canEdit: boolean }) {
  const [hours, setHours] = useState(initial.businessHours);
  const [zips, setZips] = useState((initial.serviceArea.zips ?? []).join(', '));
  const [services, setServices] = useState(initial.services.join('\n'));
  const [transfer, setTransfer] = useState(initial.transferNumber ?? '');
  const [timezone, setTimezone] = useState(initial.timezone);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const setDay = (day: (typeof DAYS)[number][0], patch: Partial<Win> | null) =>
    setHours((h) => {
      const next = { ...h };
      if (patch === null) next[day] = [];
      else next[day] = [{ open: '09:00', close: '17:00', ...h[day]?.[0], ...patch }];
      return next;
    });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    const zipList = zips.split(/[\s,]+/).filter(Boolean);
    const res = await fetch('/api/settings/business', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        timezone,
        businessHours: hours,
        serviceArea: zipList.length ? { type: 'zips', zips: zipList } : { type: 'none' },
        services: services
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        transferNumber: transfer.trim() === '' ? null : transfer.trim()
      })
    });
    const body = await res.json();
    setSaving(false);
    setStatus(
      res.ok
        ? { ok: true, text: 'Saved.' }
        : {
            ok: false,
            text: body.error?.fieldErrors
              ? `Check these fields: ${Object.keys(body.error.fieldErrors).join(', ')}`
              : (body.error?.message ?? 'Could not save.')
          }
    );
  }

  return (
    <form onSubmit={save} className='max-w-2xl space-y-8' aria-describedby='save-status'>
      <fieldset disabled={!canEdit} className='space-y-8'>
        <section className='space-y-3'>
          <h2 className='text-lg font-semibold'>Business hours</h2>
          <div className='space-y-1'>
            <Label htmlFor='timezone'>Time zone</Label>
            <Input id='timezone' value={timezone} onChange={(e) => setTimezone(e.target.value)} />
          </div>
          {DAYS.map(([key, label]) => {
            const w = hours[key]?.[0];
            return (
              <div key={key} className='flex flex-wrap items-center gap-3'>
                <span className='w-24 text-sm'>{label}</span>
                <label className='flex items-center gap-2 text-sm'>
                  <input
                    type='checkbox'
                    className='size-5'
                    checked={Boolean(w)}
                    onChange={(e) => setDay(key, e.target.checked ? {} : null)}
                  />
                  Open
                </label>
                {w && (
                  <>
                    <Input
                      aria-label={`${label} opens`}
                      type='time'
                      className='w-32'
                      value={w.open}
                      onChange={(e) => setDay(key, { open: e.target.value })}
                    />
                    <Input
                      aria-label={`${label} closes`}
                      type='time'
                      className='w-32'
                      value={w.close}
                      onChange={(e) => setDay(key, { close: e.target.value })}
                    />
                  </>
                )}
              </div>
            );
          })}
        </section>

        <section className='space-y-1'>
          <Label htmlFor='zips'>Service area (ZIP codes, comma separated)</Label>
          <Input id='zips' value={zips} onChange={(e) => setZips(e.target.value)} />
        </section>

        <section className='space-y-1'>
          <Label htmlFor='services'>Services offered (one per line)</Label>
          <textarea
            id='services'
            rows={5}
            className='border-input bg-background w-full rounded-md border p-2 text-sm'
            value={services}
            onChange={(e) => setServices(e.target.value)}
          />
        </section>

        <section className='space-y-1'>
          <Label htmlFor='transfer'>Transfer number (E.164, for example +15555550123)</Label>
          <Input
            id='transfer'
            inputMode='tel'
            value={transfer}
            onChange={(e) => setTransfer(e.target.value)}
          />
        </section>
      </fieldset>

      {canEdit ? (
        <div className='flex items-center gap-3'>
          <Button type='submit' disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <p
            id='save-status'
            role='status'
            className={status?.ok === false ? 'text-destructive text-sm' : 'text-sm'}
          >
            {status?.text}
          </p>
        </div>
      ) : (
        <p className='text-muted-foreground text-sm'>Only the owner can change these settings.</p>
      )}
    </form>
  );
}
