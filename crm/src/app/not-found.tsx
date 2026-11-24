import Link from 'next/link';
import { Wordmark } from '@/components/brand/wordmark';

// Plain and calm: say what happened, give two ways out. Server-rendered, so nothing waits on scripts.
export default function NotFound() {
  return (
    <main
      id='main-content'
      className='bg-background flex min-h-svh flex-col items-center justify-center gap-6 px-4 py-10 text-center'
    >
      <Wordmark />
      <div className='bg-card w-full max-w-sm rounded-[var(--radius-card)] border p-5 sm:p-8'>
        <p className='text-muted-foreground text-sm font-medium'>Error 404</p>
        <h1 className='mt-1 text-[28px]/[1.15] font-medium tracking-[-0.01em]'>
          This page is missing
        </h1>
        <p className='text-muted-foreground mt-2 text-[15px]'>
          The page may have moved, or the address may be wrong.
        </p>
        <div className='mt-6 grid gap-2'>
          <Link
            href='/dashboard'
            className='bg-primary text-primary-foreground focus-visible:ring-ring inline-flex min-h-11 items-center justify-center rounded-[var(--radius-control)] px-4 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none'
          >
            Back to your dashboard
          </Link>
          <Link
            href='/admin'
            className='text-primary-text inline-flex min-h-11 items-center justify-center text-sm underline underline-offset-4'
          >
            Staff: open Today
          </Link>
        </div>
      </div>
    </main>
  );
}
