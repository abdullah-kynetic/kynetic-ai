import { AuthFrame } from '@/components/auth/auth-frame';
import { SignInForm } from '@/components/auth/sign-in-form';
import { getEnv } from '@/server/env';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: "Can't sign in" };
export const dynamic = 'force-dynamic';

export default async function CantSignInPage() {
  const env = getEnv();
  return (
    <AuthFrame
      title="Can't sign in?"
      lede={
        <>
          <p>
            Clients sign in with a one-time code, so recovery is a new code. Check spam, then send
            it again. Codes expire in 10 minutes and work once. There is no password.
          </p>
          <p>
            Kynetic admins and VAs use Google plus an authenticator app. There are no backup codes.
            Another admin can reset your authenticator from Users. That signs you out and lets you
            scan a new QR code. If you are the only admin, the emergency reset is a database-owner
            script in the repo. It writes an audit row and does not create a password.
          </p>
        </>
      }
    >
      <SignInForm googleEnabled={Boolean(env.GOOGLE_CLIENT_ID)} mode='help' />
      <p className='text-muted-foreground mt-6 text-center text-sm'>
        <Link className='underline' href='/sign-in'>
          Back to log in
        </Link>
      </p>
    </AuthFrame>
  );
}
