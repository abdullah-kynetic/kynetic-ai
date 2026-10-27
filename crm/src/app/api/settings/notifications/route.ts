import { NextResponse } from 'next/server';
import { stageScope } from '@/server/deals';
import { listMyPreferences, setMyPreferences } from '@/server/notifications';
import { withApi } from '@/server/security/with-api';
import { parseJsonBody } from '@/server/validation';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export const GET = withApi(async (request) => {
  const { ctx } = await stageScope(request.headers);
  return NextResponse.json({ ok: true, preferences: await listMyPreferences(ctx) });
});

export const PUT = withApi(async (request) => {
  const { ctx } = await stageScope(request.headers);
  const body = await parseJsonBody(request, z.unknown());
  return NextResponse.json({ ok: true, preferences: await setMyPreferences(ctx, body as never) });
});
