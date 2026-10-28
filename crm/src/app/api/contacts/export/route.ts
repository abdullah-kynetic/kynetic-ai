import { NextResponse } from 'next/server';
import { contactsActorScope, exportContactsCsv, searchContactsSchema } from '@/server/contacts';
import { AppError } from '@/server/errors';
import { withApi } from '@/server/security/with-api';

export const dynamic = 'force-dynamic';

export const GET = withApi(async (request) => {
  const scope = await contactsActorScope(request.headers);
  if (!scope) throw new AppError('FORBIDDEN');
  const params = new URL(request.url).searchParams;
  const customRaw = params.get('custom');
  let custom: Record<string, unknown> | undefined;
  if (customRaw) {
    try {
      custom = JSON.parse(customRaw) as Record<string, unknown>;
    } catch {
      throw new AppError('VALIDATION_FAILED', { message: 'Invalid custom field filters.' });
    }
  }
  const filters = searchContactsSchema.parse({
    q: params.get('q') ?? undefined,
    statuses: params.getAll('status'),
    sources: params.getAll('source'),
    tags: params.getAll('tag'),
    owners: params.getAll('owner'),
    createdFrom: params.get('createdFrom') ?? undefined,
    createdTo: params.get('createdTo') ?? undefined,
    custom
  });
  const csv = await exportContactsCsv(scope.ctx, scope.actor, filters);
  return new NextResponse(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="contacts.csv"',
      'cache-control': 'private, no-store'
    }
  });
});
