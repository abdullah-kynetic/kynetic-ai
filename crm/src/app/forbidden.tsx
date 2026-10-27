import Link from 'next/link';

// Shown with HTTP 403 when a signed-in user opens a page they may not use, such as a client user on
// an admin route (DESIGN_SYSTEM error states: one sentence and a way back).
export default function Forbidden() {
  return (
    <main className='mx-auto flex min-h-svh max-w-md flex-col justify-center gap-4 p-6 text-center'>
      <h1 className='font-heading text-2xl font-bold'>You don&apos;t have access to this page</h1>
      <p className='text-muted-foreground text-sm'>
        This page is for the Kynetic team. If you think this is a mistake, ask your Kynetic contact.
      </p>
      <Link href='/dashboard' className='text-primary text-sm font-medium underline'>
        Back to home
      </Link>
    </main>
  );
}
