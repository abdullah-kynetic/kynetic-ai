import { EditDealButton } from '@/components/deals/deal-panel';
import PageContainer from '@/components/layout/page-container';
import { StatusBadge, type StatusTone } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { formatCents, getDealDetail, type DealDetail } from '@/server/deals';
import { AppError } from '@/server/errors';
import { loadShellContext } from '@/server/shell';
import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

export const metadata: Metadata = { title: 'Deal', robots: { index: false, follow: false } };

const ROLE_LABEL: Record<string, string> = {
  homeowner: 'Homeowner',
  spouse: 'Spouse',
  tenant: 'Tenant',
  property_manager: 'Property manager',
  other: 'Other'
};

/** DESIGN_SYSTEM tone mapping: Won is success, Lost is neutral (not error), the rest are info. */
const stageTone = (s: { isWon: boolean; isLost: boolean }): StatusTone =>
  s.isWon ? 'success' : s.isLost ? 'neutral' : 'info';

const day = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    dateStyle: 'medium',
    timeZone: 'UTC'
  });

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC'
  });

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, cookieStore, requestHeaders] = await Promise.all([params, cookies(), headers()]);
  const shell = await loadShellContext(requestHeaders, cookieStore.get('tenant_id')?.value);
  if (!shell) redirect('/sign-in');
  // A Kynetic user outside any tenant has no deals to show.
  if (!shell.tenant) notFound();

  let detail: DealDetail;
  try {
    detail = await getDealDetail(
      { tenantId: shell.tenant.id, userId: shell.user.id, role: shell.role },
      id
    );
  } catch (err) {
    // Another tenant's id, a deleted deal and a malformed id all read as the standard 404.
    if (err instanceof AppError && (err.code === 'NOT_FOUND' || err.code === 'VALIDATION_FAILED')) {
      notFound();
    }
    throw err;
  }

  const { deal, stage, stages, owner, members, contacts } = detail;
  const label = (m: { name: string | null; email: string }) => m.name ?? m.email;
  const canEdit = shell.role === 'owner' || shell.role === 'staff';

  return (
    <PageContainer
      pageTitle={deal.title}
      pageDescription={`${formatCents(deal.valueCents)}`}
      pageHeaderAction={
        <div className='flex items-center gap-2'>
          <StatusBadge tone={stageTone(stage)}>{stage.name}</StatusBadge>
          {canEdit && (
            <EditDealButton
              deal={{
                id: deal.id,
                title: deal.title,
                valueCents: deal.valueCents,
                serviceType: deal.serviceType,
                expectedClose: deal.expectedClose,
                source: deal.source,
                ownerId: deal.ownerId,
                stageId: deal.stageId,
                lostReason: deal.lostReason
              }}
              stages={stages.map((s) => ({ id: s.id, name: s.name, isLost: s.isLost }))}
              members={members.map((m) => ({ id: m.id, label: label(m) }))}
            />
          )}
        </div>
      }
    >
      <div className='grid gap-4 lg:grid-cols-3'>
        <div className='flex flex-col gap-4 lg:col-span-2'>
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className='grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2'>
                <Item label='Value' value={formatCents(deal.valueCents)} tabular />
                <Item label='Stage' value={stage.name} />
                <Item label='Service type' value={deal.serviceType} />
                <Item
                  label='Expected close'
                  value={deal.expectedClose ? day(deal.expectedClose) : null}
                />
                <Item label='Lead source' value={deal.source} />
                <Item label='Owner' value={owner ? label(owner) : null} />
                {stage.isLost && <Item label='Lost reason' value={deal.lostReason} />}
                {deal.wonAt && <Item label='Won' value={when(deal.wonAt)} />}
                {deal.lostAt && <Item label='Lost' value={when(deal.lostAt)} />}
                <Item label='Added' value={when(deal.createdAt)} />
              </dl>
            </CardContent>
          </Card>

          <Card aria-labelledby='section-timeline'>
            <CardHeader>
              <CardTitle id='section-timeline'>Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <EmptyState
                title='No activity yet'
                description='Stage changes, calls, texts and notes on this deal will show here.'
              />
            </CardContent>
          </Card>
        </div>

        <Card className='h-fit' aria-labelledby='section-people'>
          <CardHeader>
            <CardTitle id='section-people'>People</CardTitle>
          </CardHeader>
          <CardContent>
            {contacts.length ? (
              <ul className='flex flex-col gap-3 text-sm'>
                {contacts.map((c) => (
                  <li key={c.contactId} className='flex flex-col'>
                    <Link
                      href={`/dashboard/contacts/${c.contactId}`}
                      className='text-primary-text underline-offset-4 hover:underline'
                    >
                      {c.name}
                    </Link>
                    <span className='text-muted-foreground'>{ROLE_LABEL[c.role] ?? c.role}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title='No one linked' description='People on this job will show here.' />
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}

function Item({
  label,
  value,
  tabular
}: {
  label: string;
  value?: string | null;
  tabular?: boolean;
}) {
  return (
    <div>
      <dt className='text-muted-foreground'>{label}</dt>
      <dd className={`mt-0.5${tabular ? ' tabular-nums' : ''}`}>
        {value || <span className='text-muted-foreground'>Not set</span>}
      </dd>
    </div>
  );
}
