import { NextResponse } from 'next/server';
import { deleteStage, stageScope, updateStage } from '@/server/deals';
import { withApi } from '@/server/security/with-api';
import { parseJsonBody } from '@/server/validation';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ stageId: string }> };

export const PATCH = withApi<Ctx>(async (request, { params }) => {
  const { ctx, actor } = await stageScope(request.headers);
  const { stageId } = await params;
  const body = await parseJsonBody(request, z.unknown());
  return NextResponse.json({
    ok: true,
    stages: await updateStage(ctx, actor, stageId, body as never)
  });
});

/** `?moveTo=<stage id>` names where the stage's deals go; required when it still has deals. */
export const DELETE = withApi<Ctx>(async (request, { params }) => {
  const { ctx, actor } = await stageScope(request.headers);
  const { stageId } = await params;
  const moveToStageId = new URL(request.url).searchParams.get('moveTo') ?? undefined;
  return NextResponse.json({
    ok: true,
    stages: await deleteStage(ctx, actor, stageId, { moveToStageId })
  });
});
