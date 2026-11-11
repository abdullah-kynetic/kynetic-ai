import PageContainer from '@/components/layout/page-container';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/states';
import {
  canViewClientUsage,
  usageMonthNow,
  getClientUsage,
  resolveUsageMonth
} from '@/server/client-usage';
import { ValidationError } from '@/server/errors';
import { ModuleDisabledError } from '@/server/modules';
import { getBusinessSettings } from '@/server/settings/business';
import { loadShellContext } from '@/server/shell';
import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { UsageChart } from './usage-chart';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Usage', robots: { index: false, follow: false } };

const CAP_TONE = {
  no_cap: 'neutral',
  under: 'success',
  watch: 'warning',
  reached: 'error'
} as const;

type SearchParams = { month?: string };

export default async function UsagePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [query, cookieStore, requestHeaders] = await Promise.all([
    searchParams,
    cookies(),
    headers()
  ]);
  const shell = await loadShellContext(requestHeaders, cookieStore.get('tenant_id')?.value);
  if (!shell) redirect('/sign-in');
  const tenant = shell.tenant;
  if (!tenant || !canViewClientUsage(shell.role)) {
    return (
      <PageContainer pageTitle='Usage' access={false}>
        {null}
      </PageContainer>
    );
  }
  const ctx = { tenantId: tenant.id, userId: shell.user.id, role: shell.role };
  const settings = await getBusinessSettings(ctx);
  // A bad month in a hand-edited URL falls back to the current month.
  let month: string;
  try {
    month = resolveUsageMonth(query.month, usageMonthNow(settings.timezone));
  } catch (err) {
    if (err instanceof ValidationError) redirect('/dashboard/usage');
    throw err;
  }

  let usage;
  try {
    usage = await getClientUsage(ctx, month);
  } catch (err) {
    if (err instanceof ModuleDisabledError) {
      return (
        <PageContainer pageTitle='Usage' access={false}>
          {null}
        </PageContainer>
      );
    }
    throw err;
  }

  const kpis = [
    ['Minutes', usage.totals.minutes.toLocaleString()],
    ['Calls', usage.totals.calls.toLocaleString()],
    ['Texts', usage.totals.sms.toLocaleString()],
    ['Emails', usage.totals.emails.toLocaleString()]
  ] as const;

  return (
    <PageContainer
      pageTitle='Usage'
      pageDescription='What your account used this month. Usage only, no prices.'
    >
      <form method='get' action='/dashboard/usage' className='flex flex-wrap items-end gap-3'>
        <label htmlFor='usage-month' className='grid gap-1 text-sm'>
          <span className='text-muted-foreground'>Month</span>
          <Input id='usage-month' name='month' type='month' defaultValue={month} required />
        </label>
        <Button type='submit' variant='outline'>
          Apply
        </Button>
        <span aria-live='polite' className='text-muted-foreground text-sm'>
          <Badge variant={CAP_TONE[usage.cap.status]}>{usage.cap.label}</Badge>
        </span>
      </form>

      <div className='mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        {kpis.map(([label, value]) => (
          <div key={label} className='rounded-xl bg-card p-4 ring-1 ring-foreground/10'>
            <p className='text-muted-foreground text-sm'>{label}</p>
            <p className='mt-2 text-2xl font-semibold'>{value}</p>
          </div>
        ))}
      </div>

      <div className='mt-4'>
        <UsageChart days={usage.daily} />
      </div>

      {!usage.daily.length && (
        <div className='mt-4'>
          <EmptyState
            title='No usage this month'
            description='Calls, texts and emails appear here after your account starts using them.'
          />
        </div>
      )}
    </PageContainer>
  );
}
