import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div role='status' aria-label='Loading tasks' className='flex flex-col gap-3 p-4 md:px-6'>
      <Skeleton className='h-8 w-40' />
      <Skeleton className='h-12 w-full' />
      <Skeleton className='h-12 w-full' />
      <Skeleton className='h-12 w-full' />
    </div>
  );
}
