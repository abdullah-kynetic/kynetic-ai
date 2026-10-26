import { NextResponse } from 'next/server';
import { pingDatabase } from '@/server/db/ping';
import { getEnv } from '@/server/env';

export const dynamic = 'force-dynamic';

// Queue check is added with pg-boss in M0-15.
export async function GET() {
  const db = await pingDatabase(getEnv().DATABASE_URL);
  return NextResponse.json(
    {
      status: db ? 'ok' : 'degraded',
      checks: { database: db ? 'ok' : 'fail', queue: 'not_configured' }
    },
    { status: db ? 200 : 503, headers: { 'Cache-Control': 'no-store' } }
  );
}
