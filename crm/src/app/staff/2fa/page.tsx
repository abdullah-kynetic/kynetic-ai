import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireUser, UnauthenticatedError } from '@/server/auth';
import { TwoFactorForm } from './two-factor-form';

export const metadata: Metadata = { title: 'Two-factor sign-in', robots: { index: false } };
export const dynamic = 'force-dynamic';

// The only page a staff session can reach until it has passed TOTP (F-98).
export default async function StaffTwoFactorPage() {
  let state: 'enrol' | 'challenge';
  try {
    const user = await requireUser(await headers(), { allowPendingSecondFactor: true });
    if (user.twoFactor !== 'enrol' && user.twoFactor !== 'challenge') redirect('/dashboard');
    state = user.twoFactor;
  } catch (e) {
    if (e instanceof UnauthenticatedError) redirect('/');
    throw e;
  }
  return (
    <main className='mx-auto flex min-h-svh max-w-md flex-col justify-center gap-6 p-6'>
      <h1 className='text-xl font-semibold'>
        {state === 'enrol' ? 'Set up two-factor sign-in' : 'Enter your code'}
      </h1>
      <TwoFactorForm state={state} />
    </main>
  );
}
