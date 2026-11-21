import { NextResponse } from 'next/server';
import { getContactDetail } from '@/server/contacts';
import {
  auditService,
  idempotentResponse,
  runIdempotent,
  withServiceAuth,
  withServiceTenant
} from '@/server/service-auth';
import { errorResponse } from '@/server/errors';
import { ModuleDisabledError, moduleDisabledResponse } from '@/server/modules';
import { readJsonBody, splitContactBody, updateServiceContact } from '@/server/service-api';
import { parseInput, uuidSchema } from '@/server/validation';

export const dynamic = 'force-dynamic';

export const GET = withServiceAuth(
  async (_request, svc, context: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await context.params;
      const detail = await withServiceTenant(svc, async (tx) => {
        const result = await getContactDetail({ tenantId: svc.tenantId, role: 'system' }, id, {
          tx
        });
        await auditService(tx, svc, {
          action: 'service.read',
          entity: 'contact',
          entityId: id,
          after: { route: 'GET /api/service/contacts/{id}' }
        });
        return result;
      });
      return NextResponse.json({ ok: true, contact: detail });
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'contacts:read' }
);

// Edits the fields sent (names, companyId, phones, emails, address, timezone, source, status, tags,
// ownerId, custom). Fields left out keep their values. A duplicate is a 409 unless acknowledgeDuplicates
// is set. The audit row names the changed fields, not their values. Requires an Idempotency-Key header.
export const PATCH = withServiceAuth(
  async (request, svc, context: { params: Promise<{ id: string }> }) => {
    try {
      const id = parseInput(uuidSchema, (await context.params).id);
      const { raw, json } = await readJsonBody(request);
      const { body, acknowledgeDuplicates } = splitContactBody(json);
      const result = await runIdempotent(svc, request, raw, async (tx) => {
        const { data, fields } = await updateServiceContact(
          tx,
          svc,
          id,
          body,
          acknowledgeDuplicates
        );
        await auditService(tx, svc, {
          action: 'service.contact_update',
          entity: 'contact',
          entityId: id,
          after: { route: 'PATCH /api/service/contacts/{id}', fields }
        });
        return { status: 200, body: { ok: true, data } };
      });
      return idempotentResponse(result);
    } catch (error) {
      if (error instanceof ModuleDisabledError) return moduleDisabledResponse(error);
      return errorResponse(error);
    }
  },
  { requiredScope: 'contacts:write' }
);
