import { errorResponse } from '@/server/errors';
import { createServiceReferral, listServiceReferrals, readJsonBody } from '@/server/service-api';
import { idempotentResponse, runIdempotent } from '@/server/service-auth';
import { ModuleDisabledError, moduleDisabledResponse } from '@/server/modules';
import { auditService, withServiceAuth, withServiceTenant } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

// Referrals and their KPIs. Reads use referrals:write, the only referral scope the spec names.
export const GET = withServiceAuth(
  async (request, svc) => {
    try {
      const status = new URL(request.url).searchParams.get('status') ?? undefined;
      const data = await withServiceTenant(svc, async (tx) => {
        const result = await listServiceReferrals(tx, svc, status);
        await auditService(tx, svc, {
          action: 'service.read',
          entity: 'referrals',
          after: { route: 'GET /api/service/referrals', returned: result.rows.length }
        });
        return result;
      });
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      if (error instanceof ModuleDisabledError) return moduleDisabledResponse(error);
      return errorResponse(error);
    }
  },
  { requiredScope: 'referrals:write' }
);

// Creates one referral. Requires an Idempotency-Key header.
export const POST = withServiceAuth(
  async (request, svc) => {
    try {
      const { raw, json } = await readJsonBody(request);
      const result = await runIdempotent(svc, request, raw, async (tx) => {
        const data = await createServiceReferral(tx, svc, json as Record<string, unknown>);
        await auditService(tx, svc, {
          action: 'service.referral_create',
          entity: 'client_referral',
          entityId: data.id,
          after: { route: 'POST /api/service/referrals' }
        });
        return { status: 201, body: { ok: true, data } };
      });
      return idempotentResponse(result);
    } catch (error) {
      if (error instanceof ModuleDisabledError) return moduleDisabledResponse(error);
      return errorResponse(error);
    }
  },
  { requiredScope: 'referrals:write' }
);
