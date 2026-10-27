import PageContainer from '@/components/layout/page-container';
import { DataTableSkeleton } from '@/components/data-table/data-table-skeleton';

export default function ContactsLoading() {
  return (
    <PageContainer pageTitle='Leads'>
      <DataTableSkeleton columnCount={7} rowCount={10} filterCount={4} />
    </PageContainer>
  );
}
