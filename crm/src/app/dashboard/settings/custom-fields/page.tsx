import PageContainer from '@/components/layout/page-container';
import { CustomFieldsManager } from '@/features/custom-fields/custom-fields-manager';
import { customFieldsScope, listFieldDefs } from '@/server/custom-fields';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Custom fields' };

// Custom fields settings (M1-06, PRD F-12 and F-43). Open to every client (P1-4); who may edit the
// definitions is the service's rule.
export default async function CustomFieldsPage() {
  const scope = await customFieldsScope(await headers());
  if (!scope) {
    return (
      <PageContainer pageTitle='Custom fields' access={false}>
        {null}
      </PageContainer>
    );
  }
  const defs = await listFieldDefs(scope.ctx);
  return (
    <PageContainer
      pageTitle='Custom fields'
      pageDescription='Add fields that are specific to your business. They show up on every contact, in the list and in filters.'
    >
      <CustomFieldsManager defs={defs} canEdit={scope.canEdit} />
    </PageContainer>
  );
}
