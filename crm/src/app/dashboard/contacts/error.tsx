'use client';

import { ErrorState } from '@/components/ui/states';

export default function ContactsError({ error, retry }: { error: unknown; retry: () => void }) {
  const reference =
    error instanceof Error ? (error as Error & { digest?: string }).digest : undefined;
  return (
    <div className='flex flex-1 flex-col px-4 pt-2 pb-4 md:px-6 md:pt-4'>
      <ErrorState
        message='Your contacts could not be loaded.'
        reference={reference}
        onRetry={retry}
      />
    </div>
  );
}
