import { NextResponse } from 'next/server';
import { isViewingAs } from '@/app/admin/view-as-guard';
import { decideAdminAccess } from '@/server/admin';
import { resolveActor } from '@/server/auth';
import { uploadTenantDocument } from '@/server/documents';
import { AppError } from '@/server/errors';
import { withApi } from '@/server/security/with-api';

export const dynamic = 'force-dynamic';

export const POST = withApi(async (request, { params }: { params: Promise<{ tenantId: string }> }) => {
  const access = await decideAdminAccess(request.headers);
  if (access.kind !== 'ok' || access.role !== 'admin' || (await isViewingAs(access.user)))
    throw new AppError('FORBIDDEN');
  const { tenantId } = await params;
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) throw new AppError('VALIDATION_FAILED', { message: 'A PDF file is required.' });
  if (file.size > 10 * 1024 * 1024) throw new AppError('VALIDATION_FAILED', { message: 'PDF exceeds the 10 MB limit.' });
  const actor = await resolveActor(access.user, tenantId);
  const result = await uploadTenantDocument(
    { tenantId, userId: access.user.id, role: 'admin' },
    actor,
    { title: String(form.get('title') ?? ''), kind: String(form.get('kind') ?? ''), fileName: file.name },
    new Uint8Array(await file.arrayBuffer())
  );
  return NextResponse.json({ ok: true, document: result }, { status: 201 });
});
