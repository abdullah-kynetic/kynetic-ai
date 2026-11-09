import { AuthFrame } from '@/components/auth/auth-frame';
import { SignInForm } from '@/components/auth/sign-in-form';
import { getEnv } from '@/server/env';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Sign up' };
export const dynamic = 'force-dynamic';

export default async function SignUpPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const env = getEnv();
  return (
    <AuthFrame
      title='Sign up'
      lede={
        <>
          <p>Sign up is for someone who was invited. Enter that email and we will send a code.</p>
          <p>
            If you were not invited, no account is created. Ask the person who invited you, or your
            Kynetic contact, for access.
          </p>
        </>
      }
    >
      {error === 'google' && (
        <p role='alert' className='text-destructive mb-4 text-sm'>
          We could not continue with Google. Use the invited email instead, or try Google again.
        </p>
      )}
      <SignInForm googleEnabled={Boolean(env.GOOGLE_CLIENT_ID)} mode='signup' />
    </AuthFrame>
  );
}
