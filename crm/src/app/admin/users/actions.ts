'use server';

import {
  changeMembershipRole,
  changeStaffRole,
  deactivateUser,
  inviteUser,
  reactivateUser,
  resetClientUser,
  type StaffCaller
} from '@/server/admin';
import { requireUser } from '@/server/auth';
import { AppError } from '@/server/errors';
import { refuseDuringViewAs } from '../view-as-guard';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

// Server actions for /admin/users (F-61). Each one re-reads the signed-in user (role and TOTP state from
// the database) and the service layer authorizes the action. Hiding a button is never the check.

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };

async function caller(): Promise<StaffCaller> {
  const user = await requireUser(await headers());
  await refuseDuringViewAs(user);
  return { id: user.id, kyneticRole: user.kyneticRole };
}

async function run(
  message: string,
  fn: (who: StaffCaller) => Promise<void>
): Promise<ActionResult> {
  try {
    await fn(await caller());
  } catch (err) {
    if (err instanceof AppError) return { ok: false, message: err.message };
    if (err instanceof Error && err.name === 'ForbiddenError')
      return { ok: false, message: 'You do not have access to this.' };
    if (err instanceof Error && err.name === 'UnauthenticatedError')
      return { ok: false, message: 'Sign in to continue.' };
    if (err instanceof Error && err.name === 'SecondFactorRequiredError')
      return { ok: false, message: 'Finish two-factor sign-in to continue.' };
    throw err;
  }
  revalidatePath('/admin/users');
  return { ok: true, message };
}

export async function inviteUserAction(formData: FormData): Promise<ActionResult> {
  const input = {
    tenantId: String(formData.get('tenantId') ?? ''),
    email: String(formData.get('email') ?? ''),
    role: String(formData.get('role') ?? '') as 'owner' | 'staff'
  };
  // No email sender is wired until the notification milestone. The invitation is created and the
  // person can sign in with that address; the result says the email was not sent.
  let delivered = false;
  const result = await run('Invitation created.', async (who) => {
    delivered = (await inviteUser(who, input)).delivered;
  });
  return result.ok && !delivered
    ? {
        ok: true,
        message: 'Invitation created. The invite email is not sent yet from this build.'
      }
    : result;
}

export const deactivateUserAction = async (userId: string) =>
  run('User deactivated and signed out everywhere.', (who) => deactivateUser(who, userId));

export const reactivateUserAction = async (userId: string) =>
  run('User reactivated.', (who) => reactivateUser(who, userId));

export const resetClientUserAction = async (userId: string) =>
  run('User signed out everywhere. They sign in again with Google or a new link.', (who) =>
    resetClientUser(who, userId)
  );

export const changeMembershipRoleAction = async (
  tenantId: string,
  userId: string,
  role: 'owner' | 'staff'
) => run('Role updated.', (who) => changeMembershipRole(who, { tenantId, userId, role }));

export const changeStaffRoleAction = async (userId: string, role: 'admin' | 'va' | null) =>
  run('Kynetic role updated and the person signed out.', (who) =>
    changeStaffRole(who, { userId, role })
  );
