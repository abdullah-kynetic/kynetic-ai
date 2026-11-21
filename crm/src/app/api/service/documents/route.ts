import { errorResponse } from '@/server/errors';
import {
  listServiceDocuments,
  readDocumentBody,
  uploadServiceDocument
} from '@/server/service-api';
import { idempotentResponse, runIdempotent } from '@/server/service-auth';
import { ModuleDisabledError, moduleDisabledResponse } from '@/server/modules';
import { auditService, withServiceAuth, withServiceTenant } from '@/server/service-auth';

export const dynamic = 'force-dynamic';

// Current client documents, newest first. Each read writes a `service.read` audit row.
export const GET = withServiceAuth(
  async (_request, svc) => {
    try {
      const data = await withServiceTenant(svc, async (tx) => {
        const rows = await listServiceDocuments(tx, svc);
        await auditService(tx, svc, {
          action: 'service.read',
          entity: 'document',
          after: { route: 'GET /api/service/documents' }
        });
        return rows;
      });
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      if (error instanceof ModuleDisabledError) return moduleDisabledResponse(error);
      return errorResponse(error);
    }
  },
  { requiredScope: 'documents:read' }
);

// Uploads a PDF as base64 JSON. Requires an Idempotency-Key header. Oversize is 413.
export const POST = withServiceAuth(
  async (request, svc) => {
    try {
      const { raw, json } = await readDocumentBody(request);
      const result = await runIdempotent(svc, request, raw, async (tx) => {
        const data = await uploadServiceDocument(tx, svc, json as Record<string, unknown>);
        await auditService(tx, svc, {
          action: 'service.document_upload',
          entity: 'document',
          entityId: data.id,
          after: { route: 'POST /api/service/documents', kind: data.kind }
        });
        return { status: 201, body: { ok: true, data } };
      });
      return idempotentResponse(result);
    } catch (error) {
      if (error instanceof ModuleDisabledError) return moduleDisabledResponse(error);
      return errorResponse(error);
    }
  },
  { requiredScope: 'documents:write' }
);
