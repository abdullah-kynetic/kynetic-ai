import { errorResponse } from '@/server/errors';
import { listServiceBackups, runServiceBackup } from '@/server/service-api';
import { withPlatformAuth } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

// Backups list. Restore and decrypt are not exposed.
export const GET = withPlatformAuth(
  async (_request, plat) => {
    try {
      const data = await listServiceBackups(plat);
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'settings:read' }
);

// Queues one manual backup now.
export const POST = withPlatformAuth(
  async (_request, plat) => {
    try {
      const data = await runServiceBackup(plat);
      return Response.json(
        { ok: true, data },
        { status: 202, headers: { 'Cache-Control': 'no-store' } }
      );
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'settings:write' }
);
