import PageContainer from '@/components/layout/page-container';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/states';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { ForbiddenError } from '@/server/auth';
import { ModuleDisabledError } from '@/server/modules';
import {
  listReferrals,
  referralContactOptions,
  resolveReferralStatus,
  REFERRAL_STATUSES,
  REFERRAL_STATUS_LABEL,
  type ReferralRow
} from '@/server/referrals';
import { loadShellContext } from '@/server/shell';
import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { EditReferral, NewReferral } from './referral-forms';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Referrals', robots: { index: false, follow: false } };

const dateLabel = (iso: string) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(iso));

function dollars(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  })}`;
}

const TONE: Partial<Record<ReferralRow['status'], 'success' | 'info' | 'neutral' | 'warning'>> = {
  new: 'info',
  contacted: 'neutral',
  booked: 'info',
  won: 'success',
  lost: 'warning'
};

type SearchParams = { status?: string };

export default async function ReferralsPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [query, cookieStore, requestHeaders] = await Promise.all([
    searchParams,
    cookies(),
    headers()
  ]);
  const shell = await loadShellContext(requestHeaders, cookieStore.get('tenant_id')?.value);
  if (!shell) redirect('/sign-in');
  const tenant = shell.tenant;
  if (!tenant) {
    return (
      <PageContainer pageTitle='Referrals' access={false}>
        {null}
      </PageContainer>
    );
  }
  const ctx = { tenantId: tenant.id, userId: shell.user.id, role: shell.role };
  const status = resolveReferralStatus(query.status);

  let data;
  let contacts;
  try {
    [data, contacts] = await Promise.all([
      listReferrals(ctx, { status }),
      referralContactOptions(ctx)
    ]);
  } catch (err) {
    // Referrals are CRM Full; Lite tenants and modules off read as no access.
    if (err instanceof ModuleDisabledError || err instanceof ForbiddenError) {
      return (
        <PageContainer pageTitle='Referrals' access={false}>
          {null}
        </PageContainer>
      );
    }
    throw err;
  }

  const canEditRewards = shell.role === 'owner';
  const kpis = [
    ['This month', data.kpis.thisMonth.toLocaleString()],
    [
      'Conversion (90 days)',
      data.kpis.conversion90 == null ? 'No referrals yet' : `${data.kpis.conversion90}%`
    ],
    ['Rewards pending', dollars(data.kpis.rewardsPendingCents)]
  ] as const;

  return (
    <PageContainer
      pageTitle='Referrals'
      pageDescription='People your customers send your way, and the rewards you owe.'
      pageHeaderAction={<NewReferral contacts={contacts} />}
    >
      <div className='grid gap-4 sm:grid-cols-3'>
        {kpis.map(([label, value]) => (
          <div key={label} className='rounded-xl bg-card p-4 ring-1 ring-foreground/10'>
            <p className='text-muted-foreground text-sm'>{label}</p>
            <p className='mt-2 text-2xl font-semibold'>{value}</p>
          </div>
        ))}
      </div>

      <nav aria-label='Filter by referral status' className='mt-4 flex flex-wrap gap-2'>
        <StatusLink status={undefined} active={!status}>
          All
        </StatusLink>
        {REFERRAL_STATUSES.map((option) => (
          <StatusLink key={option} status={option} active={status === option}>
            {REFERRAL_STATUS_LABEL[option]}
          </StatusLink>
        ))}
      </nav>

      <div className='mt-4'>
        {!data.rows.length ? (
          status ? (
            <EmptyState
              title='No referrals match'
              description='Try a different status.'
              action={
                <Link
                  href='/dashboard/referrals'
                  className='border-input hover:bg-muted inline-flex h-11 items-center rounded border px-4 text-sm'
                >
                  Clear filter
                </Link>
              }
            />
          ) : (
            <EmptyState
              title='No referrals yet'
              description='When a customer sends someone your way, add the referral here.'
            />
          )
        ) : (
          <>
            <div className='hidden md:block'>
              <Table>
                <caption className='sr-only'>Client referrals, newest first</caption>
                <TableHeader>
                  <TableRow>
                    <TableHead scope='col'>Referred by</TableHead>
                    <TableHead scope='col'>Referee</TableHead>
                    <TableHead scope='col'>Status</TableHead>
                    <TableHead scope='col'>Reward</TableHead>
                    <TableHead scope='col'>Added</TableHead>
                    <TableHead scope='col'>
                      <span className='sr-only'>Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((row) => (
                    <TableRow key={row.id} className='h-11'>
                      <TableCell>{row.referrerName}</TableCell>
                      <TableCell>
                        <span className='font-medium'>{row.refereeName}</span>
                        {row.refereePhone && (
                          <span className='text-muted-foreground block text-xs'>
                            {row.refereePhone}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={TONE[row.status] ?? 'neutral'}>
                          {REFERRAL_STATUS_LABEL[row.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className='whitespace-nowrap'>
                        {row.rewardCents ? dollars(row.rewardCents) : '–'}
                        {row.rewardStatus !== 'none' && (
                          <span className='text-muted-foreground block text-xs capitalize'>
                            {row.rewardStatus}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className='whitespace-nowrap'>
                        {dateLabel(row.createdAt)}
                      </TableCell>
                      <TableCell>
                        <EditReferral row={row} canEditRewards={canEditRewards} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ul className='flex flex-col gap-2 md:hidden'>
              {data.rows.map((row) => (
                <li key={row.id} className='bg-card flex flex-col gap-1.5 rounded-lg border p-3'>
                  <div className='flex items-start justify-between gap-2'>
                    <span className='font-medium'>{row.refereeName}</span>
                    <Badge variant={TONE[row.status] ?? 'neutral'}>
                      {REFERRAL_STATUS_LABEL[row.status]}
                    </Badge>
                  </div>
                  <p className='text-muted-foreground text-sm'>
                    Referred by {row.referrerName} · {dateLabel(row.createdAt)}
                  </p>
                  {row.rewardCents > 0 && (
                    <p className='text-sm'>
                      Reward {dollars(row.rewardCents)} ({row.rewardStatus})
                    </p>
                  )}
                  <div className='mt-1'>
                    <EditReferral row={row} canEditRewards={canEditRewards} />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </PageContainer>
  );
}

function StatusLink({
  status,
  active,
  children
}: {
  status?: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={status ? `/dashboard/referrals?status=${status}` : '/dashboard/referrals'}
      aria-current={active ? 'true' : undefined}
      className={
        active
          ? 'bg-primary text-primary-foreground inline-flex h-11 items-center rounded-full px-4 text-sm font-medium'
          : 'border-input hover:bg-muted inline-flex h-11 items-center rounded-full border px-4 text-sm'
      }
    >
      {children}
    </Link>
  );
}
