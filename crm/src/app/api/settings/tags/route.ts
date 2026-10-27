import { NextResponse } from 'next/server';
import { stageScope } from '@/server/deals';
import { createTag, deleteTag, listTags, renameTag } from '@/server/settings';
import { withApi } from '@/server/security/with-api';
import { parseJsonBody } from '@/server/validation';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export const GET = withApi(async (request) => {
  const { ctx } = await stageScope(request.headers);
  return NextResponse.json({ ok: true, tags: await listTags(ctx) });
});

export const POST = withApi(async (request) => {
  const { ctx, actor } = await stageScope(request.headers);
  const body = await parseJsonBody(request, z.unknown());
  return NextResponse.json({ ok: true, tags: await createTag(ctx, actor, body as never) });
});

/** Body `{ from, to }`. Renaming onto an existing tag merges the two. */
export const PATCH = withApi(async (request) => {
  const { ctx, actor } = await stageScope(request.headers);
  const body = await parseJsonBody(request, z.unknown());
  return NextResponse.json({ ok: true, tags: await renameTag(ctx, actor, body as never) });
});

/** Body `{ name }`. Removes the tag from every contact. */
export const DELETE = withApi(async (request) => {
  const { ctx, actor } = await stageScope(request.headers);
  const body = await parseJsonBody(request, z.unknown());
  return NextResponse.json({ ok: true, tags: await deleteTag(ctx, actor, body as never) });
});
