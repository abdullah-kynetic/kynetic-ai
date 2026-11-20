'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { moveProspectsToSalesAction } from './actions';

export type ProspectItem = {
  id: string;
  businessName: string;
  source: string;
  location: string;
  website: string | null;
  phone: string | null;
  email: string | null;
  ownerName: string | null;
  addedOn: string;
};

const sourceLabel: Record<string, string> = {
  google_maps: 'Google Maps',
  directory: 'Directory',
  referral: 'Referral',
  manual: 'By hand'
};

/** Lead table with select-all, per-row selection and a DB-only Move to Sales action. */
export function ProspectTable({ rows, emptyText }: { rows: ProspectItem[]; emptyText: string }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [pending, start] = useTransition();
  const all = rows.length > 0 && selected.size === rows.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function move() {
    const ids = [...selected];
    setMessage(null);
    start(async () => {
      try {
        const result = await moveProspectsToSalesAction(ids);
        if (!result.ok) {
          setMessage({ tone: 'error', text: result.message });
          return;
        }
        const skipped = result.skipped.map((s) => `${s.name}: ${s.reason}`).join(' ');
        setMessage({
          tone: result.skipped.length ? 'error' : 'ok',
          text: `Moved ${result.moved.length} to Sales. ${skipped}`.trim()
        });
        setSelected(new Set());
        router.refresh();
      } catch {
        setMessage({ tone: 'error', text: 'Check your connection and try again.' });
      }
    });
  }

  return (
    <div className='space-y-3'>
      <div className='flex flex-wrap items-center gap-3'>
        <button
          type='button'
          onClick={move}
          disabled={selected.size === 0 || pending}
          className='bg-primary text-primary-foreground disabled:bg-muted disabled:text-muted-foreground min-h-11 rounded-lg px-4 text-sm font-medium'
        >
          {pending ? 'Moving…' : `Move to Sales${selected.size ? ` (${selected.size})` : ''}`}
        </button>
        <span className='text-muted-foreground text-sm'>
          Creates a deal in the Sales pipeline. Nothing is sent.
        </span>
      </div>
      {message && (
        <p
          role={message.tone === 'error' ? 'alert' : 'status'}
          className={`rounded-lg border p-3 text-sm ${message.tone === 'error' ? 'border-destructive/40 bg-destructive/10 text-destructive' : 'border-gain/40 bg-gain-soft text-gain'}`}
        >
          {message.text}
        </p>
      )}
      <div className='bg-card overflow-x-auto rounded-xl border'>
        <table className='w-full min-w-[56rem] text-left text-sm'>
          <thead className='bg-surface-sunken'>
            <tr>
              <th className='w-12 p-3'>
                <input
                  type='checkbox'
                  aria-label='Select all prospects'
                  checked={all}
                  onChange={() => setSelected(all ? new Set() : new Set(rows.map((row) => row.id)))}
                />
              </th>
              <th className='p-3'>Business</th>
              <th className='p-3'>Source</th>
              <th className='p-3'>Location</th>
              <th className='p-3'>Website</th>
              <th className='p-3'>Phone</th>
              <th className='p-3'>Email</th>
              <th className='p-3'>Owner</th>
              <th className='p-3'>Added</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className='text-muted-foreground p-6'>
                  {emptyText}
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className='border-t'>
                <td className='p-3'>
                  <input
                    type='checkbox'
                    aria-label={`Select ${row.businessName}`}
                    checked={selected.has(row.id)}
                    onChange={() => toggle(row.id)}
                  />
                </td>
                <td className='p-3 font-medium'>{row.businessName}</td>
                <td className='p-3'>{sourceLabel[row.source] ?? row.source}</td>
                <td className='p-3'>{row.location || '—'}</td>
                <td className='p-3 break-all'>{row.website ?? '—'}</td>
                <td className='p-3'>{row.phone ?? '—'}</td>
                <td className='p-3 break-all'>{row.email ?? '—'}</td>
                <td className='p-3'>{row.ownerName ?? '—'}</td>
                <td className='p-3'>{row.addedOn}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
