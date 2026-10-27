import PageContainer from '@/components/layout/page-container';

// Entry point for the admin side. The client table (F-53) and health chips (F-54) arrive in M8b.
export default function AdminHomePage() {
  return (
    <PageContainer
      pageTitle='All clients'
      pageDescription='Every client in one place. The table arrives with the admin dashboard milestone.'
    >
      <p className='text-muted-foreground text-sm'>No clients yet.</p>
    </PageContainer>
  );
}
