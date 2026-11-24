import Link from 'next/link';

// Rendered with status 403 when a page calls forbidden(): a module that is off for the tenant, or a
// role that may not open the page. Nothing here says which; the server already refused.
export default function Forbidden() {
  return (
    <main
      id='main-content'
      className='bg-background flex min-h-svh flex-col items-center justify-center px-4 py-10 text-center'
    >
      <div className='bg-card w-full max-w-sm rounded-[var(--radius-card)] border p-5 sm:p-8'>
        <p className='text-muted-foreground text-sm font-medium'>Error 403</p>
        <h1 className='mt-1 text-[28px]/[1.15] font-medium tracking-[-0.01em]'>
          You do not have access to this page
        </h1>
        <p className='text-muted-foreground mt-2 text-[15px]'>
          It may not be part of your plan. Ask the owner of your account, or contact Kynetic AI.
        </p>
        <Link
          href='/dashboard'
          className='text-primary-text mt-4 inline-flex min-h-11 items-center text-sm underline underline-offset-4'
        >
          Back to your dashboard
        </Link>
      </div>
    </main>
  );
}
