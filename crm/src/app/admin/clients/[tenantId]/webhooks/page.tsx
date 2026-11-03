import { headers } from 'next/headers';
import { forbidden, notFound } from 'next/navigation';
import PageContainer from '@/components/layout/page-container';
import { decideAdminAccess } from '@/server/admin';
import { getLeadWebhookSettings } from '@/server/admin/lead-webhooks';
import { getEnv } from '@/server/env';
import { AppError } from '@/server/errors';
import { isViewingAs } from '../../../view-as-guard';
import { SecretPanel } from './secret-panel';

export const dynamic = 'force-dynamic';

export default async function LeadWebhookPage({
  params
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok' || access.role !== 'admin') forbidden();
  if (await isViewingAs(access.user)) forbidden();
  const { tenantId } = await params;
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
    </PageContainer>
  );
}
