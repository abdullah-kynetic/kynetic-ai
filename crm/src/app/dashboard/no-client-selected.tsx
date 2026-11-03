import Link from 'next/link';
import PageContainer from '@/components/layout/page-container';

/**
 * Kynetic staff who are not inside a client have no tenant, so every client page would error. Show
 * the way in instead.
 */
export function NoClientSelected() {
  return (
    <PageContainer
      pageTitle='Pick a client'
      pageDescription='Client pages show one client at a time.'
    >
      <p className='mb-4'>
        You are signed in as Kynetic staff, not inside a client. Choose a client to see their
        portal.
      </p>
      <Link href='/admin/view-as' className='inline-flex min-h-11 items-center underline'>
        View as a client
      </Link>
    </PageContainer>
  );
}
