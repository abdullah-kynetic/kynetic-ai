import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withApi } from '@/server/security/with-api';
import { parseJsonBody } from '@/server/validation';
import { inviteStaff, revokeInvite, settingsScope } from '@/server/settings';

export const dynamic = 'force-dynamic';

/** The raw token is not returned: the invite email carries it (sent by the email adapter, M8a-02). */
export const POST = withApi(async (request) => {
  const { ctx, actor } = await settingsScope(request.headers);
  const { id, expiresAt } = await inviteStaff(
    ctx,
    actor,
    await parseJsonBody(request, z.unknown())
  );
  return NextResponse.json({ ok: true, id, expiresAt }, { status: 201 });
});

export const DELETE = withApi(async (request) => {
  const { ctx, actor } = await settingsScope(request.headers);
  const { id } = await parseJsonBody(request, z.object({ id: z.string() }).strict());
  await revokeInvite(ctx, actor, id);
  return NextResponse.json({ ok: true });
});
