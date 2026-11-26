import Link from 'next/link';
import { StatusPill, type Tone } from '@/components/ui/status-pill';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { StartViewAsForm } from '../view-as/start-form';
import { loadClientRows, type ClientRow } from './rows';

export type ClientListKind = 'live' | 'demo' | 'churned' | 'archived' | 'operations';
export type ClientListFilters = { q?: string; health?: string; stage?: string };

const healthPill: Record<'green' | 'yellow' | 'red', { tone: Tone; word: string }> = {
  green: { tone: 'gain', word: 'Healthy' },
  yellow: { tone: 'attention', word: 'Watch' },
  red: { tone: 'alert', word: 'At risk' }
};
const stageWord: Record<string, string> = {
  proposal: 'Proposal',
  building: 'Building',
  testing: 'Testing',
  live: 'Live',
  at_risk: 'At risk',
  churned: 'Churned',
  demo: 'Demo',
  archived: 'Archived'
};
const stageTone: Record<string, Tone> = {
  proposal: 'neutral',
  building: 'attention',
  testing: 'attention',
  live: 'gain',
  at_risk: 'alert',
  churned: 'neutral',
  demo: 'neutral',
  archived: 'neutral'
};
const titles: Record<ClientListKind, string> = {
  live: 'Live clients',
  demo: 'Demo clients',
  churned: 'Churned clients',
  archived: 'Archived clients',
  operations: 'All clients'
};

function inKind(kind: ClientListKind, row: ClientRow) {
  if (kind === 'live') return row.stage === 'live' || row.stage === 'at_risk';
  if (kind === 'demo') return row.stage === 'demo';
  if (kind === 'churned') return row.stage === 'churned';
  if (kind === 'archived') return row.stage === 'archived';
  return row.stage !== 'churned' && row.stage !== 'archived';
}

export async function ClientList({
  kind,
  filters
}: {
  kind: ClientListKind;
  filters: ClientListFilters;
}) {
  const { user, rows: all } = await loadClientRows();
  const q = (filters.q ?? '').trim().toLowerCase();
  const kindRows = all.filter((row) => inKind(kind, row));
  const rows = kindRows
    .filter((row) => row.name.toLowerCase().includes(q))
    .filter((row) => !filters.health || row.healthTone === filters.health)
    .filter((row) => !filters.stage || row.stage === filters.stage);
  const filtered = Boolean(q || filters.health || filters.stage);
  return (
    <section className='space-y-4' aria-label={titles[kind]}>
      <h2 className='text-xl font-medium'>{titles[kind]}</h2>
      <form className='flex flex-wrap items-center gap-2' role='search'>
        <Input
          name='q'
          aria-label='Search clients'
          placeholder='Search clients'
          defaultValue={filters.q ?? ''}
          className='h-9 max-w-sm'
        />
        <select
          name='health'
          aria-label='Health'
          defaultValue={filters.health ?? ''}
          className='bg-background h-9 rounded-md border px-3 text-sm'
        >
          <option value=''>Any health</option>
          <option value='green'>Healthy</option>
          <option value='yellow'>Watch</option>
          <option value='red'>At risk</option>
        </select>
        {kind === 'operations' && (
          <select
            name='stage'
            aria-label='Stage'
            defaultValue={filters.stage ?? ''}
            className='bg-background h-9 rounded-md border px-3 text-sm'
          >
            <option value=''>Any stage</option>
            {Object.entries(stageWord)
              .filter(([id]) => id !== 'churned')
              .map(([id, word]) => (
                <option key={id} value={id}>
                  {word}
                </option>
              ))}
          </select>
        )}
        <button
          className='bg-primary text-primary-foreground h-9 rounded-md px-4 text-sm'
          type='submit'
        >
          Filter
        </button>
        {filtered && (
          <Link className='text-sm underline' href='?'>
            Clear filters
          </Link>
        )}
      </form>
      <p className='text-muted-foreground text-sm' aria-live='polite'>
        Showing {rows.length} of {kindRows.length}
      </p>
      <div className='bg-card overflow-hidden rounded-[var(--radius-card)] border'>
        <Table scrollLabel={`${titles[kind]} table`}>
          <TableHeader className='bg-surface-sunken'>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className='hidden md:table-cell'>Plan</TableHead>
              <TableHead>Health</TableHead>
              <TableHead className='hidden md:table-cell'>Open as client</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className='text-muted-foreground'>
                  {filtered ? 'No clients match these filters.' : 'No clients here yet.'}{' '}
                  {kind !== 'churned' && kind !== 'archived' && (
                    <Link className='underline' href='/admin/clients/new'>
                      Onboard a client
                    </Link>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const health = healthPill[row.healthTone];
                const openable = row.status !== 'suspended' && row.status !== 'offboarded';
                const open = openable ? (
                  <StartViewAsForm
                    tenantId={row.tenantId}
                    tenantName={row.name}
                    reasonRequired={user.kyneticRole !== 'admin'}
                  />
                ) : (
                  <span className='text-muted-foreground text-sm'>Not available</span>
                );
                return (
                  <TableRow key={row.tenantId}>
                    <TableCell className='font-medium'>
                      <Link
                        className='inline-flex min-h-11 items-center underline-offset-4 hover:underline'
                        href={`/admin/clients/${row.tenantId}`}
                      >
                        {row.name}
                      </Link>
                      <div className='mt-1 md:hidden'>{open}</div>
                    </TableCell>
                    <TableCell>
                      <StatusPill tone={stageTone[row.stage] ?? 'neutral'}>
                        {stageWord[row.stage]}
                      </StatusPill>
                    </TableCell>
                    <TableCell className='hidden md:table-cell'>
                      {row.plan} {row.pricingTier ?? ''}
                    </TableCell>
                    <TableCell>
                      <StatusPill tone={health.tone}>
                        {row.healthScore} · {health.word}
                      </StatusPill>
                    </TableCell>
                    <TableCell className='hidden md:table-cell'>{open}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      <p className='text-muted-foreground text-xs'>
        Health: green ≥70, yellow ≥40, red &lt;40. Healthy, Watch and At risk follow those cut-offs.
      </p>
    </section>
  );
}

export type ClientListSearch = Promise<{
  q?: string;
  health?: string;
  stage?: string;
}>;
