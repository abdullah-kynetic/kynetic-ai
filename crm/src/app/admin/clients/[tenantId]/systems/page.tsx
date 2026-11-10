import PageContainer from '@/components/layout/page-container';
import { decideAdminAccess } from '@/server/admin';
import { AppError } from '@/server/errors';
import { listModuleHistory } from '@/server/modules/admin';
import {
  listTenantAutomationSettings,
  listTenantModuleConfig
} from '@/server/admin/system-settings';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { forbidden, notFound } from 'next/navigation';
import { SystemsPanel } from './systems-panel';

export const metadata: Metadata = { title: 'Systems' };
export const dynamic = 'force-dynamic';

export default async function ClientSystemsPage({
  params
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok' || access.role !== 'admin') forbidden();
  const actor = { id: access.user.id, kyneticRole: access.role };
  let data: Awaited<ReturnType<typeof listTenantModuleConfig>>;
  let history: Awaited<ReturnType<typeof listModuleHistory>>;
  let automations: Awaited<ReturnType<typeof listTenantAutomationSettings>>;
  try {
    [data, history, automations] = await Promise.all([
      listTenantModuleConfig(actor, tenantId),
      listModuleHistory(actor, tenantId),
      listTenantAutomationSettings(actor, tenantId)
    ]);
  } catch (error) {
    if (error instanceof AppError && error.code === 'NOT_FOUND') notFound();
    throw error;
  }
  return (
    <PageContainer
      pageTitle={`${data.tenant.name}: systems`}
      pageDescription='Turn each system on or off, and set the options that are defined for it. A change applies on the client’s next request. Turning a system off keeps its data.'
    >
      <SystemsPanel
        tenantId={data.tenant.id}
        modules={data.modules.map((module) => ({
          ...module,
          level: module.level === 'lite' || module.level === 'full' ? module.level : null
        }))}
        automations={automations}
        history={history.map((row) => ({ ...row, at: row.at.toISOString() }))}
        currentUserId={access.user.id}
      />
    </PageContainer>
  );
}
