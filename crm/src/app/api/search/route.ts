import { NextResponse } from 'next/server';
import { contactsActorScope, searchContacts } from '@/server/contacts';
import { AppError } from '@/server/errors';
import { requireModule } from '@/server/modules';
import { getDb } from '@/server/db/client';
import { enforceSearchRateLimit } from '@/server/security/rate-limit';
import { withApi } from '@/server/security/with-api';

export const dynamic = 'force-dynamic';

export const GET = withApi(async (request) => {
  const scope = await contactsActorScope(request.headers);
  if (!scope) throw new AppError('FORBIDDEN');
  await requireModule(scope.ctx, 'crm', { level: 'full' });
  await enforceSearchRateLimit(getDb(), scope.actor.userId);
  const q = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) return NextResponse.json({ ok: true, results: [] });
  const result = await searchContacts(scope.ctx, { q, perPage: 10 });
  return NextResponse.json({
    ok: true,
    results: result.rows.map((row) => ({
      id: row.id,
      name: [row.firstName, row.lastName].filter(Boolean).join(' ') || 'Unnamed contact',
      phone: row.primaryPhoneE164
    }))
  });
});
