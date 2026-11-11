import PageContainer from '@/components/layout/page-container';
export default function Loading() {
  return (
    <PageContainer pageTitle='Reviews'>
      <p role='status' aria-busy='true'>
        Loading reviews…
      </p>
    </PageContainer>
  );
}
