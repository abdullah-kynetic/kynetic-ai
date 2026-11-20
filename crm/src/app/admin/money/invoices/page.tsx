import Link from 'next/link';
import { StatTiles } from '@/components/layout/stat-tiles';
import { agencyBillingCycle, agencyDate } from '@/components/agency/format';
import { StatusPill, type Tone } from '@/components/ui/status-pill';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { getAgencyWorkspace } from '@/server/agency';
import { getAgencyBilling } from '@/server/agency/billing';
import { agencyCaller } from '../../agency/caller';
import { AgencyWorkspaceMissing } from '../../agency/workspace-missing';

export const dynamic = 'force-dynamic';
const usd = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
const tone: Record<string, Tone> = {
  draft: 'neutral',
  open: 'attention',
  past_due: 'alert',
  paid: 'gain'
};
const word: Record<string, string> = {
  draft: 'Draft',
  open: 'Open',
  past_due: 'Past due',
  paid: 'Paid'
};

export default async function InvoicesPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const caller = await agencyCaller();
  if (!(await getAgencyWorkspace(caller))) return <AgencyWorkspaceMissing pageTitle='Invoices' />;
  const { status } = await searchParams;
  const data = await getAgencyBilling(caller);
  const filter = status && word[status] ? status : '';
  const rows = data.invoices.filter((i) => !filter || i.status === filter);
  const total = (s: string) =>
    data.invoices.filter((i) => i.status === s).reduce((sum, i) => sum + i.amount_cents, 0);
  return (
    <section className='space-y-5' aria-label='Invoices'>
      <h2 className='text-xl font-semibold'>Invoices</h2>
      <p className='text-muted-foreground text-sm'>
        Invoice drafts for won deals. Nothing is sent or charged. Create drafts and simulate payment
        events in{' '}
        <Link className='underline' href='/admin/money/billing'>
          Billing
        </Link>
        .
      </p>
      <StatTiles
        label='Invoices by status'
        tiles={Object.keys(word).map((s) => ({
          label: word[s]!,
          value: usd(total(s)),
          note: `${data.invoices.filter((i) => i.status === s).length} invoices`
        }))}
      />
      <nav aria-label='Invoice status filter' className='flex flex-wrap gap-2 text-sm'>
        {[['', 'All'], ...Object.entries(word)].map(([value, label]) => (
          <Link
            key={value || 'all'}
            href={value ? `?status=${value}` : '?'}
            aria-current={filter === value ? 'page' : undefined}
            className={`inline-flex min-h-11 items-center rounded-full border px-4 ${filter === value ? 'bg-foreground text-background' : 'bg-card'}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className='bg-card overflow-hidden rounded-[var(--radius-card)] border'>
        <Table scrollLabel='Invoices table'>
          <TableHeader className='bg-surface-sunken'>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Billing</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Due</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className='text-muted-foreground'>
                  {filter
                    ? 'No invoices with this status.'
                    : 'No invoice drafts yet. Save deal terms in Billing, then create a draft.'}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className='font-medium'>{i.deal_title ?? 'Deal'}</TableCell>
                  <TableCell>{agencyBillingCycle(i.cycle_key)}</TableCell>
                  <TableCell className='tabular-nums'>{usd(i.amount_cents)}</TableCell>
                  <TableCell>
                    <StatusPill tone={tone[i.status] ?? 'neutral'}>
                      {word[i.status] ?? i.status}
                    </StatusPill>
                  </TableCell>
                  <TableCell>
                    <time dateTime={String(i.due_on)}>{agencyDate(String(i.due_on))}</time>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
