import { headers } from 'next/headers';
import { forbidden } from 'next/navigation';
import PageContainer from '@/components/layout/page-container';
import { decideAdminAccess } from '@/server/admin';
import { resolveActor } from '@/server/auth';
import { listImportBatches } from '@/server/imports';
import { isViewingAs } from '../../../view-as-guard';
import { ImportPanel } from './panel';

export const dynamic = 'force-dynamic';

export default async function AdminImportsPage({
  params
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok' || access.role !== 'admin' || (await isViewingAs(access.user)))
    forbidden();
  const ctx = { tenantId, userId: access.user.id, role: 'admin' as const };
  const actor = await resolveActor(access.user);
  const batches = await listImportBatches(ctx, actor);
  return (
    <PageContainer
      pageTitle='Imports'
      pageDescription='Import contacts, companies, deals and notes into this client workspace.'
    >
      <ImportPanel
        tenantId={tenantId}
        batches={batches.map((batch) => ({
          id: batch.id,
          fileName: batch.fileName,
          importedSource: batch.importedSource,
          status: batch.status,
          rowsTotal: batch.rowsTotal,
          rowsOk: batch.rowsOk,
          rowsFailed: batch.rowsFailed,
          rowsDuplicate: batch.rowsDuplicate,
          report: batch.report
        }))}
      />
    </PageContainer>
  );
}
