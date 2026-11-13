import PageContainer from '@/components/layout/page-container';
import { ImportLeads } from '@/features/imports/import-leads';
import { listImportBatches } from '@/server/imports';
import { importSelfScope } from '@/server/imports/scope';
import type { Metadata } from 'next';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Import leads' };

// Client self-serve lead import (P1-5, F-95). Owners of a client workspace only: the scope needs
// `import.self` for the tenant their membership names, so staff users, Kynetic staff and visitors
// without a tenant see the no-access message.
export default async function ImportLeadsPage() {
  const scope = await importSelfScope(await headers());
  if (!scope) {
    return (
      <PageContainer pageTitle='Import leads' access={false}>
        {null}
      </PageContainer>
    );
  }
  const batches = await listImportBatches(scope.ctx, scope.actor);
  return (
    <PageContainer
      pageTitle='Import leads'
      pageDescription='Bring your own lead list in from a CSV or Excel file. You can check it first and undo an import later.'
    >
      <ImportLeads
        history={batches
          .slice(-10)
          .reverse()
          .map((b) => ({
            id: b.id,
            fileName: b.fileName,
            status: b.status,
            rowsTotal: b.rowsTotal,
            rowsOk: b.rowsOk,
            rowsFailed: b.rowsFailed,
            rowsDuplicate: b.rowsDuplicate,
            committedAt: b.committedAt
          }))}
      />
    </PageContainer>
  );
}
