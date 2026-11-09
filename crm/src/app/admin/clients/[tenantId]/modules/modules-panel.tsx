'use client';

import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import * as React from 'react';
import { toggleModule } from './actions';

type Level = 'lite' | 'full' | null;
type ModuleRow = {
  moduleKey: string;
  enabled: boolean;
  level: Level;
  changedAt: string | null;
};
type HistoryRow = {
  at: string;
  actorUserId: string | null;
  moduleKey: string;
  before: { enabled: boolean; level: Level } | null;
  after: { enabled: boolean; level: Level };
};

const LABELS: Record<string, { label: string; note?: string }> = {
  platform: {
    label: 'Base portal',
    note: 'Leads, pipeline, appointments, call logs, reports. Always on.'
  },
  alex_core: { label: 'Alex (speed to lead)' },
  quote_followup: { label: 'Quote follow-up' },
  after_hours: {
    label: 'After-hours answering',
    note: 'Includes missed-call text-back at no charge.'
  },
  missed_call_textback: { label: 'Missed-call text-back' },
  reactivation: { label: 'Reactivation' },
  opm: { label: 'Operations manager (OPM)' },
  followup_bundle: {
    label: 'Follow-up bundle',
    note: 'Quote follow-up, reactivation and missed-call text-back together.'
  },
  crm: {
    label: 'CRM',
    note: 'One configurable CRM. The capability set (lite or full) is an internal flag, not a sold tier.'
  }
};

const describe = (s: { enabled: boolean; level: Level } | null) =>
  !s ? 'off' : s.enabled ? `on${s.level ? ` (${s.level})` : ''}` : 'off';

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

export function ModulesPanel(props: {
  tenantId: string;
  modules: ModuleRow[];
  history: HistoryRow[];
  currentUserId: string;
}) {
  const [pendingKey, setPendingKey] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [, startTransition] = React.useTransition();

  const change = (moduleKey: string, enabled: boolean, level?: 'lite' | 'full') => {
    setPendingKey(moduleKey);
    setMessage(null);
    startTransition(async () => {
      const result = await toggleModule({ tenantId: props.tenantId, moduleKey, enabled, level });
      if (!result.ok) setMessage(result.message);
      setPendingKey(null);
    });
  };

  return (
    <div className='space-y-8'>
      <p role='status' aria-live='polite' className='text-destructive min-h-5 text-sm'>
        {message}
      </p>
      <section aria-labelledby='modules-heading'>
        <h2 id='modules-heading' className='mb-3 text-base font-semibold'>
          Modules
        </h2>
        <ul className='divide-y rounded-lg border'>
          {props.modules.map((m) => {
            const meta = LABELS[m.moduleKey] ?? { label: m.moduleKey };
            const busy = pendingKey === m.moduleKey;
            const labelId = `module-${m.moduleKey}`;
            return (
              <li key={m.moduleKey} className='flex flex-wrap items-center gap-3 p-4'>
                <div className='min-w-0 flex-1'>
                  <p id={labelId} className='text-sm font-medium'>
                    {meta.label}
                  </p>
                  {meta.note && <p className='text-muted-foreground text-sm'>{meta.note}</p>}
                  {m.changedAt && m.moduleKey !== 'platform' && (
                    <p className='text-muted-foreground text-xs'>Changed {when(m.changedAt)}</p>
                  )}
                </div>
                {m.moduleKey === 'crm' && (
                  <select
                    aria-label='CRM level'
                    className='border-input bg-background h-9 rounded-md border px-2 text-sm'
                    value={m.level ?? 'lite'}
                    disabled={busy || !m.enabled}
                    onChange={(e) => change('crm', true, e.target.value as 'lite' | 'full')}
                  >
                    <option value='lite'>Core capabilities (lite)</option>
                    <option value='full'>Extended capabilities (full)</option>
                  </select>
                )}
                {m.moduleKey === 'platform' ? (
                  <Badge variant='secondary'>Always on</Badge>
                ) : (
                  <Switch
                    aria-labelledby={labelId}
                    checked={m.enabled}
                    disabled={busy}
                    onCheckedChange={(checked) =>
                      change(
                        m.moduleKey,
                        checked,
                        m.moduleKey === 'crm' ? (m.level ?? 'lite') : undefined
                      )
                    }
                  />
                )}
              </li>
            );
          })}
        </ul>
      </section>
      <section aria-labelledby='history-heading'>
        <h2 id='history-heading' className='mb-3 text-base font-semibold'>
          History
        </h2>
        {props.history.length === 0 ? (
          <p className='text-muted-foreground text-sm'>No changes yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Change</TableHead>
                <TableHead>By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {props.history.map((h, i) => (
                <TableRow key={`${h.at}-${i}`}>
                  <TableCell>{when(h.at)}</TableCell>
                  <TableCell>{LABELS[h.moduleKey]?.label ?? h.moduleKey}</TableCell>
                  <TableCell>
                    {describe(h.before)} → {describe(h.after)}
                  </TableCell>
                  <TableCell>
                    {h.actorUserId === props.currentUserId ? 'You' : 'Another admin'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
