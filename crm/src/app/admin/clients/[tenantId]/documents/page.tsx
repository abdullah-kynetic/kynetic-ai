import { headers } from 'next/headers';
import { forbidden } from 'next/navigation';
import PageContainer from '@/components/layout/page-container';
import { decideAdminAccess } from '@/server/admin';
import { resolveActor } from '@/server/auth';
import { listAdminTenantDocuments } from '@/server/documents';
import { isViewingAs } from '../../../view-as-guard';
import { DocumentList } from './document-list';
import { DocumentUploadForm } from './upload-form';

export const dynamic = 'force-dynamic';

export default async function AdminTenantDocumentsPage({
  params
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok' || access.role !== 'admin' || (await isViewingAs(access.user)))
    forbidden();
  const actor = await resolveActor(access.user, tenantId);
  const documents = await listAdminTenantDocuments(
    { tenantId, userId: access.user.id, role: 'admin' },
    actor
  );
  return (
    <PageContainer
      pageTitle='Client documents'
      pageDescription='Upload a PDF for this client workspace. Delete and replace hide older copies from the client.'
    >
      <DocumentUploadForm tenantId={tenantId} />
      <DocumentList tenantId={tenantId} documents={documents} />
    </PageContainer>
  );
}
