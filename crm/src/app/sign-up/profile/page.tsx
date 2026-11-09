import { AuthFrame } from '@/components/auth/auth-frame';
import { requireUser, UnauthenticatedError } from '@/server/auth';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { ProfileForm } from './profile-form';

export const metadata: Metadata = { title: 'Set up your profile' };
export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  try {
    const user = await requireUser(await headers(), { allowPendingSecondFactor: true });
    if (user.name?.trim()) redirect('/dashboard');
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect('/sign-in');
    throw err;
  }
  return (
    <AuthFrame
      title='Set up your profile'
      lede='This is the name people in your company see. You can change it later in settings.'
    >
      <ProfileForm />
    </AuthFrame>
  );
}
