import { createContactSchema } from '../contacts/schemas';
import { normalizePhone } from '../contacts/phone';
import { createHash } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { audit } from '../audit';
import { can, type Actor } from '../auth/permissions';
import { getStorage } from '../adapters/storage';
import type { Db } from '../db/client';
import { contacts, importBatches } from '../db/schema';
import { AppError, ValidationError } from '../errors';
import { withTenant, type TenantContextInput } from '../tenancy';
import { loadImportTable, type ImportTable } from './table';
import { requireModule } from '../modules';

export type ContactMapping = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  externalId?: string;
  consentDate?: string;
  consentChannel?: string;
  consentEvidence?: string;
};
export type ImportIssue = { row: number; reason: string };
export type ContactDryRun = {
  total: number;
  ok: number;
  failed: number;
  duplicates: number;
  issues: ImportIssue[];
};

export const mappingSchema = z.strictObject({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  externalId: z.string().optional(),
  consentDate: z.string().optional(),
  consentChannel: z.string().optional(),
  consentEvidence: z.string().optional()
});

export async function dryRunContactBatch(
  ctx: TenantContextInput,
  actor: Actor,
  batchId: string,
  rawMapping: unknown,
  opts: { db?: Db } = {}
): Promise<ContactDryRun> {
  if (!can(actor, 'import.onboarding', ctx.tenantId)) throw new AppError('FORBIDDEN');
  await requireModule(ctx, 'platform', opts);
  const mapping = mappingSchema.safeParse(rawMapping);
  if (!mapping.success || !z.uuid().safeParse(batchId).success)
    throw new ValidationError({ mapping: ['invalid'] });
  return withTenant(
    ctx,
    async (tx) => {
      await requireModule(ctx, 'platform', { tx });
      const [batch] = await tx
        .select()
        .from(importBatches)
        .where(eq(importBatches.id, batchId))
        .limit(1);
      if (!batch) throw new AppError('NOT_FOUND');
      if (
        !batch.fileKey ||
        (batch.fileType !== 'csv' && batch.fileType !== 'xlsx') ||
        !['uploaded', 'mapped', 'dry_run_ok', 'dry_run_failed'].includes(batch.status)
      )
        throw new AppError('CONFLICT');
      const file = await getStorage().get(batch.fileKey);
      if (!file || createHash('sha256').update(file.body).digest('hex') !== batch.fileSha256)
        throw new AppError('CONFLICT', { message: 'Import file is missing or has changed.' });
      const existing = await tx
        .select({ phones: contacts.phones, emails: contacts.emails })
        .from(contacts)
        .where(and(isNull(contacts.deletedAt), isNull(contacts.mergedIntoId)));
      let report: ContactDryRun;
      try {
        const table = await loadImportTable(batch.fileType, file.body);
        report = previewContacts(
          table.rows,
          mapping.data,
          {
            phones: existing.flatMap((c) => c.phones),
            emails: existing.flatMap((c) => c.emails)
          },
          table.blocked
        );
      } catch {
        throw new ValidationError({ mapping: ['invalid_column_or_file'] });
      }
      await tx
        .update(importBatches)
        .set({
          mapping: mapping.data,
          status: report.failed ? 'dry_run_failed' : 'dry_run_ok',
          rowsTotal: report.total,
          rowsOk: report.ok,
          rowsFailed: report.failed,
          rowsDuplicate: report.duplicates,
          report
        })
        .where(eq(importBatches.id, batch.id));
      await audit(tx, {
        action: 'import.dry_run',
        entity: 'import_batch',
        entityId: batch.id,
        after: {
          total: report.total,
          ok: report.ok,
          failed: report.failed,
          duplicates: report.duplicates
        }
      });
      return report;
    },
    opts
  );
}

/** Preview an import without writing any contact data. Row numbers include the header. */
export function previewContacts(
  rows: string[][],
  mapping: ContactMapping,
  existing: { phones: readonly string[]; emails: readonly string[] } = { phones: [], emails: [] },
  blocked: ImportTable['blocked'] = new Map()
): ContactDryRun {
  const [headers = [], ...data] = rows;
  const index = (name?: string) => (name === undefined ? -1 : headers.indexOf(name));
  const columns = {
    firstName: index(mapping.firstName),
    lastName: index(mapping.lastName),
    phone: index(mapping.phone),
    email: index(mapping.email)
  };
  if (Object.values(mapping).some((name) => !headers.includes(name)))
    throw new Error('unknown_column');
  const phones = new Set(
    existing.phones.map((p) => normalizePhone(p)).filter((p): p is string => p !== null)
  );
  const emails = new Set(existing.emails.map((e) => e.trim().toLowerCase()));
  const issues: ImportIssue[] = [];
  let ok = 0,
    failed = 0,
    duplicates = 0;
  data.forEach((row, i) => {
    const formula = blocked.get(i + 2);
    if (formula) {
      failed++;
      if (issues.length < 200) issues.push({ row: i + 2, reason: formula });
      return;
    }
    const field = (n: number) => (n < 0 ? '' : (row[n] ?? '').trim());
    const phone = field(columns.phone);
    const email = field(columns.email).toLowerCase();
    const result = createContactSchema.safeParse({
      firstName: field(columns.firstName),
      lastName: field(columns.lastName) || null,
      phones: phone ? [phone] : [],
      emails: email ? [email] : []
    });
    if (!result.success) {
      failed++;
      if (issues.length < 200)
        issues.push({
          row: i + 2,
          reason: result.error.issues
            .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .join('; ')
        });
      return;
    }
    const normalized = result.data.phones[0];
    if ((normalized && phones.has(normalized)) || (email && emails.has(email))) {
      duplicates++;
      return;
    }
    if (normalized) phones.add(normalized);
    if (email) emails.add(email);
    ok++;
  });
  return { total: data.length, ok, failed, duplicates, issues };
}
