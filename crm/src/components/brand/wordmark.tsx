import { cn } from '@/lib/utils';

/** The Kynetic wordmark: ink in the light theme, cream in the dark theme. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, nothing to optimize */}
      <img
        src='/brand/wordmark-ink.svg'
        alt='Kynetic'
        width={190}
        height={27}
        className={cn('h-7 w-auto dark:hidden', className)}
      />
      {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, nothing to optimize */}
      <img
        src='/brand/wordmark-cream.svg'
        alt='Kynetic'
        width={190}
        height={27}
        className={cn('hidden h-7 w-auto dark:block', className)}
      />
    </>
  );
}
