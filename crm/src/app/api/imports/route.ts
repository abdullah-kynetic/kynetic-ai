import { NextResponse } from 'next/server';
import { withApi } from '@/server/security/with-api';
import { classifyImportUpload, createImportBatch, IMPORT_MAX_BYTES } from '@/server/imports';
import { loadImportTable } from '@/server/imports/table';
import { AppError } from '@/server/errors';
import { decideAdminAccess } from '@/server/admin';
import { resolveActor } from '@/server/auth';
import { isViewingAs } from '@/app/admin/view-as-guard';
import { getDb } from '@/server/db/client';
import { enforceExportImportRateLimit } from '@/server/security/rate-limit';

export const dynamic = 'force-dynamic';

export const POST = withApi(async (request) => {
  const access = await decideAdminAccess(request.headers);
  if (access.kind !== 'ok' || access.role !== 'admin' || (await isViewingAs(access.user)))
    throw new AppError('FORBIDDEN');
  const form = await request.formData();
  const tenantId = String(form.get('tenantId') ?? '');
  const actor = await resolveActor(access.user);
  const ctx = { tenantId, userId: access.user.id, role: 'admin' as const };
  const file = form.get('file');
  if (!(file instanceof File))
    throw new AppError('VALIDATION_FAILED', { message: 'A file is required.' });
  if (file.size > IMPORT_MAX_BYTES)
    throw new AppError('VALIDATION_FAILED', { message: 'File exceeds the 10 MB limit.' });
  const rawEntity = String(form.get('entity') ?? 'contact');
  if (!['contact', 'company', 'deal', 'note'].includes(rawEntity))
    throw new AppError('VALIDATION_FAILED', { message: 'Unsupported import record type.' });
  await enforceExportImportRateLimit(getDb(), tenantId);
  const uploadKind = classifyImportUpload(file.name);
  if (uploadKind === 'excel')
    throw new AppError('VALIDATION_FAILED', {
      message: 'Upload a CSV or .xlsx file. Macro-enabled and legacy Excel files are not accepted.'
    });
  if (uploadKind !== 'csv' && uploadKind !== 'xlsx')
    throw new AppError('VALIDATION_FAILED', { message: 'Upload a CSV or .xlsx file.' });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const batch = await createImportBatch(
    ctx,
    actor,
    {
      fileName: file.name,
      fileType: uploadKind,
      entity: rawEntity as 'contact' | 'company' | 'deal' | 'note',
      importedSource: String(form.get('importedSource') ?? ''),
      sourceLabel: String(form.get('sourceLabel') ?? '') || undefined,
      mapping: {},
      duplicateRule: form.get('duplicateRule') === 'fill_empty' ? 'fill_empty' : 'skip'
    },
    bytes
  );
  const headers = (await loadImportTable(uploadKind, bytes)).rows[0] ?? [];
  return NextResponse.json({ ok: true, batch, headers }, { status: 201 });
});
