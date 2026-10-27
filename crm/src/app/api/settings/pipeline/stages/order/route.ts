import { NextResponse } from 'next/server';
import { reorderStages, stageScope } from '@/server/deals';
import { withApi } from '@/server/security/with-api';
import { parseJsonBody } from '@/server/validation';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export const PUT = withApi(async (request) => {
  const { ctx, actor } = await stageScope(request.headers);
  const body = await parseJsonBody(request, z.unknown());
  return NextResponse.json({ ok: true, stages: await reorderStages(ctx, actor, body as never) });
});
