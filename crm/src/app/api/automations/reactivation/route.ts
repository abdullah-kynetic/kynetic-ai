import { NextResponse } from 'next/server';
import { launchReactivation, reactivationAudienceSchema } from '@/server/automations';
import { settingsScope } from '@/server/settings';
import { withApi } from '@/server/security/with-api';
import { parseJsonBody } from '@/server/validation';

export const dynamic = 'force-dynamic';

/** Launches one consent-gated reactivation batch for the selected imported audience. */
export const POST = withApi(async (request) => {
  const { ctx, actor } = await settingsScope(request.headers);
  const input = await parseJsonBody(request, reactivationAudienceSchema);
  const result = await launchReactivation(ctx, actor, input);
  return NextResponse.json({ ok: true, result }, { status: 201 });
});
