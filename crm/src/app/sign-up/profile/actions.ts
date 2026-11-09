'use server';

import { requireUser, UnauthenticatedError } from '@/server/auth';
import { getAuthDb } from '@/server/db/client';
import { users } from '@/server/db/schema';
import { nameSchema } from '@/server/validation';
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export async function saveProfileName(
  formData: FormData
): Promise<{ ok: false; message: string } | undefined> {
  let user;
  try {
    user = await requireUser(await headers(), { allowPendingSecondFactor: true });
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect('/sign-in');
    throw err;
  }
  const parsed = nameSchema.safeParse(formData.get('name'));
  if (!parsed.success) return { ok: false, message: 'Enter your name to continue.' };
  await getAuthDb()
    .update(users)
    .set({ name: parsed.data, updatedAt: new Date() })
    .where(eq(users.id, user.id));
  redirect('/dashboard');
}
