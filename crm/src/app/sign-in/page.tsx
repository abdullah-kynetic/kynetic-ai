import { SignInForm } from '@/components/auth/sign-in-form';
import { Wordmark } from '@/components/brand/wordmark';
import { ThemeModeToggle } from '@/components/themes/theme-mode-toggle';
import { getEnv } from '@/server/env';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Sign in' };
// Reads the environment per request; nothing here is known at build time.
export const dynamic = 'force-dynamic';

const ERRORS: Record<string, string> = {
  link: 'That sign-in link did not work. It may have expired or been used already. Request a new one.',
  google: 'We could not sign you in with Google. If you were invited, use the email link instead.'
};

export default async function SignInPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const env = getEnv();
  // The tenant is not known before sign-in, so this page is Kynetic-branded (DESIGN_SYSTEM).
  return (
    <main className='bg-background relative flex min-h-svh flex-col items-center justify-center px-4 py-10'>
      <div className='absolute top-4 right-4'>
        <ThemeModeToggle />
      </div>
      <div className='w-full max-w-sm'>
        <Wordmark className='mb-8' />
        <div className='bg-card rounded-xl border p-6 sm:p-8'>
          <h1 className='font-display text-[28px]/8 font-semibold sm:text-[32px]/9'>Sign in</h1>
          <p className='text-muted-foreground mt-1 mb-6 text-sm'>
            Open your Kynetic portal. Access is by invitation.
          </p>
          {error && ERRORS[error] && (
            <p role='alert' className='text-destructive mb-4 text-sm'>
              {ERRORS[error]}
            </p>
          )}
          <SignInForm googleEnabled={Boolean(env.GOOGLE_CLIENT_ID)} />
        </div>
        <p className='text-muted-foreground mt-6 text-center text-xs'>Kynetic AI</p>
      </div>
    </main>
  );
}
