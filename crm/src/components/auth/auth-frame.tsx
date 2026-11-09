import { Wordmark } from '@/components/brand/wordmark';
import { ThemeModeToggle } from '@/components/themes/theme-mode-toggle';
import type { ReactNode } from 'react';

/** Shared card for sign-in, sign-up, recovery and profile. The tenant is not known yet. */
export function AuthFrame({
  title,
  lede,
  children
}: {
  title: string;
  lede: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className='bg-background relative flex min-h-svh flex-col items-center justify-center px-4 py-10'>
      <div className='absolute top-4 right-4'>
        <ThemeModeToggle />
      </div>
      <div className='w-full max-w-sm'>
        <Wordmark className='mb-8' />
        <div className='bg-card rounded-xl border p-6 sm:p-8'>
          <h1 className='font-display text-[28px]/8 font-semibold sm:text-[32px]/9'>{title}</h1>
          <div className='text-muted-foreground mt-1 mb-6 space-y-2 text-sm'>{lede}</div>
          {children}
        </div>
        <p className='text-muted-foreground mt-6 text-center text-xs'>Kynetic AI</p>
      </div>
    </main>
  );
}
