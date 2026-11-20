import PageContainer from '@/components/agency/page';

/** A useful first-visit state for area tabs when no synthetic records exist. */
export function AgencyWorkspaceMissing({ pageTitle }: { pageTitle: string }) {
  return (
    <PageContainer pageTitle={pageTitle} pageDescription='Ready for your first record.'>
      <p className='text-muted-foreground'>
        Nothing to show here yet. As synthetic prospects and clients are added, their activity will
        appear on this page.
      </p>
    </PageContainer>
  );
}
