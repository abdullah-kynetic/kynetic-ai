import { and, desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { getStorage, mintSignedUrl, tenantKey, type StorageAdapter } from '../adapters/storage';
import { MAX_DOCUMENT_BYTES, assertPdfUpload } from '../documents/pdf-file';
import type { Tx } from '../db/client';
import { tenantDocuments } from '../db/schema';
import { AppError, ValidationError } from '../errors';
import type { ServiceContext } from '../service-auth/authenticate';
import { parseInput, uuidSchema } from '../validation';

// Client documents for the service API (C10). Reuses the portal's PDF rule (name ends in .pdf, body
// starts with %PDF-, size cap) and its soft delete. The upload arrives as base64 JSON, so the size
// is checked before decoding and an oversize file is 413 PAYLOAD_TOO_LARGE. Only current documents
// (not deleted, not superseded) are listed or linked.

const currentDocument = and(
  isNull(tenantDocuments.deletedAt),
  isNull(tenantDocuments.supersededBy)
);

const uploadSchema = z.strictObject({
  title: z.string().trim().min(1).max(200),
  kind: z.enum(['agreement', 'proposal', 'invoice', 'report', 'other']),
  fileName: z.string().trim().min(1).max(255),
  contentBase64: z.string().min(1)
});

/** Base64 grows by 4/3, so a body this long cannot decode to a file under the cap. */
const MAX_BASE64_CHARS = Math.ceil((MAX_DOCUMENT_BYTES * 4) / 3) + 4;

/**
 * Reads the upload body. The generic reader caps bodies at 10 KB, too small for a PDF, so this one
 * allows the base64 size and turns anything bigger into 413 before parsing.
 */
export async function readDocumentBody(request: Request): Promise<{ raw: string; json: unknown }> {
  const raw = await request.text();
  if (raw.length > MAX_BASE64_CHARS + 1024) throw new AppError('PAYLOAD_TOO_LARGE');
  try {
    return { raw, json: JSON.parse(raw) };
  } catch {
    throw new ValidationError({ '': ['invalid_json'] });
  }
}

/** Runs inside withServiceTenant. */
export async function listServiceDocuments(tx: Tx, svc: ServiceContext) {
  return tx
    .select({
      id: tenantDocuments.id,
      kind: tenantDocuments.kind,
      title: tenantDocuments.title,
      createdAt: tenantDocuments.createdAt
    })
    .from(tenantDocuments)
    .where(and(eq(tenantDocuments.tenantId, svc.tenantId), currentDocument))
    .orderBy(desc(tenantDocuments.createdAt));
}

/** Runs inside withServiceTenant. A missing, deleted or superseded document is NOT_FOUND. */
export async function getServiceDocumentUrl(
  tx: Tx,
  svc: ServiceContext,
  rawId: string,
  storage: StorageAdapter = getStorage()
) {
  const id = parseInput(uuidSchema, rawId);
  const [row] = await tx
    .select({ fileKey: tenantDocuments.fileKey })
    .from(tenantDocuments)
    .where(
      and(eq(tenantDocuments.id, id), eq(tenantDocuments.tenantId, svc.tenantId), currentDocument)
    )
    .limit(1);
  if (!row) throw new AppError('NOT_FOUND');
  return { id, url: await mintSignedUrl(storage, svc.tenantId, row.fileKey) };
}

/** Runs inside withServiceTenant. Stores the file, then records it; a failed insert removes the file. */
export async function uploadServiceDocument(
  tx: Tx,
  svc: ServiceContext,
  body: Record<string, unknown>,
  storage: StorageAdapter = getStorage()
) {
  const parsed = uploadSchema.safeParse(body);
  if (!parsed.success) throw new ValidationError({ document: ['invalid'] });
  if (parsed.data.contentBase64.length > MAX_BASE64_CHARS) {
    throw new AppError('PAYLOAD_TOO_LARGE');
  }
  const bytes = new Uint8Array(Buffer.from(parsed.data.contentBase64, 'base64'));
  if (bytes.byteLength > MAX_DOCUMENT_BYTES) throw new AppError('PAYLOAD_TOO_LARGE');
  assertPdfUpload(parsed.data.fileName, bytes);

  const id = crypto.randomUUID();
  const key = tenantKey(svc.tenantId, 'documents', id, 'document.pdf');
  await storage.put(key, bytes, { contentType: 'application/pdf' });
  try {
    const [row] = await tx
      .insert(tenantDocuments)
      .values({
        id,
        tenantId: svc.tenantId,
        kind: parsed.data.kind,
        title: parsed.data.title,
        fileKey: key,
        uploadedBy: null
      })
      .returning();
    return { id: row!.id, kind: row!.kind, title: row!.title, createdAt: row!.createdAt };
  } catch (error) {
    await storage.remove(key);
    throw error;
  }
}

/** Runs inside withServiceTenant. Soft delete, like the portal. */
export async function deleteServiceDocument(tx: Tx, svc: ServiceContext, rawId: string) {
  const id = parseInput(uuidSchema, rawId);
  const [row] = await tx
    .select({ id: tenantDocuments.id, title: tenantDocuments.title })
    .from(tenantDocuments)
    .where(
      and(eq(tenantDocuments.id, id), eq(tenantDocuments.tenantId, svc.tenantId), currentDocument)
    )
    .for('update')
    .limit(1);
  if (!row) throw new AppError('NOT_FOUND');
  const deletedAt = new Date().toISOString();
  await tx.update(tenantDocuments).set({ deletedAt }).where(eq(tenantDocuments.id, id));
  return { id, deleted: true as const };
}
