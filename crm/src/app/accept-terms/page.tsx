import { Wordmark } from '@/components/brand/wordmark';
import { getSessionUser } from '@/server/auth';
import { pendingDocuments } from '@/server/terms';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { AcceptForm } from './accept-form';

export const metadata: Metadata = {
  title: 'Terms and Privacy',
  robots: { index: false, follow: false }
};
export const dynamic = 'force-dynamic';

export default async function AcceptTermsPage() {
  const user = await getSessionUser(await headers());
  if (!user) redirect('/sign-in');
  const pending = await pendingDocuments(user.id);
  // Nothing outstanding (already accepted, or opened by hand): back to the portal.
  if (pending.length === 0) redirect('/dashboard');

  return (
    <main className='bg-background flex min-h-svh flex-col items-center px-4 py-10'>
      <div className='w-full max-w-2xl'>
        <Wordmark className='mb-8' />
        <div className='bg-card rounded-xl border p-6 sm:p-8'>
          <h1 className='font-display text-[28px]/8 font-semibold sm:text-[32px]/9'>
            Terms and Privacy
          </h1>
          <p className='text-muted-foreground mt-1 text-sm'>
            Please read and accept to continue to your portal.
          </p>
          {pending.map((doc) => (
            <section key={doc.document} aria-labelledby={`doc-${doc.document}`} className='mt-6'>
              <h2 id={`doc-${doc.document}`} className='text-lg font-semibold'>
                {doc.title}
              </h2>
              <div className='bg-muted/50 mt-2 space-y-3 rounded-md border p-4 text-sm'>
                {doc.paragraphs.map((p) => (
                  <p key={p}>{p}</p>
                ))}
              </div>
            </section>
          ))}
          <AcceptForm />
        </div>
      </div>
    </main>
  );
}
