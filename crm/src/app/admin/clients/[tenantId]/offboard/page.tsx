import { headers } from 'next/headers';
import Link from 'next/link';
import { forbidden, notFound } from 'next/navigation';
import PageContainer from '@/components/layout/page-container';
import { decideAdminAccess, listTenantExports } from '@/server/admin';
import { loadClientOverview } from '@/server/admin/client-overview';
import { AppError } from '@/server/errors';
import { isViewingAs } from '../../../view-as-guard';
import { offboardTenantAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function OffboardPage({
  params,
  searchParams
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ done?: string; error?: string }>;
}) {
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok' || access.role !== 'admin') forbidden();
  if (await isViewingAs(access.user)) forbidden();
  const [{ tenantId }, query] = await Promise.all([params, searchParams]);
  let overview: Awaited<ReturnType<typeof loadClientOverview>>;
  try {
    overview = await loadClientOverview({ id: access.user.id, kyneticRole: access.role }, tenantId);
  } catch (error) {
    if (error instanceof AppError && error.code === 'NOT_FOUND') notFound();
    throw error;
  }
  const exports = await listTenantExports(
    { userId: access.user.id, role: 'admin' },
    tenantId
  ).catch((error: unknown) => {
    if (error instanceof AppError && error.code === 'NOT_FOUND') return [];
    throw error;
  });
  const tenant = overview.tenant;
  return (
    <PageContainer
      pageTitle={`Offboard ${tenant.name}`}
      pageDescription='Stops calls and texts, suspends the client, and prepares a download of their records. Nothing is deleted automatically.'
    >
      <p>
        <Link className='underline' href={`/admin/clients/${tenant.id}`}>
          Back to {tenant.name}
        </Link>
      </p>
      {query.done && (
        <p role='status'>
          Offboarding is recorded. Deletion due {tenant.deletionDueOn ?? 'in 30 days'} is a date to
          follow in the runbook. The export is queued.
        </p>
      )}
      {query.error === 'slug' && (
        <p role='alert'>Type the client slug exactly. Nothing was changed.</p>
      )}
      {query.error === 'failed' && <p role='alert'>Offboarding could not be saved.</p>}
      {tenant.offboardedAt ? (
        <p>
          Already offboarded on {tenant.offboardedAt}. Deletion due {tenant.deletionDueOn}. Running
          this again does not move that date.
        </p>
      ) : (
        <p>
          This client is {tenant.status}. Type the slug {tenant.slug} to confirm.
        </p>
      )}
      <form
        action={offboardTenantAction.bind(null, tenant.id)}
        className='mt-4 grid max-w-md gap-3'
      >
        <label className='grid gap-1'>
          Client slug
          <input className='min-h-11 rounded border px-3' name='slug' required autoComplete='off' />
        </label>
        <button className='min-h-11 rounded border px-3' type='submit'>
          Offboard client
        </button>
      </form>
      <section className='mt-8' aria-labelledby='exports-heading'>
        <h2 id='exports-heading' className='text-lg font-semibold'>
          Record export
        </h2>
        {exports.length === 0 ? (
          <p>No export yet.</p>
        ) : (
          <ul className='divide-y rounded border'>
            {exports.map((row) => (
              <li key={row.id} className='p-3'>
                {row.status} · {row.createdAt}
                {row.error ? ` · ${row.error}` : ''}
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageContainer>
  );
}
