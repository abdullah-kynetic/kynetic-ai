import { AuthFrame } from '@/components/auth/auth-frame';
import { SignInForm } from '@/components/auth/sign-in-form';
import { safeNextPath } from '@/lib/return-path';
import { getEnv } from '@/server/env';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Log in' };
export const dynamic = 'force-dynamic';

const ERRORS: Record<string, string> = {
  link: 'That sign-in link did not work. It may have expired or been used already. Request a code instead.',
  google:
    'We could not sign you in with Google. If you were invited as a client, use the email code instead.'
};

export default async function SignInPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const env = getEnv();
  const nextPath = safeNextPath(next);
  return (
    <AuthFrame
      title='Log in'
      lede='For people who already have access. Enter a one-time email code. Kynetic staff use Google, or an email code when the portal allows it.'
    >
      {error && ERRORS[error] && (
        <p role='alert' className='text-destructive mb-4 text-sm'>
          {ERRORS[error]}
        </p>
      )}
      <SignInForm googleEnabled={Boolean(env.GOOGLE_CLIENT_ID)} mode='login' nextPath={nextPath} />
    </AuthFrame>
  );
}
