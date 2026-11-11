import PageContainer from '@/components/layout/page-container';
export default function Loading() {
  return (
    <PageContainer pageTitle='Referrals'>
      <p role='status' aria-busy='true'>
        Loading referrals…
      </p>
    </PageContainer>
  );
}
