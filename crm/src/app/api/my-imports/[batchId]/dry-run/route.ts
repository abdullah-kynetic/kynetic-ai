import { NextResponse } from 'next/server';
import { AppError } from '@/server/errors';
import { dryRunImportBatch } from '@/server/imports';
import { importSelfScope } from '@/server/imports/scope';
import { withApi } from '@/server/security/with-api';

export const dynamic = 'force-dynamic';

// Step of a client's own import (P1-5). The tenant is the caller's own membership; the batch id is
// looked up inside that tenant, so another tenant's batch reads as not found.
export const POST = withApi(
  async (request, { params }: { params: Promise<{ batchId: string }> }) => {
    const scope = await importSelfScope(request.headers);
    if (!scope) throw new AppError('FORBIDDEN');
    const { batchId } = await params;
    const body = await request.json();
    const report = await dryRunImportBatch(scope.ctx, scope.actor, batchId, body.mapping);
    return NextResponse.json({ ok: true, report });
  }
);
