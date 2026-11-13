import { NextResponse } from 'next/server';
import { AppError } from '@/server/errors';
import { getDb } from '@/server/db/client';
import { classifyImportUpload, createImportBatch, IMPORT_MAX_BYTES } from '@/server/imports';
import { importSelfScope } from '@/server/imports/scope';
import { loadImportTable } from '@/server/imports/table';
import { enforceExportImportRateLimit } from '@/server/security/rate-limit';
import { withApi } from '@/server/security/with-api';

export const dynamic = 'force-dynamic';

/** Source label stored on every contact a client imports (P1-5). */
const CLIENT_IMPORT_SOURCE = 'client_upload';

/**
 * A client uploads their own lead list (CSV or .xlsx). The tenant comes from the signed-in
 * membership, never from the form, and only contacts can be imported this way. The same intake
 * rules as the staff import apply: size, type, encoding and the row limit.
 */
export const POST = withApi(async (request) => {
  const scope = await importSelfScope(request.headers);
  if (!scope) throw new AppError('FORBIDDEN');
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File))
    throw new AppError('VALIDATION_FAILED', { message: 'A file is required.' });
  if (file.size > IMPORT_MAX_BYTES)
    throw new AppError('VALIDATION_FAILED', { message: 'File exceeds the 10 MB limit.' });
  await enforceExportImportRateLimit(getDb(), scope.ctx.tenantId);
  const uploadKind = classifyImportUpload(file.name);
  if (uploadKind !== 'csv' && uploadKind !== 'xlsx')
    throw new AppError('VALIDATION_FAILED', {
      message: 'Upload a CSV or .xlsx file. Macro-enabled and legacy Excel files are not accepted.'
    });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const batch = await createImportBatch(
    scope.ctx,
    scope.actor,
    {
      fileName: file.name,
      fileType: uploadKind,
      entity: 'contact',
      importedSource: CLIENT_IMPORT_SOURCE,
      mapping: {},
      duplicateRule: form.get('duplicateRule') === 'fill_empty' ? 'fill_empty' : 'skip'
    },
    bytes
  );
  const headers = (await loadImportTable(uploadKind, bytes)).rows[0] ?? [];
  return NextResponse.json({ ok: true, batch, headers }, { status: 201 });
});
