import { headers } from 'next/headers';
import { forbidden, notFound } from 'next/navigation';
import PageContainer from '@/components/layout/page-container';
import { decideAdminAccess } from '@/server/admin';
import { listServiceTokens } from '@/server/admin/service-tokens';
import { AppError } from '@/server/errors';
import { isViewingAs } from '../../../view-as-guard';
import { ServiceTokenPanel } from './panel';

export const dynamic = 'force-dynamic';

export default async function ServiceTokensPage({
  params
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok' || access.role !== 'admin') forbidden();
  if (await isViewingAs(access.user)) forbidden();
  const { tenantId } = await params;
  const tokens = await listServiceTokens(
    { id: access.user.id, kyneticRole: access.role },
    tenantId
  ).catch((error: unknown) => {
    if (error instanceof AppError && error.code === 'NOT_FOUND') notFound();
    throw error;
  });
  return (
    <PageContainer
      pageTitle='Service tokens'
      pageDescription='Tokens n8n uses to call this client. The secret is shown once and stored as a hash.'
    >
      <ServiceTokenPanel tenantId={tenantId} tokens={tokens} />
    </PageContainer>
  );
}
