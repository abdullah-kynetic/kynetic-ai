import Link from 'next/link';
import { ShopEmpty } from '@/components/shop/shop-empty';
import { ShopPage } from '@/components/shop/shop-page';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/ui/status-pill';
import { getShopLeads, LEAD_SOURCES, sourceLabel, type LeadSourceKey } from '@/server/shop';
import { day } from '../_lib/format';
import { shopContext } from '../_lib/context';

export const dynamic = 'force-dynamic';

const KEYS = new Set<string>([...LEAD_SOURCES.map((s) => s.key), 'other']);

export default async function LeadsPage({
  searchParams
}: {
  searchParams: Promise<{ source?: string }>;
}) {
  const ctx = await shopContext();
  const { source } = await searchParams;
  const chosen = source && KEYS.has(source) ? (source as LeadSourceKey) : undefined;
  const { rows, counts } = await getShopLeads(ctx, { source: chosen });
  const chips: { key: string; label: string; count: number; href: string }[] = [
    {
      key: 'all',
      label: 'All',
      count: counts.all,
      href: '/dashboard/shop/leads'
    },
    ...LEAD_SOURCES.map((s) => ({
      key: s.key,
      label: s.label,
      count: counts[s.key],
      href: `/dashboard/shop/leads?source=${s.key}`
    })),
    ...(counts.other > 0
      ? [
          {
            key: 'other',
            label: 'Other',
            count: counts.other,
            href: '/dashboard/shop/leads?source=other'
          }
        ]
      : [])
  ];
  return (
    <ShopPage
      ctx={ctx}
      title='Leads'
      description='Everyone who reached out, where they came from, and what happened.'
      actions={
        <Button render={<Link href='/dashboard/shop/leads/new' aria-label='Add walk-in' />}>
          Add walk-in
        </Button>
      }
    >
      <nav aria-label='Filter by source' className='-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0'>
        <ul className='flex min-w-max gap-2'>
          {chips.map((chip) => {
            const active = (chosen ?? 'all') === chip.key;
            return (
              <li key={chip.key}>
                <Link
                  href={chip.href}
                  aria-current={active ? 'true' : undefined}
                  className={`focus-visible:ring-ring inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm focus-visible:ring-2 focus-visible:outline-none ${active ? 'bg-primary text-primary-foreground border-transparent' : 'bg-card hover:bg-muted'}`}
                >
                  {chip.label}
                  <span className='tabular-nums opacity-80'>{chip.count}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {rows.length === 0 ? (
        <ShopEmpty
          title={chosen ? 'No leads from this source' : 'No leads yet'}
          description='New leads from calls, texts, photo quotes and walk-ins will appear here.'
          action={
            <Button
              render={<Link href='/dashboard/shop/leads/new' aria-label='Add walk-in' />}
              variant='outline'
            >
              Add walk-in
            </Button>
          }
        />
      ) : (
        <ul className='bg-card divide-y rounded-[var(--radius-card)] border'>
          {rows.map((lead) => (
            <li key={lead.id}>
              <Link
                href={`/dashboard/shop/leads/${lead.id}`}
                className='hover:bg-muted focus-visible:ring-ring flex min-h-11 flex-col gap-1 px-4 py-3 focus-visible:ring-2 focus-visible:outline-none sm:px-5'
              >
                <span className='flex flex-wrap items-center gap-x-3 gap-y-1'>
                  <span className='font-medium'>{lead.name}</span>
                  <StatusPill tone='neutral'>{sourceLabel(lead.source)}</StatusPill>
                  {lead.stageName ? (
                    <StatusPill tone='attention'>{lead.stageName}</StatusPill>
                  ) : null}
                  <span className='text-muted-foreground ml-auto text-xs'>
                    {day(lead.createdAt)}
                  </span>
                </span>
                <span className='text-muted-foreground text-sm'>
                  {[lead.vehicleLabel || lead.dealTitle, lead.phone].filter(Boolean).join(' · ')}
                </span>
                {lead.summary ? (
                  <span className='text-muted-foreground line-clamp-2 text-sm'>{lead.summary}</span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </ShopPage>
  );
}
