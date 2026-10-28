import { NextResponse } from 'next/server';
import { contactsScope, searchContacts } from '@/server/contacts';
import { AppError } from '@/server/errors';
import { requireModule } from '@/server/modules';
import { withApi } from '@/server/security/with-api';

export const dynamic = 'force-dynamic';

export const GET = withApi(async (request) => {
  const ctx = await contactsScope(request.headers);
  if (!ctx) throw new AppError('FORBIDDEN');
  await requireModule(ctx, 'crm', { level: 'full' });
  const q = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) return NextResponse.json({ ok: true, results: [] });
  const result = await searchContacts(ctx, { q, perPage: 10 });
  return NextResponse.json({
    ok: true,
    results: result.rows.map((row) => ({
      id: row.id,
      name: [row.firstName, row.lastName].filter(Boolean).join(' ') || 'Unnamed contact',
      phone: row.primaryPhoneE164
    }))
  });
});
