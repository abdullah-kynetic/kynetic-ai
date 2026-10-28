import PageContainer from '@/components/layout/page-container';
import {
  bulkCapabilities,
  contactFacets,
  contactsActorScope,
  contactsScope,
  searchContacts
} from '@/server/contacts';
import { listFieldDefs } from '@/server/custom-fields';
import { isModuleEnabled } from '@/server/modules';
import { ContactsTable } from '@/features/contacts/list/contacts-table';
import {
  isFiltered,
  readListView,
  type RawSearchParams
} from '@/features/contacts/list/search-params';
import { headers } from 'next/headers';
import { can } from '@/server/auth/permissions';
import { Button } from '@/components/ui/button';

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
  const canWrite = (await contactsScope(await headers(), 'tenant_data.write')) !== null;
  // Custom fields are CRM Full (F-12); the base portal and Lite show the list without them.
  const customFields = (await isModuleEnabled(ctx, 'crm', { level: 'full' }))
    ? await listFieldDefs(ctx, 'contact')
    : [];
  const { hidden, ...view } = readListView(await searchParams, customFields);
  const exportEnabled =
    can(actor, 'export.csv', ctx.tenantId) &&
    (await isModuleEnabled(ctx, 'crm', { level: 'full' }));
  const exportParams = new URLSearchParams();
  if (view.q) exportParams.set('q', view.q);
  for (const status of view.statuses ?? []) exportParams.append('status', status);
  for (const source of view.sources ?? []) exportParams.append('source', source);
  for (const tag of view.tags ?? []) exportParams.append('tag', tag);
  for (const owner of view.owners ?? []) exportParams.append('owner', owner);
  if (view.createdFrom) exportParams.set('createdFrom', view.createdFrom);
  if (view.createdTo) exportParams.set('createdTo', view.createdTo);
  if (view.custom) exportParams.set('custom', JSON.stringify(view.custom));
  const [result, facets, bulk] = await Promise.all([
    searchContacts(ctx, view),
    contactFacets(ctx),
    bulkCapabilities(ctx, actor)
  ]);
  return (
    <PageContainer
      pageTitle='Leads'
      pageDescription='Every contact in your CRM. Search, filter and share the view by its link.'
      pageHeaderAction={
        exportEnabled ? (
          <Button
            render={<a href={`/api/contacts/export?${exportParams}`} download />}
            variant='outline'
          >
            Export CSV
          </Button>
        ) : undefined
      }
    >
      <ContactsTable
        rows={result.rows}
        total={result.total}
        pageCount={result.pageCount}
        perPage={result.perPage}
        facets={facets}
        customFields={customFields}
        hidden={hidden}
        bulk={bulk}
        filtered={isFiltered({ hidden, ...view })}
        canWrite={canWrite}
      />
    </PageContainer>
  );
}
