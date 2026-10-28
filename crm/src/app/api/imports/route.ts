import { NextResponse } from 'next/server';
import { settingsScope } from '@/server/settings';
import { withApi } from '@/server/security/with-api';
import { createImportBatch, IMPORT_MAX_BYTES } from '@/server/imports';
import { AppError } from '@/server/errors';

export const dynamic = 'force-dynamic';

export const POST = withApi(async (request) => {
  const { ctx, actor } = await settingsScope(request.headers);
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) throw new AppError('VALIDATION_FAILED', { message: 'A file is required.' });
  if (file.size > IMPORT_MAX_BYTES) throw new AppError('VALIDATION_FAILED', { message: 'File exceeds the 10 MB limit.' });
  const batch = await createImportBatch(ctx, actor, {
    fileName: file.name,
    fileType: file.name.toLowerCase().endsWith('.xlsx') ? 'xlsx' : 'csv',
    importedSource: String(form.get('importedSource') ?? ''),
    sourceLabel: String(form.get('sourceLabel') ?? '') || undefined,
    mapping: {},
    duplicateRule: 'skip'
  }, new Uint8Array(await file.arrayBuffer()));
  return NextResponse.json({ ok: true, batch }, { status: 201 });
});
