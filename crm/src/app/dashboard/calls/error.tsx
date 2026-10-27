'use client';

import { ErrorState } from '@/components/ui/states';

export default function CallsError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      message="Alex's calls could not be loaded."
      reference={error.digest}
      onRetry={reset}
    />
  );
}
