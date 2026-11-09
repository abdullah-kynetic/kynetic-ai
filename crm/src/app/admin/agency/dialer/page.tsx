import Link from 'next/link';
import { headers } from 'next/headers';
import { forbidden, notFound } from 'next/navigation';
import PageContainer from '@/components/agency/page';
import { AgencySubmitButton as Button } from '@/components/agency/motion';
import { Label } from '@/components/ui/label';
import { decideAdminAccess } from '@/server/admin';
import { getAgencyWorkspace } from '@/server/agency';
import { getAgencyDialer, HUMAN_CALL_OUTCOMES } from '@/server/agency/dialer';
import { listAgencyCampaigns } from '@/server/agency/campaigns';
import { AppError } from '@/server/errors';
import { AgencyWorkspaceMissing } from '../workspace-missing';
import { isViewingAs } from '../../view-as-guard';
import { logAgencyCallAction, markAgencyDncAction } from './actions';
export const dynamic = 'force-dynamic';
export default async function DialerPage({
  searchParams
}: {
  searchParams: Promise<{ campaignId?: string; error?: string }>;
}) {
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok' || access.role !== 'admin') forbidden();
  if (await isViewingAs(access.user)) forbidden();
  const caller = { id: access.user.id, kyneticRole: access.role };
  if (!(await getAgencyWorkspace(caller)))
    return <AgencyWorkspaceMissing pageTitle='Human dialer' />;
  const query = await searchParams;
  const [data, campaigns] = await Promise.all([
    getAgencyDialer(caller, query.campaignId),
    listAgencyCampaigns(caller)
  ]).catch((error: unknown) => {
    if (
      error instanceof AppError &&
      (error.code === 'NOT_FOUND' || error.code === 'VALIDATION_FAILED')
    )
      notFound();
    throw error;
  });
  const next = data.next;
  return (
    <PageContainer
      pageTitle='Human dialer'
      pageDescription='Manual call logging for the synthetic agency workspace.'
    >
      <Link href='/admin/agency' className='mb-4 inline-flex min-h-11 items-center underline'>
        Back to agency workspace
      </Link>
      <p className='mb-4 rounded border p-3'>
        Synthetic test numbers only. This page places no calls. DNC, protected businesses and
        excluded states are filtered and rechecked before saving.
      </p>
      {query.error && (
        <p role='alert' className='mb-4'>
          That lead is no longer available or was already logged. The queue has been refreshed.
        </p>
      )}
      <form className='mb-6 flex flex-wrap items-end gap-3'>
        <div>
          <Label htmlFor='campaignId'>Campaign</Label>
          <select
            id='campaignId'
            name='campaignId'
            defaultValue={query.campaignId ?? ''}
            className='border-input bg-background block min-h-11 rounded border px-3'
          >
            <option value=''>All eligible leads</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <Button type='submit' variant='outline'>
          Apply
        </Button>
      </form>
      <p className='mb-4'>
        {data.remaining} eligible · {data.unavailable} unavailable or already logged
      </p>
      {next ? (
        <section className='max-w-3xl space-y-4' aria-labelledby='dialer-next'>
          <h2 id='dialer-next' className='text-xl font-semibold'>
            {next.name}
          </h2>
          <p className='text-lg'>{next.phone}</p>
          <p>DNC check: clear</p>
          <div className='rounded border p-4'>
            <h3 className='mb-2 font-medium'>Draft script — review before use</h3>
            <p className='whitespace-pre-wrap'>{data.script}</p>
          </div>
          <form action={logAgencyCallAction.bind(null, next.id)} className='space-y-3'>
            <input type='hidden' name='eventId' value={crypto.randomUUID()} />
            <div>
              <Label htmlFor='notes'>Notes (optional)</Label>
              <textarea
                id='notes'
                name='notes'
                maxLength={1000}
                className='border-input bg-background mt-2 min-h-24 w-full rounded border p-3'
              />
            </div>
            <div className='flex flex-wrap gap-2'>
              {HUMAN_CALL_OUTCOMES.map((outcome) => (
                <Button
                  key={outcome}
                  type='submit'
                  name='outcome'
                  value={outcome}
                  variant='outline'
                >
                  {outcome.replaceAll('_', ' ')}
                </Button>
              ))}
            </div>
          </form>
          <form action={markAgencyDncAction.bind(null, next.id)}>
            <Button type='submit' variant='outline'>
              Mark DNC without logging a call
            </Button>
          </form>
        </section>
      ) : (
        <p className='mb-6 rounded border p-4'>No eligible leads remain in this queue.</p>
      )}
      <p className='text-muted-foreground mt-6 text-sm'>
        This is a first-pass queue. Logged leads leave it; callback is a recorded outcome and
        schedules no reminder.
      </p>
      <section className='mt-8 space-y-3' aria-labelledby='recent-calls'>
        <h2 id='recent-calls' className='text-lg font-semibold'>
          Recent manual outcomes
        </h2>
        <ul className='space-y-2'>
          {data.history.map((h) => (
            <li key={h.id} className='rounded border p-3'>
              {h.name} · {h.outcome.replaceAll('_', ' ')} ·{' '}
              <time dateTime={h.loggedAt}>{new Date(h.loggedAt).toISOString()}</time>
            </li>
          ))}
        </ul>
      </section>
    </PageContainer>
  );
}
