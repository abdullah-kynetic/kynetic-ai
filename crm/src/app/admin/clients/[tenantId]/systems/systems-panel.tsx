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
import { SYSTEM_CATALOG } from '@/server/modules/catalog';
import type { ModuleKey } from '@/server/modules/keys';
import Link from 'next/link';
import * as React from 'react';
import { setAutomation, toggleModule } from './actions';

type Level = 'lite' | 'full' | null;
type ModuleRow = {
  moduleKey: string;
  enabled: boolean;
  level: Level;
  changedAt: string | null;
  config: { entries: { key: string; value: string }[]; hidesSecrets: boolean };
};
type HistoryRow = {
  at: string;
  actorUserId: string | null;
  moduleKey: string;
  before: { enabled: boolean; level: Level } | null;
  after: { enabled: boolean; level: Level };
};
type AutomationRow = {
  key: string;
  label: string;
  moduleKey: string | null;
  enabled: boolean;
};

const CONFIG_LABELS: Record<string, string> = {
  outbound_kill_switch: 'Outbound kill switch',
  n8nWebhookUrl: 'n8n webhook URL'
};

const describe = (state: { enabled: boolean; level: Level } | null) =>
  !state ? 'off' : state.enabled ? `on${state.level ? ` (${state.level})` : ''}` : 'off';

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

function linksFor(moduleKey: string, tenantId: string): { href: string; label: string }[] {
  if (moduleKey === 'alex_core')
    return [{ href: `/admin/clients/${tenantId}/alex`, label: 'Alex configuration' }];
  if (moduleKey === 'opm')
    return [{ href: `/admin/clients/${tenantId}/presence`, label: 'Online presence' }];
  if (moduleKey === 'platform')
    return [
      { href: `/admin/clients/${tenantId}/webhooks`, label: 'Lead webhooks' },
      { href: '/admin/operations', label: 'Operations and kill switch' }
    ];
  return [];
}

export function SystemsPanel(props: {
  tenantId: string;
  modules: ModuleRow[];
  automations: AutomationRow[];
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

  const changeAutomation = (templateKey: string, enabled: boolean) => {
    setPendingKey(`auto:${templateKey}`);
    setMessage(null);
    startTransition(async () => {
      const result = await setAutomation({ tenantId: props.tenantId, templateKey, enabled });
      if (!result.ok) setMessage(result.message);
      setPendingKey(null);
    });
  };

  return (
    <div className='space-y-8'>
      <p role='status' aria-live='polite' className='text-destructive min-h-5 text-sm'>
        {message}
      </p>
      <ul className='space-y-4'>
        {props.modules.map((module) => {
          const meta = SYSTEM_CATALOG[module.moduleKey as ModuleKey] ?? {
            label: module.moduleKey,
            outcome: ''
          };
          const busy = pendingKey === module.moduleKey;
          const labelId = `module-${module.moduleKey}`;
          const owned = props.automations.filter((row) => row.moduleKey === module.moduleKey);
          const links = linksFor(module.moduleKey, props.tenantId);
          return (
            <li key={module.moduleKey} className='rounded-xl bg-card p-4 ring-1 ring-foreground/10'>
              <div className='flex flex-wrap items-start gap-3'>
                <div className='min-w-0 flex-1'>
                  <p id={labelId} className='text-sm font-medium'>
                    {meta.label}
                  </p>
                  <p className='text-muted-foreground mt-1 text-sm'>{meta.outcome}</p>
                  {module.changedAt && module.moduleKey !== 'platform' && (
                    <p className='text-muted-foreground mt-1 text-xs'>
                      Changed {when(module.changedAt)}
                    </p>
                  )}
                </div>
                {module.moduleKey === 'crm' && (
                  <select
                    aria-label='CRM capability set'
                    className='border-input bg-background h-11 rounded-md border px-2 text-sm'
                    value={module.level ?? 'lite'}
                    disabled={busy || !module.enabled}
                    onChange={(event) => change('crm', true, event.target.value as 'lite' | 'full')}
                  >
                    <option value='lite'>Core capabilities</option>
                    <option value='full'>Extended capabilities</option>
                  </select>
                )}
                {module.moduleKey === 'platform' ? (
                  <Badge variant='secondary'>Always on</Badge>
                ) : (
                  <Switch
                    aria-labelledby={labelId}
                    checked={module.enabled}
                    disabled={busy}
                    onCheckedChange={(checked) =>
                      change(
                        module.moduleKey,
                        checked,
                        module.moduleKey === 'crm' ? (module.level ?? 'lite') : undefined
                      )
                    }
                  />
                )}
              </div>
              <div className='mt-4 space-y-3 border-t pt-3'>
                <p className='text-sm font-medium'>Settings</p>
                {owned.length > 0 && (
                  <ul className='space-y-2'>
                    {owned.map((automation) => {
                      const autoId = `auto-${automation.key}`;
                      return (
                        <li
                          key={automation.key}
                          className='flex items-center justify-between gap-3'
                        >
                          <span id={autoId} className='text-sm'>
                            {automation.label}
                          </span>
                          <Switch
                            aria-labelledby={autoId}
                            checked={automation.enabled}
                            disabled={!module.enabled || pendingKey === `auto:${automation.key}`}
                            onCheckedChange={(checked) => changeAutomation(automation.key, checked)}
                          />
                        </li>
                      );
                    })}
                    {!module.enabled && module.moduleKey !== 'platform' && (
                      <li className='text-muted-foreground text-xs'>
                        Turn the system on to change these.
                      </li>
                    )}
                  </ul>
                )}
                {module.config.entries.length > 0 && (
                  <ul className='text-sm'>
                    {module.config.entries.map((entry) => (
                      <li key={entry.key}>
                        {CONFIG_LABELS[entry.key] ?? entry.key}: {entry.value}
                      </li>
                    ))}
                  </ul>
                )}
                {module.config.hidesSecrets && (
                  <p className='text-muted-foreground text-xs'>Stored credentials stay hidden.</p>
                )}
                {links.length > 0 && (
                  <p className='flex flex-wrap gap-4'>
                    {links.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className='text-primary-text inline-flex min-h-11 items-center underline'
                      >
                        {link.label}
                      </Link>
                    ))}
                  </p>
                )}
                {owned.length === 0 &&
                  module.config.entries.length === 0 &&
                  !module.config.hidesSecrets &&
                  links.length === 0 &&
                  module.moduleKey !== 'crm' && (
                    <p className='text-muted-foreground text-sm'>
                      No extra settings are defined for this system.
                    </p>
                  )}
              </div>
            </li>
          );
        })}
      </ul>
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
                <TableHead>System</TableHead>
                <TableHead>Change</TableHead>
                <TableHead>By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {props.history.map((row, index) => (
                <TableRow key={`${row.at}-${index}`}>
                  <TableCell>{when(row.at)}</TableCell>
                  <TableCell>
                    {SYSTEM_CATALOG[row.moduleKey as ModuleKey]?.label ?? row.moduleKey}
                  </TableCell>
                  <TableCell>
                    {describe(row.before)} → {describe(row.after)}
                  </TableCell>
                  <TableCell>
                    {row.actorUserId === props.currentUserId ? 'You' : 'Another admin'}
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
