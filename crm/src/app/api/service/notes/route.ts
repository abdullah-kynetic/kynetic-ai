import { errorResponse, ValidationError } from '@/server/errors';
import { moduleDisabledResponse, ModuleDisabledError } from '@/server/modules';
import { recordServiceNote, serviceNoteSchema } from '@/server/service-api';
import {
  auditService,
  idempotentResponse,
  runIdempotent,
  withServiceAuth
} from '@/server/service-auth';
import { parseInput } from '@/server/validation';

export const dynamic = 'force-dynamic';

// Adds one plain-text note to a contact. The note text is untrusted data. Nothing is sent, mentioned,
// pinned or triggered. Requires an Idempotency-Key header: the same key and body replays the first response.
export const POST = withServiceAuth(
  async (request, svc) => {
    try {
      const raw = await request.text();
      if (raw.length > 20_000) throw new ValidationError({ '': ['too_big'] });
      let json: unknown;
      try {
        json = JSON.parse(raw);
      } catch {
        throw new ValidationError({ '': ['invalid_json'] });
      }
      const input = parseInput(serviceNoteSchema, json);
      const result = await runIdempotent(svc, request, raw, async (tx) => {
        const data = await recordServiceNote(tx, svc, input);
        await auditService(tx, svc, {
          action: 'service.note_create',
          entity: 'note',
          entityId: data.noteId,
          after: { route: 'POST /api/service/notes', contactId: input.contactId }
        });
        return { status: 201, body: { ok: true, data } };
      });
      return idempotentResponse(result);
    } catch (error) {
      if (error instanceof ModuleDisabledError) return moduleDisabledResponse(error);
      return errorResponse(error);
    }
  },
  { requiredScope: 'notes:write' }
);
