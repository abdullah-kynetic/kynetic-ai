import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { authorize, type Actor } from '../auth';
import { getStorage, mintSignedUrl, tenantKey, type StorageAdapter } from '../adapters/storage';
import type { Db } from '../db/client';
import { tenantDocuments } from '../db/schema';
import { AppError, ValidationError } from '../errors';
import { audit } from '../audit';
import { withTenant, type TenantContextInput } from '../tenancy';
import { parseInput } from '../validation';

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const inputSchema = z.strictObject({
  title: z.string().trim().min(1).max(200),
  kind: z.enum(['agreement', 'proposal', 'invoice', 'report', 'other']),
  fileName: z.string().trim().min(1).max(255)
});
type Options = { db?: Db; storage?: StorageAdapter };

export async function uploadTenantDocument(
  ctx: TenantContextInput,
  actor: Actor,
  input: unknown,
  body: Uint8Array,
  opts: Options = {}
) {
  authorize(actor, 'import.onboarding', ctx.tenantId);
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError({ document: ['invalid'] });
  if (body.byteLength < 8 || body.byteLength > MAX_DOCUMENT_BYTES)
    throw new ValidationError({ file: ['invalid_size'] });
  if (!parsed.data.fileName.toLowerCase().endsWith('.pdf') || new TextDecoder().decode(body.slice(0, 5)) !== '%PDF-')
    throw new ValidationError({ file: ['pdf_required'] });

  const storage = opts.storage ?? getStorage();
  return withTenant(ctx, async (tx) => {
    const id = crypto.randomUUID();
    const key = tenantKey(ctx.tenantId, 'documents', id, 'document.pdf');
    await storage.put(key, body, { contentType: 'application/pdf' });
    try {
      const [row] = await tx.insert(tenantDocuments).values({
        id,
        tenantId: ctx.tenantId,
        kind: parsed.data.kind,
        title: parsed.data.title,
        fileKey: key,
        uploadedBy: actor.userId
      }).returning();
      await audit(tx, {
        action: 'document.upload',
        entity: 'tenant_document',
        entityId: id,
        after: { kind: row!.kind, title: row!.title, fileSizeBytes: body.byteLength }
      });
      return { id: row!.id, kind: row!.kind, title: row!.title, createdAt: row!.createdAt };
    } catch (error) {
      await storage.remove(key);
      throw error;
    }
  }, { db: opts.db });
}

export async function listTenantDocuments(ctx: TenantContextInput, actor: Actor, opts: Options = {}) {
  authorize(actor, 'tenant_data.read', ctx.tenantId);
  return withTenant(ctx, (tx) => tx.select({
    id: tenantDocuments.id,
    kind: tenantDocuments.kind,
    title: tenantDocuments.title,
    createdAt: tenantDocuments.createdAt
  }).from(tenantDocuments).where(eq(tenantDocuments.tenantId, ctx.tenantId)).orderBy(desc(tenantDocuments.createdAt)), { db: opts.db });
}

export async function getTenantDocumentUrl(
  ctx: TenantContextInput,
  actor: Actor,
  documentId: string,
  opts: Options = {}
) {
  authorize(actor, 'tenant_data.read', ctx.tenantId);
  parseInput(z.uuid(), documentId);
  const key = await withTenant(ctx, async (tx) => {
    const [row] = await tx.select({ fileKey: tenantDocuments.fileKey }).from(tenantDocuments)
      .where(and(eq(tenantDocuments.id, documentId), eq(tenantDocuments.tenantId, ctx.tenantId))).limit(1);
    return row?.fileKey ?? null;
  }, { db: opts.db });
  if (!key) throw new AppError('NOT_FOUND');
  return { url: await mintSignedUrl(opts.storage ?? getStorage(), ctx.tenantId, key) };
}
