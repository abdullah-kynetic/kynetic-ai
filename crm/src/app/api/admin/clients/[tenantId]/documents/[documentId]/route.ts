import { NextResponse } from 'next/server';
import { isViewingAs } from '@/app/admin/view-as-guard';
import { decideAdminAccess } from '@/server/admin';
import { resolveActor } from '@/server/auth';
import { deleteTenantDocument } from '@/server/documents';
import { AppError } from '@/server/errors';
import { withApi } from '@/server/security/with-api';

export const dynamic = 'force-dynamic';

export const DELETE = withApi(
  async (request, { params }: { params: Promise<{ tenantId: string; documentId: string }> }) => {
    const access = await decideAdminAccess(request.headers);
    if (access.kind !== 'ok' || access.role !== 'admin' || (await isViewingAs(access.user)))
      throw new AppError('FORBIDDEN');
    const { tenantId, documentId } = await params;
    const actor = await resolveActor(access.user, tenantId);
    await deleteTenantDocument(
      { tenantId, userId: access.user.id, role: 'admin' },
      actor,
      documentId
    );
    return NextResponse.json({ ok: true });
  }
);
