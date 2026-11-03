import { NextResponse } from 'next/server';
import { contactsActorScope } from '@/server/contacts';
import { getTenantDocumentUrl } from '@/server/documents';
import { AppError } from '@/server/errors';
import { withApi } from '@/server/security/with-api';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  async (request, { params }: { params: Promise<{ documentId: string }> }) => {
    const scope = await contactsActorScope(request.headers);
    if (!scope) throw new AppError('FORBIDDEN');
    const { documentId } = await params;
    const { url } = await getTenantDocumentUrl(scope.ctx, scope.actor, documentId);
    return NextResponse.redirect(url, { status: 302 });
  }
);
