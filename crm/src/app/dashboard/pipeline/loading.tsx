import PageContainer from '@/components/layout/page-container';

export default function PipelineLoading() {
  return (
    <PageContainer pageTitle='Pipeline'>
      <div
        role='status'
        aria-label='Loading pipeline'
        className='flex animate-pulse gap-4 motion-reduce:animate-none'
      >
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className='bg-muted h-64 w-72 shrink-0 rounded-lg' />
        ))}
      </div>
    </PageContainer>
  );
}
