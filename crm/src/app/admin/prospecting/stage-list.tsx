import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { getAgencyWorkspace } from '@/server/agency';
import {
  PROSPECT_SOURCES,
  listAgencyProspects,
  type ProspectStage
} from '@/server/agency/prospects';
import { agencyCaller } from '../agency/caller';
import { createProspectAction } from './actions';
import { ProspectTable } from './prospect-table';

export type StageSearch = Promise<{ q?: string; source?: string; state?: string; error?: string }>;

const copy: Record<ProspectStage, { title: string; empty: string }> = {
  scraped: {
    title: 'Scraped leads',
    empty: 'Nothing waiting to be enriched. Add a synthetic prospect to start.'
  },
  half_enriched: {
    title: 'Half-enriched leads',
    empty: 'No half-enriched leads. They appear once a phone or website is known.'
  },
  fully_enriched: {
    title: 'Fully enriched leads',
    empty: 'No fully enriched leads yet. They are ready to move to Sales.'
  }
};
const sourceWord: Record<string, string> = {
  google_maps: 'Google Maps',
  directory: 'Directory',
  referral: 'Referral',
  manual: 'By hand'
};

export async function StageList({ stage, search }: { stage: ProspectStage; search: StageSearch }) {
  const caller = await agencyCaller();
  const query = await search;
  const workspace = await getAgencyWorkspace(caller);
  if (!workspace)
    return (
      <section className='bg-card space-y-3 rounded-xl border p-6'>
        <h2 className='text-lg font-semibold'>{copy[stage].title}</h2>
        <p className='text-muted-foreground text-sm'>
          Create the synthetic agency workspace on the Funnel page to start adding prospects.
        </p>
        <Link href='/admin/prospecting' className='text-primary underline'>
          Open the funnel
        </Link>
      </section>
    );
  const source = PROSPECT_SOURCES.find((s) => s === query.source);
  const filters = {
    stage,
    ...(query.q?.trim() ? { q: query.q.trim() } : {}),
    ...(source ? { source } : {}),
    ...(/^[A-Za-z]{2}$/.test(query.state ?? '') ? { state: query.state } : {})
  };
  const rows = await listAgencyProspects(caller, filters);
  const filtered = Boolean(filters.q || filters.source || filters.state);
  return (
    <section className='space-y-4' aria-label={copy[stage].title}>
      <h2 className='text-xl font-semibold'>{copy[stage].title}</h2>
      {query.error && (
        <p role='alert' className='text-destructive text-sm'>
          The prospect was not saved. Use a name, a source, an @example.test email and a 555-01xx
          phone, and not Florida or Oklahoma.
        </p>
      )}
      <form className='flex flex-wrap items-center gap-2' role='search'>
        <Input
          name='q'
          aria-label='Search prospects'
          placeholder='Search by business name'
          defaultValue={query.q ?? ''}
          className='max-w-sm'
        />
        <select
          name='source'
          aria-label='Source'
          defaultValue={source ?? ''}
          className='bg-background h-9 rounded-md border px-3 text-sm'
        >
          <option value=''>Any source</option>
          {PROSPECT_SOURCES.map((s) => (
            <option key={s} value={s}>
              {sourceWord[s]}
            </option>
          ))}
        </select>
        <Input
          name='state'
          aria-label='State'
          placeholder='State (TX)'
          maxLength={2}
          defaultValue={query.state ?? ''}
          className='w-28'
        />
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
        {rows.length} {rows.length === 1 ? 'prospect' : 'prospects'}
        {filtered ? ' match these filters' : ''}
      </p>
      {rows.length === 0 ? (
        <div className='bg-card rounded-xl border p-6 text-sm'>
          <p className='text-muted-foreground'>
            {filtered ? 'No prospects match these filters.' : copy[stage].empty}
          </p>
        </div>
      ) : (
        <ProspectTable
          rows={rows.map((p) => ({
            id: p.id,
            businessName: p.businessName,
            source: p.source,
            location: [p.city, p.state].filter(Boolean).join(', '),
            website: p.website,
            phone: p.phone,
            email: p.email,
            ownerName: p.ownerName,
            addedOn: p.createdAt.slice(0, 10)
          }))}
        />
      )}
      {stage === 'scraped' && (
        <details className='bg-card rounded-xl border p-5' open={rows.length === 0}>
          <summary className='min-h-11 cursor-pointer font-medium'>
            Add a synthetic prospect
          </summary>
          <form action={createProspectAction} className='mt-4 grid gap-4 sm:grid-cols-2'>
            <label className='space-y-1 text-sm'>
              <span>Business name</span>
              <Input name='businessName' maxLength={200} required />
            </label>
            <label className='space-y-1 text-sm'>
              <span>Source</span>
              <select
                name='source'
                className='bg-background block h-9 w-full rounded-md border px-3 text-sm'
              >
                {PROSPECT_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {sourceWord[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className='space-y-1 text-sm'>
              <span>City</span>
              <Input name='city' maxLength={120} />
            </label>
            <label className='space-y-1 text-sm'>
              <span>State</span>
              <Input name='state' maxLength={2} placeholder='TX' />
            </label>
            <label className='space-y-1 text-sm'>
              <span>Website</span>
              <Input name='website' maxLength={300} />
            </label>
            <label className='space-y-1 text-sm'>
              <span>Synthetic phone</span>
              <Input name='phone' placeholder='+12025550123' />
            </label>
            <label className='space-y-1 text-sm'>
              <span>Synthetic email</span>
              <Input name='email' type='email' placeholder='owner@example.test' />
            </label>
            <label className='space-y-1 text-sm'>
              <span>Owner name</span>
              <Input name='ownerName' maxLength={200} />
            </label>
            <p className='text-muted-foreground text-xs sm:col-span-2'>
              The stage follows what you fill in: a phone or website makes it half-enriched, all of
              website, phone, email and owner make it fully enriched.
            </p>
            <button
              type='submit'
              className='bg-primary text-primary-foreground min-h-11 rounded-lg px-4 text-sm font-medium sm:col-span-2'
            >
              Add prospect
            </button>
          </form>
        </details>
      )}
    </section>
  );
}
