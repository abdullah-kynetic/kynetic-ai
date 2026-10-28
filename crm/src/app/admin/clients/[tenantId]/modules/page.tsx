import PageContainer from '@/components/layout/page-container';
import { decideAdminAccess } from '@/server/admin';
import { AppError } from '@/server/errors';
import { getTenantModules, listModuleHistory } from '@/server/modules/admin';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { forbidden, notFound } from 'next/navigation';
import { ModulesPanel } from './modules-panel';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Modules' };
export const dynamic = 'force-dynamic';

// Per-client module switches and history (F-70, F-85, M8a-06). Admin only: module flags are not a VA right.
export default async function ClientModulesPage({
  params
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok' || access.role !== 'admin') forbidden();
  const actor = { id: access.user.id, kyneticRole: access.role };
  let data: Awaited<ReturnType<typeof getTenantModules>>;
  let history: Awaited<ReturnType<typeof listModuleHistory>>;
  try {
    [data, history] = await Promise.all([
      getTenantModules(actor, tenantId),
      listModuleHistory(actor, tenantId)
    ]);
  } catch (e) {
    if (e instanceof AppError && e.code === 'NOT_FOUND') notFound();
    throw e;
  }
  const { tenant, modules } = data;
  return (
    <PageContainer
      pageTitle={`${tenant.name}: modules`}
      pageDescription='Switch what this client has. A change applies on their next request. Turning a module off keeps its data.'
    >
      {modules.some((module) => module.moduleKey === 'opm' && module.enabled) && <Link href={`/admin/clients/${tenant.id}/presence`} className='text-primary-text mb-4 inline-block underline'>Manage online presence</Link>}
      <ModulesPanel
        tenantId={tenant.id}
        modules={modules}
        history={history.map((h) => ({ ...h, at: h.at.toISOString() }))}
        currentUserId={access.user.id}
      />
    </PageContainer>
  );
}
