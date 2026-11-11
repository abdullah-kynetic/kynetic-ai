import PageContainer from '@/components/layout/page-container';
export default function Loading() {
  return (
    <PageContainer pageTitle='Reports'>
      <p role='status' aria-busy='true'>
        Loading metrics and charts…
      </p>
    </PageContainer>
  );
}
