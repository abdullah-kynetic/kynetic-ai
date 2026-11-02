import { headers } from 'next/headers';
import { forbidden } from 'next/navigation';
import PageContainer from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { decideAdminAccess } from '@/server/admin';
import { listSupportQueue, type SupportStatus } from '@/server/support';
import { setSupportStatusAction } from './actions';

export const dynamic = 'force-dynamic';

const STATUS_LABEL = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved' } as const;
const ACTIONS: Record<SupportStatus, { status: SupportStatus; label: string }[]> = {
  open: [
    { status: 'in_progress', label: 'Start' },
    { status: 'resolved', label: 'Resolve' }
  ],
  in_progress: [
    { status: 'resolved', label: 'Resolve' },
    { status: 'open', label: 'Reopen' }
  ],
  resolved: [{ status: 'open', label: 'Reopen' }]
};

export default async function AdminSupportPage() {
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok') forbidden();
  const rows = await listSupportQueue({ userId: access.user.id, role: access.role });
  return (
    <PageContainer
      pageTitle='Support requests'
      pageDescription='Requests from clients, open ones first.'
    >
      {rows.length === 0 ? (
        <p className='text-muted-foreground'>No support requests.</p>
      ) : (
        <ul className='grid max-w-4xl gap-3'>
          {rows.map((row) => (
            <li key={row.id} className='rounded border p-3'>
              <div className='flex flex-wrap items-center justify-between gap-2'>
                <span className='font-medium'>{row.subject}</span>
                <span className='text-sm'>{STATUS_LABEL[row.status]}</span>
              </div>
              <p className='text-muted-foreground text-sm'>
                {row.tenantName} · {new Date(row.createdAt).toLocaleString()}
              </p>
              <p className='mt-2 whitespace-pre-wrap text-sm'>{row.body}</p>
              <div className='mt-3 flex flex-wrap gap-2'>
                {ACTIONS[row.status].map((next) => (
                  <form action={setSupportStatusAction} key={next.status}>
                    <input type='hidden' name='id' value={row.id} />
                    <input type='hidden' name='status' value={next.status} />
                    <Button type='submit' variant='outline' className='min-h-11'>
                      {next.label}
                    </Button>
                  </form>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  );
}
