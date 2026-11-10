import { NextResponse } from 'next/server';
import { decideAdminAccess, listUsageMonth } from '@/server/admin';
import { usageCsv } from '@/server/usage';
import { errorResponse } from '@/server/errors';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const access = await decideAdminAccess(new Headers(request.headers));
    if (access.kind !== 'ok') return new NextResponse(null, { status: 403 });
    const month = new URL(request.url).searchParams.get('month') ?? undefined;
    const { month: label, rows } = await listUsageMonth(
      { userId: access.user.id, role: access.role },
      month
    );
    return new NextResponse(usageCsv(rows), {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="usage-${label}.csv"`,
        'cache-control': 'private, no-store'
      }
    });
  } catch (error) {
    return errorResponse(error);
  }
}
