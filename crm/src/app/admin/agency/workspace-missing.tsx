import Link from 'next/link';
import PageContainer from '@/components/layout/page-container';

/** Shown instead of an error when the synthetic agency workspace has not been created yet. */
export function AgencyWorkspaceMissing({ pageTitle }: { pageTitle: string }) {
  return (
    <PageContainer pageTitle={pageTitle} pageDescription='Create the agency workspace first.'>
      <p className='mb-4'>
        This page needs the synthetic agency workspace, and it has not been created yet.
      </p>
      <Link href='/admin/agency' className='inline-flex min-h-11 items-center underline'>
        Go to the agency workspace to create it
      </Link>
    </PageContainer>
  );
}
