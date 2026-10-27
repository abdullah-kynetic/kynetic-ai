import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withApi } from '@/server/security/with-api';
import { parseJsonBody } from '@/server/validation';
import { removeStaff, setStaffPermissions, settingsScope } from '@/server/settings';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ userId: string }> };

export const PATCH = withApi<Ctx>(async (request, { params }) => {
  const { ctx, actor } = await settingsScope(request.headers);
  const { userId } = await params;
  await setStaffPermissions(ctx, actor, userId, await parseJsonBody(request, z.unknown()));
  return NextResponse.json({ ok: true });
});

export const DELETE = withApi<Ctx>(async (request, { params }) => {
  const { ctx, actor } = await settingsScope(request.headers);
  const { userId } = await params;
  await removeStaff(ctx, actor, userId);
  return NextResponse.json({ ok: true });
});
