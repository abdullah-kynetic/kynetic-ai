import Link from 'next/link';
import type { ProspectFunnel } from '@/server/agency/prospects';

const sourceLabel: Record<string, string> = {
  google_maps: 'Google Maps',
  directory: 'Directory',
  referral: 'Referral',
  manual: 'Added by hand'
};
const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);

/** Counts per enrichment step, the step-to-step conversion and where prospects came from. */
export function FunnelDashboard({ funnel }: { funnel: ProspectFunnel }) {
  const top = Math.max(funnel.steps[0]?.reached ?? 0, 1);
  const sourceTop = Math.max(...funnel.sources.map((s) => s.count), 1);
  if (funnel.total === 0)
    return (
      <section className='bg-card space-y-3 rounded-xl border p-6' aria-label='Prospecting funnel'>
        <h2 className='font-semibold'>No prospects yet</h2>
        <p className='text-muted-foreground text-sm'>
          Add a synthetic prospect on the Scraped leads tab and it will show up in this funnel.
        </p>
        <Link className='text-primary underline' href='/admin/prospecting/scraped'>
          Open Scraped leads
        </Link>
      </section>
    );
  return (
    <div className='space-y-6'>
      <ul aria-label='Prospects per stage' className='grid grid-cols-2 gap-4 lg:grid-cols-4'>
        {[
          { label: 'Scraped', value: funnel.scraped, href: '/admin/prospecting/scraped' },
          {
            label: 'Half-enriched',
            value: funnel.halfEnriched,
            href: '/admin/prospecting/half-enriched'
          },
          {
            label: 'Fully enriched',
            value: funnel.fullyEnriched,
            href: '/admin/prospecting/fully-enriched'
          },
          { label: 'Moved to Sales', value: funnel.movedToSales, href: '/admin/sales' }
        ].map((tile) => (
          <li
            key={tile.label}
            className='bg-card flex flex-col gap-1 rounded-[var(--radius-card)] border p-5'
          >
            <span className='text-muted-foreground text-[13px] font-medium'>{tile.label}</span>
            <span className='text-4xl/[1.05] font-semibold tracking-tight tabular-nums'>
              {tile.value}
            </span>
            <Link
              className='text-primary text-xs underline-offset-4 hover:underline'
              href={tile.href}
            >
              Open list
            </Link>
          </li>
        ))}
      </ul>
      <section
        aria-label='Conversion funnel'
        className='bg-card space-y-4 rounded-[var(--radius-card)] border p-5'
      >
        <h2 className='font-semibold'>Funnel</h2>
        <ol className='space-y-3'>
          {funnel.steps.map((step, index) => (
            <li key={step.key} className='space-y-1'>
              <div className='flex flex-wrap justify-between gap-2 text-sm'>
                <span className='font-medium'>{step.label}</span>
                <span className='text-muted-foreground tabular-nums'>
                  {step.reached} reached
                  {index > 0 && <> · {pct(step.conversion)} of previous step</>}
                </span>
              </div>
              <div className='bg-muted h-3 overflow-hidden rounded-full' aria-hidden='true'>
                <div
                  className='bg-primary h-full rounded-full'
                  style={{
                    width: `${Math.max((step.reached / top) * 100, step.reached ? 2 : 0)}%`
                  }}
                />
              </div>
            </li>
          ))}
        </ol>
        <p className='text-muted-foreground text-xs'>
          Scraped: name only. Half-enriched: a phone or website. Fully enriched: website, phone,
          email and owner. Moving to Sales creates a deal only; nothing is sent.
        </p>
      </section>
      <section
        aria-label='Prospects by source'
        className='bg-card space-y-3 rounded-[var(--radius-card)] border p-5'
      >
        <h2 className='font-semibold'>Where prospects came from</h2>
        <ul className='space-y-3'>
          {funnel.sources.map((s) => (
            <li key={s.source} className='space-y-1'>
              <div className='flex justify-between text-sm'>
                <span>{sourceLabel[s.source]}</span>
                <span className='text-muted-foreground tabular-nums'>
                  {s.count} · {Math.round((s.count / funnel.total) * 100)}%
                </span>
              </div>
              <div className='bg-muted h-2 overflow-hidden rounded-full' aria-hidden='true'>
                <div
                  className='bg-primary h-full rounded-full'
                  style={{ width: `${(s.count / sourceTop) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
