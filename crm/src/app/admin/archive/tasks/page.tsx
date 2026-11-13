/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- scrollable table regions must be keyboard focusable (WCAG 2.1.1) */
import PageContainer from '@/components/layout/page-container';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { searchTasks, taskFiltersSchema } from '@/server/archive';
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

export const metadata: Metadata = { title: 'Archive tasks' };
export const dynamic = 'force-dynamic';

const STATUS_LABEL = { DONE: 'Done', IN_PROGRESS: 'In progress', TODO: 'To do' } as const;

export default async function ArchiveTasksPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  const ctx = await requireArchiveStaff();
  const p = await searchParams;
  const parsed = taskFiltersSchema.safeParse({
    q: first(p.q),
    status: first(p.status),
    step: first(p.step),
    dueBefore: first(p.dueBefore),
    page: first(p.page)
  });
  const result = parsed.success ? await searchTasks(ctx, parsed.data) : null;
  const f = parsed.success ? parsed.data : null;

  return (
    <PageContainer
      pageTitle='Archive'
      pageDescription='Old Twenty notes, tasks, files and records. Staff only.'
    >
      <ArchiveTabs current='/admin/archive/tasks' />
      <Banner />
      <form method='get' role='search' className='mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
        <div className='grid gap-1.5 sm:col-span-2'>
          <Label htmlFor='task-q'>Search title and text</Label>
          <Input id='task-q' name='q' defaultValue={first(p.q) ?? ''} autoComplete='off' />
        </div>
        <div className='grid gap-1.5'>
          <Label htmlFor='task-status'>Status</Label>
          <NativeSelect
            id='task-status'
            name='status'
            defaultValue={first(p.status) ?? ''}
            className='w-full'
          >
            <option value=''>Any status</option>
            <option value='TODO'>To do</option>
            <option value='IN_PROGRESS'>In progress</option>
            <option value='DONE'>Done</option>
          </NativeSelect>
        </div>
        <div className='grid gap-1.5'>
          <Label htmlFor='task-step'>Step</Label>
          <NativeSelect
            id='task-step'
            name='step'
            defaultValue={first(p.step) ?? ''}
            className='w-full'
          >
            <option value=''>Any step</option>
            {[2, 3, 4, 5].map((s) => (
              <option key={s} value={s}>
                Step {s}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className='grid gap-1.5'>
          <Label htmlFor='task-due'>Due on or before</Label>
          <Input
            id='task-due'
            type='date'
            name='dueBefore'
            defaultValue={first(p.dueBefore) ?? ''}
          />
        </div>
        <div className='flex items-end gap-2 sm:col-span-2'>
          <Button type='submit'>Search</Button>
          <Link href='/admin/archive/tasks' className={buttonVariants({ variant: 'ghost' })}>
            Clear
          </Link>
        </div>
      </form>

      {!result ? (
        <p role='alert' className='text-destructive text-sm'>
          One of the filters is not valid.
        </p>
      ) : result.rows.length === 0 ? (
        <p className='text-muted-foreground text-sm'>No tasks match.</p>
      ) : (
        <>
          <div
            className='overflow-x-auto rounded-lg border'
            role='region'
            aria-label='Tasks'
            tabIndex={0}
          >
            <table className='w-full text-left text-sm'>
              <thead>
                <tr>
                  <th scope='col' className='p-3'>
                    Task
                  </th>
                  <th scope='col' className='p-3'>
                    Status
                  </th>
                  <th scope='col' className='p-3'>
                    Step
                  </th>
                  <th scope='col' className='p-3'>
                    Priority
                  </th>
                  <th scope='col' className='p-3'>
                    Due
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((t) => (
                  <tr key={t.id} className='border-t align-top'>
                    <td className='p-3'>
                      <details>
                        <summary
                          className='cursor-pointer font-medium'
                          aria-label={`Show details for ${t.title}`}
                        >
                          <span>{t.title}</span>
                        </summary>
                        <pre className='bg-muted mt-2 max-h-96 overflow-auto rounded-md p-2 text-xs break-words whitespace-pre-wrap'>
                          {t.body || '(no text)'}
                        </pre>
                        <p className='text-muted-foreground mt-1 text-xs'>
                          Twenty id {t.twentyId} · created {t.createdOn}
                        </p>
                      </details>
                    </td>
                    <td className='p-3 whitespace-nowrap'>{STATUS_LABEL[t.status]}</td>
                    <td className='p-3'>{t.step ?? '-'}</td>
                    <td className='p-3'>{t.priority ?? '-'}</td>
                    <td className='p-3 whitespace-nowrap'>{t.dueOn ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager
            label='Tasks pages'
            basePath='/admin/archive/tasks'
            params={{
              q: f?.q,
              status: f?.status,
              step: f?.step ? String(f.step) : undefined,
              dueBefore: f?.dueBefore
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
