import { createHash } from 'node:crypto';
import { z } from 'zod';
import { audit } from '../audit';
import type { Db } from '../db/client';
import { importBatches } from '../db/schema';
import { AppError, ValidationError } from '../errors';
import { getStorage, tenantKey } from '../adapters/storage';
import { withTenant, type TenantContextInput } from '../tenancy';
import { can, type Actor } from '../auth/permissions';
import { IMPORT_MAX_ROWS, parseImportCsv } from './csv';
import { requireModule } from '../modules';

export const IMPORT_MAX_BYTES = 10 * 1024 * 1024;
export { IMPORT_MAX_ROWS };

/** Excel workbooks are not accepted until a safe parser is a dependency. CSV is the upload path. */
export function classifyImportUpload(fileName: string): 'csv' | 'excel' | 'unsupported' {
  const lower = fileName.trim().toLowerCase();
  if (lower.endsWith('.xlsx') || lower.endsWith('.xlsm') || lower.endsWith('.xls')) return 'excel';
  if (lower.endsWith('.csv')) return 'csv';
  return 'unsupported';
}
const inputSchema = z.strictObject({
  fileName: z.string().trim().min(1).max(255),
  fileType: z.enum(['csv', 'xlsx']),
  entity: z.enum(['contact', 'company', 'deal', 'note']).default('contact'),
  importedSource: z.string().trim().min(1).max(100),
  sourceLabel: z.string().trim().max(200).optional(),
  mapping: z.record(z.string(), z.string()).default({}),
  duplicateRule: z.enum(['skip', 'fill_empty']).default('skip')
});
export type ImportIntakeInput = z.input<typeof inputSchema>;

export async function createImportBatch(
  ctx: TenantContextInput,
  actor: Actor,
  input: ImportIntakeInput,
  file: Uint8Array,
  opts: { db?: Db } = {}
) {
  if (!can(actor, 'import.onboarding', ctx.tenantId)) throw new AppError('FORBIDDEN');
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError({ import: ['invalid'] });
  if (file.byteLength > IMPORT_MAX_BYTES) throw new ValidationError({ file: ['too_large'] });
  const uploadKind = classifyImportUpload(parsed.data.fileName);
  if (uploadKind === 'excel' || parsed.data.fileType === 'xlsx')
    throw new ValidationError({ file: ['xlsx_not_available'] });
  if (uploadKind !== 'csv') throw new ValidationError({ file: ['unsupported_type'] });
  if (file.length === 0 || file.includes(0)) throw new ValidationError({ file: ['invalid_csv'] });
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(file);
  } catch {
    throw new ValidationError({ file: ['invalid_csv_encoding'] });
  }
  try {
    parseImportCsv(file);
  } catch {
    throw new ValidationError({ file: ['invalid_csv_or_row_limit'] });
  }
  const lower = parsed.data.fileName.toLowerCase();
  if (!lower.endsWith('.csv')) throw new ValidationError({ file: ['unsupported_type'] });
  return withTenant(
    ctx,
    async (tx) => {
      await requireModule(ctx, 'platform', { tx });
      const id = crypto.randomUUID();
      const key = tenantKey(ctx.tenantId, 'imports', id, parsed.data.fileName);
      await getStorage().put(key, file, {
        contentType:
          parsed.data.fileType === 'csv'
            ? 'text/csv'
            : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const [row] = await tx
        .insert(importBatches)
        .values({
          id,
          tenantId: ctx.tenantId,
          entity: parsed.data.entity,
          importedSource: parsed.data.importedSource,
          sourceLabel: parsed.data.sourceLabel ?? null,
          fileName: parsed.data.fileName,
          fileType: parsed.data.fileType,
          fileKey: key,
          fileSha256: createHash('sha256').update(file).digest('hex'),
          fileSizeBytes: file.byteLength,
          mapping: parsed.data.mapping,
          duplicateRule: parsed.data.duplicateRule,
          createdBy: actor.userId
        })
        .returning();
      await audit(tx, {
        action: 'import.create',
        entity: 'import_batch',
        entityId: row.id,
        after: {
          fileType: row.fileType,
          fileSizeBytes: row.fileSizeBytes,
          importedSource: row.importedSource
        }
      });
      return row;
    },
    opts
  );
}
