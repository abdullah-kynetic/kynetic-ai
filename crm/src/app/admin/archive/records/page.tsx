import PageContainer from '@/components/layout/page-container';
import { Button, buttonVariants } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { listRecords, recordFiltersSchema } from '@/server/archive';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArchiveTabs,
  Banner,
  Pager,
  first,
  requireArchiveStaff,
  type SearchParams
} from '../archive-shared';

export const metadata: Metadata = { title: 'Archive records' };
export const dynamic = 'force-dynamic';

export default async function ArchiveRecordsPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  const ctx = await requireArchiveStaff();
  const p = await searchParams;
  const parsed = recordFiltersSchema.safeParse({ object: first(p.object), page: first(p.page) });
  const result = parsed.success ? await listRecords(ctx, parsed.data) : null;
  const f = parsed.success ? parsed.data : null;

  return (
    <PageContainer
      pageTitle='Archive'
      pageDescription='Old Twenty notes, tasks, files and records. Staff only.'
    >
      <ArchiveTabs current='/admin/archive/records' />
      <Banner />
      <form method='get' className='mb-4 flex flex-wrap items-end gap-3'>
        <div className='grid gap-1.5'>
          <Label htmlFor='rec-object'>Record type</Label>
          <NativeSelect id='rec-object' name='object' defaultValue={first(p.object) ?? ''}>
            <option value=''>All types</option>
            <option value='companies'>Companies</option>
            <option value='people'>People</option>
          </NativeSelect>
        </div>
        <Button type='submit'>Filter</Button>
        <Link href='/admin/archive/records' className={buttonVariants({ variant: 'ghost' })}>
          Clear
        </Link>
      </form>
      {!result ? (
        <p role='alert' className='text-destructive text-sm'>
          One of the filters is not valid.
        </p>
      ) : result.rows.length === 0 ? (
        <p className='text-muted-foreground text-sm'>No records.</p>
      ) : (
        <>
          <ul className='divide-y rounded-lg border' aria-label='Records'>
            {result.rows.map((r) => (
              <li key={r.id} className='p-3'>
                <p className='font-medium'>{r.label}</p>
                <p className='text-muted-foreground text-xs'>
                  {r.object} · created {r.createdOn ?? 'unknown'} · Twenty id {r.twentyId}
                </p>
                <dl className='mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm'>
                  {Object.entries(r.data).map(([k, v]) => (
                    <div key={k} className='contents'>
                      <dt className='text-muted-foreground'>{k}</dt>
                      <dd className='break-words'>{String(v)}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
          <Pager
            label='Records pages'
            basePath='/admin/archive/records'
            params={{ object: f?.object }}
            page={result.page}
            count={result.rows.length}
            hasNext={result.hasNext}
          />
        </>
      )}
    </PageContainer>
  );
}
