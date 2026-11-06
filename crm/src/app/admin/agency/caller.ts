import { headers } from 'next/headers';
import { forbidden } from 'next/navigation';
import { decideAdminAccess } from '@/server/admin';
import { isViewingAs } from '../view-as-guard';
export async function agencyCaller() {
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok' || access.role !== 'admin') forbidden();
  if (await isViewingAs(access.user)) forbidden();
  return { id: access.user.id, kyneticRole: access.role };
}
