import PageContainer from '@/components/layout/page-container';
import { contactFacets, contactsScope, searchContacts } from '@/server/contacts';
import { listFieldDefs } from '@/server/custom-fields';
import { isModuleEnabled } from '@/server/modules';
import { ContactsTable } from '@/features/contacts/list/contacts-table';
import {
  isFiltered,
  readListView,
  type RawSearchParams
} from '@/features/contacts/list/search-params';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Leads' };

// Leads list (M1-02, PRD F-05). Base portal: platform, not behind the crm module (PRD decision 1).
export default async function ContactsPage({
  searchParams
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const ctx = await contactsScope(await headers());
  if (!ctx) {
    return (
      <PageContainer pageTitle='Leads' access={false}>
        {null}
      </PageContainer>
    );
  }
  const canWrite = (await contactsScope(await headers(), 'tenant_data.write')) !== null;
  // Custom fields are CRM Full (F-12); the base portal and Lite show the list without them.
  const customFields = (await isModuleEnabled(ctx, 'crm', { level: 'full' }))
    ? await listFieldDefs(ctx, 'contact')
    : [];
  const { hidden, ...view } = readListView(await searchParams, customFields);
  const [result, facets] = await Promise.all([searchContacts(ctx, view), contactFacets(ctx)]);
  return (
    <PageContainer
      pageTitle='Leads'
      pageDescription='Every contact in your CRM. Search, filter and share the view by its link.'
    >
      <ContactsTable
        rows={result.rows}
        total={result.total}
        pageCount={result.pageCount}
        perPage={result.perPage}
        facets={facets}
        customFields={customFields}
        hidden={hidden}
        filtered={isFiltered({ hidden, ...view })}
        canWrite={canWrite}
      />
    </PageContainer>
  );
}
