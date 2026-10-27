'use client';

import { ErrorState } from '@/components/ui/states';

export default function DealError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState message='This deal could not be loaded.' reference={error.digest} onRetry={reset} />
  );
}
