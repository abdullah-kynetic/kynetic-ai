import { NextResponse } from 'next/server';
import { contactsActorScope } from '@/server/contacts';
import { listTenantDocuments } from '@/server/documents';
import { AppError } from '@/server/errors';
import { withApi } from '@/server/security/with-api';

export const dynamic = 'force-dynamic';

export const GET = withApi(async (request) => {
  const scope = await contactsActorScope(request.headers);
  if (!scope) throw new AppError('FORBIDDEN');
  const documents = await listTenantDocuments(scope.ctx, scope.actor);
  return NextResponse.json({ ok: true, documents });
});
