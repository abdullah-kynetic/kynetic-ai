'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { decideAdminAccess } from '@/server/admin';
import { resolveActor } from '@/server/auth';
import { AppError } from '@/server/errors';
import { savePresenceItem, saveReviewSnapshot, type PresenceItemInput } from '@/server/presence';
import { isViewingAs } from '../../../view-as-guard';

export async function saveItem(form: FormData) {
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok' || access.role !== 'admin' || (await isViewingAs(access.user)))
    throw new AppError('FORBIDDEN');
  const tenantId = String(form.get('tenantId') ?? '');
  const actor = await resolveActor(access.user);
  const input: PresenceItemInput = {
    kind: String(form.get('kind')) as PresenceItemInput['kind'],
    title: String(form.get('title') ?? ''),
    status: String(form.get('status')) as PresenceItemInput['status'],
    notes: String(form.get('notes') ?? '')
  };
  const id = String(form.get('id') ?? '') || undefined;
  await savePresenceItem({ tenantId, userId: access.user.id, role: 'admin' }, actor, input, id);
  revalidatePath(`/admin/clients/${tenantId}/presence`);
}

export async function saveReview(form: FormData) {
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok' || access.role !== 'admin' || (await isViewingAs(access.user)))
    throw new AppError('FORBIDDEN');
  const tenantId = String(form.get('tenantId') ?? '');
  const actor = await resolveActor(access.user);
  const rating = String(form.get('averageRating') ?? '').trim();
  await saveReviewSnapshot({ tenantId, userId: access.user.id, role: 'admin' }, actor, {
    source: String(form.get('source') ?? ''),
    capturedOn: String(form.get('capturedOn') ?? ''),
    reviewCount: Number(form.get('reviewCount')),
    averageRating: rating ? Number(rating) : null
  });
  revalidatePath(`/admin/clients/${tenantId}/presence`);
}
