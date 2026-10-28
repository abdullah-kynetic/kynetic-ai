import { headers } from 'next/headers';
import { forbidden } from 'next/navigation';
import PageContainer from '@/components/layout/page-container';
import { decideAdminAccess } from '@/server/admin';
import { isViewingAs } from '../../../view-as-guard';
import { DocumentUploadForm } from './upload-form';

export const dynamic = 'force-dynamic';

export default async function AdminTenantDocumentsPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok' || access.role !== 'admin' || await isViewingAs(access.user)) forbidden();
  return <PageContainer pageTitle='Client documents' pageDescription='Upload a PDF for this client workspace.'><DocumentUploadForm tenantId={tenantId} /></PageContainer>;
}
