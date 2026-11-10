import { headers } from 'next/headers';
import { forbidden, notFound } from 'next/navigation';
import PageContainer from '@/components/layout/page-container';
import { decideAdminAccess } from '@/server/admin';
import { getLeadWebhookSettings } from '@/server/admin/lead-webhooks';
import { getEnv } from '@/server/env';
import { AppError } from '@/server/errors';
import { isViewingAs } from '../../../view-as-guard';
import { saveN8nPushAction } from './actions';
import { SecretPanel } from './secret-panel';

export const dynamic = 'force-dynamic';

export default async function LeadWebhookPage({
  params,
  searchParams
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ n8n?: string }>;
}) {
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok' || access.role !== 'admin') forbidden();
  if (await isViewingAs(access.user)) forbidden();
  const [{ tenantId }, query] = await Promise.all([params, searchParams]);
  const settings = await getLeadWebhookSettings(
    { id: access.user.id, kyneticRole: access.role },
    tenantId
  ).catch((error: unknown) => {
    if (error instanceof AppError && error.code === 'NOT_FOUND') notFound();
    throw error;
  });
  const leadUrl = new URL(settings.leadPath, getEnv().APP_BASE_URL).toString();
  return (
    <PageContainer
      pageTitle='Lead webhooks'
      pageDescription='Tenant intake URL and signing secret.'
    >
      <dl className='mb-8 max-w-xl space-y-3'>
        <dt className='font-medium'>Portal lead intake URL</dt>
        <dd className='break-all'>{leadUrl}</dd>
        <dt className='font-medium'>n8n event receiver URL</dt>
        <dd className='break-all'>{settings.n8nUrl ?? 'Not configured'}</dd>
        <dt className='font-medium'>Signing secret</dt>
        <dd>{settings.secret.isSet ? 'Set' : 'Not issued'}</dd>
        <dt className='font-medium'>Last issued or rotated</dt>
        <dd>{settings.secret.rotatedAt ?? 'Never'}</dd>
      </dl>
      <SecretPanel tenantId={tenantId} isSet={settings.secret.isSet} />
      <form action={saveN8nPushAction.bind(null, tenantId)} className='mt-10 grid max-w-xl gap-4'>
        <h2 className='text-lg font-semibold'>n8n event push</h2>
        <p className='text-sm text-muted-foreground'>
          Portal events are signed and posted to this https URL. The signing secret is encrypted and
          is never shown again. Leave the secret blank to keep the current one.
        </p>
        {query.n8n === 'saved' && <p role='status'>n8n push settings saved.</p>}
        {query.n8n === 'invalid' && (
          <p role='alert'>Enter an https URL with no user, password, query, or fragment.</p>
        )}
        {query.n8n === 'forbidden' && <p role='alert'>Only a Kynetic admin can change this.</p>}
        {query.n8n === 'failed' && (
          <p role='alert'>The n8n push settings could not be saved. The secret was not stored.</p>
        )}
        <label className='grid gap-1'>
          n8n webhook URL
          <input
            className='min-h-11 rounded border px-3'
            name='url'
            type='url'
            required
            defaultValue={settings.n8nUrl ?? ''}
            autoComplete='off'
          />
        </label>
        <label className='grid gap-1'>
          Signing secret
          <input
            className='min-h-11 rounded border px-3'
            name='secret'
            type='password'
            autoComplete='new-password'
            placeholder={settings.n8nSecret.isSet ? 'Secret is set' : 'Paste the n8n secret'}
          />
        </label>
        <p>
          Secret: {settings.n8nSecret.isSet ? 'Set' : 'Not set'}
          {settings.n8nSecret.rotatedAt ? ` · Last rotated ${settings.n8nSecret.rotatedAt}` : ''}
        </p>
        <button className='min-h-11 rounded border px-4' type='submit'>
          Save n8n push
        </button>
      </form>
    </PageContainer>
  );
}
