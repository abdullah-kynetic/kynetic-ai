import { NextResponse } from 'next/server';
import { withApi } from '@/server/security/with-api';
import { listTeam, settingsScope } from '@/server/settings';

export const dynamic = 'force-dynamic';

export const GET = withApi(async (request) => {
  const { ctx, actor } = await settingsScope(request.headers);
  return NextResponse.json({ ok: true, ...(await listTeam(ctx, actor)) });
});
