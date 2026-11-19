import type { ReactNode } from 'react';
import { PageHeader } from '@/components/layout/page-header';

/** Settings-scoped presentation; authorization remains in each route. */
export function SettingsPage({
  children,
  pageTitle,
  pageDescription,
  access = true,
  accessFallback
}: {
  children: ReactNode;
  pageTitle: string;
  pageDescription?: string;
  access?: boolean;
  accessFallback?: ReactNode;
}) {
  if (!access) {
    return (
      <div role='status' className='flex flex-1 items-center justify-center p-4 md:px-6'>
        {accessFallback ?? (
          <p className='text-muted-foreground text-center text-lg'>
            You do not have access to this page.
          </p>
        )}
      </div>
    );
  }
  return (
    <div className='mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-6 px-4 pt-2 pb-8 md:px-6 md:pt-4'>
      <PageHeader title={pageTitle} description={pageDescription} />
      {children}
    </div>
  );
}
