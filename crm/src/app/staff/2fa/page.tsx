import { AuthFrame } from '@/components/auth/auth-frame';
import { safeNextPath } from '@/lib/return-path';
import { requireUser, UnauthenticatedError } from '@/server/auth';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { TwoFactorForm } from './two-factor-form';

export const metadata: Metadata = { title: 'Two-factor sign-in', robots: { index: false } };
export const dynamic = 'force-dynamic';

// The only page a staff session can reach until it has passed TOTP (F-98).
export default async function StaffTwoFactorPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const nextPath = safeNextPath((await searchParams).next);
  let state: 'enrol' | 'challenge';
  try {
    const user = await requireUser(await headers(), { allowPendingSecondFactor: true });
    if (user.twoFactor !== 'enrol' && user.twoFactor !== 'challenge')
      redirect(nextPath ?? '/dashboard');
    state = user.twoFactor;
  } catch (e) {
    if (e instanceof UnauthenticatedError) redirect('/sign-in');
    throw e;
  }
  return (
    <AuthFrame
      title={state === 'enrol' ? 'Set up your authenticator' : 'Enter your authenticator code'}
      lede={
        state === 'enrol'
          ? 'Scan the QR code. Backup codes are not used.'
          : 'Enter the 6-digit code from your authenticator app.'
      }
    >
      <TwoFactorForm state={state} nextPath={nextPath} />
    </AuthFrame>
  );
}
