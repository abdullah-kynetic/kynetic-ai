'use client';

import { ErrorState } from '@/components/ui/states';

export default function ContactError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      message='This contact could not be loaded.'
      reference={error.digest}
      onRetry={reset}
    />
  );
}
