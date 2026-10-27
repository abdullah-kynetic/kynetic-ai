import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div role='status' aria-label='Loading calls' className='flex flex-col gap-4 p-4 md:px-6'>
      <Skeleton className='h-8 w-40' />
      <Skeleton className='h-10 w-full max-w-2xl' />
      {Array.from({ length: 10 }, (_, i) => (
        <Skeleton key={i} className='h-11 w-full' />
      ))}
    </div>
  );
}
