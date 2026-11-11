import PageContainer from '@/components/layout/page-container';
export default function Loading() {
  return (
    <PageContainer pageTitle='Usage'>
      <p role='status' aria-busy='true'>
        Loading usage…
      </p>
    </PageContainer>
  );
}
