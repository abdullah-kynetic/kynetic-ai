import { NextResponse } from 'next/server';
import { withApi } from '@/server/security/with-api';
import { parseJsonBody } from '@/server/validation';
import { z } from 'zod';
import { getBusinessSettings, updateBusinessSettings, settingsScope } from '@/server/settings';

export const dynamic = 'force-dynamic';

export const GET = withApi(async (request) => {
  const { ctx } = await settingsScope(request.headers);
  return NextResponse.json({ ok: true, settings: await getBusinessSettings(ctx) });
});

export const PATCH = withApi(async (request) => {
  const { ctx, actor } = await settingsScope(request.headers);
  const body = await parseJsonBody(request, z.unknown());
  return NextResponse.json({ ok: true, settings: await updateBusinessSettings(ctx, actor, body) });
});
