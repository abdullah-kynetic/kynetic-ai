import { NextResponse } from 'next/server';
import { isViewingAs } from '@/app/admin/view-as-guard';
import { decideAdminAccess } from '@/server/admin';
import { resolveActor } from '@/server/auth';
import { replaceTenantDocument } from '@/server/documents';
import { AppError } from '@/server/errors';
import { withApi } from '@/server/security/with-api';

export const dynamic = 'force-dynamic';

export const POST = withApi(
  async (request, { params }: { params: Promise<{ tenantId: string; documentId: string }> }) => {
    const access = await decideAdminAccess(request.headers);
    if (access.kind !== 'ok' || access.role !== 'admin' || (await isViewingAs(access.user)))
      throw new AppError('FORBIDDEN');
    const { tenantId, documentId } = await params;
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File))
      throw new AppError('VALIDATION_FAILED', { message: 'A PDF file is required.' });
    const actor = await resolveActor(access.user, tenantId);
    const document = await replaceTenantDocument(
      { tenantId, userId: access.user.id, role: 'admin' },
      actor,
      documentId,
      {
        title: String(form.get('title') ?? ''),
        kind: String(form.get('kind') ?? 'other'),
        fileName: file.name
      },
      new Uint8Array(await file.arrayBuffer())
    );
    return NextResponse.json({ ok: true, document });
  }
);
