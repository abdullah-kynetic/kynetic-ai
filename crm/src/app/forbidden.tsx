import Link from 'next/link';

// Rendered with status 403 when a page calls forbidden(): a module that is off for the tenant, or a
// role that may not open the page. Nothing here says which; the server already refused.
export default function Forbidden() {
  return (
    <main
      id='main-content'
      className='flex min-h-svh flex-col items-center justify-center gap-3 px-4 text-center'
    >
      <h1 className='font-display text-[28px]/8 font-semibold'>
        You do not have access to this page
      </h1>
      <p className='text-muted-foreground max-w-md text-sm'>
        It may not be part of your plan. Ask the owner of your account, or contact Kynetic AI.
      </p>
      <Link href='/dashboard' className='text-primary-text text-sm underline underline-offset-4'>
        Back to your dashboard
      </Link>
    </main>
  );
}
