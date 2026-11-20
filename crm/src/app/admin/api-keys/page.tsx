import { headers } from 'next/headers';
import { forbidden } from 'next/navigation';
import { PortalPageContainer as PageContainer } from '@/components/layout/page-container';
import { decideAdminAccess } from '@/server/admin';
import { getServiceApiEnabled, listAdminKeys } from '@/server/admin/admin-api-keys';
import { AppError } from '@/server/errors';
import { isViewingAs } from '../view-as-guard';
import { AdminKeyPanel } from './panel';

export const dynamic = 'force-dynamic';

export default async function AdminApiKeysPage() {
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok' || access.role !== 'admin') forbidden();
  if (await isViewingAs(access.user)) forbidden();
  const caller = { id: access.user.id, kyneticRole: access.role };
  const [keys, enabled] = await Promise.all([
    listAdminKeys(caller),
    getServiceApiEnabled(caller)
  ]).catch((error: unknown) => {
    // Only the portal owner sees this page; any other admin gets a 403.
    if (error instanceof AppError && error.code === 'FORBIDDEN') forbidden();
    throw error;
  });
  return (
    <PageContainer
      pageTitle='API keys'
      pageDescription='Admin keys act for any client through the API and MCP. The secret is shown once and stored as a hash.'
    >
      <AdminKeyPanel keys={keys} enabled={enabled} />
    </PageContainer>
  );
}
