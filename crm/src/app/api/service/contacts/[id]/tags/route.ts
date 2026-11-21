import { errorResponse } from '@/server/errors';
import { ModuleDisabledError, moduleDisabledResponse } from '@/server/modules';
import {
  addServiceContactTags,
  contactTagsBodySchema,
  readJsonBody,
  removeServiceContactTags
} from '@/server/service-api';
import {
  auditService,
  idempotentResponse,
  runIdempotent,
  withServiceAuth
} from '@/server/service-auth';
import type { ServiceContext } from '@/server/service-auth/authenticate';
import { parseInput, uuidSchema } from '@/server/validation';

export const dynamic = 'force-dynamic';

// Adds tags to one contact (POST) or removes them (DELETE). Body: { "tags": ["..."] }, 1 to 50 tags.
// Adding a tag that is already there changes nothing. Requires an Idempotency-Key header.
async function tagsWrite(
  request: Request,
  svc: ServiceContext,
  id: string,
  mode: 'add' | 'remove'
) {
  const parsedId = parseInput(uuidSchema, id);
  const { raw, json } = await readJsonBody(request);
  const { tags } = parseInput(contactTagsBodySchema, json);
  const result = await runIdempotent(svc, request, raw, async (tx) => {
    const data =
      mode === 'add'
        ? await addServiceContactTags(tx, svc, parsedId, tags)
        : await removeServiceContactTags(tx, svc, parsedId, tags);
    await auditService(tx, svc, {
      action: mode === 'add' ? 'service.contact_tags_add' : 'service.contact_tags_remove',
      entity: 'contact',
      entityId: parsedId,
      after: {
        route: `${mode === 'add' ? 'POST' : 'DELETE'} /api/service/contacts/{id}/tags`,
        count: tags.length
      }
    });
    return { status: 200, body: { ok: true, data } };
  });
  return idempotentResponse(result);
}

export const POST = withServiceAuth(
  async (request, svc, context: { params: Promise<{ id: string }> }) => {
    try {
      return await tagsWrite(request, svc, (await context.params).id, 'add');
    } catch (error) {
      if (error instanceof ModuleDisabledError) return moduleDisabledResponse(error);
      return errorResponse(error);
    }
  },
  { requiredScope: 'contacts:write' }
);

export const DELETE = withServiceAuth(
  async (request, svc, context: { params: Promise<{ id: string }> }) => {
    try {
      return await tagsWrite(request, svc, (await context.params).id, 'remove');
    } catch (error) {
      if (error instanceof ModuleDisabledError) return moduleDisabledResponse(error);
      return errorResponse(error);
    }
  },
  { requiredScope: 'contacts:write' }
);
