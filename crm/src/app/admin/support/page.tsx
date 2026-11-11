import { headers } from 'next/headers';
import Link from 'next/link';
import { forbidden } from 'next/navigation';
import PageContainer from '@/components/layout/page-container';
import { statusLabel } from '@/components/support/thread';
import { Button } from '@/components/ui/button';
import { decideAdminAccess } from '@/server/admin';
import {
  listSupportAlerts,
  listSupportQueue,
  SUPPORT_CATEGORIES,
  SUPPORT_STATUSES,
  type SupportCategory,
  type SupportStatus
} from '@/server/support';
import { setSupportStatusAction } from './actions';

export const dynamic = 'force-dynamic';

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

const CATEGORY_LABEL: Record<SupportCategory, string> = {
  general: 'General',
  alex_change: 'Alex change',
  system_request: 'System request'
};

export default async function AdminSupportPage({
  searchParams
}: {
  searchParams: Promise<{ category?: string; status?: string }>;
}) {
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok') forbidden();
  const staff = { userId: access.user.id, role: access.role };
  const query = await searchParams;
  const category = SUPPORT_CATEGORIES.find((item) => item === query.category) ?? null;
  const status = SUPPORT_STATUSES.find((item) => item === query.status) ?? null;
  const hrefFor = (next: { category?: SupportCategory | null; status?: SupportStatus | null }) => {
    const params = new URLSearchParams();
    const nextCategory = next.category === undefined ? category : next.category;
    const nextStatus = next.status === undefined ? status : next.status;
    if (nextCategory) params.set('category', nextCategory);
    if (nextStatus) params.set('status', nextStatus);
    const search = params.toString();
    return `/admin/support${search ? `?${search}` : ''}`;
  };
  const [rows, alerts] = await Promise.all([
    listSupportQueue(staff, { category, status }),
    listSupportAlerts(staff)
  ]);
  return (
    <PageContainer
      pageTitle='Support requests'
      pageDescription='Requests from clients, open ones first. Replies stay in the portal.'
    >
      <div className='mb-4 flex flex-wrap gap-2'>
        <Link
          className='inline-flex min-h-11 items-center rounded border px-3'
          href={hrefFor({ category: null })}
          aria-current={!category ? 'page' : undefined}
        >
          All
        </Link>
        {SUPPORT_CATEGORIES.map((item) => (
          <Link
            key={item}
            className='inline-flex min-h-11 items-center rounded border px-3'
            href={hrefFor({ category: item })}
            aria-current={category === item ? 'page' : undefined}
          >
            {CATEGORY_LABEL[item]}
          </Link>
        ))}
      </div>
      <div className='mb-4 flex flex-wrap gap-2' aria-label='Filter by status'>
        <Link
          className='inline-flex min-h-11 items-center rounded border px-3'
          href={hrefFor({ status: null })}
          aria-current={!status ? 'page' : undefined}
        >
          Any status
        </Link>
        {SUPPORT_STATUSES.map((item) => (
          <Link
            key={item}
            className='inline-flex min-h-11 items-center rounded border px-3'
            href={hrefFor({ status: item })}
            aria-current={status === item ? 'page' : undefined}
          >
            {statusLabel(item)}
          </Link>
        ))}
      </div>
      {alerts.length > 0 ? (
        <section aria-labelledby='support-alerts' className='mb-4 rounded border p-3'>
          <h2 id='support-alerts' className='font-medium'>
            New requests
          </h2>
          <ul className='mt-2 grid gap-1 text-sm'>
            {alerts.map((alert) => (
              <li key={alert.id}>
                <Link href={alert.link ?? '/admin/support'} className='underline'>
                  {alert.tenantName}: {alert.body ?? alert.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {rows.length === 0 ? (
        <p className='text-muted-foreground'>No support requests.</p>
      ) : (
        <ul className='grid max-w-4xl gap-3'>
          {rows.map((row) => (
            <li key={row.id} className='rounded border p-3'>
              <div className='flex flex-wrap items-center justify-between gap-2'>
                <Link className='font-medium underline' href={`/admin/support/${row.id}`}>
                  {row.subject}
                </Link>
                <span className='text-sm'>{statusLabel(row.status)}</span>
              </div>
              <p className='text-muted-foreground text-sm'>
                {row.tenantName} · {CATEGORY_LABEL[row.category]} ·{' '}
                {new Date(row.createdAt).toLocaleString()}
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
