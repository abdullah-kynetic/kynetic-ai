import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div role='status' aria-label='Loading deal' className='flex flex-col gap-4 p-4 md:px-6'>
      <Skeleton className='h-8 w-56' />
      <Skeleton className='h-40 w-full' />
      <Skeleton className='h-32 w-full' />
    </div>
  );
}
