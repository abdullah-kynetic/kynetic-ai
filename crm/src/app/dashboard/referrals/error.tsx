'use client';
import { ErrorState } from '@/components/ui/states';
export default function Error({ retry }: { retry: () => void }) {
  return (
    <div className='p-4'>
      <ErrorState message='Referrals could not be loaded.' onRetry={retry} />
    </div>
  );
}
