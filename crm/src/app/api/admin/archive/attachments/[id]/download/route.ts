import { NextResponse } from 'next/server';
import { isViewingAs } from '@/app/admin/view-as-guard';
import { decideAdminAccess } from '@/server/admin';
import { getArchiveAttachmentUrl } from '@/server/archive';
import { AppError } from '@/server/errors';
import { withApi } from '@/server/security/with-api';

export const dynamic = 'force-dynamic';

/** Staff only. Redirects to a short-lived signed link; the link itself is never stored. */
export const GET = withApi(async (request, { params }: { params: Promise<{ id: string }> }) => {
  const access = await decideAdminAccess(request.headers);
  if (access.kind === 'sign_in') throw new AppError('UNAUTHENTICATED');
  if (access.kind !== 'ok' || (await isViewingAs(access.user))) throw new AppError('FORBIDDEN');
  const { id } = await params;
  const { url } = await getArchiveAttachmentUrl({ userId: access.user.id, role: access.role }, id);
  return NextResponse.redirect(url, { status: 302 });
});
