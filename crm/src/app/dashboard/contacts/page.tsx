import PageContainer from '@/components/layout/page-container';
import {
  bulkCapabilities,
  contactFacets,
  contactsActorScope,
  searchContacts
} from '@/server/contacts';
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
  const scope = await contactsActorScope(await headers());
  if (!scope) {
    return (
      <PageContainer pageTitle='Leads' access={false}>
        {null}
      </PageContainer>
    );
  }
  const { ctx, actor } = scope;
  const { hidden, ...view } = readListView(await searchParams);
  const [result, facets, bulk] = await Promise.all([
    searchContacts(ctx, view),
    contactFacets(ctx),
    bulkCapabilities(ctx, actor)
  ]);
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
        hidden={hidden}
        bulk={bulk}
        filtered={isFiltered({ hidden, ...view })}
      />
    </PageContainer>
  );
}
