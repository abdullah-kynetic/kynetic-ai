import { NextResponse } from 'next/server';
import { decideAdminAccess } from '@/server/admin';
import { resolveActor } from '@/server/auth';
import { AppError } from '@/server/errors';
import { commitContactBatch } from '@/server/imports';
import { withApi } from '@/server/security/with-api';
import { isViewingAs } from '@/app/admin/view-as-guard';

export const dynamic = 'force-dynamic';

export const POST = withApi(
  async (request, { params }: { params: Promise<{ batchId: string }> }) => {
    const access = await decideAdminAccess(request.headers);
    if (access.kind !== 'ok' || access.role !== 'admin' || (await isViewingAs(access.user)))
      throw new AppError('FORBIDDEN');
    const { batchId } = await params;
    const body = await request.json();
    const tenantId = typeof body.tenantId === 'string' ? body.tenantId : '';
    const actor = await resolveActor(access.user);
    const result = await commitContactBatch(
      { tenantId, userId: access.user.id, role: 'admin' },
      actor,
      batchId
    );
    return NextResponse.json({ ok: true, result });
  }
);
