import PageContainer from '@/components/layout/page-container';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { listNoteTags, noteFiltersSchema, searchNotes } from '@/server/archive';
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

export const metadata: Metadata = { title: 'Archive notes' };
export const dynamic = 'force-dynamic';

export default async function ArchiveNotesPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  const ctx = await requireArchiveStaff();
  const p = await searchParams;
  const parsed = noteFiltersSchema.safeParse({
    q: first(p.q),
    tag: first(p.tag),
    from: first(p.from),
    to: first(p.to),
    hideSuperseded: first(p.hideSuperseded),
    page: first(p.page)
  });
  const [tags, result] = await Promise.all([
    listNoteTags(ctx),
    parsed.success ? searchNotes(ctx, parsed.data) : null
  ]);
  const f = parsed.success ? parsed.data : null;

  return (
    <PageContainer
      pageTitle='Archive'
      pageDescription='Old Twenty notes, tasks, files and records. Staff only.'
    >
      <ArchiveTabs current='/admin/archive/notes' />
      <Banner />
      <form method='get' role='search' className='mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
        <div className='grid gap-1.5 sm:col-span-2'>
          <Label htmlFor='arch-q'>Search title and text</Label>
          <Input id='arch-q' name='q' defaultValue={first(p.q) ?? ''} autoComplete='off' />
        </div>
        <div className='grid gap-1.5'>
          <Label htmlFor='arch-tag'>Tag</Label>
          <NativeSelect
            id='arch-tag'
            name='tag'
            defaultValue={first(p.tag) ?? ''}
            className='w-full'
          >
            <option value=''>All tags</option>
            {tags.map((t) => (
              <option key={t.tag} value={t.tag}>
                {t.tag} ({t.count})
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className='flex items-end gap-2'>
          <label className='flex items-center gap-2 text-sm'>
            <input
              type='checkbox'
              name='hideSuperseded'
              defaultChecked={first(p.hideSuperseded) === 'on'}
            />
            Hide superseded
          </label>
        </div>
        <div className='grid gap-1.5'>
          <Label htmlFor='arch-from'>Created from</Label>
          <Input id='arch-from' type='date' name='from' defaultValue={first(p.from) ?? ''} />
        </div>
        <div className='grid gap-1.5'>
          <Label htmlFor='arch-to'>Created to</Label>
          <Input id='arch-to' type='date' name='to' defaultValue={first(p.to) ?? ''} />
        </div>
        <div className='flex items-end gap-2 sm:col-span-2'>
          <Button type='submit'>Search</Button>
          <Link href='/admin/archive/notes' className={buttonVariants({ variant: 'ghost' })}>
            Clear
          </Link>
        </div>
      </form>

      {!result ? (
        <p role='alert' className='text-destructive text-sm'>
          One of the filters is not valid. Dates must be YYYY-MM-DD.
        </p>
      ) : result.rows.length === 0 ? (
        <p className='text-muted-foreground text-sm'>No notes match.</p>
      ) : (
        <>
          <ul className='divide-y rounded-lg border' aria-label='Notes'>
            {result.rows.map((n) => (
              <li key={n.id} className='p-3'>
                <Link
                  href={`/admin/archive/notes/${n.id}`}
                  className='text-foreground font-medium underline underline-offset-2'
                >
                  {n.title}
                </Link>
                <p className='text-muted-foreground mt-0.5 text-xs'>
                  {n.createdOn} · {n.tag}
                  {n.superseded ? ' · superseded' : ''}
                </p>
                <p className='mt-1 text-sm break-words'>{n.snippet.replace(/<\/?b>/g, '')}</p>
              </li>
            ))}
          </ul>
          <Pager
            label='Notes pages'
            basePath='/admin/archive/notes'
            params={{
              q: f?.q,
              tag: f?.tag,
              from: f?.from,
              to: f?.to,
              hideSuperseded: f?.hideSuperseded ? 'on' : undefined
            }}
            page={result.page}
            count={result.rows.length}
            hasNext={result.hasNext}
          />
        </>
      )}
    </PageContainer>
  );
}
