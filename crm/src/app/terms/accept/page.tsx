import { Button } from '@/components/ui/button';
import { getSessionUser } from '@/server/auth';
import { CURRENT_DOCUMENTS } from '@/server/terms';
import { safeNextPath } from '@/server/terms/gate';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { acceptTermsAction } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Terms and privacy', robots: { index: false, follow: false } };

export default async function AcceptTermsPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const requestHeaders = await headers();
  const user = await getSessionUser(requestHeaders);
  if (!user) redirect('/sign-in');
  const query = await searchParams;
  const next = safeNextPath(query.next);
  return (
    <main className='mx-auto grid max-w-2xl gap-6 px-4 py-10'>
      <h1 className='text-2xl font-semibold'>Terms and privacy</h1>
      <p role='status' className='rounded border p-3 text-sm font-medium'>
        Draft wording. Counsel has not approved this text.
      </p>
      {CURRENT_DOCUMENTS.map((document) => (
        <section key={document.document} aria-labelledby={`doc-${document.document}`}>
          <h2 id={`doc-${document.document}`} className='text-lg font-semibold'>
            {document.title}
          </h2>
          <p className='text-muted-foreground text-xs'>Version {document.version}</p>
          {document.paragraphs.map((paragraph) => (
            <p key={paragraph} className='mt-2 text-sm'>
              {paragraph}
            </p>
          ))}
        </section>
      ))}
      <form action={acceptTermsAction}>
        <input type='hidden' name='next' value={next} />
        <Button type='submit'>I accept</Button>
      </form>
    </main>
  );
}
