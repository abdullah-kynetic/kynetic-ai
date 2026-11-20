'use client';
import { ErrorState } from '@/components/ui/states';

export default function AdminError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className='mx-auto w-full max-w-[1280px] px-4 py-8 md:px-6'>
      <ErrorState
        message='This page could not be loaded.'
        reference={error.digest}
        onRetry={reset}
      />
    </div>
  );
}
